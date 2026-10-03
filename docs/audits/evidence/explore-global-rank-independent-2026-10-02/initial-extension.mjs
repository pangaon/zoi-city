import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');

const migrationPath='supabase/migrations/20261002232848_explore_public_global_covering_rank_index.sql',migration=read(migrationPath);
const preflight=JSON.parse(read('docs/audits/evidence/discovery-media-readers-preflight-2026-10-02.json'));
const liveDiagnosis=JSON.parse(read('docs/audits/evidence/explore-global-parent-timeout-diagnosis-2026-10-02.json'));
const dir=mkdtempSync(join(tmpdir(),'zoi-explore-global-')),bin='/usr/lib/postgresql/16/bin',env={...process.env,PGHOST:dir,PGPORT:process.env.QA_EXPLORE_GLOBAL_PGPORT||'15715',PGDATABASE:'postgres'};
const q=s=>execFileSync(join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',s],{env,encoding:'utf8',maxBuffer:30*1024*1024,stdio:['pipe','pipe','pipe']}).trim();
const json=s=>JSON.parse(q(s)),lit=v=>v===null?'NULL':Array.isArray(v)?'ARRAY['+v.map(lit).join(',')+']::text[]':typeof v==='number'?String(v):"'"+v.replaceAll("'","''")+"'";
const functions=preflight.functions.filter(f=>f.signature.startsWith('explore_search'));
const rows=(a,array=false)=>json(`SELECT public.${array?'explore_search_types':'explore_search'}(${a.map(lit).join(',')})`);
const meta=()=>json(`SELECT jsonb_agg(jsonb_build_object('definition',pg_get_functiondef(p.oid),'owner',p.proowner::regrole::text,'acl',p.proacl::text,'config',p.proconfig,'stable',p.provolatile,'definer',p.prosecdef,'args',pg_get_function_arguments(p.oid),'returns',pg_get_function_result(p.oid)) ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('explore_search','explore_search_types')`);
const digest=()=>q("SELECT md5(string_agg(to_jsonb(l)::text,'' ORDER BY id)) FROM zoi.listings l");
const plan=()=>json('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+liveDiagnosis.query);
const flatten=p=>[p,...(p.Plans||[]).flatMap(flatten)];
const actualCalls={};const actualPlan=(array=false,offset=0)=>json(`EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) SELECT public.${array?'explore_search_types':'explore_search'}(NULL,NULL,NULL,NULL,24,${offset},NULL)`);
let started=false,passed=0;const pass=s=>{passed++;console.log('PASS '+s)};
const start=()=>{execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',`-k ${dir} -p ${env.PGPORT} -c listen_addresses='' -c shared_buffers=32MB -c max_parallel_workers_per_gather=0`,'-w','start'],{stdio:'ignore'});started=true;};
const restart=()=>{execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','fast','-w','stop'],{stdio:'ignore'});started=false;start();};
try{
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-A','trust','--locale=en_US.UTF-8','--encoding=UTF8'],{stdio:'ignore'});start();
 q(`CREATE ROLE postgres SUPERUSER;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA zoi;CREATE EXTENSION pg_trgm;
 CREATE TABLE zoi.categories(id bigint PRIMARY KEY,label_en text);
 CREATE TABLE zoi.listings(id uuid PRIMARY KEY,slug text,name text,description text,profile jsonb DEFAULT '{}'::jsonb,primary_category_id bigint,entity_type text,city text,country text,region text,region_native text,region_code text,verification_status text,trust_score numeric,rating numeric,photo_url text,owner_workspace_id uuid,claim_status text,publish_status text,moderation_status text,marketplace_status text,search_tsv tsvector,padding text);
 ALTER TABLE zoi.listings ALTER COLUMN padding SET STORAGE PLAIN;ALTER TABLE zoi.listings ALTER COLUMN profile SET STORAGE PLAIN;
 ALTER TABLE zoi.listings ENABLE ROW LEVEL SECURITY;ALTER TABLE zoi.categories ENABLE ROW LEVEL SECURITY;
 CREATE INDEX listings_public_discovery_counts_idx ON zoi.listings(country,region,city) INCLUDE(region_code,region_native) WHERE publish_status='published' AND moderation_status IN ('clean','cleared') AND coalesce(marketplace_status,'')<>'hidden';
 CREATE INDEX fixture_name ON zoi.listings USING gin(lower(name)gin_trgm_ops);CREATE INDEX fixture_fts ON zoi.listings USING gin(search_tsv);
 INSERT INTO zoi.categories VALUES(1,'Events'),(2,'Restaurants');`);
 const geo=read('supabase/migrations/0039_canonical_geography_contract.sql');q(geo.slice(geo.indexOf('create or replace function zoi.geo_country_canon'),geo.indexOf('$function$;',geo.indexOf('as $function$'))+12));
 for(const f of functions){q(f.definition);q(`ALTER FUNCTION public.${f.signature} OWNER TO postgres;GRANT EXECUTE ON FUNCTION public.${f.signature} TO anon,authenticated,service_role;REVOKE EXECUTE ON FUNCTION public.${f.signature} FROM PUBLIC;`);assert.equal(q(`SELECT md5(pg_get_functiondef('public.${f.signature}'::regprocedure))`),f.definition_md5);}
 assert.equal(q("SELECT md5(pg_get_functiondef('zoi.geo_country_canon(text)'::regprocedure))"),'a4610e0eee4af255cbc37d228b248be9');
 pass('exact installed scalar/types source and canonicalizer reconstructed, with owner/ACL');
 q(`INSERT INTO zoi.listings SELECT md5(i::text)::uuid,'fixture-'||i,
 CASE WHEN i%4=0 THEN '  Shared '||i/4||'  ' WHEN i%4=1 THEN 'shared '||(i-1)/4 ELSE 'Fixture '||lpad(i::text,6,'0') END,
 'Base description '||i,jsonb_build_object('fixture_payload',repeat(md5(i::text),64))||CASE WHEN i%5=0 THEN '{"hero_kind":"event_poster","hero_url":"https://fixture.example/poster.jpg","photo_url":"https://fixture.example/poster.jpg"}'::jsonb ELSE jsonb_build_object('_enrich',jsonb_build_object('description','Source description '||i,'photo_url','https://fixture.example/'||i||'.jpg')) END,
 CASE WHEN i%8=0 THEN NULL ELSE 1+i%2 END,(ARRAY['business','event','church','creator','travel_place','artist'])[1+i%6],
 CASE WHEN i%4 IN(0,1) THEN 'Toronto' ELSE (ARRAY['Toronto','Montréal','Αθήνα','',NULL,'Old Toronto'])[1+i%6] END,
 CASE WHEN i%4=0 THEN 'Canada' WHEN i%4=1 THEN 'ca' ELSE (ARRAY['Canada','ca','USA','United States','',NULL,'Ελλάδα'])[1+i%7] END,
 'Ontario','Οντάριο','CA-ON',CASE WHEN i%11=0 THEN NULL WHEN i%3=0 THEN 'verified' ELSE 'unverified' END,
 CASE WHEN i%13=0 THEN NULL ELSE (i%100)::numeric/100 END,CASE WHEN i%10=0 THEN NULL ELSE (i%50)::numeric/10 END,
 CASE WHEN i%8=0 THEN NULL ELSE 'https://fixture.example/'||i||'.jpg' END,CASE WHEN i%14=0 THEN md5('owner-'||i)::uuid END,
 CASE WHEN i%14=0 THEN 'claimed' ELSE 'unclaimed' END,CASE WHEN i%29=0 THEN 'draft' ELSE 'published' END,
 CASE WHEN i%31=0 THEN NULL WHEN i%17=0 THEN 'pending' WHEN i%5=0 THEN 'cleared' ELSE 'clean' END,
 CASE WHEN i%37=0 THEN 'hidden' WHEN i%41=0 THEN NULL ELSE '' END,to_tsvector('simple','Greek signature fixture spa'),repeat(md5(i::text),110) FROM generate_series(1,32000) i;
 INSERT INTO zoi.listings(id,slug,name,entity_type,city,country,profile,publish_status,moderation_status,marketplace_status,trust_score) VALUES
 ('90000000-0000-4000-8000-000000000001','sparse','Sparse cleared parish','church','Sparse','Canada','{}','published','cleared',NULL,NULL),
 ('90000000-0000-4000-8000-000000000002','hidden','Hidden perfect event','event','Sparse','Canada','{}','published','clean','hidden',100),
 ('90000000-0000-4000-8000-000000000003','pending','Pending perfect business','business','Sparse','Canada','{}','published','pending','',100);
 INSERT INTO zoi.listings(id,slug,name,entity_type,city,country,publish_status,moderation_status) SELECT md5('edge-'||i)::uuid,'edge-'||i,'Amara', 'business',c,'CY','published','clean' FROM unnest(ARRAY['Λεμεσός','ΛΕΜΕΣΌΣ','100% City','Under_score','Back\\slash','İstanbul','istanbul','Québec','QUÉBEC',' A town ','']) WITH ORDINALITY AS x(c,i);`);
 q('VACUUM (ANALYZE,PARALLEL 0) zoi.listings;');
 const corpus=digest(),beforeMeta=meta(),cases=[];
 for(const query of[null,'','SIGNAT','%','_', 'Amar'])for(const city of[null,'Toronto','Tor%','Sparse','ΛΕΜΕΣΌΣ','100\\% City','no-match'])cases.push([query,null,city,null,24,0,null]);
 for(const limit of[null,0,1,48,1000])cases.push([null,null,null,null,limit,2,null]);
 for(const offset of[null,-2,24,48,90000])cases.push([null,null,null,null,24,offset,null]);
 for(const type of['business','artist','creator','church'])cases.push([null,type,null,'ca',24,0,'CA-ON']);
 cases.push(['Amar',null,'Λεμεσός','cy',48,0,null],['spa',null,null,'Cy%',24,0,'Οντάριο']);
 const arrayCases=[[null,null,null,null,24,0,null],[null,[],null,null,24,0,null],[null,['artist','business'],null,null,24,0,null],['SIGNAT',['event','church'],'Tor%',null,48,24,null],['Amar',['business'],'ΛΕΜΕΣΌΣ','CY',24,0,null],[null,['church'],'Sparse','Canada',48,0,null]];
 const expected=cases.map(a=>rows(a)),arrayExpected=arrayCases.map(a=>rows(a,true));pass(cases.length+' scalar and '+arrayCases.length+' types populated/sparse/filter/pagination oracle snapshots');
 q(`GRANT EXECUTE ON FUNCTION public.${functions[0].signature} TO PUBLIC`);assert.throws(()=>q(migration),/explore_global_rank_prerequisite_changed/);q(`REVOKE EXECUTE ON FUNCTION public.${functions[0].signature} FROM PUBLIC`);
 q(functions[0].definition.replace("CASE l.entity_type WHEN 'creator' THEN 0", "CASE l.entity_type WHEN 'creator' THEN 9"));assert.throws(()=>q(migration),/explore_global_rank_prerequisite_changed/);q(functions[0].definition);
 q('CREATE INDEX listings_public_global_rank_idx ON zoi.listings(id)');assert.throws(()=>q(migration),/explore_global_rank_prerequisite_changed/);q('DROP INDEX zoi.listings_public_global_rank_idx');pass('function/ACL/index collision drift refuses');
 q('CREATE ROLE independent_owner');
 for(const f of functions){q(`ALTER FUNCTION public.${f.signature} OWNER TO independent_owner`);assert.throws(()=>q(migration),/explore_global_rank_prerequisite_changed/);assert.equal(q("SELECT to_regclass('zoi.listings_public_global_rank_idx') IS NULL"),'t');q(`ALTER FUNCTION public.${f.signature} OWNER TO postgres`);q(`GRANT EXECUTE ON FUNCTION public.${f.signature} TO anon,authenticated,service_role;REVOKE EXECUTE ON FUNCTION public.${f.signature} FROM PUBLIC`);assert.deepEqual(meta(),beforeMeta);pass('independent '+f.signature+' wrong actual owner refuses');}
 const originalCanon=q("SELECT pg_get_functiondef('zoi.geo_country_canon(text)'::regprocedure)");
 q("CREATE OR REPLACE FUNCTION zoi.geo_country_canon(p_raw text)RETURNS text LANGUAGE SQL IMMUTABLE AS $$SELECT nullif(trim(p_raw),'')$$");assert.throws(()=>q(migration),/explore_global_rank_prerequisite_changed/);assert.equal(q("SELECT to_regclass('zoi.listings_public_global_rank_idx') IS NULL"),'t');q(originalCanon);pass('independent actual canonicalizer definition drift refuses');
 restart();const beforeCold=plan(),beforeWarm=plan();actualCalls.beforeScalarCold=actualPlan();actualCalls.beforeScalarWarm=actualPlan();actualCalls.beforeTypes=actualPlan(true);q(migration);
 assert.deepEqual(meta(),beforeMeta);assert.equal(digest(),corpus);pass('index-only migration preserves both reader contracts and every listing byte');
 restart();const afterCold=plan(),afterWarm=plan(),nodes=flatten(afterCold[0].Plan);actualCalls.afterScalarCold=actualPlan();actualCalls.afterScalarWarm=actualPlan();actualCalls.afterTypes=actualPlan(true);actualCalls.secondPage=actualPlan(false,24);actualCalls.deepOffset=actualPlan(false,12000);
 assert.ok(nodes.some(p=>p['Node Type']==='Index Only Scan'&&p['Index Name']==='listings_public_global_rank_idx'));
 assert.ok(!nodes.some(p=>p['Node Type']==='Bitmap Heap Scan'));pass('natural unforced global plan uses covering index-only rank input and bounded PK profile projection');
 for(let i=0;i<cases.length;i++)assert.deepEqual(rows(cases[i]),expected[i]);for(let i=0;i<arrayCases.length;i++)assert.deepEqual(rows(arrayCases[i],true),arrayExpected[i]);pass('all full JSON results remain identical including duplicates and legacy photo/poster/claim fields');
 const first=rows([null,null,null,null,24,0,null]),second=rows([null,null,null,null,24,24,null]);assert.deepEqual([...first,...second],rows([null,null,null,null,48,0,null]));assert.equal(new Set([...first,...second].map(r=>r.id)).size,48);pass('independent actual scalar adjacent pages are same first48 with no duplicates');
 q("UPDATE zoi.listings SET padding=padding");actualCalls.dirtyGlobalPlan=plan();actualCalls.dirtyScalar=actualPlan();const dirtyNodes=flatten(actualCalls.dirtyGlobalPlan[0].Plan);assert.ok(dirtyNodes.some(p=>p['Node Type']==='Index Only Scan'&&p['Index Name']==='listings_public_global_rank_idx'&&p['Heap Fetches']>0));assert.deepEqual(rows([null,null,null,null,24,0,null]),first);assert.equal(digest(),corpus);pass('independent dirty visibility map requires heap fetches but full current output/data preserved');q('VACUUM(ANALYZE,PARALLEL 0) zoi.listings;');
 const id='90000000-0000-4000-8000-000000000001';assert.equal(rows([null,'church','Sparse',null,24,0,null])[0].id,id);
 assert.deepEqual(rows([null,'event','Sparse',null,24,0,null]),[]);assert.deepEqual(rows([null,'business','Sparse',null,24,0,null]),[]);
 for(const role of['anon','authenticated','service_role']){assert.equal(q(`SET ROLE ${role};SELECT jsonb_array_length(public.explore_search(NULL,'church','Sparse',NULL,24,0,NULL))`),'1');assert.throws(()=>q(`SET ROLE ${role};SELECT * FROM zoi.listings`),/permission denied/);}pass('clean/cleared/hidden gates, sparse NULLs and existing public-role isolation');
 q(`UPDATE zoi.listings SET name='Owner updated',city='Owner City',country='USA',trust_score=999,verification_status='verified',photo_url=NULL,profile='{"photo_url":"","_enrich":{"photo_url":"https://fixture.example/source.jpg"}}' WHERE id='${id}'`);
 const edited=rows([null,null,null,null,48,0,null]);const oracle=json(`SET enable_indexscan=off;SET enable_bitmapscan=off;SELECT public.explore_search(NULL,NULL,NULL,NULL,48,0,NULL)`);assert.deepEqual(edited,oracle);assert.equal(rows([null,'church','Owner City',null,24,0,null])[0].id,id);
 q(`UPDATE zoi.listings SET marketplace_status='hidden' WHERE id='${id}'`);assert.deepEqual(rows([null,'church','Owner City',null,24,0,null]),[]);pass('owner name/locality/trust/photo edit and hide update ranking/projection without copied profile');
 assert.throws(()=>q(migration),/explore_global_rank_prerequisite_changed/);pass('replay refuses replacement');
 const index=json("SELECT jsonb_build_object('valid',i.indisvalid,'ready',i.indisready,'size_bytes',pg_relation_size(i.indexrelid),'definition',pg_get_indexdef(i.indexrelid)) FROM pg_index i WHERE i.indexrelid='zoi.listings_public_global_rank_idx'::regclass");
 q('DELETE FROM zoi.listings');assert.deepEqual(rows([null,null,null,null,24,0,null]),[]);assert.deepEqual(rows([null,[],null,null,24,0,null],true),[]);pass('both empty-corpus arrays preserved');
 const evidence={independentExtension:true,actualFunctionPlans:actualCalls,controlled_isolated_database:true,production_applied:false,postgres_major:16,rows:32014,padding_bytes:3520,profile_payload_bytes:2048,cold_definition:'Postgres shared buffers emptied by server restart; OS page cache not evicted',no_performance_planner_forcing:true,migration:migrationPath,migration_sha256:createHash('sha256').update(migration).digest('hex'),metadata_preserved:beforeMeta,scalar_oracle_cases:cases.length,types_oracle_cases:arrayCases.length,index,plans:{before:{buffer_cold:beforeCold,warm:beforeWarm},after:{buffer_cold:afterCold,warm:afterWarm}},groups_passed:passed};
 writeFileSync(process.env.QA_EXPLORE_GLOBAL_EVIDENCE||'/tmp/zoi-explore-global.json',JSON.stringify(evidence,null,2));console.log(passed+' global ordering database groups passed');
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

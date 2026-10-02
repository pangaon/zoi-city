import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const migrationPath='supabase/migrations/20261002230128_discovery_directory_public_order_index.sql',migration=read(migrationPath);
const preflight=JSON.parse(read('docs/audits/evidence/discovery-directory-order-preflight-2026-10-02.json'));
const dir=mkdtempSync(join(tmpdir(),'zoi-directory-order-')),bin='/usr/lib/postgresql/16/bin',env={...process.env,PGHOST:dir,PGPORT:process.env.QA_DIRECTORY_ORDER_PGPORT||'15714',PGDATABASE:'postgres'};
const q=s=>execFileSync(join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',s],{env,encoding:'utf8',maxBuffer:20*1024*1024,stdio:['pipe','pipe','pipe']}).trim();
const json=s=>JSON.parse(q(s)),quote=v=>v===null?'NULL':"'"+v.replaceAll("'","''")+"'";
const rows=a=>json(`SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') FROM public.dir_browse(${a.map((v,i)=>i<2?quote(v):v===null?'NULL':v).join(',')}) r`);
const signature='public.dir_browse(text,text,integer,integer)';
const body=()=>q(`SELECT pg_get_functiondef('${signature}'::regprocedure)`);
const metadata=()=>json(`SELECT jsonb_build_object('owner',p.proowner::regrole::text,'acl',p.proacl::text,'config',p.proconfig,'stable',p.provolatile,'definer',p.prosecdef,'args',pg_get_function_arguments(p.oid),'returns',pg_get_function_result(p.oid)) FROM pg_proc p WHERE p.oid='${signature}'::regprocedure`);
const digest=()=>q("SELECT md5(string_agg(to_jsonb(l)::text,'' ORDER BY id)) FROM zoi.listings l");
const scan=a=>preflight.definition.split('AS $function$\n')[1].split('\n$function$')[0].replaceAll('p_type',quote(a[0])).replaceAll('p_city',quote(a[1])).replaceAll('p_limit',a[2]===null?'NULL':String(a[2])).replaceAll('p_offset',a[3]===null?'NULL':String(a[3]));
const plan=(a)=>json('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+scan(a));
const flatten=p=>[p,...(p.Plans||[]).flatMap(flatten)];
const actualCallPlans={};
const actualCallPlan=(limit,offset)=>json(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT * FROM public.dir_browse(NULL,NULL,${limit},${offset})`);
let started=false,passed=0;const pass=s=>{passed++;console.log('PASS '+s)};
const start=()=>{execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',`-k ${dir} -p ${env.PGPORT} -c listen_addresses='' -c shared_buffers=32MB -c max_parallel_workers_per_gather=0`,'-w','start'],{stdio:'ignore'});started=true;};
const restart=()=>{execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','fast','-w','stop'],{stdio:'ignore'});started=false;start();};
try{
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-A','trust','--no-locale','--encoding=UTF8'],{stdio:'ignore'});start();
 q(`CREATE ROLE postgres SUPERUSER;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA zoi;
 CREATE TABLE zoi.categories(id bigint PRIMARY KEY,label_en text);
 CREATE TABLE zoi.listings(id uuid PRIMARY KEY,name text,display_name text,entity_type text,city text,country text,website text,phone text,profile jsonb,primary_category_id bigint,rating numeric,rating_count integer,bookable boolean,sells_products boolean,claim_status text,verification_status text,completeness_score numeric,publish_status text,moderation_status text,marketplace_status text,padding text);
 ALTER TABLE zoi.listings ALTER COLUMN padding SET STORAGE PLAIN;ALTER TABLE zoi.listings ALTER COLUMN profile SET STORAGE PLAIN;
 ALTER TABLE zoi.listings ENABLE ROW LEVEL SECURITY;ALTER TABLE zoi.categories ENABLE ROW LEVEL SECURITY;
 CREATE INDEX listings_public_discovery_counts_idx ON zoi.listings(entity_type) WHERE publish_status='published' AND moderation_status IN ('clean','cleared') AND coalesce(marketplace_status,'')<>'hidden';
 INSERT INTO zoi.categories VALUES(1,'Events'),(2,'Restaurants');`);
 q(preflight.definition);q(`ALTER FUNCTION ${signature} OWNER TO postgres;GRANT EXECUTE ON FUNCTION ${signature} TO anon,authenticated,service_role;REVOKE EXECUTE ON FUNCTION ${signature} FROM PUBLIC;`);
 assert.equal(q(`SELECT md5(pg_get_functiondef('${signature}'::regprocedure))`),preflight.md5);pass('actual installed reader reconstructed with exact body, owner and ACL');
 q(`INSERT INTO zoi.listings SELECT md5(i::text)::uuid,'Fixture '||lpad(i::text,6,'0'),CASE WHEN i%23=0 THEN 'Owner display '||i END,
 (ARRAY['business','event','church','creator','travel_place','artist'])[1+i%6],(ARRAY['Toronto','Montréal','Αθήνα','',NULL,'Old Toronto'])[1+i%6],(ARRAY['Canada','ca','USA','United States','',NULL,'Ελλάδα'])[1+i%7],
 CASE WHEN i%8=0 THEN NULL ELSE 'https://fixture.example/'||i END,CASE WHEN i%9=0 THEN NULL ELSE '+1-555-0100' END,
 jsonb_build_object('fixture_payload',repeat(md5(i::text),64))||CASE WHEN i%9=0 THEN '{}'::jsonb WHEN i%5=0 THEN '{"brand":{"logo":"","tagline":"","colors":[]}}'::jsonb ELSE jsonb_build_object('brand',jsonb_build_object('logo','https://fixture.example/'||i||'.png','tagline','Owner tagline '||i,'colors',jsonb_build_array('#112233'))) END,
 CASE WHEN i%8=0 THEN NULL ELSE 1+i%2 END,CASE WHEN i%10=0 THEN NULL ELSE (i%50)::numeric/10 END,i%70,CASE WHEN i%7=0 THEN NULL ELSE i%2=0 END,CASE WHEN i%7=0 THEN NULL ELSE i%3=0 END,
 'unclaimed',CASE WHEN i%11=0 THEN NULL WHEN i%3=0 THEN 'verified' ELSE 'unverified' END,CASE WHEN i%13=0 THEN NULL ELSE i%100 END,
 CASE WHEN i%29=0 THEN 'draft' ELSE 'published' END,CASE WHEN i%31=0 THEN NULL WHEN i%17=0 THEN 'pending' WHEN i%5=0 THEN 'cleared' ELSE 'clean' END,
 CASE WHEN i%37=0 THEN 'hidden' WHEN i%41=0 THEN NULL ELSE '' END,repeat(md5(i::text),110) FROM generate_series(1,20000) i;
 INSERT INTO zoi.listings(id,name,entity_type,city,country,profile,rating,completeness_score,publish_status,moderation_status,marketplace_status) VALUES
 ('90000000-0000-4000-8000-000000000001','Sparse cleared parish','church','Sparse','Canada','{}',NULL,NULL,'published','cleared',NULL),
 ('90000000-0000-4000-8000-000000000002','Hidden perfect event','event','Sparse','Canada','{}',10,100,'published','clean','hidden'),
 ('90000000-0000-4000-8000-000000000003','Pending perfect business','business','Sparse','Canada','{}',10,100,'published','pending','');`);
 q('VACUUM (ANALYZE,PARALLEL 0) zoi.listings;');
 const corpus=digest(),beforeBody=body(),beforeMeta=metadata();
 const cases=[[null,null,30,0],[null,null,null,null],[null,null,0,-3],[null,null,1000,0],[null,null,12,24],[null,null,60,90000]];
 for(const type of ['business','event','church','creator','travel_place','artist','no-match',''])for(const city of [null,'Toronto','Tor','%', 'Montréal','Αθήνα','', 'no-match','Sparse'])cases.push([type,city,12,3]);
 const expected=cases.map(rows);pass(cases.length+' populated, sparse, Unicode, wildcard, type and pagination cases retain the installed-reader oracle');
 q(`GRANT EXECUTE ON FUNCTION ${signature} TO PUBLIC;`);assert.throws(()=>q(migration),/directory_order_prerequisite_changed/);assert.equal(q("SELECT to_regclass('zoi.listings_public_directory_order_idx') IS NULL"),'t');q(`REVOKE EXECUTE ON FUNCTION ${signature} FROM PUBLIC;`);
 q(preflight.definition.replace("l.name asc","l.name desc"));assert.throws(()=>q(migration),/directory_order_prerequisite_changed/);q(preflight.definition);
 q('CREATE INDEX listings_public_directory_order_idx ON zoi.listings(id);');assert.throws(()=>q(migration),/directory_order_prerequisite_changed/);q('DROP INDEX zoi.listings_public_directory_order_idx;');pass('body, grants or existing index-name drift refuses before creation');
 q(`CREATE ROLE directory_independent_owner;ALTER FUNCTION ${signature} OWNER TO directory_independent_owner;`);
 assert.throws(()=>q(migration),/directory_order_prerequisite_changed/);assert.equal(q("SELECT to_regclass('zoi.listings_public_directory_order_idx') IS NULL"),'t');q(`ALTER FUNCTION ${signature} OWNER TO postgres;DROP ROLE directory_independent_owner;`);assert.deepEqual(metadata(),beforeMeta);pass('independent changed function owner refuses without index or listing mutation');
 restart();actualCallPlans.beforeCold=actualCallPlan(30,0);actualCallPlans.beforeWarm=actualCallPlan(30,0);
 restart();const beforeCold=plan([null,null,30,0]),beforeWarm=plan([null,null,30,0]);assert.ok(flatten(beforeCold[0].Plan).some(p=>p['Node Type']==='Sort'));
 q(migration);assert.equal(body(),beforeBody);assert.deepEqual(metadata(),beforeMeta);assert.equal(digest(),corpus);
 pass('index only change preserves function signature/body/defaults/owner/ACL/config and every listing byte');
 restart();const afterCold=plan([null,null,30,0]),afterWarm=plan([null,null,30,0]);
 const nodes=flatten(afterCold[0].Plan);assert.ok(nodes.some(p=>p['Index Name']==='listings_public_directory_order_idx'));assert.ok(!nodes.some(p=>p['Node Type']==='Sort'));
 pass('natural global plan uses exact ordering index and removes full eligible sort, with no planner forcing');
 restart();actualCallPlans.afterCold=actualCallPlan(30,0);actualCallPlans.afterWarm=actualCallPlan(30,0);actualCallPlans.secondPage=actualCallPlan(30,30);actualCallPlans.deepOffset=actualCallPlan(30,12000);
 assert.deepEqual([...rows([null,null,30,0]),...rows([null,null,30,30])],rows([null,null,60,0]));pass('independent adjacent actual-function pages equal the same ordered first60 with no duplicates');

 for(let i=0;i<cases.length;i++)assert.deepEqual(rows(cases[i]),expected[i]);pass('all '+cases.length+' oracle results preserve all projection fields and existing ranking/pagination');
 const scopedPlans={business:plan(['business','Toronto',30,0]),event:plan(['event','Montréal',30,0]),parish:plan(['church','Sparse',30,0])};
 const id='90000000-0000-4000-8000-000000000001';
 let owner=rows(['church','Sparse',60,0])[0];assert.equal(owner.id,id);assert.equal(owner.logo,null);assert.deepEqual(owner.colors,[]);assert.equal(owner.bookable,false);assert.equal(owner.sells_products,false);
 assert.deepEqual(rows(['event','Sparse',60,0]),[]);assert.deepEqual(rows(['business','Sparse',60,0]),[]);pass('cleared sparse parish visible, hidden/pending excluded, NULL projections preserved');
 for(const role of ['anon','authenticated','service_role']){assert.equal(q(`SET ROLE ${role};SELECT count(*) FROM public.dir_browse('church','Sparse',60,0)`),'1');assert.throws(()=>q(`SET ROLE ${role};SELECT * FROM zoi.listings`),/permission denied/);}pass('existing public roles exercise definer reader without new private table grants');
 q(`UPDATE zoi.listings SET display_name='Owner display',name='Owner current name',website='https://owner.example/',phone='+1-555-0200',profile='{"brand":{"logo":"https://owner.example/logo.svg","colors":["#abcdef"],"tagline":"Owner updated"}}',rating=4.9,completeness_score=100 WHERE id='${id}';`);
 owner=rows(['church','Sparse',60,0])[0];assert.equal(owner.name,'Owner display');assert.equal(owner.logo,'https://owner.example/logo.svg');assert.equal(owner.phone,'+1-555-0200');assert.equal(owner.website,'https://owner.example/');assert.deepEqual(owner.colors,['#abcdef']);assert.equal(owner.tagline,'Owner updated');assert.equal(rows([null,null,30,0])[0].id,id);
 q(`UPDATE zoi.listings SET profile='{"brand":{"logo":"","colors":[],"tagline":""}}',display_name=NULL,phone=NULL,website=NULL WHERE id='${id}';`);
 owner=rows(['church','Sparse',60,0])[0];assert.equal(owner.name,'Owner current name');assert.equal(owner.phone,null);assert.equal(owner.website,null);pass('independent current owner contact and website explicit NULL clears remain NULL');assert.equal(owner.logo,null);assert.equal(owner.tagline,null);assert.deepEqual(owner.colors,[]);
 assert.equal(q(`SELECT (nullif(profile #>> '{brand,logo}','') IS NOT NULL)::text FROM zoi.listings WHERE id='${id}'`),'false');
 const indexedAfterEdits=rows([null,null,60,0]);assert.equal(indexedAfterEdits.some(r=>r.id===id),false);const seqAfterEdits=json(`SET enable_indexscan=off;SET enable_bitmapscan=off;SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') FROM public.dir_browse(NULL,NULL,60,0) r`);assert.deepEqual(indexedAfterEdits,seqAfterEdits);
 q(`UPDATE zoi.listings SET marketplace_status='hidden' WHERE id='${id}';`);assert.deepEqual(rows(['church','Sparse',60,0]),[]);pass('owner name/contact/brand edit and clear update output/order immediately; clearing logo removes former top result from first60; hide removes sparse listing');
 assert.throws(()=>q(migration),/directory_order_prerequisite_changed/);pass('index replay fails closed without replacement or duplicate objects');
 const index=json("SELECT jsonb_build_object('valid',i.indisvalid,'ready',i.indisready,'size_bytes',pg_relation_size(i.indexrelid),'definition',pg_get_indexdef(i.indexrelid)) FROM pg_index i WHERE i.indexrelid='zoi.listings_public_directory_order_idx'::regclass");assert.equal(index.valid,true);assert.equal(index.ready,true);
 q('DELETE FROM zoi.listings;');assert.deepEqual(rows([null,null,30,0]),[]);pass('empty corpus retains empty array shape without fallback data');
 const evidence={independent_adversarial_extension:true,actual_function_call_plans:actualCallPlans,controlled_isolated_database:true,production_applied:false,postgres_major:16,rows:20003,padding_bytes:3520,profile_payload_bytes:2048,cold_definition:'Postgres shared buffers emptied by server restart; OS page cache not evicted',no_performance_planner_forcing:true,existing_tie_order:'No tie breaker added: equal existing sort keys remain unspecified',migration:migrationPath,migration_sha256:createHash('sha256').update(migration).digest('hex'),metadata_preserved:beforeMeta,oracle_cases:cases.length,index,plans:{before:{buffer_cold:beforeCold,warm:beforeWarm},after:{buffer_cold:afterCold,warm:afterWarm},scoped:scopedPlans},groups_passed:passed};
 writeFileSync(process.env.QA_DIRECTORY_ORDER_EVIDENCE||'/tmp/zoi-directory-order.json',JSON.stringify(evidence,null,2));console.log(passed+' directory ordering database groups passed');
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

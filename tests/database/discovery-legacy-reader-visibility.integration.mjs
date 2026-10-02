import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const migrationPath='supabase/migrations/20261002223454_discovery_legacy_reader_visibility.sql',migration=read(migrationPath);
const preflight=JSON.parse(read('docs/audits/evidence/discovery-legacy-reader-preflight-2026-10-02.json')).functions;
const active='explore_geo(integer,integer)',directory='dir_browse(text,text,integer,integer)',map='explore_geo(text,text,text,text,integer)';
const dir=mkdtempSync(join(tmpdir(),'zoi-discovery-legacy-')),bin='/usr/lib/postgresql/16/bin',env={...process.env,PGHOST:dir,PGPORT:process.env.QA_DISCOVERY_LEGACY_PGPORT||'15713',PGDATABASE:'postgres'};
const q=s=>execFileSync(join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',s],{env,encoding:'utf8',maxBuffer:20*1024*1024,stdio:['pipe','pipe','pipe']}).trim();
const json=s=>JSON.parse(q(s)),quote=v=>v===null?'NULL':"'"+v.replaceAll("'","''")+"'",get=s=>preflight.find(r=>r.signature===s).definition;
const eligible="publish_status='published' AND moderation_status IN ('clean','cleared') AND coalesce(marketplace_status,'')<>'hidden'";
const directoryRows=a=>json(`SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') FROM public.dir_browse(${a.map((v,i)=>i<2?quote(v):v===null?'NULL':v).join(',')}) r`);
const mapRows=a=>json(`SELECT public.explore_geo(${a.map((v,i)=>i<4?quote(v):v===null?'NULL':v).join(',')})`);
const metadata=()=>json(`SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',p.proowner::regrole::text,'acl',p.proacl::text,'config',p.proconfig,'stable',p.provolatile,'definer',p.prosecdef,'args',pg_get_function_arguments(p.oid),'returns',pg_get_function_result(p.oid)) ORDER BY p.oid::regprocedure::text) FROM pg_proc p WHERE p.oid IN ('public.${active}'::regprocedure,'public.${directory}'::regprocedure,'public.${map}'::regprocedure)`);
let started=false,passed=0;
const pass=s=>{passed++;console.log('PASS '+s)};
try{
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-A','trust','--no-locale','--encoding=UTF8'],{stdio:'ignore'});
 execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',`-k ${dir} -p ${env.PGPORT} -c listen_addresses=''`,'-w','start'],{stdio:'ignore'});started=true;
 q(`CREATE ROLE postgres SUPERUSER;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA zoi;
 CREATE TABLE zoi.categories(id bigint PRIMARY KEY,slug text,label_en text);
 CREATE TABLE zoi.listings(id uuid PRIMARY KEY,name text,display_name text,entity_type text,slug text,canonical_path text,description text,city text,country text,region text,province_state text,latitude double precision,longitude double precision,geo_precision text,address text,website text,phone text,profile jsonb,search_tsv tsvector,primary_category_id bigint,rating numeric,rating_count integer,bookable boolean,sells_products boolean,claim_status text,verification_status text,trust_score numeric,completeness_score numeric,trust_badges jsonb,publish_status text,moderation_status text,marketplace_status text,duplicate_status text,updated_at timestamptz,padding text);
 ALTER TABLE zoi.listings ALTER COLUMN padding SET STORAGE PLAIN;ALTER TABLE zoi.listings ENABLE ROW LEVEL SECURITY;ALTER TABLE zoi.categories ENABLE ROW LEVEL SECURITY;
 CREATE INDEX idx_listings_publish ON zoi.listings(publish_status);INSERT INTO zoi.categories VALUES(1,'events','Events'),(2,'food','Restaurants');`);
 q(read('supabase/migrations/0039_canonical_geography_contract.sql').match(/create or replace function zoi\.geo_country_canon\(p_raw text\)[\s\S]*?\$function\$;/i)[0]);
 q("CREATE FUNCTION zoi.geo_precision_canon(text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT $1 $$;");
 const view=JSON.parse(read('docs/audits/evidence/discovery-related-reader-definitions-2026-10-02.json')).public_view[0].definition;q('CREATE VIEW zoi.v_public_listings AS '+view);
 for(const r of preflight){q(r.definition);q(`ALTER FUNCTION public.${r.signature} OWNER TO postgres;GRANT EXECUTE ON FUNCTION public.${r.signature} TO anon,authenticated,service_role;REVOKE EXECUTE ON FUNCTION public.${r.signature} FROM PUBLIC;`);assert.equal(q(`SELECT md5(pg_get_functiondef('public.${r.signature}'::regprocedure))`),r.definition_md5);}
 pass('isolated fixture reconstructs all three installed bodies/signatures/ACLs, including unchanged active map reader');
 q(`INSERT INTO zoi.listings(id,name,display_name,entity_type,slug,canonical_path,city,country,latitude,longitude,geo_precision,profile,search_tsv,primary_category_id,rating,rating_count,bookable,sells_products,claim_status,verification_status,trust_score,completeness_score,publish_status,moderation_status,marketplace_status,duplicate_status,padding)
 SELECT md5(i::text)::uuid,'Fixture '||lpad(i::text,5,'0')||CASE WHEN i%13=0 THEN ' Festival' ELSE '' END,CASE WHEN i%23=0 THEN 'Owner display '||i END,
 (ARRAY['business','event','church','creator','travel_place','artist'])[1+i%6],'fixture-'||i,CASE WHEN i%7=0 THEN '/business/current-owner-'||i END,
 (ARRAY['Toronto','Montréal','Αθήνα','',NULL,'Old Toronto'])[1+i%6],(ARRAY['Canada','ca','USA','United States','',NULL,'Ελλάδα'])[1+i%7],
 CASE WHEN i%11=0 THEN NULL ELSE 40+(i%400)::float/100 END,CASE WHEN i%17=0 THEN NULL ELSE -70-(i%400)::float/100 END,'source_published',
 CASE WHEN i%9=0 THEN '{}'::jsonb WHEN i%5=0 THEN '{"brand":{"logo":"","tagline":"","colors":[]}}'::jsonb ELSE jsonb_build_object('brand',jsonb_build_object('logo','https://fixture.example/'||i||'.png','tagline','Owner tagline '||i,'colors',jsonb_build_array('#112233'))) END,
 to_tsvector('simple',CASE WHEN i%19=0 THEN 'night gala festival' ELSE 'fixture' END),CASE WHEN i%8=0 THEN NULL ELSE 1+i%2 END,
 CASE WHEN i%10=0 THEN NULL ELSE (i%50)::numeric/10 END,i%70,CASE WHEN i%7=0 THEN NULL ELSE i%2=0 END,CASE WHEN i%7=0 THEN NULL ELSE i%3=0 END,
 'unclaimed',CASE WHEN i%11=0 THEN NULL WHEN i%3=0 THEN 'verified' ELSE 'unverified' END,CASE WHEN i%10=0 THEN NULL ELSE i%100 END,i%100,
 CASE WHEN i%29=0 THEN 'draft' ELSE 'published' END,CASE WHEN i%31=0 THEN NULL WHEN i%17=0 THEN 'pending' WHEN i%5=0 THEN 'cleared' ELSE 'clean' END,
 CASE WHEN i%37=0 THEN 'hidden' WHEN i%41=0 THEN NULL ELSE '' END,'unique',repeat(md5(i::text),110) FROM generate_series(1,4800) i;
 INSERT INTO zoi.listings(id,name,entity_type,slug,city,country,latitude,longitude,profile,search_tsv,publish_status,moderation_status,marketplace_status,duplicate_status) VALUES
 ('90000000-0000-4000-8000-000000000001','Sparse cleared parish','church','sparse-cleared','Toronto','Canada',0,0,'{}',to_tsvector('simple','sparse parish'),'published','cleared',NULL,'unique'),
 ('90000000-0000-4000-8000-000000000002','Hidden high ranked event','event','hidden-event','Toronto','Canada',40,-70,'{}',to_tsvector('simple','hidden'),'published','clean','hidden','unique'),
 ('90000000-0000-4000-8000-000000000003','Pending mapped listing','business','pending-mapped','Toronto','Canada',40,-70,'{}',to_tsvector('simple','pending'),'published','pending','','unique');
 CREATE TABLE zoi.qa_original AS TABLE zoi.listings;`);
 const originalDigest=q("SELECT md5(string_agg(to_jsonb(l)::text,'' ORDER BY id)) FROM zoi.listings l"),metadataBefore=metadata(),activeBefore=q(`SELECT pg_get_functiondef('public.${active}'::regprocedure)`);
 const originalDirectory=directoryRows([null,null,60,0]),originalMap=mapRows([null,null,null,null,1200]);
 assert.equal(directoryRows(['church','Toronto',60,0]).length,0);assert.equal(directoryRows(['event','Toronto',60,0]).length,1);assert.equal(mapRows(['Pending mapped',null,null,null,600]).length,1);pass('retained installed readers reproduce omitted cleared parish, exposed hidden event and pending mapped listing');
 // Use the actual installed readers on a physically eligible-only corpus as oracle.
 // Cleared rows become clean only in this controlled oracle stage because old
 // dir_browse excluded them; no projected/ranked field is modified.
 q(`DELETE FROM zoi.listings WHERE NOT coalesce(${eligible},false);UPDATE zoi.listings SET moderation_status='clean' WHERE moderation_status='cleared';`);
 const directoryCases=[[null,null,30,0],[null,null,null,null],[null,null,0,-3],[null,null,1000,0],[null,null,12,24],[null,null,60,9000]];
 for(const type of ['business','event','church','creator','travel_place','artist','no-match',''])for(const city of [null,'Toronto','Tor','%', 'Montréal','Αθήνα','', 'no-match'])directoryCases.push([type,city,12,3]);
 const mapCases=[[null,null,null,null,600],[null,null,null,null,null],[null,null,null,null,0],[null,null,null,null,5000]];
 for(const args of [['Festival',null,null,null],['gala',null,null,null],['%',null,null,null],['_',null,null,null],['',null,null,null],[null,'business','Toronto','Canada'],[null,'business','Tor%','ca'],[null,'church','Toronto','Canada'],[null,'travel_place',null,null],[null,'no-match',null,null],[null,null,'%',null],[null,null,'',null],[null,null,null,'ca'],[null,null,null,'Canada'],[null,null,null,'United%'],[null,null,null,''],['Α',null,'Αθήνα','Ελλάδα']])mapCases.push([...args,1200]);
 const expectedDirectory=directoryCases.map(directoryRows),expectedMap=mapCases.map(mapRows);
 q('TRUNCATE zoi.listings;INSERT INTO zoi.listings SELECT * FROM zoi.qa_original;');assert.equal(q("SELECT md5(string_agg(to_jsonb(l)::text,'' ORDER BY id)) FROM zoi.listings l"),originalDigest);
 pass('actual installed readers provide oracle for eligible populated/sparse/Unicode/type/locality/wildcard and pagination corpus, restored byte-for-byte');
 q(`GRANT EXECUTE ON FUNCTION public.${map} TO PUBLIC;`);assert.throws(()=>q(migration),/legacy_discovery_prerequisite_changed/);assert.equal(q(`SELECT pg_get_functiondef('public.${directory}'::regprocedure)`),get(directory).trim());q(`REVOKE EXECUTE ON FUNCTION public.${map} FROM PUBLIC;`);
 q("CREATE OR REPLACE FUNCTION public.dir_browse(p_type text DEFAULT NULL::text,p_city text DEFAULT NULL::text,p_limit integer DEFAULT 30,p_offset integer DEFAULT 0) RETURNS TABLE(id uuid,name text,entity_type text,city text,country text,category text,website text,phone text,logo text,colors jsonb,tagline text,rating numeric,rating_count integer,bookable boolean,sells_products boolean,claim_status text,verification_status text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$ SELECT NULL::uuid,NULL::text,NULL::text,NULL::text,NULL::text,NULL::text,NULL::text,NULL::text,NULL::text,NULL::jsonb,NULL::text,NULL::numeric,NULL::integer,NULL::boolean,NULL::boolean,NULL::text,NULL::text WHERE false $$;");assert.throws(()=>q(migration),/legacy_discovery_prerequisite_changed/);q(get(directory));
 pass('changed body or widened grant refuses entire migration before either reader replacement');
 q(migration);assert.deepEqual(metadata(),metadataBefore);assert.equal(q(`SELECT pg_get_functiondef('public.${active}'::regprocedure)`),activeBefore);assert.equal(q("SELECT md5(string_agg(to_jsonb(l)::text,'' ORDER BY id)) FROM zoi.listings l"),originalDigest);
 pass('only function bodies change; signatures/defaults/returns/ACLs/owner/config, all listing data and active integer map remain unchanged');
 for(let i=0;i<directoryCases.length;i++)assert.deepEqual(directoryRows(directoryCases[i]),expectedDirectory[i]);pass(directoryCases.length+' directory oracle cases retain projection, raw-country labels, owner brand, ranking, type/city semantics and pagination');
 for(let i=0;i<mapCases.length;i++)assert.deepEqual(mapRows(mapCases[i]),expectedMap[i]);pass(mapCases.length+' JSON map oracle cases retain canonical path/fallback, ID, sparse geometry, ranking, FTS/raw alias/locality and limit behavior');
 const sparse=directoryRows(['church','Toronto',60,0]).find(r=>r.id==='90000000-0000-4000-8000-000000000001');assert.ok(sparse);assert.equal(sparse.logo,null);assert.deepEqual(sparse.colors,[]);assert.equal(sparse.bookable,false);assert.equal(sparse.sells_products,false);
 const sparseMap=mapRows(['Sparse',null,null,null,600]);assert.equal(sparseMap.length,1);assert.equal(sparseMap[0].lat,0);assert.equal(sparseMap[0].lng,0);assert.equal(sparseMap[0].path,'/p/sparse-cleared');assert.equal(mapRows(['Pending mapped',null,null,null,600]).length,0);assert.equal(directoryRows(['event','Toronto',60,0]).some(r=>r.id==='90000000-0000-4000-8000-000000000002'),false);
 pass('cleared sparse client is visible, NULL brand/booleans preserved, zero coordinates retained; pending/hidden records absent');
 for(const role of ['anon','authenticated','service_role']){assert.equal(json(`SET ROLE ${role};SELECT public.explore_geo('Sparse',NULL,NULL,NULL,600)`).length,1);assert.equal(q(`SET ROLE ${role};SELECT count(*) FROM public.dir_browse('church','Toronto',60,0)`),String(directoryRows(['church','Toronto',60,0]).length));assert.throws(()=>q(`SET ROLE ${role};SELECT * FROM zoi.listings`),/permission denied/);}
 pass('all existing public roles can exercise both readers without private table access or new grants');
 q("UPDATE zoi.listings SET display_name='Owner parish display',name='Owner parish name',canonical_path='/church/current-owner-parish',website='https://owner.example/',phone='+1-555-0100',profile='{\"brand\":{\"logo\":\"https://owner.example/logo.svg\",\"colors\":[\"#abcdef\"],\"tagline\":\"Owner updated\"}}' WHERE id='90000000-0000-4000-8000-000000000001';");
 let owner=directoryRows(['church','Toronto',60,0]).find(r=>r.id==='90000000-0000-4000-8000-000000000001');assert.equal(owner.name,'Owner parish display');assert.equal(owner.website,'https://owner.example/');assert.equal(owner.phone,'+1-555-0100');assert.equal(owner.logo,'https://owner.example/logo.svg');assert.deepEqual(owner.colors,['#abcdef']);assert.equal(owner.tagline,'Owner updated');assert.equal(mapRows(['Owner parish',null,null,null,600])[0].path,'/church/current-owner-parish');
 q("UPDATE zoi.listings SET profile='{\"brand\":{\"logo\":\"\",\"colors\":[],\"tagline\":\"\"}}',display_name=NULL WHERE id='90000000-0000-4000-8000-000000000001';");owner=directoryRows(['church','Toronto',60,0]).find(r=>r.id==='90000000-0000-4000-8000-000000000001');assert.equal(owner.name,'Owner parish name');assert.equal(owner.logo,null);assert.equal(owner.tagline,null);assert.deepEqual(owner.colors,[]);
 q("UPDATE zoi.listings SET marketplace_status='hidden' WHERE id='90000000-0000-4000-8000-000000000001';");assert.equal(mapRows(['Owner parish',null,null,null,600]).length,0);assert.equal(directoryRows(['church','Toronto',60,0]).some(r=>r.id==='90000000-0000-4000-8000-000000000001'),false);
 pass('current owner name/path/brand/contact edits and explicit clears survive; hide immediately removes both projections');
 q('DELETE FROM zoi.listings;');assert.deepEqual(directoryRows([null,null,30,0]),[]);assert.deepEqual(mapRows([null,null,null,null,600]),[]);pass('empty corpus returns empty existing shapes, no fabricated fallback listings');
 assert.throws(()=>q(migration),/legacy_discovery_prerequisite_changed/);pass('replay fails closed against already-replaced definitions');
 writeFileSync(process.env.QA_LEGACY_DISCOVERY_EVIDENCE||'/tmp/zoi-discovery-legacy-visibility.json',JSON.stringify({controlled_isolated_database:true,production_applied:false,postgres_major:16,wide_rows:4803,padding_bytes:3520,migration:migrationPath,migration_sha256:createHash('sha256').update(migration).digest('hex'),metadata_preserved:metadataBefore,active_integer_definition_preserved:true,eligible_oracle:{directory_cases:directoryCases.length,map_cases:mapCases.length},before:{directory_ids:originalDirectory.map(r=>r.id),map_ids:originalMap.map(r=>r.id)},after:{directory_ids:expectedDirectory[3].map(r=>r.id),map_ids:expectedMap[3].map(r=>r.id)},groups_passed:passed},null,2));console.log(passed+' legacy discovery visibility database groups passed');
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base=new URL('../../',import.meta.url),dir=mkdtempSync(join(tmpdir(),'zoi-discovery-counts-')),bin='/usr/lib/postgresql/16/bin';
const env={...process.env,PGHOST:dir,PGPORT:process.env.QA_DISCOVERY_PGPORT||'15712',PGDATABASE:'postgres'};
const q=s=>execFileSync(join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',s],{env,encoding:'utf8',maxBuffer:8*1024*1024,stdio:['pipe','pipe','pipe']}).trim();
const json=s=>JSON.parse(q(s));
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const read=p=>readFileSync(new URL(p,base),'utf8');
const additional=JSON.parse(read('docs/audits/evidence/discovery-additional-count-readers-preflight-2026-10-02.json')).functions;
const definitions=[...JSON.parse(read('docs/audits/evidence/discovery-current-definitions-2026-10-02.json')),...additional];
const preflight={functions:[...JSON.parse(read('docs/audits/evidence/discovery-geography-function-preflight-2026-10-02.json')).functions,...additional]};
const signatures=['explore_countries()','explore_regions(text)','home_stats()','explore_cities(integer)','explore_region_cities(text,text)'];
const migrationPath='supabase/migrations/20261002221551_discovery_public_geography_counts.sql',migration=read(migrationPath);
const get=s=>definitions.find(d=>d.signature===s).definition;
const body=s=>s.split('AS $function$')[1].split('$function$')[0].trim().replace(/;$/,'');
const eligible="l.publish_status='published' AND l.moderation_status IN ('clean','cleared') AND coalesce(l.marketplace_status,'')<>'hidden'";
const countriesReference=`SELECT zoi.geo_country_canon(l.country) country,count(*) listings,count(DISTINCT l.region) regions,count(DISTINCT l.city) cities FROM zoi.listings l WHERE ${eligible} AND zoi.geo_country_canon(l.country) IS NOT NULL GROUP BY 1`;
const regionsReference=filter=>`SELECT zoi.geo_country_canon(l.country) country,l.region,max(l.region_code) region_code,count(*) listings,count(DISTINCT l.city) cities FROM zoi.listings l WHERE ${eligible} AND zoi.geo_country_canon(l.country) IS NOT NULL AND l.region IS NOT NULL AND l.region<>'' AND (${filter} IS NULL OR ${filter}='' OR zoi.geo_country_canon(l.country) ILIKE ${filter}) GROUP BY 1,2`;
const rows=s=>json(`SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]') FROM (${s}) r`);
const plan=s=>json(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${s}`)[0];
const metadata=()=>json("SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',p.proowner::regrole::text,'acl',p.proacl::text,'config',p.proconfig,'stable',p.provolatile,'definer',p.prosecdef,'arguments',pg_get_function_arguments(p.oid),'result',pg_get_function_result(p.oid)) ORDER BY p.oid::regprocedure::text) FROM pg_proc p WHERE p.oid IN ('public.explore_countries()'::regprocedure,'public.explore_regions(text)'::regprocedure,'public.home_stats()'::regprocedure,'public.explore_cities(integer)'::regprocedure,'public.explore_region_cities(text,text)'::regprocedure)");
let started=false,passed=0;
const pass=s=>{passed++;console.log('PASS '+s)};
try{
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-A','trust','--no-locale','--encoding=UTF8'],{stdio:'ignore'});
 execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',`-k ${dir} -p ${env.PGPORT} -c listen_addresses=''`,'-w','start'],{stdio:'ignore'});started=true;
 q(`CREATE ROLE postgres SUPERUSER;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA zoi;
 CREATE TABLE zoi.listings(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,country text,region text,city text,region_code text,publish_status text,moderation_status text,marketplace_status text,region_native text,padding text);
 ALTER TABLE zoi.listings ALTER COLUMN padding SET STORAGE PLAIN;ALTER TABLE zoi.listings ENABLE ROW LEVEL SECURITY;
 CREATE INDEX idx_zoi_listings_publish ON zoi.listings(publish_status);`);
 const canon=read('supabase/migrations/0039_canonical_geography_contract.sql').match(/create or replace function zoi\.geo_country_canon\(p_raw text\)[\s\S]*?\$function\$;/i)[0];q(canon);
 for(const sig of signatures){
  q(get(sig));q(`ALTER FUNCTION public.${sig} OWNER TO postgres;GRANT EXECUTE ON FUNCTION public.${sig} TO anon,authenticated,service_role;`);
  if(sig!=='home_stats()')q(`REVOKE EXECUTE ON FUNCTION public.${sig} FROM PUBLIC;`);
  assert.equal(q(`SELECT md5(pg_get_functiondef('public.${sig}'::regprocedure))`),preflight.functions.find(f=>f.signature===sig).definition_md5);
 }pass('isolated PostgreSQL matches exact installed definitions, signatures and ACLs');
 q(`INSERT INTO zoi.listings(country,region,city,region_code,publish_status,moderation_status,marketplace_status,padding)
 SELECT (ARRAY['Canada','ca','USA','us','Ελλάδα','Greece',' ','',NULL,'United Kingdom','UK','Unrecognised'])[1+i%12],
 (ARRAY['Ontario','Québec','Αττική','',NULL,' ','100% Place','Under_score'])[1+i%8],
 (ARRAY['Toronto','Montréal','Αθήνα','',NULL,' ','Twinned'])[1+i%7],
 (ARRAY['ON','QC','AT',NULL,''])[1+i%5],
 CASE WHEN i%29=0 THEN 'draft' ELSE 'published' END,
 CASE WHEN i%31=0 THEN 'pending' WHEN i%17=0 THEN 'cleared' ELSE 'clean' END,
 CASE WHEN i%37=0 THEN 'hidden' WHEN i%41=0 THEN NULL ELSE 'active' END,
 repeat(md5(i::text),110) FROM generate_series(1,48000) i;
 INSERT INTO zoi.listings(country,region,city,region_code,publish_status,moderation_status,marketplace_status,padding) VALUES
 ('ONLY HIDDEN','Private region','Secret city','XX','published','clean','hidden',''),
 ('ONLY MODERATED','Private region','Other secret city','XX','published','pending','active',''),
 ('ONLY DRAFT','Private region','Draft city','XX','draft','clean','active',''),
 ('Literal%_Country','Literal%_Region',NULL,NULL,'published','cleared',NULL,'');`);
 q("UPDATE zoi.listings SET region_native=CASE region WHEN 'Ontario' THEN 'Οντάριο' WHEN 'Québec' THEN 'Κεμπέκ' ELSE concat('Native ',region) END WHERE id%9<>0;");
 q('VACUUM (PARALLEL 0,ANALYZE) zoi.listings;');
 const countriesBefore=rows('SELECT * FROM public.explore_countries()'),statsBefore=json('SELECT public.home_stats()'),metadataBefore=metadata(),countriesDefinition=q("SELECT pg_get_functiondef('public.explore_countries()'::regprocedure)");
 assert.deepEqual(countriesBefore,rows(countriesReference));pass('installed countries agrees with independent eligible-row reference on 48,004 wide rows');
 const filters=[null,'','Canada','cAnAdA','United%','%','_','No match','Ελλάδα','Literal\\%\\_Country'];
 const expected=filters.map(v=>rows(regionsReference(v===null?'NULL::text':quote(v))));
 assert.equal(expected.at(-1).length,1);
 const beforePlans={countries:plan(body(get('explore_countries()'))),regions:plan(body(get('explore_regions(text)')).replaceAll('p_country','NULL::text')),stats:plan(body(get('home_stats()'))),cities:plan(body(get('explore_cities(integer)')).replaceAll('p_limit','100')),region_cities:plan(body(get('explore_region_cities(text,text)')).replaceAll('p_country','NULL::text').replaceAll('p_region','NULL::text'))};
 q('GRANT EXECUTE ON FUNCTION public.explore_regions(text) TO PUBLIC;');
 assert.throws(()=>q(migration),/discovery_geography_prerequisite_changed/);assert.equal(q("SELECT to_regclass('zoi.listings_public_geography_counts_idx') IS NULL"),'t');
 q('REVOKE EXECUTE ON FUNCTION public.explore_regions(text) FROM PUBLIC;');
 q("CREATE OR REPLACE FUNCTION public.home_stats() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'zoi','public' AS $$ SELECT '{}'::jsonb $$;");
 assert.throws(()=>q(migration),/discovery_geography_prerequisite_changed/);assert.equal(q("SELECT to_regclass('zoi.listings_public_geography_counts_idx') IS NULL"),'t');q(get('home_stats()'));
 q("CREATE OR REPLACE FUNCTION zoi.geo_country_canon(p_raw text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT p_raw $$;");assert.throws(()=>q(migration),/discovery_country_normalization_changed/);q(canon);
 pass('body, grant and country-normalization drift reject migration before any index or reader mutation');
 q(migration);assert.deepEqual(metadata(),metadataBefore);assert.equal(q("SELECT pg_get_functiondef('public.explore_countries()'::regprocedure)"),countriesDefinition);pass('migration preserves installed owner/ACL/config/defaults/returns and countries body');
 assert.deepEqual(rows('SELECT * FROM public.explore_countries()'),countriesBefore);
 for(let n=0;n<filters.length;n++){const v=filters[n];assert.deepEqual(rows(`SELECT * FROM public.explore_regions(${v===null?'NULL':quote(v)})`),expected[n]);}
 pass('country aliases, NULL/empty/Unicode, region codes, duplicate cities and country ILIKE filters remain exact');
 const citiesReference=`SELECT l.city,zoi.geo_country_canon(l.country) country,count(*) n FROM zoi.listings l WHERE ${eligible} AND l.city IS NOT NULL AND l.city<>'' GROUP BY 1,2`;
 assert.deepEqual(rows('SELECT * FROM public.explore_cities(100)'),rows(citiesReference));
 const fullCities=json('SELECT jsonb_agg(to_jsonb(c)) FROM public.explore_cities(100) c');
 for(const limit of [null,0,-5,1,24,100,1000]){const actual=json(`SELECT jsonb_agg(to_jsonb(c)) FROM public.explore_cities(${limit===null?'NULL':limit}) c`);assert.equal(actual.length,Math.min(fullCities.length,Math.min(Math.max(limit??24,1),100)));for(const row of actual)assert.ok(fullCities.some(r=>JSON.stringify(r)===JSON.stringify(row)));for(let i=1;i<actual.length;i++){assert.ok(actual[i].n<=actual[i-1].n);if(actual[i].n===actual[i-1].n)assert.ok(actual[i].city>=actual[i-1].city);}}
 pass('cities preserve aliases including NULL canonical country groups, ordering and NULL/min/max limit contract');
 const regionFilters=[null,'','Ontario','ontario','Οντάριο','on','QC','%','Under\\_score','100\\% Place','missing'];
 for(const country of [null,'','Canada','%','United%','no match'])for(const region of regionFilters){const c=country===null?'NULL::text':quote(country),r=region===null?'NULL::text':quote(region);const reference=`SELECT zoi.geo_country_canon(l.country) country,l.region,l.city,count(*) listings FROM zoi.listings l WHERE ${eligible} AND zoi.geo_country_canon(l.country) IS NOT NULL AND l.city IS NOT NULL AND l.city<>'' AND (${c} IS NULL OR ${c}='' OR zoi.geo_country_canon(l.country) ILIKE ${c}) AND (${r} IS NULL OR ${r}='' OR l.region ILIKE ${r} OR l.region_native ILIKE ${r} OR upper(l.region_code)=upper(${r})) GROUP BY 1,2,3`;assert.deepEqual(rows(`SELECT * FROM public.explore_region_cities(${c},${r})`),rows(reference));}
 for(const regional of ['Οντάριο','on',regionFilters[8],regionFilters[9]])assert.ok(Number(q(`SELECT count(*) FROM public.explore_region_cities(NULL,${quote(regional)})`))>0);
 pass('region cities preserve country/region/native/code/escaped-pattern filters and NULL/empty regional groups');
 const stats=json('SELECT public.home_stats()'),reference=json(`SELECT jsonb_build_object('listings',count(*),'cities',count(DISTINCT l.city),'countries',count(DISTINCT l.country)) FROM zoi.listings l WHERE ${eligible}`);
 assert.deepEqual(stats,reference);assert.ok(statsBefore.listings>stats.listings);assert.ok(statsBefore.countries>stats.countries);assert.equal(q("SELECT count(*) FROM public.explore_regions() WHERE country LIKE 'ONLY %'"),'0');
 pass('regions/stats exclude hidden/moderated/draft rows; stats retain raw country and empty-string distinct semantics');
 for(const role of ['anon','authenticated','service_role']){assert.deepEqual(json(`SET ROLE ${role};SELECT public.home_stats()`),stats);assert.equal(q(`SET ROLE ${role};SELECT count(*) FROM public.explore_countries()`),String(countriesBefore.length));assert.equal(q(`SET ROLE ${role};SELECT count(*) FROM public.explore_regions()`),String(expected[0].length));assert.equal(q(`SET ROLE ${role};SELECT count(*) FROM public.explore_cities(100)`),String(fullCities.length));assert.equal(q(`SET ROLE ${role};SELECT count(*) FROM public.explore_region_cities()`),q('SELECT count(*) FROM public.explore_region_cities()'));assert.throws(()=>q(`SET ROLE ${role};SELECT * FROM zoi.listings`),/permission denied/);}
 pass('public readers work through existing definer rights without granting direct private-table access');
 const definitionsAfter=json("SELECT jsonb_object_agg(p.oid::regprocedure::text,pg_get_functiondef(p.oid)) FROM pg_proc p WHERE p.oid IN ('public.explore_countries()'::regprocedure,'public.explore_regions(text)'::regprocedure,'public.home_stats()'::regprocedure,'public.explore_cities(integer)'::regprocedure,'public.explore_region_cities(text,text)'::regprocedure)");
 const afterPlans={countries:plan(body(definitionsAfter['explore_countries()'])),regions:plan(body(definitionsAfter['explore_regions(text)']).replaceAll('p_country','NULL::text')),stats:plan(body(definitionsAfter['home_stats()'])),cities:plan(body(definitionsAfter['explore_cities(integer)']).replaceAll('p_limit','100')),region_cities:plan(body(definitionsAfter['explore_region_cities(text,text)']).replaceAll('p_country','NULL::text').replaceAll('p_region','NULL::text'))};
 const nodes=p=>[p,...(p.Plans||[]).flatMap(nodes)];
 for(const key of ['countries','regions','stats','cities','region_cities']){
  const scans=nodes(afterPlans[key].Plan).filter(n=>n['Relation Name']==='listings');assert.ok(scans.length);assert.ok(scans.every(n=>n['Node Type']==='Index Only Scan'&&n['Index Name']==='listings_public_geography_counts_idx'&&n['Heap Fetches']===0));
  assert.ok(afterPlans[key].Plan['Shared Hit Blocks']<beforePlans[key].Plan['Shared Hit Blocks']);
 }
 pass('all five readers choose covering index-only scans without planner forcing or heap fetches; buffers decrease');
 q("UPDATE zoi.listings SET moderation_status=NULL WHERE id=(SELECT min(id) FROM zoi.listings WHERE country='Literal%_Country');");assert.equal(json('SELECT public.home_stats()').listings,stats.listings-1);assert.equal(q("SELECT count(*) FROM public.explore_regions('Literal\\%\\_Country')"),'0');q("UPDATE zoi.listings SET moderation_status='cleared' WHERE country='Literal%_Country';");assert.deepEqual(json('SELECT public.home_stats()'),stats);pass('fresh counts change immediately with current visibility; NULL moderation is excluded');
 const empty=json("BEGIN;DELETE FROM zoi.listings;SELECT jsonb_build_object('stats',public.home_stats(),'countries',(SELECT count(*) FROM public.explore_countries()),'regions',(SELECT count(*) FROM public.explore_regions()),'cities',(SELECT count(*) FROM public.explore_cities()),'region_cities',(SELECT count(*) FROM public.explore_region_cities()));ROLLBACK;");
 assert.deepEqual(empty,{stats:{listings:0,cities:0,countries:0},countries:0,regions:0,cities:0,region_cities:0});
 q('VACUUM (PARALLEL 0,ANALYZE) zoi.listings;');pass('empty table returns zero-valued stats and empty option arrays; test rolls back original corpus');
 assert.throws(()=>q(migration),/discovery_geography_prerequisite_changed/);pass('replay fails closed rather than silently replacing changed readers');
 const report={controlled_isolated_database:true,postgres_major:16,production_applied:false,wide_rows:48004,padding_bytes:3520,visibility_contract:eligible,migration:migrationPath,migration_sha256:createHash('sha256').update(migration).digest('hex'),before:beforePlans,after:afterPlans,metadata_preserved:metadataBefore,stats_before:statsBefore,stats_after:stats,groups_passed:passed};
 writeFileSync(process.env.QA_DISCOVERY_EVIDENCE||'/tmp/zoi-discovery-geography-plans.json',JSON.stringify(report,null,2));console.log(passed+' discovery geography database groups passed');
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

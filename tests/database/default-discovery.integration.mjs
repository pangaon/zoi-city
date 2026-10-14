// Actual isolated PostgreSQL: compare full public JSON with the prior RPC oracle.
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'zoi-default-page-')),bin='/usr/lib/postgresql/16/bin';
const env={...process.env,PGHOST:dir,PGPORT:'15681',PGDATABASE:'postgres',PGUSER:'postgres'};
const q=sql=>execFileSync(join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',sql],{env,encoding:'utf8',maxBuffer:8e6,stdio:['pipe','pipe','pipe']}).trim();
const parse=sql=>JSON.parse(q(sql));let started=false,checks=0;
const predicate="publish_status='published' AND moderation_status IN('clean','cleared') AND coalesce(marketplace_status,'')<>'hidden'";
try {
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-U','postgres','-A','trust','--locale=en_US.UTF-8'],{stdio:'ignore'});
 execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',`-k ${dir} -p 15681 -c listen_addresses=''`,'-w','start'],{stdio:'ignore'});started=true;
 q(`CREATE SCHEMA zoi;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE TABLE zoi.categories(id bigint PRIMARY KEY,label_en text);INSERT INTO zoi.categories VALUES(1,'Actual category');
 CREATE TABLE zoi.listings(id uuid PRIMARY KEY,slug text,name text,entity_type text,city text,country text,region text,region_code text,region_native text,
 verification_status text,trust_score numeric,publish_status text,moderation_status text,marketplace_status text,search_tsv tsvector,
 website text,photo_url text,description text,profile jsonb DEFAULT '{}',primary_category_id bigint DEFAULT 1,rating numeric,owner_workspace_id uuid,claim_status text);
 ALTER TABLE zoi.listings ENABLE ROW LEVEL SECURITY;
 CREATE FUNCTION zoi.geo_country_canon(text)RETURNS text LANGUAGE sql IMMUTABLE AS $$SELECT CASE lower(nullif(trim(coalesce($1,'')),''))WHEN 'ca'THEN 'Canada'WHEN 'usa'THEN 'United States'ELSE nullif(trim($1),'')END$$;
 CREATE FUNCTION zoi.public_listing_card_input(uuid,text,text,text,jsonb)RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$SELECT jsonb_build_object('photo',$3,'description',$4)$$;
 CREATE FUNCTION zoi.public_listing_card_description(text,jsonb)RETURNS text LANGUAGE sql IMMUTABLE AS $$SELECT $2->>'description'$$;
 CREATE FUNCTION zoi.public_listing_card_photo(jsonb)RETURNS text LANGUAGE sql IMMUTABLE AS $$SELECT $1->>'photo'$$;
 INSERT INTO zoi.listings(id,slug,name,city,country,verification_status,trust_score,entity_type,publish_status,moderation_status,marketplace_status,description,photo_url,profile,search_tsv)
 SELECT md5(i::text)::uuid,'listing-'||i,CASE WHEN i%3=0 THEN 'Case'||(i/3)::text WHEN i%3=1 THEN ' case'||((i-1)/3)::text||' 'ELSE 'Record '||i END,
 CASE WHEN i%3=1 THEN 'CITY 'ELSE 'City'END,CASE WHEN i%3=1 THEN 'ca'ELSE 'Canada'END,
 CASE WHEN i%71=0 THEN NULL WHEN i%2=0 THEN 'verified'ELSE 'unverified'END,CASE WHEN i%97=0 THEN NULL ELSE i%20 END,
 CASE WHEN i%3=0 THEN 'creator'WHEN i%3=1 THEN 'business'ELSE 'artist'END,'published',CASE WHEN i%113=0 THEN 'pending'WHEN i%5=0 THEN 'cleared'ELSE 'clean'END,
 CASE WHEN i%127=0 THEN 'hidden'ELSE NULL END,'Source description '||i,'https://example.org/'||i||'.jpg','{"private_not_projected":true}',to_tsvector('simple','record') FROM generate_series(1,35000)i;
 INSERT INTO zoi.listings(id,slug,name,city,country,verification_status,trust_score,entity_type,publish_status,moderation_status,marketplace_status)
 SELECT md5('loser'||i)::uuid,'loser-'||i,'Tie group','City','Canada',NULL,200,'business','published','clean',''FROM generate_series(1,2000)i;
 INSERT INTO zoi.listings(id,slug,name,city,country,verification_status,trust_score,entity_type,publish_status,moderation_status,marketplace_status)VALUES
 ('ffffffff-ffff-4fff-8fff-fffffffffff1','creator-winner','Tie group','City','ca',NULL,200,'creator','published','clean',''),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','hidden-loser','Suppressed group','City','Canada',NULL,999,'creator','published','clean','hidden'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','pending-loser','Suppressed group','City','Canada','verified',999,'artist','published','pending',''),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3','draft-loser','Suppressed group','City','Canada','verified',999,'artist','draft','clean',''),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4','public-winner','Suppressed group','City','Canada',NULL,300,'business','published','cleared',NULL),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5','null-winner',NULL,NULL,NULL,NULL,NULL,NULL,'published','clean',NULL),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee6','empty-loser','','','','verified',100,'creator','published','clean','');
 CREATE INDEX listings_public_global_rank_idx ON zoi.listings(lower(trim(coalesce(name,''))),lower(trim(coalesce(city,''))),lower(trim(coalesce(zoi.geo_country_canon(country),''))),
 (verification_status='verified')DESC,trust_score DESC NULLS LAST,(CASE entity_type WHEN 'creator'THEN 0 WHEN 'artist'THEN 1 WHEN 'business'THEN 2 ELSE 3 END),name,id)
 INCLUDE(verification_status,entity_type,city,country)WHERE ${predicate};`);
 q(readFileSync(new URL('../fixtures/explore-default-source.sql',import.meta.url),'utf8'));
 q("REVOKE ALL ON FUNCTION public.explore_search(text,text,text,text,integer,integer,text)FROM PUBLIC;GRANT EXECUTE ON FUNCTION public.explore_search(text,text,text,text,integer,integer,text)TO anon,authenticated,service_role;");
 assert.equal(q("select md5(pg_get_functiondef('public.explore_search(text,text,text,text,integer,integer,text)'::regprocedure))"),'f5b9d07ea1653f23b47eb7f80da52721');
 q(readFileSync(new URL('../../supabase/migrations/20261014043104_bounded_default_discovery_page.sql',import.meta.url),'utf8'));
 q('VACUUM ANALYZE zoi.listings');
 const compare=args=>{assert.deepEqual(parse('SELECT public.explore_search('+args+')'),parse('SELECT zoi.explore_search_before_default_page('+args+')'));checks++;};
 for(const limit of ['NULL','-1','0','1','24','48','1000'])for(const offset of ['NULL','-1','0','1','23','24','48','240','241','900','90000'])compare(`'',NULL,NULL,NULL,${limit},${offset},NULL`);
 for(const args of ["NULL,NULL,NULL,NULL,24,0,NULL","'   ','','','',24,0,''","E'\\t',NULL,NULL,NULL,24,0,NULL","'Case',NULL,NULL,NULL,24,0,NULL","'','creator',NULL,NULL,24,0,NULL","'',NULL,'City',NULL,24,0,NULL","'',NULL,' ',NULL,24,0,NULL","'',NULL,NULL,'Canada',24,0,NULL","'',NULL,NULL,'%an%',24,0,NULL","'',NULL,NULL,NULL,24,0,' '"])compare(args);
 const rows=parse("SELECT public.explore_search('',NULL,NULL,NULL,48,0,NULL)");assert(rows.every(r=>!('private_not_projected'in r)&&!('profile'in r)));checks++;
 assert.equal(rows[0].slug,'public-winner');assert.equal(rows[1].slug,'creator-winner');assert(!rows.some(r=>r.slug?.startsWith('loser-')));checks++;
 assert.equal(q("select has_function_privilege('anon','zoi.explore_default_page(integer,integer)','execute')"),'f');
 assert.equal(q("select has_function_privilege('authenticated','zoi.explore_search_before_default_page(text,text,text,text,integer,integer,text)','execute')"),'f');
 assert.equal(q("select has_function_privilege('anon','public.explore_search(text,text,text,text,integer,integer,text)','execute')"),'t');checks++;
 assert.equal(q("set role anon;select jsonb_array_length(public.explore_search('',NULL,NULL,NULL,5,0,NULL));reset role;"),'5');checks++;
 const definition=q("select prosrc from pg_proc where oid='zoi.explore_default_page(integer,integer)'::regprocedure");
 const plan=parse('EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON)'+definition.replace(/\bp_limit\b/g,'24').replace(/\bp_offset\b/g,'0'));
 const flat=node=>[node,...(node.Plans||[]).flatMap(flat)],nodes=flat(plan[0].Plan);
 assert(nodes.some(n=>n['Index Name']==='listings_public_default_page_idx'));
 assert(nodes.some(n=>n['Index Name']==='listings_public_global_rank_idx'));
 assert(!nodes.some(n=>n['Node Type']==='WindowAgg'));checks++;
 console.log(JSON.stringify({passed:checks,fixture_rows:37007,full_json_oracle:true,indexes:nodes.filter(n=>n['Index Name']).map(n=>({index:n['Index Name'],rows:n['Actual Rows'],loops:n['Actual Loops']})),execution_ms:plan[0]['Execution Time'],production_latency:'not measured'}));
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

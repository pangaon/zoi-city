import{mkdtempSync,readFileSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{execFileSync,execFile}from'node:child_process';import{promisify}from'node:util';import assert from'node:assert/strict';
const run=promisify(execFile),dir=mkdtempSync(join(tmpdir(),'zoi-country-')),bin='/usr/lib/postgresql/16/bin',env={...process.env,PGHOST:dir,PGPORT:'15529',PGDATABASE:'postgres'};let started=false;async function sql(q){return(await run(join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',q],{env})).stdout.trim();}
try{execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-A','trust','--no-locale'],{stdio:'ignore'});execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',`-k ${dir} -p 15529 -c listen_addresses=''`,'-w','start'],{stdio:'ignore'});started=true;
await sql(`create role anon;create role authenticated;create role service_role;create schema zoi;create table zoi.categories(id integer primary key,slug text,label_en text);create table zoi.listings(id integer primary key,name text,slug text,entity_type text,primary_category_id integer,country text,region text,region_native text,region_code text,city text,publish_status text,moderation_status text,marketplace_status text,verification_status text,trust_score numeric,description text,profile jsonb,photo_url text,latitude numeric,longitude numeric);create function zoi.geo_country_canon(s text)returns text language sql immutable as $$select case s when 'US' then 'United States' when 'CA' then 'Canada' else nullif(s,'') end$$;insert into zoi.categories values(1,'orthodox-churches','Greek Orthodox Churches'),(2,'restaurants','Restaurants');insert into zoi.listings(id,name,slug,entity_type,primary_category_id,country,region,city,publish_status,moderation_status,verification_status,trust_score,profile)select i,'Parish '||i,'parish-'||i,'church',1,case when i%2=0 then 'US' else 'United States' end,'New York','New York','published','clean','unverified',10,jsonb_build_object('description','Public description','large',repeat(md5(i::text),400)) from generate_series(1,1000)i;update zoi.listings set moderation_status='flagged' where id=1;update zoi.listings set publish_status='archived' where id=2;update zoi.listings set marketplace_status='hidden' where id=3;update zoi.listings set moderation_status='cleared',verification_status='verified' where id=4;`);
await sql(readFileSync(new URL('../../supabase/migrations/20260930071145_fast_public_place_hubs.sql',import.meta.url),'utf8'));


const before=JSON.parse(await sql("select to_json(prosrc) from pg_proc where oid='public.explore_countries()'::regprocedure;"));
await sql(`create function public.countries_before()returns table(country text,listings bigint,regions bigint,cities bigint)language sql stable security definer set search_path='' as $before$ ${before} $before$;`);
await sql(readFileSync(new URL('../../supabase/migrations/20260930205916_explore_countries_single_public_scan.sql',import.meta.url),'utf8'));
const result=async fn=>JSON.parse(await sql(`set role anon;select coalesce(jsonb_agg(x),'[]')from public.${fn}()x;`));
assert.deepEqual(await result('explore_countries'),await result('countries_before'));
console.log('PASS alias merging and distinct place counts match prior public contract');
await sql(`insert into zoi.listings(id,country,region,city,publish_status,moderation_status,marketplace_status)values
(1001,'CA',null,null,'published','clean',null),(1002,'Canada','','','published','cleared',null),
(1003,'CA','Ontario','Toronto','published','flagged',null),(1004,'CA','Hidden','Hidden','published','clean','hidden'),
(1005,'CA','Draft','Draft','draft','clean',null),(1006,'CA','Unknown','Unknown','published',null,null),
(1007,null,'Null','Null','published','clean',null),(1008,'','Empty','Empty','published','clean',null),
(1009,'  ','Space','Space','published','clean',null);
create or replace function zoi.geo_country_canon(s text)returns text language sql immutable as $$select case s when 'US' then 'United States' when 'CA' then 'Canada' else nullif(trim(s),'') end$$;`);
assert.deepEqual(await result('explore_countries'),await result('countries_before'));
const ca=(await result('explore_countries')).find(x=>x.country==='Canada');assert.deepEqual(ca,{country:'Canada',listings:2,regions:1,cities:1});
await sql("update zoi.listings set marketplace_status='hidden' where id=1001;");assert.equal((await result('explore_countries')).find(x=>x.country==='Canada').listings,1);
assert.deepEqual(await result('explore_countries'),await result('countries_before'));
console.log('PASS moderation/publish/hidden/nulls/empty strings and immediate visibility change');
await sql('set role anon;select *from zoi.listings').then(()=>assert.fail('private table accessible'),()=>{});
assert.equal(await sql("select prosecdef and proconfig=array['search_path=\"\"'] from pg_proc where oid='public.explore_countries()'::regprocedure;"),'t');
console.log('PASS definer/searchpath contract and no direct public table access');
await sql(`alter table zoi.listings add column padding text;alter table zoi.listings alter column padding set storage plain;
insert into zoi.listings(id,country,region,city,publish_status,moderation_status,padding)select i,case when i%3=0 then 'CA' when i%3=1 then 'Canada' else 'US' end,'Region'||(i%40),'City'||(i%400),'published','clean',repeat(md5(i::text),64)from generate_series(2000,33999)i;
create index country_counts_fixture on zoi.listings(entity_type)where publish_status='published' and moderation_status in('clean','cleared')and coalesce(marketplace_status,'')<>'hidden';`);
await sql('vacuum analyze zoi.listings;');
assert.deepEqual(await result('explore_countries'),await result('countries_before'));
const timings=[];for(let i=0;i<4;i++){const pair={};for(const fn of i%2?['explore_countries','countries_before']:['countries_before','explore_countries']){const plan=JSON.parse(await sql(`explain(analyze,buffers,format json)select *from public.${fn}();`))[0];pair[fn]={ms:plan['Execution Time'],hits:plan.Plan['Shared Hit Blocks']};}timings.push(pair);}
console.log(JSON.stringify({rows:33009,alternating_timings:timings}));
assert(timings.every(x=>x.explore_countries.hits<x.countries_before.hits));
console.log('PASS exact wide33009row aggregate parity and measured reduction in buffer visits');
await sql(readFileSync(new URL('../../ops/verify-explore-countries.sql',import.meta.url),'utf8'));console.log('PASS production read-only rollback fixture');
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

import {mkdtempSync,readFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'zoi-address-')),bin='/usr/lib/postgresql/16/bin',env={...process.env,PGHOST:dir,PGPORT:'15683',PGDATABASE:'postgres',PGUSER:'postgres'};let started=false,checks=0;
const q=s=>execFileSync(join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',s],{env,encoding:'utf8',maxBuffer:8e6,stdio:['pipe','pipe','pipe']}).trim();const rows=s=>JSON.parse(q('select public.explore_map_address_search('+s+')'));
try{execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-U','postgres','-A','trust','--no-locale'],{stdio:'ignore'});execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',`-k ${dir} -p 15683 -c listen_addresses=''`,'-w','start'],{stdio:'ignore'});started=true;
q(`create schema zoi;create schema extensions;create extension pg_trgm with schema public;create role anon;create role authenticated;create role service_role;
create table zoi.listings(id uuid primary key,slug text,name text,entity_type text,address text,city text,country text,verification_status text,trust_score numeric,publish_status text,moderation_status text,marketplace_status text,profile jsonb default '{}');alter table zoi.listings enable row level security;
create function zoi.geo_country_canon(text)returns text language sql immutable as $$select case lower(trim($1))when 'ca'then 'Canada'when 'usa'then 'United States'else trim($1)end$$;
insert into zoi.listings(id,slug,name,entity_type,address,city,country,verification_status,trust_score,publish_status,moderation_status)
select md5(i::text)::uuid,'other-'||i,'Other '||i,'business','Other Street '||i,'Other City','Canada','unverified',0,'published','clean'from generate_series(1,35000)i;
insert into zoi.listings(id,slug,name,entity_type,address,city,country,verification_status,trust_score,publish_status,moderation_status,marketplace_status,profile)values
('11111111-1111-4111-8111-111111111111','actual','Actual place','business','15 Actual Street','Toronto','Canada','verified',50,'published','clean',null,'{"private":"must not project"}'),
('11111111-1111-4111-8111-111111111112','duplicate','Actual place','business','15 Actual Street','Toronto','ca','unverified',10,'published','clean',null,'{}'),
('11111111-1111-4111-8111-111111111113','another-branch','Actual place','business','17 Actual Street','Toronto','Canada','verified',49,'published','cleared',null,'{}'),
('11111111-1111-4111-8111-111111111114','hidden','Hidden','business','15 Actual Street','Toronto','Canada','verified',99,'published','clean','hidden','{}'),
('11111111-1111-4111-8111-111111111115','draft','Draft','business','15 Actual Street','Toronto','Canada','verified',99,'draft','clean',null,'{}'),
('11111111-1111-4111-8111-111111111116','pending','Pending','business','15 Actual Street','Toronto','Canada','verified',99,'published','pending',null,'{}'),
('11111111-1111-4111-8111-111111111117','artist','Artist','artist','15 Actual Street','Athens','Greece','verified',50,'published','clean',null,'{}'),
('11111111-1111-4111-8111-111111111118','literal','Literal','business','A%_\\ Street','Toronto','Canada','verified',50,'published','clean',null,'{}');`);
q(readFileSync(new URL('../../supabase/migrations/20261014052314_public_map_address_search.sql',import.meta.url),'utf8'));q('vacuum analyze zoi.listings');
let result=rows("'Actual Street','Toronto','ca',array['business'],32");assert.deepEqual(result.map(r=>r.slug),['actual','another-branch']);assert(result.every(r=>!('profile'in r)&&!('latitude'in r)&&!('longitude'in r)&&r.path==='/p/'+r.slug));checks++;
assert.equal(rows("'Actual Street','Athens','Greece',array['artist'],32")[0].slug,'artist');checks++;
assert.equal(rows("'Actual Street','Toronto','Canada',array[]::text[],32").length,0);checks++;
assert.equal(rows("'A%_\\',null,null,null,32")[0].slug,'literal');checks++;
assert.equal(rows("'%',null,null,null,32").length,0);assert.equal(rows("'z',null,null,null,32").length,0);checks++;
for(const limit of [-1,0,1,1000]){assert(rows("'Other Street',null,null,null,"+limit).length<=Math.min(Math.max(limit,1),32));checks++;}
assert.throws(()=>rows("repeat('x',201),null,null,null,32"),/invalid_map_address_search/);assert.throws(()=>rows("'street',null,null,array['bad);drop'],32"),/invalid_map_address_search/);checks++;
assert.equal(q("set role anon;select jsonb_array_length(public.explore_map_address_search('Actual Street','Toronto','Canada',array['business'],32));reset role;"),'2');assert.equal(q("select has_table_privilege('anon','zoi.listings','select')"),'f');checks++;
const plan=JSON.parse(q("explain(analyze,buffers,format json)select id from zoi.listings where publish_status='published'and moderation_status in('clean','cleared')and coalesce(marketplace_status,'')<>'hidden'and nullif(btrim(address),'')is not null and lower(address)like '%actual street%'"));const flat=n=>[n,...(n.Plans||[]).flatMap(flat)];assert(flat(plan[0].Plan).some(n=>n['Index Name']==='listings_public_address_trgm_idx'));checks++;
console.log(JSON.stringify({passed:checks,fixture_rows:35008,anonymous_public_reader:true,private_profile_and_coordinates_absent:true,index_used:true,execution_ms:plan[0]['Execution Time']}));
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

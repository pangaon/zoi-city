#!/usr/bin/env node
// Real isolated PostgreSQL transactions; no Supabase/network calls.
// Requires PostgreSQL16 server binaries installed. Run explicitly with node.
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
const run=promisify(execFile),dir=mkdtempSync(join(tmpdir(),'zoi-seats-pg-')),bin=process.env.PG_BIN||'/usr/lib/postgresql/16/bin';
const port=15532;const env={...process.env,PGHOST:dir,PGPORT:String(port),PGDATABASE:'postgres'};
const actor='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',member='00000000-0000-4000-8000-000000000003',ws='10000000-0000-4000-8000-000000000001',event='20000000-0000-4000-8000-000000000001';
const literal=x=>"'"+String(x).replace(/'/g,"''")+"'";
const sql=(query,user)=>`${user?`set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`:''}${query}`;
async function query(q,user){let r;try{r=await run(join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',sql(q,user)],{env});}catch(e){throw Object.assign(new Error(e.stderr),{stderr:e.stderr});}return r.stdout.trim().split('\n').filter(Boolean).at(-1);}
async function rejects(q,user,pattern){try{await query(q,user);assert.fail('Expected SQL rejection');}catch(e){assert.match(e.stderr||e.message,pattern);}}
let started=false,checks=0;
const pass=name=>{checks++;console.log('PASS '+name);};
try{
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-A','trust','--no-locale'],{stdio:'ignore'});
 execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'server.log'),'-o',`-k ${dir} -p ${port} -c listen_addresses=''`,'-w','start'],{stdio:'ignore'});started=true;
 await query(`create role anon;create role authenticated;create role service_role;create schema zoi;grant usage on schema zoi to service_role;
 create table zoi.listings(id uuid primary key,name text,entity_type text,primary_category_id bigint,city text,country text,address text,owner_workspace_id uuid,slug text unique,website text,profile jsonb default '{}',verification_status text,publish_status text default 'published',marketplace_status text,updated_at timestamptz default now());
 create function zoi.profile_strip(p jsonb) returns jsonb language sql as $$select p-'rating'-'_enrich'$$;
 create function public.enrich_queue_lease(p_limit integer default40,p_max_age_days integer default30,p_lease_minutes integer default15) returns table(slug text,website text,lease_id text) language plpgsql security definer as $$begin return query select * from zoi.enrich_queue_lease(p_limit,p_max_age_days,p_lease_minutes);end$$;
 create function public.enrich_apply(p_batch jsonb) returns table(slug text,applied boolean) language plpgsql security definer as $$begin return query select * from zoi.enrich_apply(p_batch);end$$;
 revoke all on function public.enrich_queue_lease(integer,integer,integer),public.enrich_apply(jsonb) from public,anon,authenticated;grant execute on function public.enrich_queue_lease(integer,integer,integer),public.enrich_apply(jsonb) to service_role;` .replaceAll('default40','default 40').replaceAll('default30','default 30').replaceAll('default15','default 15'));
 await query(readFileSync(new URL('../../supabase/migrations/20260930042432_enrichment_resilient_leases.sql',import.meta.url),'utf8'));
 await query(`alter table zoi.listings add column source_url text,add column moderation_status text default 'clean';`);
 await query(readFileSync(new URL('../../supabase/migrations/20260930053625_listing_quality_coverage.sql',import.meta.url),'utf8'));
 await query(readFileSync(new URL('../../supabase/migrations/20260930090004_preserve_blocked_enrichment_evidence.sql',import.meta.url),'utf8'));
 const j=x=>literal(JSON.stringify(x))+'::jsonb';
 const service=q=>query('set role service_role;'+q);
 const id='30000000-0000-4000-8000-000000000001';
 await query(`insert into zoi.listings(id,slug,name,entity_type,website,profile)values('${id}','blocked-fixture','QA','business','https://example.org/',${j({description:'OWNER',_enrich:{photo_url:'https://example.org/old.jpg',member:{name:'Reviewed'},checked_at:'2026-09-16',provenance:{photo_url:'reviewed'}}})});`);
 for(const payload of [{blocked:'true',blocked_reason:'http403'},{crawl_status:'error',blocked:'true',blocked_reason:'robots'},{crawl_status:'error',last_error:'timeout'}]){
  await query(`update zoi.listings set profile=jsonb_set(profile,'{_enrich}',(profile->'_enrich')-'blocked'-'blocked_reason');`);
  const lease=JSON.parse(await service(`select jsonb_agg(t)from public.enrich_sample_lease(array['${id}'::uuid])t;`))[0];
  assert.equal(await service(`select applied from public.enrich_apply(${j([{...lease,profile:payload}])});`),'t');
  const p=JSON.parse(await query(`select profile from zoi.listings where id='${id}';`));
  assert.equal(p.description,'OWNER');assert.equal(p._enrich.photo_url,'https://example.org/old.jpg');assert.equal(p._enrich.checked_at,'2026-09-16');assert.deepEqual(p._enrich.member,{name:'Reviewed'});assert.deepEqual(p._enrich.provenance,{photo_url:'reviewed'});assert.equal(p._enrich.crawl_status,'error');assert.ok(p._enrich.last_attempt_at);assert.equal(p._coverage.tasks.enrichment.status,payload.blocked?'blocked':'retry');
  if(payload.blocked){assert.equal(p._enrich.blocked,'true');assert.equal(p._enrich.blocked_reason,payload.blocked_reason);assert.equal(await service(`select count(*)from public.enrich_queue_lease(3);`),'0');}
  assert.equal(await service(`select applied from public.enrich_apply(${j([{...lease,profile:payload}])});`),'f');
  pass('preserve owner and reviewed source data; bounded block and replay fence '+JSON.stringify(payload));
 }
 await query(`update zoi.listings set profile=jsonb_set(profile,'{_enrich}',(profile->'_enrich')-'blocked'-'blocked_reason');`);
 const lease=JSON.parse(await service(`select jsonb_agg(t)from public.enrich_sample_lease(array['${id}'::uuid])t;`))[0];
 assert.equal(await service(`select applied from public.enrich_apply(${j([{...lease,profile:{phone:'NEW'},provenance:{phone:'source'}}])});`),'t');
 assert.equal(await query(`select profile#>>'{_enrich,phone}'from zoi.listings where id='${id}';`),'NEW');pass('successful extraction unchanged');
 assert.equal(await query("select has_function_privilege('anon','public.enrich_apply(jsonb)','execute') or has_function_privilege('authenticated','public.enrich_apply(jsonb)','execute');"),'f');pass('service-only grants unchanged');
 await query("create table zoi.categories(id bigint);insert into zoi.categories values(1);create table zoi.user_profiles(id uuid,auth_user_id uuid);create table zoi.workspace_members(workspace_id uuid,profile_id uuid,role text);insert into zoi.user_profiles values('21a04e78-e3b1-448e-8517-47aad25dd5da','2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd');insert into zoi.workspace_members values('053a5656-b19b-48a4-8721-65c4674f647c','21a04e78-e3b1-448e-8517-47aad25dd5da','owner');");
 const rollback=JSON.parse(await query(readFileSync(new URL('../../ops/qa-enrichment-blocked-rollback.sql',import.meta.url),'utf8')));assert.equal(rollback.persisted_fixtures,0);assert.equal(rollback.ok,true);pass('exact dedicated QA rollback fixture no retained rows');
 console.log(`# ${checks} blocked enrichment checks passed`);
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

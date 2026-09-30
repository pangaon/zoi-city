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
const port=15495;const env={...process.env,PGHOST:dir,PGPORT:String(port),PGDATABASE:'postgres'};
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
 await query(readFileSync(new URL('../../supabase/migrations/20260930040222_enrichment_resilient_leases.sql',import.meta.url),'utf8'));
 const id='30000000-0000-4000-8000-000000000001',j=x=>literal(JSON.stringify(x))+'::jsonb';
 await query(`insert into zoi.listings(id,slug,website,profile) values('${id}','fixture','https://business.example.org/',${j({description:'Owner text',photo_url:'https://owner.example.org/photo.jpg',_enrich:{checked_at:'2026-01-01',phone:'1234567',photo_url:'https://business.example.org/old.jpg',source_url:'https://business.example.org/',provenance:{phone:'tel-link'}}})});`);
 const sample=()=>query(`select coalesce(jsonb_agg(x),'[]') from public.enrich_sample_lease(array['${id}']::uuid[])x;`).then(JSON.parse);
 const apply=(lease,profile)=>query(`select coalesce(jsonb_agg(x),'[]') from public.enrich_apply(${j([{slug:'fixture',website:'https://business.example.org/',lease_id:lease,profile,provenance:{photo_url:'page-image'}}])})x;`).then(JSON.parse);
 await rejects(`set role authenticated;select * from public.enrich_sample_lease(array['${id}']::uuid[]);`,null,/permission denied/);pass('sample leases require service role');
 const first=await sample();assert.equal(first.length,1);assert.equal((await sample()).length,0);assert.equal((await apply('wrong',{phone:'wrong'}))[0].applied,false);pass('active lease cannot be stolen or applied with wrong token');
 assert.equal((await apply(first[0].lease_id,{crawl_status:'error',last_error:'timeout',phone:'wrong'}))[0].applied,true);
 let p=JSON.parse(await query(`select profile from zoi.listings where id='${id}';`));assert.equal(p._enrich.phone,'1234567');assert.equal(p._enrich.checked_at,'2026-01-01');assert.equal(p.description,'Owner text');assert.equal(p.photo_url,'https://owner.example.org/photo.jpg');assert.ok(p._enrich.last_attempt_at);assert.equal(p._enrich.lease,undefined);pass('transient failure preserves all last-good source fields, source date and owner edits');
 assert.equal(await query('select count(*) from public.enrich_queue_lease();'),'0');await query(`update zoi.listings set profile=jsonb_set(profile,'{_enrich,last_attempt_at}',to_jsonb((now()-interval '7 hours')::text));`);const retry=JSON.parse(await query('select jsonb_agg(x) from public.enrich_queue_lease()x;'));assert.equal(retry.length,1);pass('normal queue backs failed attempts off for six hours');
 await query(`update zoi.listings set website='https://newowner.example.org/' where id='${id}';`);assert.equal((await apply(retry[0].lease_id,{phone:'oldsite'}))[0].applied,false);pass('website edit during fetch prevents obsolete source data being applied');
 await query(`update zoi.listings set website='https://business.example.org/',profile=jsonb_set(profile,'{_enrich,lease,expires_at}',to_jsonb((now()-interval '1 minute')::text));`);assert.equal((await apply(retry[0].lease_id,{phone:'expired'}))[0].applied,false);pass('expired lease returns explicit false receipt without write');
 const concurrent=await Promise.all([sample(),sample()]);assert.equal(concurrent.flat().length,1);const lease=concurrent.flat()[0].lease_id;assert.equal((await apply(lease,{photo_url:null,photo_urls:[],phone:'7654321'}))[0].applied,true);p=JSON.parse(await query(`select profile from zoi.listings where id='${id}';`));assert.equal(p._enrich.photo_url,null);assert.deepEqual(p._enrich.photo_urls,[]);assert.equal(p._enrich.phone,'7654321');assert.equal(p._enrich.crawl_status,undefined);assert.equal(p.photo_url,'https://owner.example.org/photo.jpg');pass('new successful crawl deliberately clears machine fields and retains owner overrides');
 assert.equal((await apply(lease,{phone:'replay'}))[0].applied,false);pass('consumed lease cannot replay a write');
 await query(`update zoi.listings set profile=jsonb_set(profile,'{_enrich,checked_at}','"2026-99-99"');`);assert.equal(await query('select count(*) from public.enrich_queue_lease();'),'1');pass('malformed legacy dates do not poison the entire queue');
 await query(`create table zoi.categories(id bigint);insert into zoi.categories values(1);create table zoi.user_profiles(id uuid,auth_user_id uuid);insert into zoi.user_profiles values('21a04e78-e3b1-448e-8517-47aad25dd5da','2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd');create table zoi.workspace_members(workspace_id uuid,profile_id uuid,role text);insert into zoi.workspace_members values('053a5656-b19b-48a4-8721-65c4674f647c','21a04e78-e3b1-448e-8517-47aad25dd5da','owner');`);
 const proof=JSON.parse(await query(readFileSync(new URL('../../ops/qa-enrichment-resilience-rollback.sql',import.meta.url),'utf8')));assert.equal(proof.persisted_fixtures,0);pass('exact proposed production proof rolls back all fixture state');
 console.log(`${checks} enrichment resilience checks passed`);
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

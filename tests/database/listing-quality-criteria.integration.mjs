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
const port=15499;const env={...process.env,PGHOST:dir,PGPORT:String(port),PGDATABASE:'postgres'};
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
 const ids=Array.from({length:7},(_,i)=>`30000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`),j=x=>literal(JSON.stringify(x))+'::jsonb';
 await query(`insert into zoi.listings(id,slug,name,entity_type,website,profile)select ('30000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'fixture-'||i,'Person '||i,'professional','https://association.example/profile/'||i,'{"description":"Owner text","photo_url":"https://owner.example/photo.jpg"}'from generate_series(1,7)i;update zoi.listings set publish_status='draft'where id='${ids[1]}';update zoi.listings set marketplace_status='hidden'where id='${ids[2]}';update zoi.listings set moderation_status='flagged'where id='${ids[3]}';update zoi.listings set website=null where id='${ids[4]}';update zoi.listings set owner_workspace_id='${ws}'where id='${ids[5]}';`);

 await query("create table zoi.categories(id bigint primary key,slug text);insert into zoi.categories values(21,'restaurants');");
 await query(readFileSync(new URL('../../supabase/migrations/20260930074014_listing_quality_criterion_signoffs.sql',import.meta.url),'utf8'));
 const service=q=>query('set role service_role;'+q),check=async()=>JSON.parse(await service(`select public.listing_quality_checklist('${ids[0]}')`));
 let state=await check();assert(state.criteria.every(c=>c.status==='pending'));assert.equal(state.complete,false);pass('every listing has individual pending master criteria without receipt seeding');
 await rejects(`set role authenticated;select public.listing_quality_checklist('${ids[0]}')`,null,/permission denied/);pass('private evidence reporting is service only');
 await query(`update zoi.listings l set profile=jsonb_set(profile,'{_enrich}',jsonb_build_object('lease',jsonb_build_object('id','criterion-lease','task','classification','fingerprint',zoi.listing_quality_fingerprint(l),'expires_at',now()+interval '15 minutes')))where id='${ids[0]}'`);
 state=await check();const fp=state.source_fingerprint,commit='a'.repeat(40),evidence={kind:'source',performed:true,observations:'Compared the exact person identity against source body.',refs:[{uri:'https://ci.example.org/artifact/identity',sha256:'b'.repeat(64)}],blockers:[]};
 const record=(request,stage,actor,specialist=null,e=evidence,f=fp,c=commit)=>`select public.listing_quality_criterion_record('${request}','${ids[0]}','identity',1,'${stage}','${actor}',${specialist?literal(specialist):'null'},'criterion-lease','${f}','${c}','passed',${j(e)})`;
 const req='60000000-0000-4000-8000-000000000001',review='60000000-0000-4000-8000-000000000002';
 await rejects('set role service_role;'+record(req,'specialist','worker-one',null,{...evidence,blockers:['unverified source']}),null,/blockers_prevent_signoff/);pass('blockers cannot be signed off');
 const a=JSON.parse(await service(record(req,'specialist','worker-one')));assert.equal(JSON.parse(await service(record(req,'specialist','worker-one'))).id,a.id);assert.equal((await check()).criteria.find(c=>c.key==='identity').status,'awaiting_independent_review');pass('specialist receipt is idempotent and is not final signoff');
 await rejects('set role service_role;'+record(review,'reviewer','worker-one',a.id),null,/independent_review_required/);
 const b=JSON.parse(await service(record(review,'reviewer','worker-two',a.id,{...evidence,refs:[{uri:'https://ci.example.org/artifact/independent',sha256:'c'.repeat(64)}]})));assert(b.id);assert.equal((await check()).criteria.find(c=>c.key==='identity').status,'signed_off');assert.equal((await check()).complete,false);pass('distinct reviewer can sign one criterion but not imply listing completion');
 await rejects('set role service_role;'+record(req,'specialist','different-worker'),null,/request_conflict/);pass('request reuse with altered evidence rejected');
 await query(`update zoi.listings set profile=profile||'{"description":"Updated owner wording"}'where id='${ids[0]}'`);assert.equal((await check()).criteria.find(c=>c.key==='identity').status,'pending_recheck');pass('owner content change invalidates evidence without changing owner content');
 await service(`select public.listing_quality_criterion_revise('identity',1,'Shared identity parser changed; source comparison and independent review required again.')`);assert.equal((await check()).criteria.find(c=>c.key==='identity').status,'pending');assert.equal(await query(`select profile->>'description'from zoi.listings where id='${ids[0]}'`),'Updated owner wording');pass('shared master revision invalidates every affected listing without owner writes');
 const hidden=JSON.parse(await service(`select public.listing_quality_checklist('${ids[2]}')`));assert(hidden.criteria.every(c=>c.status==='blocked_visibility'));pass('hidden records remain represented with blockers');

 await query(`update zoi.listings set primary_category_id=21,entity_type='business' where id='${ids[0]}'`);const restaurant=await check();assert.equal(restaurant.family,'restaurant');assert(restaurant.criteria.some(c=>c.key==='category.restaurants'));assert(restaurant.criteria.some(c=>c.key==='menu'));pass('verified live taxonomy maps restaurant plus category-specific criteria');
 await query(`update zoi.listings l set profile=jsonb_set(jsonb_set(profile,'{_enrich}','{}'),'{_coverage}',jsonb_build_object('fingerprint',zoi.listing_quality_fingerprint(l),'tasks',jsonb_build_object('classification',jsonb_build_object('status','verified','recorded_at',now()))))where id='${ids[0]}'`);
 const reopened=JSON.parse(await service(`select public.listing_quality_criteria_requeue(null,20)`));assert(reopened.reopened>=1);assert.equal(await query(`select profile#>>'{_coverage,tasks,classification,status}'from zoi.listings where id='${ids[0]}'`),'pending');assert.equal(await query(`select profile->>'description'from zoi.listings where id='${ids[0]}'`),'Updated owner wording');pass('bounded recheck reopens existing task receipts without creating a duplicate queue or losing owner text');

 await query(`create table zoi.user_profiles(id uuid,auth_user_id uuid);create table zoi.workspace_members(workspace_id uuid,profile_id uuid,role text);insert into zoi.user_profiles values('21a04e78-e3b1-448e-8517-47aad25dd5da','2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd');insert into zoi.workspace_members values('053a5656-b19b-48a4-8721-65c4674f647c','21a04e78-e3b1-448e-8517-47aad25dd5da','owner');`);
 const countBefore=await query('select count(*)from zoi.quality_signoffs');await query(readFileSync(new URL('../../ops/qa-quality-criteria-rollback.sql',import.meta.url),'utf8'));assert.equal(await query('select count(*)from zoi.quality_signoffs'),countBefore);pass('exact production rollback fixture passes locally with zero retained signoffs');
 console.log(`Passed ${checks} criterion PostgreSQL checks.`);
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

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
const port=15533;const env={...process.env,PGHOST:dir,PGPORT:String(port),PGDATABASE:'postgres'};
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
 await query(readFileSync(new URL('../../supabase/migrations/20260930090118_bounded_enrichment_evidence_gap_queue.sql',import.meta.url),'utf8'));
 const j=x=>literal(JSON.stringify(x))+'::jsonb';const service=q=>query('set role service_role;'+q);
 async function add(i,m={},extra={}){await query(`insert into zoi.listings(id,slug,name,entity_type,website,verification_status,profile,publish_status,moderation_status,marketplace_status)values('30000000-0000-4000-8000-${String(i).padStart(12,'0')}','gap-${i}','QA','business','https://example.org/${i}','${extra.verified||'unverified'}',${j({_enrich:{checked_at:new Date().toISOString(),...m},...(extra.coverage?{_coverage:{tasks:{enrichment:{status:extra.coverage}}}}:{})})},'${extra.publish||'published'}','${extra.moderation||'clean'}',${extra.hidden?"'hidden'":'null'});`);}
 const lease=()=>service("select coalesce(jsonb_agg(t),'[]'::jsonb)from public.enrich_queue_lease(40)t;").then(JSON.parse);
 const reset=()=>query('truncate zoi.listings;');
 await add(1,{}, {verified:'source_verified'});await add(2);await add(3);await add(4,{crawl_status:'error',checked_at:'2020-01-01',last_attempt_at:'2020-01-01'});await add(5,{crawl_status:'error',checked_at:'2020-01-01'});
 let rows=await lease();assert.equal(rows.length,3);assert.deepEqual(rows.map(r=>r.slug).sort(),['gap-1','gap-2','gap-4']);pass('cap3 and2fresh1retry quota with verified priority');
 rows=await lease();assert.deepEqual(rows.map(r=>r.slug).sort(),['gap-3','gap-5']);pass('leased rows excluded; unused quota fills and progresses');
 await reset();await add(1,{crawl_status:'error'});await add(2,{crawl_status:'error',checked_at:'2020-01-01'});await add(3,{status:'ok'},{coverage:'fetched'});await add(4,{crawl_status:'member_identity_reviewed'});await add(5,{blocked:'true'});await add(6,{}, {publish:'draft'});await add(7,{}, {moderation:'flagged'});await add(8,{}, {hidden:true});await add(9,{status:'ok'});
 rows=await lease();assert.deepEqual(rows.map(r=>r.slug),['gap-2']);pass('legacy checked date backoff; fetched/member/blocked/private/moderation exclusions');
 await reset();await add(1,{status:'ok',checked_at:'2020-01-01'});await add(2,{}, {coverage:'pending'});rows=await lease();assert.deepEqual(rows.map(r=>r.slug),['gap-1']);pass('normal stale successful refresh preserved; nonempty coverage not gap');
 await reset();await add(1);await add(2);await add(3);await add(4);
 for(let attempt=0;attempt<8;attempt++){await query("update zoi.listings set profile=jsonb_set(profile,'{_enrich}',(profile->'_enrich')-'lease');");const concurrent=await Promise.all([lease(),lease()]);const all=concurrent.flat().map(x=>x.slug);assert.equal(new Set(all).size,all.length);assert.equal(all.length,4);}pass('eight concurrent lease races never claim same record');
 assert.equal(await query("select has_function_privilege('anon','public.enrich_queue_lease(integer,integer,integer)','execute') or has_function_privilege('authenticated','public.enrich_queue_lease(integer,integer,integer)','execute');"),'f');pass('service-only queue remains private');
 const fixture=JSON.parse(await query(readFileSync(new URL('../../ops/qa-enrichment-gap-queue-rollback.sql',import.meta.url),'utf8')));assert.equal(fixture.ok,true);assert.equal(fixture.actual_listing_leases,0);pass('installed-function temporary clone fixture never leases actual listings');
 console.log(`# ${checks} queue cohort checks passed`);
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

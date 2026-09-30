#!/usr/bin/env node
// Real isolated PostgreSQL transactions; no Supabase/network calls.
// Requires PostgreSQL16 server binaries installed. Run explicitly with node.
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {createLayout,seatRows} from '../../assets/tickets/venue-model.mjs';
const run=promisify(execFile),dir=mkdtempSync(join(tmpdir(),'zoi-seats-pg-')),bin=process.env.PG_BIN||'/usr/lib/postgresql/16/bin';
const port=15485;const env={...process.env,PGHOST:dir,PGPORT:String(port),PGDATABASE:'postgres'};
const actor='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',member='00000000-0000-4000-8000-000000000003',ws='10000000-0000-4000-8000-000000000001',event='20000000-0000-4000-8000-000000000001';
const literal=x=>"'"+String(x).replace(/'/g,"''")+"'";
const sql=(query,user)=>`${user?`set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`:''}${query}`;
async function query(q,user){const r=await run(join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',sql(q,user)],{env});return r.stdout.trim().split('\n').filter(Boolean).at(-1);}
async function rejects(q,user,pattern){try{await query(q,user);assert.fail('Expected SQL rejection');}catch(e){assert.match(e.stderr||e.message,pattern);}}
let started=false,checks=0;
const pass=name=>{checks++;console.log('PASS '+name);};
try{
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-A','trust','--no-locale'],{stdio:'ignore'});
 execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'server.log'),'-o',`-k ${dir} -p ${port} -c listen_addresses=''`,'-w','start'],{stdio:'ignore'});started=true;
 await query(readFileSync(new URL('./venue-fixture.sql',import.meta.url),'utf8'));
 await query(`create role service_role; create table zoi.ai_profiles(workspace_id uuid primary key,business_name text,about text,tone text,languages text,sample text,updated_at timestamptz);create function zoi.ops_role(p_workspace uuid) returns text language sql security definer as $$select m.role from zoi.workspace_members m join zoi.user_profiles p on p.id=m.profile_id where m.workspace_id=p_workspace and p.auth_user_id=auth.uid()$$; update zoi.workspace_members set role='viewer' where profile_id='${member}';insert into zoi.workspace_members values('${ws}','${other}','editor');`);
 await query(readFileSync(new URL('../../supabase/migrations/20260930013516_bounded_ai_generation_ledger.sql',import.meta.url),'utf8'));
 const request=n=>`80000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const begin=(n,user=actor)=>`select public.ai_generation_begin('${user}','${ws}','${request(n)}','${'a'.repeat(64)}','caption','Hello',1,'{}');`;
 await rejects(`select public.ai_profile_save('${ws}','Biz','','','','');`,member,/insufficient_permission/);pass('viewer cannot mutate business AI profile');
 assert.equal(JSON.parse(await query(begin(1))).available,false);pass('disabled runtime makes no reservation');
 await query('update zoi.ai_runtime set enabled=true;');
 await rejects(begin(1),actor,/permission denied/);pass('clients cannot reserve provider spend directly');
 const first=JSON.parse(await query(begin(1)));assert.equal(first.dispatch,true);assert.equal(first.generation.budget_debit_micro_usd,30240);
 assert.equal(JSON.parse(await query(begin(1))).dispatch,false);pass('idempotent retry never dispatches provider twice');
 await rejects(begin(1).replace("'Hello'","'Changed'"),undefined,/generation_request_conflict/);pass('request identifier cannot change input');
 const id=first.generation.id;
 const finish=JSON.parse(await query(`select public.ai_generation_finish('${id}','succeeded','{"text":"Draft"}','{"text":"Draft"}',null,100,20);`));assert.equal(finish.generation.estimated_micro_usd,200);assert.equal(finish.generation.budget_debit_micro_usd,200);pass('provider token estimate replaces conservative reservation');
 assert.equal(JSON.parse(await query(`select public.ai_generation_finish('${id}','failed',null,null,'late_error',null,null);`)).generation.status,'succeeded');pass('terminal settlement is immutable');
 await query(begin(2));await rejects(begin(3),undefined,/generation_rate_limit/);pass('per-user minute rate limit enforced');
 await query('truncate zoi.ai_generations; update zoi.ai_runtime set global_daily_micro_usd=40000;');
 const contenders=await Promise.allSettled([query(begin(4)),query(begin(5,other))]);assert.equal(contenders.filter(x=>x.status==='fulfilled').length,1);assert.equal(await query('select count(*) from zoi.ai_generations;'),'1');pass('concurrent actors cannot overspend global budget');
 await rejects(`select public.ai_generation_get('10000000-0000-4000-8000-000000000002','${id}');`,actor,/not_authorized/);pass('history cannot cross workspace boundary');
 await rejects('select * from zoi.ai_generations;',actor,/permission denied/);pass('raw ledger is private');
 const history=JSON.parse(await query(`select public.ai_generation_history('${ws}');`,member));assert.equal(history.generations.length,1);pass('workspace viewer can read persisted generation history');
 console.log(`${checks} AI database checks passed`);
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

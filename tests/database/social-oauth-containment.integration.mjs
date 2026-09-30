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
 await query(readFileSync(new URL('./community-fixture.sql',import.meta.url),'utf8'));await query(readFileSync(new URL('./social-oauth-fixture.sql',import.meta.url),'utf8'));
 await query(readFileSync(new URL('../../supabase/migrations/20260930034924_social_channel_credential_access_containment.sql',import.meta.url),'utf8'));
 const worker=['social_channels_for_publish','social_channel_upsert','social_oauth_state_put','social_oauth_state_take','social_cron_secret_get','social_due_posts','social_target_record','social_post_finalize'];
 for(const name of worker){assert.equal(await query(`select bool_and(not has_function_privilege('anon',oid,'EXECUTE') and not has_function_privilege('authenticated',oid,'EXECUTE') and has_function_privilege('service_role',oid,'EXECUTE')) from pg_proc where proname='${name}';`),'t');}pass('all eight worker APIs deny anonymous/authenticated and retain service execution');
 await query(`insert into zoi.user_profiles(id,auth_user_id) values('${actor}','${actor}'),('${other}','${other}');insert into zoi.workspace_members values('${ws}','${actor}','owner');insert into zoi.social_channels(id,workspace_id,platform,connected,status,access_token,refresh_token) values(1,'${ws}','facebook',true,'connected','LOCAL DUMMY SECRET','LOCAL DUMMY REFRESH');`);
 const rows=await query(`select row_to_json(c) from public.social_channels_list('${ws}')c;`,actor);assert.equal(JSON.parse(rows).platform,'facebook');assert.ok(!rows.includes('DUMMY'));pass('authorized list preserves safe shape and never returns token columns');
 await rejects(`select * from public.social_channels_list('${ws}');`,other,/social_workspace_access_denied/);await rejects(`set role anon;select * from public.social_channels_list('${ws}');`,undefined,/permission denied/);pass('cross-tenant and anonymous channel list denied');
 for(const fn of [`social_channels_for_publish('${ws}',null)`,`social_cron_secret_get()`,`social_channel_remove('${ws}',1)`,`social_channel_add('${ws}','facebook','test',null)`])await rejects('select public.'+fn+';',actor,/permission denied/);pass('credential reads and unsafe legacy mutations fail before execution');
 await rejects('select * from zoi.social_channels;',actor,/permission denied/);await rejects('select * from zoi.social_oauth_states;',actor,/permission denied/);pass('direct sensitive tables deny client roles');
 assert.equal(await query(`set role service_role;select jsonb_array_length(public.social_channels_for_publish('${ws}',null));`),'1');pass('scheduler service path remains callable using local dummy credentials only');
 await query(`create schema extensions;create extension pgcrypto with schema extensions;create schema cron;create table cron.job(jobid bigint primary key,jobname text,command text);create function cron.alter_job(p_job bigint,command text) returns void language sql as $$update cron.job j set command=alter_job.command where j.jobid=p_job$$;alter table zoi.app_config add column updated_at timestamptz;insert into zoi.app_config values('social_cron_secret','LOCAL_DUMMY_OLD_SECRET',now());insert into cron.job values(8,'social_publish_worker','social-publish LOCAL_DIFFERENT_OLD_CRON_SECRET'),(9,'other-worker','unrelated');`);
 await query(readFileSync(new URL('../../supabase/migrations/20260930035311_rotate_social_scheduler_secret.sql',import.meta.url),'utf8'));await query(readFileSync(new URL('./social-rotation-production-rollback.sql',import.meta.url),'utf8'));assert.equal(await query("select count(*) from cron.job where command like '%LOCAL_DUMMY_OLD_SECRET%';"),'0');assert.equal(await query("select command from cron.job where jobid=9;"),'unrelated');pass('rotation replaces only known publisher command with dynamic secret lookup; unrelated job untouched');
 console.log(`${checks} OAuth containment database checks passed`);
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

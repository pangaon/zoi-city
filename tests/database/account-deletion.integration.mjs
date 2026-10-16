import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createAccountDeleteHandler} from '../../supabase/functions/account-delete/index.ts';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const evidence=process.env.ZOI_ACCOUNT_DELETE_EVIDENCE||path.join('/home/codespace/.cache/zoi','account-delete-owner');mkdirSync(evidence,{recursive:true,mode:0o700});
const dir=mkdtempSync(path.join(evidence,'pg-'));const data=path.join(dir,'data'),socket=path.join(dir,'socket');mkdirSync(socket,{mode:0o700});
const bin='/usr/lib/postgresql/16/bin',port=String(Number(process.env.PGPORT)||15951);if(!/^\d{4,5}$/.test(port))throw Error('Invalid local port');
const env={...process.env,PGHOST:socket,PGPORT:port,PGDATABASE:'postgres',PGUSER:process.env.USER||'codespace'};
const run=(name,args,input)=>execFileSync(path.join(bin,name),args,{env,input,encoding:'utf8',maxBuffer:8*1024*1024});
const sql=s=>run('psql',['-XqAt','-v','ON_ERROR_STOP=1'],s).trim();
const fixture=JSON.parse(readFileSync(path.join(root,'tests/database/fixtures/account-deletion-live.json')));
const migration=readFileSync(path.join(root,'supabase/migrations/20261016040420_self_service_account_deletion.sql'),'utf8');
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const ident=s=>'"'+s.replaceAll('"','""')+'"';
const results=[];const check=(name,fn)=>{fn();results.push({name,pass:true});};
function rejected(s,pattern){try{sql(s);assert.fail('Expected refusal');}catch(e){assert.match(String(e.stderr||e.message),pattern);}}
const claims=(a,s,role='authenticated')=>`set request.jwt.claims=${quote(JSON.stringify({sub:a,session_id:s,role}))};set role ${role};`;
const user=()=>{const a=randomUUID(),s=randomUUID(),p=randomUUID();sql(`insert into auth.users(id,email,raw_user_meta_data) values('${a}','synthetic+${a}@example.invalid','{"name":"Erase me"}');insert into auth.sessions(id,user_id,created_at) values('${s}','${a}',clock_timestamp());insert into zoi.user_profiles(id,auth_user_id,display_name,first_name,name_key,name_day_month,name_day_day,roots_place,roots_region,city,country,team,identity,origin_place_id) values('${p}','${a}','Personal name','Personal','key',2,3,'place','region','city','country','team','identity',9);`);return {a,s,p,email:'synthetic+'+a+'@example.invalid'};};
const prepare=u=>{u.r=randomUUID();u.token='ab'.repeat(32);u.hash=createHash('sha256').update(u.token).digest('hex');return JSON.parse(sql(`${claims(u.a,u.s)}select public.account_delete_prepare('${u.r}','${u.hash}');`));};
const confirm=u=>JSON.parse(sql(`${claims(u.a,u.s)}select public.account_delete_confirm('${u.r}');`));
const processRequest=(u,w=randomUUID())=>{u.w=w;return JSON.parse(sql(`${claims(u.a,u.s,'service_role')}select public.account_delete_process('${u.r}','${w}');`));};
const finish=u=>JSON.parse(sql(`${claims(u.a,u.s,'service_role')}select public.account_delete_finish('${u.r}','${u.w}');`));
let started=false;
try{
 run('initdb',['-D',data,'-A','trust','--no-locale']);run('pg_ctl',['-D',data,'-l',path.join(dir,'server.log'),'-o',`-F -k ${socket} -p ${port} -c listen_addresses=''`,'-w','start']);started=true;
 sql(`create role anon;create role authenticated;create role service_role;create role postgres superuser;create schema auth;create schema zoi;create schema storage;create schema extensions;create extension pgcrypto with schema extensions;grant usage on schema public,auth to anon,authenticated,service_role;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'$$;` .replace("select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'","select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid"));
 sql(`create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;create function auth.role() returns text language sql as $$select auth.jwt()->>'role'$$;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,deleted_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users on delete cascade,created_at timestamptz,not_after timestamptz);
 create table zoi.user_profiles(id uuid primary key,display_name text,first_name text,name_key text,name_day_month integer,name_day_day integer,roots_place text,roots_region text,city text,country text,team text,identity text,created_at timestamptz default clock_timestamp(),auth_user_id uuid,origin_place_id bigint);
 create table zoi.workspaces(id uuid primary key,name text,owner_profile_id uuid not null references zoi.user_profiles on delete cascade,created_by_auth uuid);
 create table zoi.workspace_members(id uuid primary key,workspace_id uuid references zoi.workspaces on delete cascade,profile_id uuid references zoi.user_profiles on delete cascade,role text);
 create table storage.objects(id uuid primary key,bucket_id text,name text,owner uuid,owner_id text,version text);
 create table zoi.community_profiles(profile_id uuid primary key references zoi.user_profiles,handle text,display_name text,bio text,avatar_media_id uuid,avatar_url text,initial_data jsonb);
 create table zoi.community_preferences(profile_id uuid primary key references zoi.user_profiles,topics text[],initial_data jsonb);
 create table zoi.feed_posts(id uuid primary key,profile_id uuid,body text);
 create table zoi.feed_comments(id uuid primary key,profile_id uuid,body text);
 create table zoi.community_reports(id uuid primary key,reporter uuid references zoi.user_profiles,post_id uuid,content_snapshot jsonb,details text);
 create table zoi.community_media_assets(id uuid primary key,profile_id uuid references zoi.user_profiles);
 create table public.tab_payments(id uuid primary key,collected_by_staff_id uuid references auth.users);
 grant usage on schema zoi to postgres;`);
 // Exact selected current-session functions and ACLs, not mock helper logic.
 for(const helper of fixture.helpers){sql(helper.definition);sql(`alter function ${helper.signature} owner to postgres;revoke all on function ${helper.signature} from public,anon,authenticated,service_role;`);assert.equal(sql(`select md5(pg_get_functiondef('${helper.signature}'::regprocedure))`),helper.body_md5);}
 sql(fixture.ensure_profile.definition);sql('alter function zoi.ensure_profile() owner to postgres');assert.equal(sql("select md5(pg_get_functiondef('zoi.ensure_profile()'::regprocedure))"),fixture.ensure_profile.definition_md5);
 sql("set role postgres;\n"+migration);
 check('new private ledger and narrowly scoped execute grants',()=>{assert.equal(sql("select relrowsecurity from pg_class where oid='zoi.account_deletion_requests'::regclass"),'t');assert.equal(sql("select has_table_privilege('service_role','zoi.account_deletion_requests','select')"),'f');assert.equal(sql("select has_function_privilege('anon','public.account_delete_confirm(uuid)','execute')"),'f');assert.equal(sql("select has_function_privilege('authenticated','public.account_delete_process(uuid,uuid)','execute')"),'f');});
 check('exact old authority bodies remain unchanged',()=>{for(const h of fixture.helpers)assert.equal(sql(`select md5(pg_get_functiondef('${h.signature}'::regprocedure))`),h.body_md5);});
 check('legacy ensure_profile is entry-only; metadata and original remainder reverse exactly',()=>{const after=sql("select pg_get_functiondef('zoi.ensure_profile()'::regprocedure)")+'\n';const start=after.indexOf("  IF current_setting('transaction_isolation')"),end=after.indexOf('  SELECT id INTO me',start);assert.ok(start>0&&end>start);const inserted=after.slice(start,end);assert.match(inserted,/account-delete:/);assert.match(inserted,/account_deletion_in_progress/);assert.match(inserted,/account_delete_isolation_required/);assert.equal(after.slice(0,start)+after.slice(end),fixture.ensure_profile.definition);assert.equal(sql("select prosecdef and proacl is null and proconfig=array['search_path=zoi, public'] and proowner='postgres'::regrole from pg_proc where oid='zoi.ensure_profile()'::regprocedure"),'t');});
 check('legacy NULL/existing/create return paths preserved, RR actor calls refused',()=>{assert.equal(sql("set request.jwt.claims='{}';select zoi.ensure_profile()"),'');assert.equal(sql("begin isolation level repeatable read;set request.jwt.claims='{}';select zoi.ensure_profile();commit"),'');const u=user();assert.equal(sql(`${claims(u.a,u.s,'postgres')}select zoi.ensure_profile()`),u.p);rejected(`begin isolation level repeatable read;${claims(u.a,u.s,'postgres')}select zoi.ensure_profile()`,/account_delete_isolation_required/);const a=randomUUID();sql(`insert into auth.users(id)values('${a}')`);const p=sql(`${claims(a,randomUUID(),'postgres')}select zoi.ensure_profile()`);assert.match(p,/^[a-f0-9-]{36}$/);assert.equal(sql(`select auth_user_id from zoi.user_profiles where id='${p}'`),a);});
 check('mutating deletion API refuses RR before any accepted request',()=>{const u=user();rejected(`begin isolation level repeatable read;${claims(u.a,u.s)}select public.account_delete_prepare('${randomUUID()}','${'f'.repeat(64)}')`,/account_delete_isolation_required/);assert.equal(sql(`select count(*) from zoi.account_deletion_requests where actor_id='${u.a}'`),'0');});
 check('recent server session, not refreshed old JWT',()=>{const u=user();sql(`update auth.sessions set created_at=clock_timestamp()-interval '1 hour' where id='${u.s}'`);rejected(`${claims(u.a,u.s)}select public.account_delete_prepare('${randomUUID()}','${'a'.repeat(64)}')`,/account_delete_reauthenticate/);});
 check('missing and revoked SID refused',()=>{const u=user();rejected(`${claims(u.a,randomUUID())}select public.account_delete_prepare('${randomUUID()}','${'a'.repeat(64)}')`,/suite_session_unavailable/);});
 check('nonce binds original SID and immutable recovery hash',()=>{const u=user();prepare(u);assert.equal(prepareReplay(u).state,'prepared');rejected(`${claims(u.a,u.s)}select public.account_delete_prepare('${u.r}','${'f'.repeat(64)}')`,/account_delete_request_conflict/);const s=randomUUID();sql(`insert into auth.sessions values('${s}','${u.a}',clock_timestamp(),null)`);rejected(`${claims(u.a,s)}select public.account_delete_prepare('${u.r}','${u.hash}')`,/account_delete_request_conflict/);});
 check('cross-actor cannot confirm another request',()=>{const u=user(),v=user();prepare(u);rejected(`${claims(v.a,v.s)}select public.account_delete_confirm('${u.r}')`,/account_delete_request_conflict/);});
 check('failed final context recheck rolls back preliminary session revocation',()=>{const u=user();prepare(u);sql(`update zoi.user_profiles set auth_user_id=null where id='${u.p}'`);rejected(`${claims(u.a,u.s)}select public.account_delete_confirm('${u.r}')`,/account_delete_request_conflict/);assert.equal(sql(`select count(*) from auth.sessions where user_id='${u.a}'`),'1');assert.equal(sql(`select state from zoi.account_deletion_requests where request_id='${u.r}'`),'prepared');});
 check('service processor cannot revoke a merely prepared account',()=>{const u=user();prepare(u);assert.equal(processRequest(u).state,'prepared');assert.equal(sql(`select count(*) from auth.sessions where user_id='${u.a}'`),'1');});
 check('minimal recovery works without Auth; stored hash is not the capability',()=>{const u=user();prepare(u);const got=JSON.parse(sql(`set role anon;select public.account_delete_status('${u.r}','${u.token}')`));assert.deepEqual(got,{request_id:u.r,state:'prepared'});rejected(`set role anon;select public.account_delete_status('${u.r}','${u.hash}')`,/account_delete_unavailable/);});
 check('clean profile and initial-data rows truly erased, Auth deletion then verified',()=>{const u=user();sql(`insert into zoi.community_profiles(profile_id,initial_data) values('${u.p}','{"display_name":"Old PII"}');insert into zoi.community_preferences values('${u.p}','{}','{"city":"Old city"}')`);prepare(u);assert.equal(confirm(u).state,'accepted');assert.equal(sql(`select count(*) from auth.sessions where user_id='${u.a}'`),'0');assert.equal(processRequest(u).state,'auth_pending');assert.equal(sql(`select count(*) from zoi.community_profiles where profile_id='${u.p}'`),'0');assert.equal(sql(`select count(*) from zoi.community_preferences where profile_id='${u.p}'`),'0');rejected(`${claims(u.a,u.s,'service_role')}select public.account_delete_finish('${u.r}','${u.w}')`,/account_delete_incomplete/);sql(`delete from auth.users where id='${u.a}'`);assert.equal(finish(u).state,'completed');rejected(`${claims(u.a,u.s,'postgres')}select zoi.ensure_profile()`,/account_deletion_in_progress/);assert.equal(sql(`select count(*) from zoi.user_profiles u cross join lateral jsonb_each(to_jsonb(u)-array['id','created_at']) v where u.id='${u.p}' and v.value<>'null'::jsonb`),'0');});
 check('old JWT cannot recreate profile or append personal content after acceptance',()=>{const u=user();prepare(u);confirm(u);rejected(`insert into zoi.user_profiles(id,auth_user_id) values('${randomUUID()}','${u.a}')`,/account_deletion_in_progress/);rejected(`update zoi.user_profiles set city='late' where id='${u.p}'`,/account_deletion_in_progress/);rejected(`insert into zoi.feed_posts values('${randomUUID()}','${u.p}','late')`,/account_deletion_in_progress/);});
 check('shared business owner/workspace and teammate are preserved; no completion',()=>{const u=user(),v=user(),w=randomUUID();sql(`insert into zoi.workspaces values('${w}','Shared business','${u.p}','${u.a}');insert into zoi.workspace_members values('${randomUUID()}','${w}','${v.p}','admin')`);prepare(u);confirm(u);assert.equal(processRequest(u).state,'requires_review');assert.equal(sql(`select name from zoi.workspaces where id='${w}'`),'Shared business');assert.equal(sql(`select count(*) from zoi.workspace_members where workspace_id='${w}' and profile_id='${v.p}'`),'1');assert.equal(sql(`select display_name from zoi.user_profiles where id='${u.p}'`),'Personal name');});
 check('post and report snapshot are explicit unsupported history, never silently done',()=>{const u=user();sql(`insert into zoi.community_reports values('${randomUUID()}','${u.p}',null,'{"author":"Private name"}','Original detail')`);prepare(u);confirm(u);assert.equal(processRequest(u).state,'requires_review');assert.equal(sql(`select content_snapshot->>'author' from zoi.community_reports where reporter='${u.p}'`),'Private name');});
 check('non-FK history is detected without deleting it',()=>{sql('create table zoi.unknown_personal_history(id uuid,actor_id uuid,payload jsonb)');const u=user();sql(`insert into zoi.unknown_personal_history values('${randomUUID()}','${u.a}','{"private":"retained"}')`);prepare(u);confirm(u);assert.equal(processRequest(u).state,'requires_review');});
 check('Auth NO ACTION references held before destructive Auth step',()=>{const u=user();sql(`insert into public.tab_payments values('${randomUUID()}','${u.a}')`);prepare(u);confirm(u);assert.equal(processRequest(u).state,'requires_review');assert.equal(sql(`select count(*) from auth.users where id='${u.a}'`),'1');});
 check('owned Storage bytes require review; no metadata-only fake deletion',()=>{const u=user();sql(`insert into storage.objects values('${randomUUID()}','media','${u.a}/photo.png','${u.a}','${u.a}','v1')`);prepare(u);confirm(u);assert.equal(processRequest(u).state,'requires_review');assert.equal(sql(`select count(*) from storage.objects where owner='${u.a}'`),'1');});
 check('worker lease prevents concurrent duplicate Auth calls and retries bounded',()=>{const u=user();prepare(u);confirm(u);assert.equal(processRequest(u).state,'auth_pending');const old=u.w;rejected(`${claims(u.a,u.s,'service_role')}select public.account_delete_process('${u.r}','${randomUUID()}')`,/account_delete_busy/);sql(`update zoi.account_deletion_requests set worker_until=clock_timestamp()-interval '1 second' where request_id='${u.r}'`);assert.equal(processRequest(u).state,'auth_pending');assert.notEqual(u.w,old);sql(`delete from auth.users where id='${u.a}'`);assert.equal(finish(u).state,'completed');});
 check('prepared cancellation cannot cancel accepted deletion',()=>{const u=user();prepare(u);assert.equal(JSON.parse(sql(`${claims(u.a,u.s)}select public.account_delete_cancel('${u.r}')`)).state,'cancelled');prepare(u);confirm(u);rejected(`${claims(u.a,u.s)}select public.account_delete_cancel('${u.r}')`,/suite_session_unavailable/);});
 check('profile schema drift fails closed rather than leaving unknown personal field',()=>{sql('alter table zoi.user_profiles add column unexpected_private text');const u=user();prepare(u);confirm(u);assert.equal(processRequest(u).state,'requires_review');sql('alter table zoi.user_profiles drop column unexpected_private');});
 // A true second backend holds profile + prepared-receipt SHARE locks. The
 // confirmer must wait, then processing erases its committed latest text.
 const u=user();prepare(u);
 const child=spawn(path.join(bin,'psql'),['-XqAt','-v','ON_ERROR_STOP=1'],{env,stdio:['pipe','pipe','pipe']});let childErr='';child.stderr.on('data',x=>childErr+=x);child.stdin.end(`set application_name='account_delete_prior_writer';begin;update zoi.user_profiles set city='last committed private city' where id='${u.p}';select pg_sleep(1.2);commit;`);
 for(let n=0;n<40;n++){if(sql("select count(*) from pg_stat_activity where application_name='account_delete_prior_writer' and wait_event='PgSleep'")==='1')break;await new Promise(r=>setTimeout(r,25));if(n===39)throw Error('Concurrent writer never reached barrier');}
 const start=Date.now();confirm(u);assert.ok(Date.now()-start>500);await new Promise((resolve,reject)=>{if(child.exitCode!==null){child.exitCode===0?resolve():reject(Error(childErr));}else child.on('exit',code=>code===0?resolve():reject(Error(childErr)));});assert.equal(processRequest(u).state,'auth_pending');assert.equal(sql(`select city is null from zoi.user_profiles where id='${u.p}'`),'t');results.push({name:'actual two-backend prior writer waits before acceptance and latest PII is erased',pass:true});
 await concurrentLegacy();
 if(process.env.ZOI_ACCOUNT_DELETE_BROWSER==='1')await mountedBrowser();
 writeFileSync(path.join(evidence,'result.json'),JSON.stringify({pass:true,groups:results.length,results,limitations:fixture.limitations},null,2)+'\n');console.log(JSON.stringify({pass:true,groups:results.length,evidence}));
}finally{if(started)try{run('pg_ctl',['-D',data,'-m','immediate','-w','stop']);}catch{}rmSync(dir,{recursive:true,force:true});}
function prepareReplay(u){return JSON.parse(sql(`${claims(u.a,u.s)}select public.account_delete_prepare('${u.r}','${u.hash}');`));}
async function concurrentLegacy(){
 function backend(name,body){const child=spawn(path.join(bin,'psql'),['-XqAt','-v','ON_ERROR_STOP=1'],{env,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);const finished=new Promise(resolve=>child.on('exit',code=>resolve({code,stdout,stderr})));child.stdin.end(`set application_name=${quote(name)};${body}`);return {finished};}
 async function sleeping(name){for(let n=0;n<50;n++){if(sql(`select count(*) from pg_stat_activity where application_name=${quote(name)} and wait_event='PgSleep'`)==='1')return;await new Promise(r=>setTimeout(r,20));}throw Error('Concurrent backend never reached sleep barrier');}
 // Wall-clock expiry must be checked after the actual row-lock wait. Every
 // refusal leaves the prepared request/session intact, including confirm's
 // preliminary revocation (the complete statement rolls back).
 for(const action of ['prepare','confirm','cancel']){
  const u=user();if(action!=='prepare')prepare(u);
  sql(`update auth.sessions set not_after=clock_timestamp()+interval '1.2 seconds' where id='${u.s}'`);
  const name='account_delete_expired_'+action;
  const lock=action==='cancel'?`select 1 from zoi.account_deletion_requests where request_id='${u.r}' for update`:`select 1 from zoi.user_profiles where id='${u.p}' for update`;
  const a=backend(name,`begin;${lock};select pg_sleep(2.2);commit;`);await sleeping(name);
  const request=u.r||randomUUID();const call=action==='prepare'?`public.account_delete_prepare('${request}','${'c'.repeat(64)}')`:`public.account_delete_${action}('${request}')`;
  const start=Date.now();rejected(`${claims(u.a,u.s)}select ${call}`,/suite_session_unavailable/);assert.ok(Date.now()-start>500);
  const done=await a.finished;assert.equal(done.code,0,done.stderr);
  assert.equal(sql(`select count(*) from auth.sessions where user_id='${u.a}'`),'1');
  assert.equal(sql(`select coalesce((select state from zoi.account_deletion_requests where actor_id='${u.a}'),'absent')`),action==='prepare'?'absent':'prepared');
  results.push({name:`actual two-backend ${action} refuses SID expiry during row wait; session and request effects roll back`,pass:true});
 }
 {
  const u=user();sql(`update auth.sessions set created_at=clock_timestamp()-interval '298.8 seconds' where id='${u.s}'`);
  const a=backend('account_delete_reauth_wait',`begin;select 1 from zoi.user_profiles where id='${u.p}' for update;select pg_sleep(2.2);commit;`);await sleeping('account_delete_reauth_wait');
  rejected(`${claims(u.a,u.s)}select public.account_delete_prepare('${randomUUID()}','${'d'.repeat(64)}')`,/account_delete_reauthenticate/);
  assert.equal((await a.finished).code,0);assert.equal(sql(`select count(*) from zoi.account_deletion_requests where actor_id='${u.a}'`),'0');
  results.push({name:'prepare rechecks recent authentication age after real profile wait',pass:true});
 }
 {
  const u=user();prepare(u);
  // Actual booking_customer_authority ordering: current session SHARE first,
  // then ensure_profile. Use both real retained helpers, no mock lock helper.
  const a=backend('account_delete_booking_order',`begin;${claims(u.a,u.s,'postgres')}select zoi.suite_lock_session();select pg_sleep(1.2);select zoi.ensure_profile();insert into zoi.unknown_personal_history values('${randomUUID()}','${u.p}','{"private":"legacy in flight"}');commit;`);
  await sleeping('account_delete_booking_order');const start=Date.now();confirm(u);assert.ok(Date.now()-start>500);const done=await a.finished;assert.equal(done.code,0,done.stderr);assert.doesNotMatch(done.stderr,/deadlock/);assert.equal(processRequest(u).state,'requires_review');results.push({name:'real two-backend suite-session-SHARE before ensure_profile completes without inversion; committed history held',pass:true});
 }
 {
  const u=user();prepare(u);const a=backend('account_delete_duplicate_confirm',`begin;${claims(u.a,u.s)}select public.account_delete_confirm('${u.r}');select pg_sleep(1.2);commit;`);await sleeping('account_delete_duplicate_confirm');const start=Date.now();rejected(`${claims(u.a,u.s)}select public.account_delete_confirm('${u.r}')`,/suite_session_unavailable/);assert.ok(Date.now()-start>500);const done=await a.finished;assert.equal(done.code,0,done.stderr);assert.equal(sql(`select count(*) from zoi.account_deletion_requests where actor_id='${u.a}' and state='accepted'`),'1');results.push({name:'simultaneous same-SID confirmation serializes before session lock upgrades, one accepted request',pass:true});
 }
 {
  const u=user();const a=backend('account_delete_old_rr_snapshot',`begin isolation level repeatable read;${claims(u.a,u.s,'postgres')}select count(*) from zoi.account_deletion_requests;select pg_sleep(1.2);select zoi.ensure_profile();commit;`);await sleeping('account_delete_old_rr_snapshot');prepare(u);confirm(u);const done=await a.finished;assert.notEqual(done.code,0);assert.match(done.stderr,/account_delete_isolation_required/);assert.equal(sql(`select count(*) from zoi.user_profiles where auth_user_id='${u.a}'`),'1');results.push({name:'real old REPEATABLE READ snapshot taken before request cannot re-enter legacy writer after acceptance',pass:true});
 }
 {
  const u=user();const a=backend('account_delete_legacy_before_prepare',`begin;${claims(u.a,u.s,'postgres')}select zoi.ensure_profile();select pg_sleep(1.2);insert into zoi.unknown_personal_history values('${randomUUID()}','${u.p}','{"private":"before prepare"}');commit;`);await sleeping('account_delete_legacy_before_prepare');const start=Date.now();prepare(u);assert.ok(Date.now()-start>500);const done=await a.finished;assert.equal(done.code,0,done.stderr);confirm(u);assert.equal(processRequest(u).state,'requires_review');results.push({name:'legacy writer before request holds actor gate through its entire commit; preparation waits',pass:true});
 }
}
async function mountedBrowser(){
 const tokens=new Map(),emails=new Map(),lost=new Set();
 const publicKey='isolated-public-key',serviceKey='isolated-service-key';
 const mint=u=>{const access_token='e30.'+Buffer.from(JSON.stringify({session_id:u.s})).toString('base64url')+'.'+randomUUID();tokens.set(access_token,u);return {access_token,refresh_token:'isolated-'+randomUUID(),expires_at:Math.floor(Date.now()/1000)+3600,user:{id:u.a,email:u.email}};};
 const rpcNames=new Set(['account_delete_prepare','account_delete_confirm','account_delete_cancel','account_delete_status','account_delete_process','account_delete_finish','account_delete_pending']);
 const handler=createAccountDeleteHandler({url:'https://csebihpaychdkanjjsmz.supabase.co',publicKey,serviceKey,fetch:async(url,options)=>{
  const parsed=new URL(url);assert.equal(parsed.origin,'https://csebihpaychdkanjjsmz.supabase.co');assert.equal(options.redirect,'error');
  const token=options.headers.Authorization?.slice(7),u=tokens.get(token),service=token===serviceKey;
  if(parsed.pathname.startsWith('/auth/v1/admin/users/')){assert.ok(service);assert.equal(options.method,'DELETE');const id=parsed.pathname.split('/').at(-1);assert.match(id,/^[a-f0-9-]{36}$/);sql(`delete from auth.users where id=${quote(id)}::uuid`);return new Response('{}');}
  const name=parsed.pathname.split('/').at(-1);assert.ok(rpcNames.has(name));const body=JSON.parse(options.body||'{}');
  const args=Object.entries(body).map(([k,v])=>{assert.match(k,/^p_[a-z_]+$/);return ident(k)+'=>'+quote(String(v));}).join(',');
  try{const role=service?'service_role':u?'authenticated':'anon';const prefix=claims(u?.a||'00000000-0000-4000-8000-000000000000',u?.s||'00000000-0000-4000-8000-000000000000',role);return new Response(sql(prefix+`select public.${name}(${args})`),{headers:{'Content-Type':'application/json'}});}catch(e){const code=String(e.stderr||e.message).match(/account_delete_reauthenticate/)?.[0]||'isolated_request_refused';return new Response(JSON.stringify({message:code}),{status:403});}
 }});
 const bridge=createServer(async(req,res)=>{try{
  const uri=new URL(req.url,'http://fixture');if(uri.pathname==='/fixture'){const u=user();u.email='synthetic+'+u.a+'@example.invalid';emails.set(u.email,u);sql(`update auth.users set email=${quote(u.email)} where id='${u.a}'`);if(uri.searchParams.get('mode')==='history')sql(`insert into zoi.community_reports values('${randomUUID()}','${u.p}',null,'{"author":"Synthetic retained private text"}','Synthetic report')`);if(uri.searchParams.get('mode')==='lost')lost.add(u.a);res.end(JSON.stringify({session:mint(u)}));return;}
  const parts=[];for await(const c of req)parts.push(c);const raw=Buffer.concat(parts).toString();const body=raw?JSON.parse(raw):{};
  if(uri.pathname==='/auth/v1/otp'){assert.equal(body.create_user,false);assert.ok(emails.has(body.email));res.end('{}');return;}
  if(uri.pathname==='/auth/v1/verify'){assert.equal(body.token,'123456');const u=emails.get(body.email);assert.ok(u);u.s=randomUUID();sql(`insert into auth.sessions(id,user_id,created_at) values('${u.s}','${u.a}',clock_timestamp())`);res.end(JSON.stringify(mint(u)));return;}
  if(uri.pathname==='/rest/v1/rpc/zoi_me'){res.end('{"workspaces":[]}');return;}
  assert.equal(uri.pathname,'/functions/v1/account-delete');const response=await handler(new Request('https://isolated-edge.invalid',{method:'POST',headers:{Authorization:req.headers.authorization||'','Content-Type':'application/json'},body:raw}));
  const auth=tokens.get((req.headers.authorization||'').slice(7));if(body.action==='confirm'&&auth&&lost.has(auth.a)){lost.delete(auth.a);assert.equal(sql(`select state from zoi.account_deletion_requests where actor_id='${auth.a}'`),'completed');res.destroy();return;}
  res.writeHead(response.status,{'Content-Type':'application/json'});res.end(await response.text());
 }catch{res.writeHead(500);res.end('{"error":"isolated_fixture_failure"}');}});
 await new Promise(r=>bridge.listen(0,'127.0.0.1',r));const browserOut=path.join(evidence,'mounted');
 try{await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['mobile/tests/browser/account-deletion-browser.cjs'],{cwd:root,env:{...process.env,OUTPUT_DIR:browserOut,ACCOUNT_DELETE_BRIDGE:'http://127.0.0.1:'+bridge.address().port},stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',x=>log+=x);child.stderr.on('data',x=>log+=x);child.on('exit',code=>{writeFileSync(path.join(evidence,'mounted.log'),log);code===0?resolve():reject(Error('Mounted test failed; inspect private mounted.log'));});});results.push({name:'actual mounted Account -> fresh synthetic Auth -> Edge -> real isolated PG erase/recover/held/account switch',pass:true});}
 finally{await new Promise(r=>bridge.close(r));}
}

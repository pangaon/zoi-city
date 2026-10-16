import {createCommunityErasureWorker} from '../../supabase/functions/account-delete/community-erasure.ts';
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createAccountDeleteHandler} from '../../supabase/functions/account-delete/index.ts';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const evidence=process.env.ZOI_ACCOUNT_DELETE_EVIDENCE||path.join('/home/codespace/.cache/zoi','account-delete-community-owner');mkdirSync(evidence,{recursive:true,mode:0o700});
const dir=mkdtempSync(path.join(evidence,'pg-'));const data=path.join(dir,'data'),socket=path.join(dir,'socket');mkdirSync(socket,{mode:0o700});
const bin='/usr/lib/postgresql/16/bin',port=String(Number(process.env.PGPORT)||15954);if(!/^\d{4,5}$/.test(port))throw Error('Invalid local port');
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

 const communityFixture=JSON.parse(readFileSync(path.join(root,'tests/database/fixtures/account-deletion-community-live.json')));
 sql(`alter table zoi.feed_posts add column status text not null default 'visible',add column media jsonb not null default '[]',add column listing_id uuid,add column listing_name text,add column listing_slug text,add column nameday_ref text,add column likes integer not null default 0,add column comments integer not null default 0,add column created_at timestamptz default clock_timestamp();
 alter table zoi.feed_comments add column post_id uuid references zoi.feed_posts on delete cascade,add column status text not null default 'visible',add column created_at timestamptz default clock_timestamp();
 create table zoi.feed_likes(post_id uuid references zoi.feed_posts on delete cascade,profile_id uuid,created_at timestamptz default clock_timestamp(),primary key(post_id,profile_id));
 create table zoi.feed_blocks(blocker uuid,blocked uuid,created_at timestamptz default clock_timestamp(),primary key(blocker,blocked));
 create table zoi.feed_follows(follower uuid,followee uuid,created_at timestamptz default clock_timestamp(),primary key(follower,followee));
 create table zoi.feed_reports(id bigserial primary key,post_id uuid,profile_id uuid,reason text,created_at timestamptz default clock_timestamp());`);
 sql(communityFixture.community_schema_sql);
 for(const h of communityFixture.immutable_helpers){sql(h.definition);sql(`alter function ${h.signature} owner to postgres;revoke all on function ${h.signature} from public,anon,authenticated,service_role;`);}
 sql(`create trigger community_member_versions_immutable before update or delete on zoi.community_member_draft_versions for each row execute function zoi.community_member_immutable();
 create trigger community_member_requests_immutable before update or delete on zoi.community_member_requests for each row execute function zoi.community_member_immutable();
 create trigger community_media_grant_immutable before update or delete on zoi.community_media_upload_grants for each row execute function zoi.community_media_immutable();
 create trigger community_media_proof_immutable before update or delete on zoi.community_media_byte_proofs for each row execute function zoi.community_media_immutable();
 create trigger account_delete_personal_guard before insert or update on zoi.community_profiles for each row execute function zoi.account_delete_personal_guard();
 create trigger account_delete_personal_guard before insert or update on zoi.community_preferences for each row execute function zoi.account_delete_personal_guard();`);
 const extension=readFileSync(path.join(root,'supabase/migrations/20261016044936_account_deletion_community_erasure.sql'),'utf8');
 sql('set role postgres;'+extension);
 const unready=user();prepare(unready);
 check('unconfigured worker refuses acceptance atomically rather than accepting an indefinite deletion',()=>{rejected(`${claims(unready.a,unready.s)}select public.account_delete_confirm('${unready.r}')`,/account_delete_worker_not_ready/);assert.equal(sql(`select state from zoi.account_deletion_requests where request_id='${unready.r}'`),'prepared');assert.equal(sql(`select count(*) from auth.sessions where user_id='${unready.a}'`),'1');});
 // Explicit isolated operational fixture, NOT an estimate/production SLA.
 sql("create or replace function zoi.account_delete_completion_budget()returns interval language sql volatile security definer set search_path='' as $$select interval '1 hour'$$");

 const step=(u,w=u.cw||=randomUUID())=>JSON.parse(sql(`${claims(u.a,u.s,'service_role')}select public.account_delete_community_step('${u.r}','${w}')`));
 const state=u=>sql(`select state||':'||community_cursor from zoi.account_deletion_requests where request_id='${u.r}'`);
 const until=(u,cursor)=>{for(let tries=0;tries<100;tries++){if(Number(sql(`select community_cursor from zoi.account_deletion_requests where request_id='${u.r}'`))>=cursor)return;const r=step(u);assert.ok(!r.objects,'Unexpected Storage boundary');}assert.fail('Bounded erasure did not advance');};
 const u=user(),other=user();const ownpost=randomUUID(),otherpost=randomUUID(),owncomment=randomUUID(),reply=randomUUID(),draft=randomUUID(),asset=randomUUID(),storage=randomUUID();
 sql(`insert into zoi.community_profiles(profile_id,handle,display_name,bio,avatar_media_id,avatar_url,initial_data)values('${u.p}','u_${u.p.slice(0,8)}','Private author','Private biography','${asset}','https://source.invalid/personal-avatar','{"private":"initial profile"}');
 insert into zoi.community_preferences(profile_id,initial_data)values('${u.p}','{"private":"initial preferences"}');
 insert into zoi.feed_posts(id,profile_id,body,media)values('${ownpost}','${u.p}','Private post','[{"url":"personal"}]'),('${otherpost}','${other.p}','Other post','[]');
 insert into zoi.feed_comments(id,profile_id,body,post_id)values('${owncomment}','${u.p}','Private reply','${otherpost}'),('${reply}','${other.p}','Other author reply','${ownpost}');
 insert into zoi.community_post_context(post_id,city,country)values('${ownpost}','Private city','Private country');
 insert into zoi.community_reports(reporter,post_id,request_id,reason,details,content_snapshot)values('${other.p}','${ownpost}','${randomUUID()}','other','Description quoting private post',jsonb_build_object('id','${ownpost}','body','Private post','author',jsonb_build_object('id','${u.p}','display_name','Private author'))),('${u.p}','${otherpost}','${randomUUID()}','other','My private complaint','{"private":"snapshot"}');
 insert into zoi.community_member_drafts(id,profile_id,account_id,version,state,payload)values('${draft}','${u.p}','${u.a}',1,'draft','{"body":"Private unsent draft"}');
 insert into zoi.community_member_draft_versions select '${draft}',x,'${u.p}','${u.a}','draft',jsonb_build_object('body','Private version '||x),null,clock_timestamp() from generate_series(1,301)x;
 insert into zoi.community_member_requests values('${u.a}','${u.p}','${randomUUID()}','save','{"private":"request"}','{"private":"receipt"}',clock_timestamp());
 insert into zoi.community_media_assets(id,profile_id,request_id,purpose,mime_type,size_bytes,sha256,metadata,state)values('${asset}','${u.p}','${randomUUID()}','avatar','image/png',32,'${'a'.repeat(64)}','{"private":"metadata"}','ready');
 insert into zoi.community_media_upload_grants(asset_id,account_id,profile_id,session_id)values('${asset}','${u.a}','${u.p}','${u.s}');
 insert into zoi.community_media_byte_proofs values('${asset}','${'a'.repeat(64)}','image/png',32,'{"private":"metadata"}',clock_timestamp());
 insert into storage.objects values('${storage}','community-private','${u.p}/${asset}',null,null,'version-1');`);
 rejected(`update zoi.community_member_draft_versions set payload='{}' where draft_id='${draft}'`,/community_member_receipt_immutable/);
 const extraAssets=[randomUUID(),randomUUID()];
 for(const [i,id]of extraAssets.entries())sql(`insert into zoi.community_media_assets(id,profile_id,request_id,purpose,mime_type,size_bytes,sha256,metadata,state)values('${id}','${u.p}','${randomUUID()}','post','${i?'video/mp4':'image/webp'}',32,'${'a'.repeat(64)}','{"private":"original upload"}','ready');insert into zoi.community_media_upload_grants(asset_id,account_id,profile_id,session_id)values('${id}','${u.a}','${u.p}','${u.s}');insert into zoi.community_media_byte_proofs values('${id}','${'a'.repeat(64)}','${i?'video/mp4':'image/webp'}',32,'{}',clock_timestamp());insert into storage.objects values('${randomUUID()}','community-private','${u.p}/${id}',null,null,'original-version');`);
 sql(`insert into zoi.feed_likes(post_id,profile_id)values('${otherpost}','${u.p}');insert into zoi.feed_follows(follower,followee)values('${u.p}','${other.p}'),('${other.p}','${u.p}');insert into zoi.feed_blocks(blocker,blocked)values('${u.p}','${other.p}');insert into zoi.feed_reports(post_id,profile_id,reason)values('${otherpost}','${u.p}','Private report'),('${ownpost}','${other.p}','Private author Private post');insert into zoi.community_saved(profile_id,post_id)values('${u.p}','${otherpost}');insert into zoi.community_mutes(profile_id,muted)values('${other.p}','${u.p}');insert into zoi.community_notifications(recipient,actor,kind,event_key)values('${other.p}','${u.p}','follow','private-follow');insert into zoi.community_publish_requests values('${u.p}','${randomUUID()}','{"body":"Private publish snapshot"}','${ownpost}',clock_timestamp());insert into zoi.community_comment_requests values('${u.p}','${randomUUID()}','${otherpost}','${owncomment}','Private comment snapshot');`);
 prepare(u);confirm(u);
 check('companion RPC private ACL, same ledger and deadline from explicit isolated configuration',()=>{assert.equal(sql("select has_function_privilege('authenticated','public.account_delete_community_step(uuid,uuid)','execute')"),'f');assert.equal(sql(`select due_at>accepted_at and due_at<=accepted_at+interval '1 hour 1 second' from zoi.account_deletion_requests where request_id='${u.r}'`),'t');});
 check('original immutable UPDATE and direct DELETE remain refused even for postgres',()=>{rejected(`update zoi.community_member_draft_versions set payload='{}' where draft_id='${draft}'`,/community_member_receipt_immutable|account_deletion_in_progress/);rejected(`delete from zoi.community_media_byte_proofs where asset_id='${asset}'`,/media_immutable_evidence/);rejected(`delete from zoi.community_member_requests where profile_id='${u.p}'`,/community_member_receipt_immutable/);});
 check('late member/history/service media and storage writes refuse after acceptance',()=>{rejected(`insert into zoi.community_member_requests values('${u.a}','${u.p}','${randomUUID()}','save','{}','{}',clock_timestamp())`,/account_deletion_in_progress/);rejected(`insert into storage.objects values('${randomUUID()}','community-private','${u.p}/${randomUUID()}',null,null,'v2')`,/account_deletion_in_progress/);rejected(`update storage.objects set version='tampered' where id='${storage}'`,/account_deletion_in_progress/);});

 {
  const child=spawn(path.join(bin,'psql'),['-XqAt','-v','ON_ERROR_STOP=1'],{env,stdio:['pipe','pipe','pipe']});let error='';child.stderr.on('data',x=>error+=x);const finished=new Promise(resolve=>child.on('exit',code=>resolve(code)));
  child.stdin.end(`set application_name='account_delete_cleanup_order';begin;select 1 from zoi.account_deletion_requests where request_id='${u.r}' for update;select pg_sleep(1.2);commit;`);
  for(let i=0;i<50;i++){if(sql("select count(*) from pg_stat_activity where application_name='account_delete_cleanup_order' and wait_event='PgSleep'")==='1')break;await new Promise(r=>setTimeout(r,20));if(i===49)throw Error('Cleanup order barrier missing');}
  const start=Date.now();sql(`update zoi.community_media_assets set state='discarded',storage_deleted_at=clock_timestamp() where id='${asset}'`);
  rejected(`update zoi.community_media_assets set state='ready' where id='${asset}'`,/could not obtain lock/);assert.ok(Date.now()-start<800);assert.equal(await finished,0,error);
  results.push({name:'real two-backend receipt/asset order: discard-only legacy cleanup remains usable; ready/PII write refuses NOWAIT instead of deadlocking',pass:true});
 }
 check('unrelated legacy Storage paths retain behavior',()=>{sql(`insert into storage.objects values('${randomUUID()}','media','legacy/avatar',null,null,'v1')`);});
 until(u,1);const beforeVersionChunk=Number(sql(`select count(*) from zoi.community_member_draft_versions where draft_id='${draft}'`));step(u);
 check('immutable history erasure chunk deletes exactly100, not301 or unbounded cascade',()=>{assert.equal(Number(sql(`select count(*) from zoi.community_member_draft_versions where draft_id='${draft}'`)),beforeVersionChunk-100);assert.equal(state(u),'accepted:1');});
 until(u,18);
 check('all301 versions and request snapshots gone; other author reply preserved without deleted parent cascade',()=>{assert.equal(sql(`select count(*) from zoi.community_member_draft_versions where draft_id='${draft}'`),'0');assert.equal(sql(`select count(*) from zoi.community_member_requests where profile_id='${u.p}'`),'0');assert.equal(sql(`select body||':'||(post_id is null)::text from zoi.feed_comments where id='${reply}'`),'Other author reply:true');assert.equal(sql(`select body from zoi.feed_posts where id='${otherpost}'`),'Other post');assert.equal(sql(`select count(*) from zoi.feed_posts where profile_id='${u.p}'`),'0');});
 check('other reporter case keeps no erased content or quoted details; own report gone',()=>{assert.equal(sql(`select reason from zoi.feed_reports where profile_id='${other.p}'`),'Content removed');assert.equal(sql(`select count(*) from zoi.community_reports where reporter='${u.p}'`),'0');assert.equal(sql(`select content_snapshot::text||':'||details from zoi.community_reports where reporter='${other.p}'`),'{"removed": true}:');});
 const manifest=step(u);assert.equal(manifest.objects.length,3);
 check('Storage still exists before real API deletion; Auth cannot complete',()=>{assert.equal(sql(`select count(*) from storage.objects where id='${storage}'`),'1');rejected(`${claims(u.a,u.s,'service_role')}select public.account_delete_community_storage_done('${u.r}','${u.cw}','${JSON.stringify(manifest.objects)}')`,/account_delete_storage_remaining/);assert.equal(sql(`select count(*) from zoi.community_media_byte_proofs where asset_id='${asset}'`),'1');});
 check('other worker cannot claim live media cleanup; forged acknowledgement refused',()=>{rejected(`${claims(u.a,u.s,'service_role')}select public.account_delete_community_step('${u.r}','${randomUUID()}')`,/account_delete_busy/);rejected(`${claims(u.a,u.s,'service_role')}select public.account_delete_community_storage_done('${u.r}','${u.cw}','[]')`,/account_delete_request_conflict/);});
 // Real local HTTP transport and durable PostgreSQL acknowledgements; Storage
 // itself is a controlled byte map, not a production/S3 availability claim.
 const bytePath=u.p+'/'+asset,bytes=new Uint8Array([137,80,78,71,...Array(28).fill(7)]),byteStore=new Map([asset,...extraAssets].map(id=>[u.p+'/'+id,bytes]));const expectedPaths=[...byteStore.keys()].sort();let deletes=0,heads=0,loseDelete=true;
 const storageServer=createServer(async(req,res)=>{try{
  assert.equal(req.headers.authorization,'Bearer isolated-storage-service');
  if(req.method==='DELETE'){
   assert.equal(req.url,'/storage/v1/object/community-private');const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks));assert.deepEqual([...body.prefixes].sort(),expectedPaths);
   deletes++;for(const name of body.prefixes){byteStore.delete(name);sql(`delete from storage.objects where bucket_id='community-private' and name=${quote(name)}`);}if(loseDelete){loseDelete=false;res.destroy();return;}res.end('[]');
  }else if(req.method==='HEAD'){
   heads++;const name=req.url.slice('/storage/v1/object/authenticated/community-private/'.length);res.statusCode=byteStore.has(name)?200:404;res.end();
  }else{res.statusCode=405;res.end();}
 }catch{res.statusCode=500;res.end();}});await new Promise(r=>storageServer.listen(0,'127.0.0.1',r));
 try{
  const eraser=createCommunityErasureWorker({url:'https://csebihpaychdkanjjsmz.supabase.co',serviceKey:'isolated-storage-service',rpc:async(name,body)=>{
   const args=Object.values(body).map(v=>quote(typeof v==='string'?v:JSON.stringify(v))).join(',');const raw=sql(`${claims(u.a,u.s,'service_role')}select public.${name}(${args})`);return raw?JSON.parse(raw):null;
  },fetch:async(url,options)=>{assert.equal(new URL(url).origin,'https://csebihpaychdkanjjsmz.supabase.co');return fetch('http://127.0.0.1:'+storageServer.address().port+new URL(url).pathname,options);}});
  await assert.rejects(eraser(u.r,u.cw),/pending/);
  check('lost actual DELETE response preserves original manifest and retry checkpoint without completion',()=>{assert.equal(byteStore.size,0);assert.equal(sql(`select jsonb_array_length(erasure_objects) from zoi.account_deletion_requests where request_id='${u.r}'`),'3');assert.equal(state(u),'accepted:18');assert.equal(sql(`select next_retry_at>clock_timestamp() from zoi.account_deletion_requests where request_id='${u.r}'`),'t');});
  sql(`update zoi.account_deletion_requests set next_retry_at=clock_timestamp() where request_id='${u.r}'`);u.cw=randomUUID();await eraser(u.r,u.cw);
  check('actual Edge companion -> local HTTP Storage DELETE+HEAD -> real canonical PG acknowledgement removes original bytes',()=>{assert.equal(deletes,2);assert.equal(heads,3);assert.equal(byteStore.has(bytePath),false);assert.equal(sql(`select count(*) from storage.objects where id='${storage}'`),'0');});
 }finally{await new Promise(r=>storageServer.close(r));}
 until(u,21);
 check('media byte proof/grants/metadata and initial_data removed before Auth finalization',()=>{for(const table of ['community_profiles','community_preferences','community_media_assets','community_media_upload_grants'])assert.equal(sql(`select count(*) from zoi.${table} where profile_id='${u.p}'`),'0');assert.equal(sql(`select count(*) from zoi.community_media_byte_proofs where asset_id='${asset}'`),'0');assert.equal(sql(`select erasure_xid is null and erasure_objects='[]'::jsonb from zoi.account_deletion_requests where request_id='${u.r}'`),'t');});
 check('canonical core clean processor now erases account; old JWT/profile recreation remain refused',()=>{assert.equal(processRequest(u).state,'auth_pending');sql(`delete from auth.users where id='${u.a}'`);assert.equal(finish(u).state,'completed');rejected(`${claims(u.a,u.s,'postgres')}select zoi.ensure_profile()`,/account_deletion_in_progress/);assert.equal(sql(`select display_name from zoi.user_profiles where id='${other.p}'`),'Personal name');});
 check('status returns completion/time/stage only, no payload or assigned fake deadline',()=>{const r=JSON.parse(sql(`set role anon;select public.account_delete_status('${u.r}','${u.token}')`));assert.equal(r.stage,'completed');assert.ok(r.due_at);assert.ok(r.completed_at);assert.ok(!('actor_id'in r));});
 const shared=user(),workspace=randomUUID();sql(`insert into zoi.workspaces values('${workspace}','Keep shared business','${shared.p}','${shared.a}')`);prepare(shared);confirm(shared);until(shared,21);
 check('business remains unchanged and does not falsely complete after Community cleanup',()=>{assert.equal(processRequest(shared).state,'requires_review');assert.equal(sql(`select name from zoi.workspaces where id='${workspace}'`),'Keep shared business');assert.equal(sql(`select count(*) from auth.users where id='${shared.a}'`),'1');});
 const retry=user();prepare(retry);confirm(retry);sql(`update zoi.account_deletion_requests set community_cursor=18 where request_id='${retry.r}';insert into storage.objects values('${randomUUID()}','media','unrelated',null,null,'v1')`);step(retry);
 check('read-only queue capped5; no service bypass for retry/status mutations',()=>{assert.ok(JSON.parse(sql(`${claims(retry.a,retry.s,'service_role')}select public.account_delete_pending()`)).length<=5);rejected(`${claims(retry.a,retry.s)}select public.account_delete_community_retry('${retry.r}','${randomUUID()}')`,/permission denied/);});

 {
  const actor=user();prepare(actor);const id=randomUUID(),pathName=actor.p+'/'+randomUUID();
  const child=spawn(path.join(bin,'psql'),['-XqAt','-v','ON_ERROR_STOP=1'],{env,stdio:['pipe','pipe','pipe']});let error='';child.stderr.on('data',x=>error+=x);const finished=new Promise(resolve=>child.on('exit',code=>resolve(code)));
  child.stdin.end(`set application_name='account_delete_storage_inflight';begin;insert into storage.objects values('${id}','community-private','${pathName}',null,null,'v1');select pg_sleep(1.2);commit;`);
  for(let i=0;i<50;i++){if(sql("select count(*) from pg_stat_activity where application_name='account_delete_storage_inflight' and wait_event='PgSleep'")==='1')break;await new Promise(r=>setTimeout(r,20));if(i===49)throw Error('Storage insert barrier missing');}
  const start=Date.now();confirm(actor);assert.ok(Date.now()-start>500);assert.equal(await finished,0,error);
  check('real two-backend old in-flight service Storage insert commits before acceptance; no inversion or missed orphan',()=>{assert.equal(sql(`select count(*) from storage.objects where id='${id}'`),'1');rejected(`update storage.objects set name='${actor.p}/${randomUUID()}' where id='${id}'`,/account_deletion_in_progress/);});
  until(actor,18);const r=step(actor);assert.equal(r.objects[0].id,id);
  sql(`${claims(actor.a,actor.s,'service_role')}select public.account_delete_community_retry('${actor.r}','${actor.cw}')`);
  check('failure backoff retains same actor/request/object; early rerun does not advance or claim complete',()=>{assert.equal(sql(`select next_retry_at>clock_timestamp() and erasure_objects<>'[]'::jsonb from zoi.account_deletion_requests where request_id='${actor.r}'`),'t');assert.equal(step(actor).community_complete,false);assert.equal(state(actor),'accepted:18');assert.equal(sql(`select count(*) from auth.users where id='${actor.a}'`),'1');});
 }

 // A future FK or data-changing trigger must refuse before any mutation.
 {
  const x=user(),id=randomUUID();sql(`insert into zoi.community_reports(id,reporter,request_id,reason,details,content_snapshot)values('${id}','${x.p}','${randomUUID()}','other','Private report','{}');create table zoi.unexpected_business_link(id uuid primary key,report_id uuid references zoi.community_reports on delete cascade);insert into zoi.unexpected_business_link values('${randomUUID()}','${id}')`);prepare(x);confirm(x);
  check('unknown new business FK on non-initial parent blocks before personal deletion or business cascade',()=>{rejected(`${claims(x.a,x.s,'service_role')}select public.account_delete_community_step('${x.r}','${randomUUID()}')`,/account_delete_cascade_graph_drift/);assert.equal(sql(`select count(*) from zoi.unexpected_business_link where report_id='${id}'`),'1');assert.equal(sql(`select details from zoi.community_reports where id='${id}'`),'Private report');});sql('drop table zoi.unexpected_business_link');
 }
 sql(`create schema vault;create table vault.secrets(name text);insert into vault.secrets values('service_role_key');create view vault.decrypted_secrets as select name,'isolated-not-real-service-key'::text decrypted_secret from vault.secrets;
 create schema net;create table net.http_request_queue(id bigserial primary key,url text,headers jsonb,body jsonb,timeout integer);
 create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer)returns bigint language sql as $$insert into net.http_request_queue(url,headers,body,timeout)values(url,headers,body,timeout_milliseconds)returning id$$;
 create schema cron;create table cron.job(jobid bigserial primary key,jobname text unique,schedule text,command text,active boolean default true);
 create function cron.schedule(name text,scheduled text,sql_command text)returns bigint language sql as $$insert into cron.job(jobname,schedule,command)values(name,scheduled,sql_command)returning jobid$$;
 create function cron.alter_job(job_id bigint,active boolean)returns void language sql as $$update cron.job set active=alter_job.active where jobid=job_id$$;
 insert into cron.job(jobname,schedule,command,active)values('unrelated-paused','1 * * * *','select 1',false);`);
 const schedule=readFileSync(path.join(root,'supabase/migrations/20261016044937_account_deletion_worker_schedule.sql'),'utf8'),definition=sql("select pg_get_functiondef('public.account_delete_community_step(uuid,uuid)'::regprocedure)");
 sql(definition.replace("auth.role()<>'service_role'","auth.role()<>'authenticated'"));
 check('scheduler exact body drift refuses atomically before job creation',()=>{rejected('set role postgres;'+schedule,/account_delete_worker_body_drift/);assert.equal(sql("select count(*) from cron.job where jobname='zoi-account-delete-worker'"),'0');});sql(definition);sql('set role postgres;'+schedule);
 check('separate scheduler installs PAUSED, exact minute command and unrelated jobs unchanged',()=>{assert.equal(sql("select schedule||':'||command||':'||active from cron.job where jobname='zoi-account-delete-worker'"),'* * * * *:select zoi.account_delete_schedule();:false');assert.equal(sql("select active from cron.job where jobname='unrelated-paused'"),'f');assert.equal(sql("select proowner='postgres'::regrole and prosecdef and proconfig=array['search_path=\"\"'] and proacl::text='{postgres=X/postgres}' from pg_proc where oid='zoi.account_delete_schedule()'::regprocedure"),'t');assert.equal(sql("select has_function_privilege('service_role','zoi.account_delete_schedule()','execute')"),'f');});
 sql("update zoi.account_deletion_requests set state='requires_review' where state in('accepted','auth_pending')");
 check('no-work dispatcher performs zero HTTP and does not read credential values into output',()=>{assert.equal(sql('select zoi.account_delete_schedule()'),'');assert.equal(sql('select count(*) from net.http_request_queue'),'0');});
 const pending=user();prepare(pending);confirm(pending);
 sql("create or replace function zoi.account_delete_completion_budget()returns interval language sql volatile security definer set search_path='' as $$select null::interval$$");
 check('unconfigured dispatch remains zero HTTP even with accepted work',()=>{assert.equal(sql('select zoi.account_delete_schedule()'),'');assert.equal(sql('select count(*) from net.http_request_queue'),'0');});
 sql("create or replace function zoi.account_delete_completion_budget()returns interval language sql volatile security definer set search_path='' as $$select interval '1 hour'$$");
 check('actual private dispatch emits one fixed bounded action; pending request dedupe prevents repeated enqueue',()=>{assert.equal(sql('select zoi.account_delete_schedule()'),'1');assert.equal(sql('select zoi.account_delete_schedule()'),'');assert.equal(sql("select url||':'||body::text||':'||timeout from net.http_request_queue"),'https://csebihpaychdkanjjsmz.supabase.co/functions/v1/account-delete:{"action": "process_pending"}:55000');assert.equal(sql("select active from cron.job where jobname='zoi-account-delete-worker'"),'f');});
 writeFileSync(path.join(evidence,'result.json'),JSON.stringify({pass:true,groups:results.length,results,limitations:communityFixture.limitations},null,2)+'\n');console.log(JSON.stringify({pass:true,groups:results.length,evidence}));
}finally{if(started)try{run('pg_ctl',['-D',data,'-m','immediate','-w','stop']);}catch{}rmSync(dir,{recursive:true,force:true});}

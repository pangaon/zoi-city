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
const port=15859;const env={...process.env,PGHOST:dir,PGPORT:String(port),PGDATABASE:'postgres'};
const actor='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',member='00000000-0000-4000-8000-000000000003',ws='10000000-0000-4000-8000-000000000001',event='20000000-0000-4000-8000-000000000001';
const literal=x=>"'"+String(x).replace(/'/g,"''")+"'";
const sql=(query,user)=>`${user?`set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`:''}${query}`;
async function query(q,user){const r=await run(join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',sql(q,user)],{env});return r.stdout.trim().split('\n').filter(Boolean).at(-1);}
async function rejects(q,user,pattern){await assert.rejects(query(q,user),pattern);}
let started=false,checks=0;function pass(label){checks++;console.log(`PASS ${label}`);}
try{
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-A','trust','--no-locale'],{stdio:'ignore'});
 execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'server.log'),'-o',`-k ${dir} -p ${port} -c listen_addresses=''`,'-w','start'],{stdio:'ignore'});started=true;
 await query(`create role anon;create role authenticated;create schema zoi;create schema auth;create function auth.uid()returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create table zoi.user_profiles(id uuid primary key,auth_user_id uuid unique,display_name text,first_name text);create table zoi.workspaces(id uuid primary key,owner_profile_id uuid not null references zoi.user_profiles(id));create table zoi.workspace_members(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references zoi.workspaces(id),profile_id uuid not null references zoi.user_profiles(id),role text not null check(role in('owner','admin','editor','viewer')),created_at timestamptz default now(),unique(workspace_id,profile_id));
 insert into zoi.user_profiles values('${actor}','${actor}','Owner',null),('${other}','${other}','Admin',null),('${member}','${member}','Editor',null);
 insert into zoi.workspaces values('${ws}','${actor}');insert into zoi.workspace_members(workspace_id,profile_id,role)values('${ws}','${actor}','owner'),('${ws}','${other}','admin'),('${ws}','${member}','editor');`);
 await query(readFileSync(new URL('../../supabase/migrations/20261001050608_workspace_team_authority.sql',import.meta.url),'utf8'));
 const get=async(user=actor)=>JSON.parse(await query(`select public.workspace_team_get('${ws}');`,user));
 const request=()=>crypto.randomUUID();
 const command=(row,id=request(),role='viewer',action='role')=>`select public.workspace_team_save('${ws}','${id}','${row.profile_id}','${row.id}','${row.revision}','${action}',${role===null?'null':literal(role)});`;
 let snapshot=await get();assert.equal(snapshot.members.length,3);assert.ok(snapshot.members.find(x=>x.profile_id===actor).protected);pass('actual roster with revision and protected recorded owner');
 let row=snapshot.members.find(x=>x.profile_id===member),id=request(),cmd=command(row,id);
 let result=JSON.parse(await query(cmd,actor));assert.equal(result.ok,true);assert.equal(result.role,'viewer');assert.notEqual(result.revision,row.revision);assert.deepEqual(JSON.parse(await query(cmd,actor)),result);pass('CAS save and exact immutable receipt replay');
 assert.equal(JSON.parse(await query(command(row),actor)).error,'membership_conflict');await rejects(command(row,id,'editor'),actor,/request_mismatch/);pass('stale revision and changed retry payload rejected');
 await rejects(command((await get()).members.find(x=>x.profile_id===actor)),actor,/owner_membership_protected/);
 await rejects(`select public.ws_member_set_role('${ws}','${actor}','viewer')`,other,/owner_membership_protected/);
 await rejects(`select public.ws_member_set_role('${ws}','${member}','admin')`,other,/owner_required/);
 await rejects(`select public.ws_member_remove('${ws}','${other}')`,other,/self_membership_protected/);
 await rejects(`select public.ws_member_set_role('${ws}','${member}','owner')`,actor,/bad_role/);pass('legacy and versioned authority cannot remove owner or escalate admin');
 await rejects(command((await get()).members.find(x=>x.profile_id===other)),member,/not_authorized/);assert.equal((await get(member)).members.length,3);pass('viewer reads roster but cannot mutate');
 row=(await get()).members.find(x=>x.profile_id===member);await query(`update zoi.workspace_members set role='editor' where profile_id='${member}';update zoi.workspace_members set role='viewer' where profile_id='${member}';`);assert.equal(JSON.parse(await query(command(row),actor)).error,'membership_conflict');pass('direct role ABA invalidates CAS');
 row=(await get()).members.find(x=>x.profile_id===member);id=request();const cancelled=JSON.parse(await query(`select public.workspace_team_request('${ws}','${id}',true);`,actor));assert.equal(cancelled.result.cancelled,true);assert.equal(JSON.parse(await query(command(row,id),actor)).cancelled,true);pass('cancellation tombstone blocks delayed original mutation');
 id=request();const accepted=JSON.parse(await query(command(row,id,'editor'),actor));assert.equal(JSON.parse(await query(`select public.workspace_team_request('${ws}','${id}',true);`,actor)).result.request_id,accepted.request_id);pass('accepted write returned by cancellation recovery');
 await query(`update zoi.workspace_members set role='viewer' where profile_id='${actor}';`);await rejects(`select public.workspace_team_request('${ws}','${id}',false);`,actor,/not_authorized/);await rejects(command(row,id,'editor'),actor,/not_authorized/);await query(`update zoi.workspace_members set role='owner' where profile_id='${actor}';`);pass('receipt recovery and replay require current authority including explicit owner downgrade');
 await rejects(`select public.workspace_team_get('10000000-0000-4000-8000-000000000002');`,actor,/not_authorized/);await rejects(`set role anon;select public.workspace_team_get('${ws}')`,null,/permission denied/);await rejects(`set role authenticated;select * from zoi.workspace_team_receipts`,null,/permission denied/);pass('cross-workspace, anonymous and direct table access denied');
 row=(await get()).members.find(x=>x.profile_id===member);const race=await Promise.all([query(command(row,request(),'viewer'),actor),query(command(row,request(),'admin'),actor)]);assert.equal(race.map(JSON.parse).filter(x=>x.ok).length,1);pass('concurrent CAS only one write accepted');
 row=(await get()).members.find(x=>x.profile_id===member);await query(command(row,request(),null,'remove'),actor);assert.equal((await get()).members.length,2);assert.equal(await query(`select public.ws_member_remove('${ws}','${member}')`,actor),'f');await query(`insert into zoi.workspace_members(workspace_id,profile_id,role)values('${ws}','${member}','editor')`);assert.equal(JSON.parse(await query(command(row),actor)).error,'membership_conflict');pass('remove and recreate cannot accept old member identity');
 row=(await get()).members.find(x=>x.profile_id===member);
 const blocker=query(`begin;select id from zoi.workspaces where id='${ws}' for update;update zoi.workspace_members set role='viewer' where profile_id='${other}';select pg_sleep(.6);commit;`);
 await new Promise(r=>setTimeout(r,150));await rejects(command(row),other,/not_authorized/);await blocker;pass('authority rechecked after workspace lock wait and admin downgrade');
 await query(`update zoi.workspaces set owner_profile_id='${other}' where id='${ws}';`);assert.equal((await get()).role,'viewer');await rejects(command(row),actor,/not_authorized/);await query(`update zoi.workspaces set owner_profile_id='${actor}' where id='${ws}';`);pass('ownership transfer immediately removes stale owner-role management');
 await query(`insert into zoi.workspace_team_receipts(actor,request_id,workspace_id,result)select '${actor}',gen_random_uuid(),'${ws}','{}'::jsonb from generate_series(1,300);`);await rejects(command(row),actor,/team_request_limit/);await rejects(`select public.workspace_team_request('${ws}','${request()}',true)`,actor,/team_request_limit/);pass('write and cancellation request growth bounded');
 console.log(`PASS ${checks} workspace team groups`);
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

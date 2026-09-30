import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const container=process.env.ZOI_TEST_POSTGRES_CONTAINER;let database='postgres';
function sql(query){return new Promise((resolve,reject)=>{const c=spawn('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-X','-At','-v','ON_ERROR_STOP=1']);let out='',err='';c.stdout.on('data',d=>out+=d);c.stderr.on('data',d=>err+=d);c.on('error',reject);c.on('close',code=>code?reject(new Error(err)):resolve(out.trim()));c.stdin.end(query);});}
const quote=s=>"'"+String(s).replace(/'/g,"''")+"'";
const uid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const ws=uid(1),otherWs=uid(2);const owner=uid(11),editor=uid(12),viewer=uid(13),outsider=uid(14);
const call=async(user,query)=>{const output=await sql(`SET ROLE authenticated; SET request.jwt.claim.sub='${user}';${query}`);return JSON.parse(output.split('\n').at(-1));};
const save=(user,kind,data,id=null,version=0,workspace=ws)=>call(user,`SELECT public.ops_record_save('${workspace}',${quote(kind)},${quote(JSON.stringify(data))},${id?quote(id):'NULL'},${version});`);
const archive=(user,r)=>call(user,`SELECT public.ops_record_archive('${ws}','${r.id}',${r.version});`);
test('workspace operations with optimistic concurrency and audit',{skip:!container},async t=>{
 const db='ops_test_'+process.pid;await sql('CREATE DATABASE '+db);database=db;t.after(async()=>{database='postgres';await sql('DROP DATABASE '+db);});
 await sql(`DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
 CREATE SCHEMA auth;CREATE SCHEMA zoi;GRANT USAGE ON SCHEMA auth,zoi TO authenticated;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE TABLE zoi.workspaces(id uuid PRIMARY KEY);CREATE TABLE zoi.user_profiles(id uuid PRIMARY KEY,auth_user_id uuid,display_name text);
 CREATE TABLE zoi.workspace_members(workspace_id uuid,profile_id uuid,role text CHECK(role IN('owner','admin','editor','viewer')),UNIQUE(workspace_id,profile_id));
 INSERT INTO zoi.workspaces VALUES('${ws}'),('${otherWs}');
 INSERT INTO zoi.user_profiles VALUES('${uid(21)}','${owner}','Owner'),('${uid(22)}','${editor}','Staff'),('${uid(23)}','${viewer}','Viewer'),('${uid(24)}','${outsider}','Other owner');
 INSERT INTO zoi.workspace_members VALUES('${ws}','${uid(21)}','owner'),('${ws}','${uid(22)}','editor'),('${ws}','${uid(23)}','viewer'),('${otherWs}','${uid(24)}','owner');`);
 await sql(readFileSync(new URL('../../supabase/migrations/20260930001738_business_operations_foundation.sql',import.meta.url),'utf8'));
 let company,contact,project,task,otherCompany;
 await t.test('owner creates company records; staff cannot administer company',async()=>{
  company=(await save(owner,'company',{title:'Hellenic Practice',legal_name:'Example Ltd',jurisdiction:'Greece',sector:'lawyer'})).record;
  assert.equal(company.version,1);assert.equal(company.data.legal_name,'Example Ltd');
  await assert.rejects(save(editor,'company',{title:'Not allowed'}),/insufficient_permission/);
 });
 await t.test('staff links contact, matter and assigned deadline task',async()=>{
  contact=(await save(editor,'contact',{title:'Client contact',email:'client@example.test',company_id:company.id})).record;
  project=(await save(editor,'project',{title:'Client onboarding matter',company_id:company.id,contact_id:contact.id})).record;
  task=(await save(editor,'task',{title:'Review intake',project_id:project.id,due_at:'2026-10-05T10:00:00Z',assignee_profile_id:uid(22)})).record;
  assert.equal(task.company_id,company.id);assert.equal(task.project_id,project.id);
 });
 await t.test('task completion persists a versioned before/after audit',async()=>{
  task=(await save(editor,'task',{title:task.title,project_id:project.id,status:'completed'},task.id,task.version)).record;
  const history=await call(owner,`SELECT public.ops_audit_list('${ws}','${task.id}',50);`);
  assert.equal(task.status,'completed');assert.equal(task.version,2);
  assert.equal(history.events[0].before_data.status,'open');assert.equal(history.events[0].after_data.status,'completed');assert.equal(history.events[0].actor_profile_id,uid(22));
 });
 await t.test('concurrent edits of the same version have exactly one winner',async()=>{
  const outcomes=await Promise.allSettled([save(editor,'task',{title:'Edit A',project_id:project.id},task.id,2),save(owner,'task',{title:'Edit B',project_id:project.id},task.id,2)]);
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.match(outcomes.find(r=>r.status==='rejected').reason.message,/version_conflict/);
  task=outcomes.find(r=>r.status==='fulfilled').value.record;
 });
 await t.test('workspace scope and viewer role prevent unauthorized operations',async()=>{
  await assert.rejects(call(outsider,`SELECT public.ops_records_list('${ws}');`),/not_authorized/);
  await assert.rejects(save(viewer,'contact',{title:'Blocked write'}),/insufficient_permission/);
  otherCompany=(await save(outsider,'company',{title:'Other business'},null,0,otherWs)).record;
  await assert.rejects(save(editor,'project',{title:'Cross-workspace matter',company_id:otherCompany.id}),/cross_workspace_link/);
  await assert.rejects(save(editor,'task',{title:'Foreign assignee',project_id:project.id,assignee_profile_id:uid(24)}),/invalid_assignee/);
 });
 await t.test('RLS allows scoped reads and denies direct writes/audit edits',async()=>{
  const count=await sql(`SET ROLE authenticated;SET request.jwt.claim.sub='${owner}';SELECT count(*) FROM zoi.ops_records;`);
  assert.equal(Number(count.split('\n').at(-1)),4);
  await assert.rejects(sql(`SET ROLE authenticated;UPDATE zoi.ops_records SET title='Tampered';`),/permission denied/);
  await assert.rejects(sql(`SET ROLE authenticated;DELETE FROM zoi.ops_audit;`),/permission denied/);
 });
 await t.test('linked parents cannot be archived while active dependents exist',async()=>{
  await assert.rejects(archive(owner,company),/record_has_active_dependents/);
  await assert.rejects(archive(editor,task),/insufficient_permission/);
  const moved=(await save(owner,'company',{title:'Another company'})).record;
  await assert.rejects(save(owner,'project',{title:project.title,company_id:moved.id},project.id,project.version),/project_has_tasks/);
 });
 await t.test('archive increments version, preserves history and hides default list',async()=>{
  const archived=(await archive(owner,task)).record;assert.equal(archived.version,task.version+1);assert.ok(archived.archived_at);
  const active=await call(viewer,`SELECT public.ops_records_list('${ws}','task',false);`);assert.equal(active.records.length,0);
  const all=await call(viewer,`SELECT public.ops_records_list('${ws}','task',true);`);assert.equal(all.records.length,1);
  await assert.rejects(save(owner,'task',{title:'Cannot edit archived',project_id:project.id},task.id,archived.version),/record_archived/);
 });
});

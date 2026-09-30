import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const container=process.env.ZOI_TEST_POSTGRES_CONTAINER;
let database='postgres';
function sql(query){return new Promise((resolve,reject)=>{const child=spawn('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-X','-At','-v','ON_ERROR_STOP=1']);let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);child.on('error',reject);child.on('close',code=>code?reject(new Error(err)):resolve(out.trim()));child.stdin.end(query);});}
const migration=readFileSync(new URL('../../supabase/migrations/20260930001746_safe_email_delivery.sql',import.meta.url),'utf8');
const ws='00000000-0000-0000-0000-000000000001';
const user='00000000-0000-0000-0000-000000000002';
const campaign='00000000-0000-0000-0000-000000000003';
const auth=`SET ROLE authenticated; SET request.jwt.claim.sub='${user}';`;
const prepare=`SELECT public.email_delivery_prepare('${ws}','${campaign}','Zoi <test@example.test>');`;
const claim=`SELECT row_to_json(r) FROM public.email_delivery_claim('${campaign}',1) r;`;
test('consent-backed email outbox against PostgreSQL',{skip:!container},async t=>{
 const name='email_test_'+process.pid;await sql('CREATE DATABASE '+name);database=name;t.after(async()=>{database='postgres';await sql('DROP DATABASE '+name);});
 await sql(`DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
 CREATE SCHEMA zoi; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE FUNCTION zoi.is_ws_member(p_id uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT p_id='${ws}'::uuid AND auth.uid()='${user}'::uuid $$;
 CREATE TABLE zoi.workspaces(id uuid PRIMARY KEY);
 CREATE TABLE zoi.user_profiles(id uuid PRIMARY KEY,auth_user_id uuid);
 CREATE TABLE zoi.workspace_members(workspace_id uuid,profile_id uuid,role text);
 INSERT INTO zoi.user_profiles VALUES('${user}','${user}');
 INSERT INTO zoi.workspace_members VALUES('${ws}','${user}','owner');
 CREATE TABLE zoi.email_campaigns(id uuid PRIMARY KEY,workspace_id uuid,subject text,body text,from_name text,audience_tag text,status text,scheduled_at timestamptz,sent_at timestamptz,recipients integer);
 INSERT INTO zoi.workspaces VALUES('${ws}');
 INSERT INTO zoi.email_campaigns VALUES('${campaign}','${ws}','Hello {{name}}','Real content','Our business',NULL,'scheduled',now(),NULL,0);`);
 await sql(migration);
 await t.test('unknown consent never becomes an eligible recipient',async()=>{
  const result=JSON.parse(await sql(prepare));
  assert.equal(result.reason,'no_consented_recipients');
  assert.equal(await sql(`SELECT status FROM zoi.email_campaigns WHERE id='${campaign}';`),'draft');
  assert.equal(await sql('SELECT count(*) FROM zoi.email_delivery_runs;'),'0');
 });
 await t.test('consent requires member authorization and evidence',async()=>{
  const fn=`SELECT public.email_consent_record('${ws}','person@example.test','Person','{}','Signed signup form',now());`;
  await assert.rejects(sql('SET ROLE anon;'+fn),/permission denied/);
  await sql(auth+fn);
  await assert.rejects(sql(auth+fn.replace('Signed signup form','yes')),/consent_evidence_required/);
 });
 await t.test('viewers cannot record consent and fields are bounded',async()=>{
  const fn="SELECT public.email_consent_record('${ws}','person@example.test','Person','{}','Signed signup form',now());".replace('${ws}',ws);
  await sql("UPDATE zoi.workspace_members SET role='viewer';");
  await assert.rejects(sql(auth+fn),/insufficient_permission/);
  await assert.rejects(sql(auth+`SELECT public.email_delivery_authorize_sender('${ws}');`),/not_authorized/);
  await assert.rejects(sql(`SET ROLE authenticated; SELECT public.email_delivery_authorize_sender('${ws}');`),/not_authorized/);
  await sql("UPDATE zoi.workspace_members SET role='owner';");
  await assert.rejects(sql(auth+fn.replace("'Person'","repeat('x',201)")),/consent_field_too_large/);
 });
 await t.test('unsubscribe permanently suppresses import-based resubscription',async()=>{
  await sql("SELECT public.email_unsubscribe_token(unsubscribe_token) FROM zoi.email_subscriptions WHERE email='person@example.test';");
  await assert.rejects(sql(auth+`SELECT public.email_consent_record('${ws}','person@example.test','Person','{}','Imported CSV assertion',now());`),/cannot_be_resubscribed/);
 });
 await t.test('queues all 501 consenting recipients without truncation and excludes suppression',async()=>{
  await sql(`INSERT INTO zoi.email_subscriptions(workspace_id,email,name,status,consent_source,consented_at) SELECT '${ws}','person'||n||'@example.test','Person '||n,'subscribed','Test fixture explicit signup',now() FROM generate_series(1,501)n;`);
  await sql(`UPDATE zoi.email_campaigns SET status='scheduled',scheduled_at=now() WHERE id='${campaign}';`);
  await sql(prepare);await sql(prepare);
  assert.equal(await sql('SELECT count(*) FROM zoi.email_delivery_recipients;'),'501');
 });
 let receipt;
 await t.test('concurrent claims cannot lease the same recipient',async()=>{
  const [a,b]=await Promise.all([sql(claim),sql(claim)]);receipt=JSON.parse(a);
  assert.notEqual(receipt.id,JSON.parse(b).id);
 });
 await t.test('provider payload stays identical across retries and template changes',async()=>{
  const first=await sql(`SELECT public.email_delivery_payload('${receipt.id}','${receipt.lease_token}','{"subject":"Original payload"}');`);
  const retry=await sql(`SELECT public.email_delivery_payload('${receipt.id}','${receipt.lease_token}','{"subject":"Changed renderer"}');`);
  assert.equal(first,retry);
 });
 await t.test('accepted receipt persists once and retry cannot claim accepted recipient',async()=>{
  const finish=`SELECT public.email_delivery_complete('${receipt.id}','${receipt.lease_token}','accepted','provider-123',NULL);`;
  assert.equal(await sql(finish),'t');assert.equal(await sql(finish),'f');
  assert.equal(await sql(`SELECT state FROM zoi.email_delivery_recipients WHERE id='${receipt.id}';`),'accepted');
 });
 await t.test('expired unknown request reuses same recipient id and immutable payload',async()=>{
  await sql(`UPDATE zoi.email_delivery_recipients SET lease_until=now()-interval '1 second',next_attempt_at=now()-interval '1 day' WHERE state='in_flight';`);
  const retried=JSON.parse(await sql(claim));
  assert.equal(await sql(`SELECT attempts FROM zoi.email_delivery_recipients WHERE id='${retried.id}';`),'2');
  assert.equal(retried.body,'Real content');
  await sql(`UPDATE zoi.email_delivery_recipients SET first_attempt_at=now()-interval '24 hours',lease_until=now()-interval '1 second' WHERE id='${retried.id}';`);
  await sql(claim);
  assert.equal(await sql(`SELECT state FROM zoi.email_delivery_recipients WHERE id='${retried.id}';`),'uncertain');
 });
 await t.test('unsubscribe after claim blocks provider authorization',async()=>{
  const r=JSON.parse(await sql(claim));
  await sql(`SELECT public.email_unsubscribe_token('${r.unsubscribe_token}');`);
  assert.equal(await sql(`SELECT public.email_delivery_authorize('${r.id}','${r.lease_token}');`),'f');
  assert.equal(await sql(`SELECT state FROM zoi.email_delivery_recipients WHERE id='${r.id}';`),'suppressed');
 });
 await t.test('pending or uncertain recipients prevent false campaign completion',async()=>{
  const summary=JSON.parse(await sql(`SELECT public.email_delivery_finalize('${campaign}');`));
  assert.equal(summary.total,501);assert.ok(summary.pending>0);assert.equal(summary.uncertain,1);
  assert.equal(await sql(`SELECT status FROM zoi.email_campaigns WHERE id='${campaign}';`),'sending');
 });
 await t.test('a started campaign cannot erase its delivery ledger by deletion',async()=>{
  await assert.rejects(sql(`DELETE FROM zoi.email_campaigns WHERE id='${campaign}';`),/foreign key constraint/);
 });
 await t.test('ordinary callers cannot read or mutate the sending ledger',async()=>{
  await assert.rejects(sql(auth+claim),/permission denied/);
  await assert.rejects(sql('SET ROLE authenticated; SELECT * FROM zoi.email_delivery_recipients;'),/permission denied/);
 });
});

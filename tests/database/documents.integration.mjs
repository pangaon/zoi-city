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
const port=15482;const env={...process.env,PGHOST:dir,PGPORT:String(port),PGDATABASE:'postgres'};
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
 await query(`create role service_role bypassrls;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;create policy broad_test_policy on storage.objects for all to authenticated using(true) with check(true);create table zoi.ops_records(id uuid primary key,workspace_id uuid,kind text,title text,archived_at timestamptz);insert into zoi.ops_records values('${event}','${ws}','project','QA matter',null);update zoi.workspace_members set role='viewer' where profile_id='${member}';insert into zoi.workspace_members values('${ws}','${other}','editor');`);
 await query(readFileSync(new URL('../../supabase/migrations/20260930005755_private_workspace_documents.sql',import.meta.url),'utf8'));
 const call=(fn,args,user=actor)=>query(`select public.${fn}(${args});`,user).then(JSON.parse);
 const hash='a'.repeat(64),req='80000000-0000-4000-8000-000000000001';
 const args=(document,expected,request=req,project=event)=>`'${ws}','${project}',${document?`'${document}'`:'null'},${expected},'QA confidential document','${request}','client.pdf','application/pdf',12,'${hash}'`;
 await rejects(`select public.documents_list('${ws}',null);`,member,/document_permission_denied/);pass('viewer cannot read confidential document metadata');
 const first=await call('document_upload_begin',args(null,0),other),upload=first.upload,doc=first.document;
 assert.equal(upload.state,'pending');assert.equal(upload.object_path.startsWith(ws+'/'+doc.id+'/'),true);
 assert.equal((await call('document_upload_begin',args(null,0),other)).upload.id,upload.id);
 await rejects(`select public.document_upload_begin(${args(null,0).replace("'client.pdf'","'different.pdf'")});`,other,/document_request_conflict/);
 await rejects(`select public.document_upload_begin(${args(null,0).replace("'QA confidential document'","'Different title'")});`,other,/document_request_conflict/);
 await rejects(`select public.document_upload_begin(${args(null,0).replace("'"+event+"'","null")});`,other,/document_request_conflict/);
 await rejects(`select public.document_upload_begin(${args(null,1)});`,other,/document_request_conflict/);pass('editor reserves private version; retry reuses exact immutable object key');
 await rejects(`select public.document_upload_finish('${upload.id}');`,other,/permission denied/);pass('client cannot finalize fabricated uploads');
 await rejects(`select public.document_upload_finish('${upload.id}');`,undefined,/uploaded_object_mismatch/);pass('finalization rejects missing stored bytes');
 await rejects(`select public.document_upload_begin(${args(doc.id,0,'80000000-0000-4000-8000-000000000002')});`,actor,/document_upload_in_progress/);pass('competing document uploads cannot claim same next version');
 await query(`insert into storage.objects(bucket_id,name,metadata) values('workspace-documents','${upload.object_path}','{"size":12,"mimetype":"application/pdf"}');`);
 await query(`select public.document_upload_finish('${upload.id}');`);
 const finished=JSON.parse(await query(`select public.document_upload_finish('${upload.id}');`));assert.equal(finished.document.current_version,1);pass('verified stored bytes commit exactly one ready version');
 const denied=await query(`select count(*) from storage.objects where bucket_id='workspace-documents';`,other);assert.equal(denied,'0');
 await rejects(`insert into storage.objects(bucket_id,name) values('workspace-documents','forged');`,other,/row-level security/);pass('restrictive storage RLS defeats broad permissive policy for editor reads and writes');
 const permit=await call('document_download_authorize',`'${ws}','${upload.id}'`,other);assert.equal(permit.expires_in,60);assert.equal(permit.filename,'client.pdf');
 await rejects(`select public.document_download_authorize('${ws}','${upload.id}');`,member,/document_permission_denied/);pass('download authorization limited to document roles');
 await rejects(`select public.document_archive('${ws}','${doc.id}',1);`,other,/document_permission_denied/);pass('editor cannot archive documents');
 await rejects(`select public.document_upload_begin(${args(doc.id,0,'80000000-0000-4000-8000-000000000003')});`,actor,/version_conflict/);pass('stale upload version cannot overwrite document');
 const races=await Promise.allSettled([call('document_upload_begin',args(doc.id,1,'80000000-0000-4000-8000-000000000004')),call('document_upload_begin',args(doc.id,1,'80000000-0000-4000-8000-000000000005'),other)]);assert.equal(races.filter(r=>r.status==='fulfilled').length,1);const next=races.find(r=>r.status==='fulfilled').value;pass('real concurrent version reservations produce one winner');
 await rejects(`select public.document_cleanup_prepare('${ws}','${next.upload.id}');`,actor,/cleanup_not_allowed/);
 await query(`update zoi.document_versions set created_at=now()-interval '16 minutes' where id='${next.upload.id}';`);
 const cleanup=await call('document_cleanup_prepare',`'${ws}','${next.upload.id}'`);assert.equal(cleanup.object_path,next.upload.object_path);
 await rejects(`select public.document_upload_finish('${next.upload.id}');`,undefined,/upload_state_conflict/);
 const clean=JSON.parse(await query(`select public.document_cleanup_finish('${next.upload.id}');`));assert.equal(clean.state,'failed');
 await rejects(`select public.document_cleanup_prepare('${ws}','${upload.id}');`,actor,/cleanup_not_allowed/);pass('cleanup requires age and fenced failed state; never deletes ready versions');
 const history=await call('document_history',`'${ws}','${doc.id}'`);assert.equal(history.versions.length,2);assert.equal(history.audit.filter(a=>a.action==='uploaded').length,1);assert.equal(history.audit.find(a=>a.action==='cleanup_finished').actor_profile_id,actor);pass('version history and actor audit survive failed replacement');
 await call('document_archive',`'${ws}','${doc.id}',1`);
 await rejects(`select public.document_download_authorize('${ws}','${upload.id}');`,actor,/document_unavailable/);pass('archive blocks new download links without destroying history');
 const cross='20000000-0000-4000-8000-000000000002';await query(`insert into zoi.ops_records values('${cross}','10000000-0000-4000-8000-000000000002','project','Other workspace',null);`);
 await rejects(`select public.document_upload_begin(${args(null,0,'80000000-0000-4000-8000-000000000009',cross)});`,actor,/active_project_required/);
 await query(`insert into zoi.workspace_members values('10000000-0000-4000-8000-000000000002','${actor}','owner');`);
 await rejects(`select public.document_history('10000000-0000-4000-8000-000000000002','${doc.id}');`,actor,/document_unavailable/);pass('cross-workspace matter links and document lookups rejected even for dual owner');
 console.log(`# ${checks} document database checks passed`);
}finally{
 if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});
 rmSync(dir,{recursive:true,force:true});
}

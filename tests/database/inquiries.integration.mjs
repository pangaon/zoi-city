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
const port=15486;const env={...process.env,PGHOST:dir,PGPORT:String(port),PGDATABASE:'postgres'};
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
 await query(`alter table zoi.user_profiles add column display_name text;alter table zoi.listings add column name text default 'QA business';create function zoi.ops_role(p_workspace uuid) returns text language sql security definer as $$select m.role from zoi.workspace_members m join zoi.user_profiles p on p.id=m.profile_id where m.workspace_id=p_workspace and p.auth_user_id=auth.uid()$$;update zoi.workspace_members set role='viewer' where profile_id='${member}';`);
 await query(readFileSync(new URL('../../supabase/migrations/20260930014346_private_business_inquiries.sql',import.meta.url),'utf8'));
 const call=(fn,args,user=actor)=>query(`select public.${fn}(${args});`,user).then(JSON.parse);
 const req=n=>`80000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const start=(n=1,body='Can we discuss a consultation?')=>`'${event}','Consultation','${body}','${req(n)}'`;
 assert.equal((await call('inquiry_availability',`'${event}'`)).available,false);
 await rejects(`select public.inquiry_start(${start()});`,other,/inquiry_unavailable/);pass('published business must opt in before receiving enquiries');
 await rejects(`select public.inquiry_settings_save('${ws}','${event}',true,null);`,actor,/inquiry_version_conflict/);
 await call('inquiry_settings_save',`'${ws}','${event}',true,0`);assert.equal((await call('inquiry_availability',`'${event}'`)).available,true);pass('owner enables owned published listing with explicit version');
 await rejects(`select public.inquiry_inbox('${ws}');`,member,/inquiry_permission_denied/);pass('viewer cannot read confidential inbox');
 const first=await call('inquiry_start',start(),other),id=first.thread.id;
 assert.equal((await call('inquiry_start',start(),other)).thread.id,id);await rejects(`select public.inquiry_start(${start(1,'Changed')});`,other,/inquiry_request_conflict/);assert.equal(await query('select count(*) from zoi.inquiry_messages;'),'1');pass('customer request retries never duplicate initial message');
 await rejects(`select public.inquiry_thread('${id}');`,member,/inquiry_permission_denied/);await rejects(`select public.inquiry_update('${ws}','${id}',1,'resolved',null);`,other,/inquiry_permission_denied/);pass('nonparticipant cannot read and customer cannot operate inbox');
 const reply=await call('inquiry_reply',`'${id}','We can help.','${req(2)}'`);assert.equal(reply.thread.status,'waiting');assert.equal((await call('inquiry_reply',`'${id}','We can help.','${req(2)}'`)).message.id,reply.message.id);pass('operator reply is immutable and idempotent');
 await rejects(`select public.inquiry_update('${ws}','${id}',1,'resolved',null);`,actor,/inquiry_version_conflict/);
 await rejects(`select public.inquiry_update('${ws}','${id}',2,'resolved','${member}');`,actor,/invalid_inquiry_assignee/);pass('stale state and assignment to viewer rejected');
 await call('inquiry_update',`'${ws}','${id}',2,'resolved','${actor}'`);
 assert.equal((await call('inquiry_reply',`'${id}','Thank you, one more question.','${req(3)}'`,other)).thread.status,'open');pass('customer reply reopens resolved enquiry');
 const own=await call('inquiry_thread',`'${id}'`,other),inbox=await call('inquiry_thread',`'${id}'`);assert.equal(own.audit.length,0);assert.equal(inbox.audit.length,4);assert.equal(own.messages.length,3);pass('customer reads own conversation; operator sees actor/time audit');
 const updates=await Promise.allSettled([call('inquiry_update',`'${ws}','${id}',4,'waiting',null`),call('inquiry_update',`'${ws}','${id}',4,'resolved',null`)]);assert.equal(updates.filter(x=>x.status==='fulfilled').length,1);pass('concurrent operators cannot overwrite each other’s status');
 await query(`insert into zoi.inquiry_messages(thread_id,author_id,author_side,request_id,body,created_at) select '${id}','${other}','customer',gen_random_uuid(),'Pagination fixture',now() from generate_series(1,101);`);
 const page1=await call('inquiry_thread',`'${id}'`,other),page2=await call('inquiry_thread',`'${id}','${page1.older_cursor}'`,other);assert.equal(page1.messages.length,100);assert.equal(page2.messages.length,4);assert.equal(new Set([...page1.messages,...page2.messages].map(m=>m.id)).size,104);pass('message cursor pages equal timestamps without duplicates or loss');
 await query(`update zoi.listings set marketplace_status='hidden' where id='${event}';`);assert.equal((await call('inquiry_availability',`'${event}'`)).available,false);assert.equal((await call('inquiry_inbox',`'${ws}'`)).listings.length,0);assert.equal((await call('inquiry_thread',`'${id}'`,other)).can_reply,false);await rejects(`select public.inquiry_start(${start(8)});`,other,/inquiry_unavailable/);await rejects(`select public.inquiry_reply('${id}','Hidden page reply','${req(9)}');`,actor,/inquiry_business_changed/);await rejects(`select public.inquiry_settings_save('${ws}','${event}',true,1);`,actor,/inquiry_listing_unavailable/);await query(`update zoi.listings set marketplace_status='' where id='${event}';`);pass('hidden listing disables public availability, new enquiries, replies and setup projection');
 const concurrent=await Promise.all([call('inquiry_start',start(4),other),call('inquiry_start',start(4),other)]);assert.equal(concurrent[0].thread.id,concurrent[1].thread.id);pass('simultaneous initial sends create exactly one thread');
 await query(`update zoi.listings set owner_workspace_id='10000000-0000-4000-8000-000000000002' where id='${event}';`);
 assert.equal((await call('inquiry_availability',`'${event}'`)).available,false);assert.equal((await call('inquiry_thread',`'${id}'`,other)).can_reply,false);await rejects(`select public.inquiry_reply('${id}','Changed business','${req(5)}');`,actor,/inquiry_business_changed/);pass('ownership transfer stops old scheduler and message delivery');
 await query(`insert into zoi.workspace_members values('10000000-0000-4000-8000-000000000002','${member}','owner');`);await rejects(`select public.inquiry_thread('${id}');`,member,/inquiry_permission_denied/);pass('new business owner cannot inherit previous customer conversations');
 await rejects('select * from zoi.inquiry_messages;',actor,/permission denied/);pass('raw message tables remain inaccessible');
 console.log(`${checks} enquiry database checks passed`);
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

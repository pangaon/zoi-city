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
const port=15539;const env={...process.env,PGHOST:dir,PGPORT:String(port),PGDATABASE:'postgres'};
const actor='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',member='00000000-0000-4000-8000-000000000003',ws='10000000-0000-4000-8000-000000000001',event='20000000-0000-4000-8000-000000000001';
const literal=x=>"'"+String(x).replace(/'/g,"''")+"'";
const sql=(query,user)=>`${user?`set role authenticated;set request.jwt.claim.session_id='90000000-0000-4000-8000-000000000001';select set_config('request.jwt.claim.sub','${user}',false);`:''}${query}`;
async function query(q,user){const r=await run(join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',sql(q,user)],{env});return r.stdout.trim().split('\n').filter(Boolean).at(-1);}
async function rejects(q,user,pattern){try{await query(q,user);assert.fail('Expected SQL rejection');}catch(e){assert.match(e.stderr||e.message,pattern);}}
let started=false,checks=0;
const pass=name=>{checks++;console.log('PASS '+name);};
try{
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-A','trust','--no-locale'],{stdio:'ignore'});
 execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'server.log'),'-o',`-k ${dir} -p ${port} -c listen_addresses=''`,'-w','start'],{stdio:'ignore'});started=true;
 await query(readFileSync(new URL('./venue-fixture.sql',import.meta.url),'utf8'));
 await query(`alter table zoi.user_profiles add column display_name text;alter table zoi.listings add column name text default 'QA business';update zoi.workspace_members set role='viewer' where profile_id='${member}';`);
 for(const file of ['20260930001738_business_operations_foundation.sql','20260930014346_private_business_inquiries.sql','20260930020814_festival_packages_and_applications.sql','20260930021401_creator_briefs_and_deliverables.sql','20261001004632_creator_mutation_receipts.sql'])await query(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 await query(`alter table zoi.workspaces add column owner_profile_id uuid;update zoi.workspaces set owner_profile_id='${actor}';create table auth.users(id uuid primary key,deleted_at timestamptz,is_anonymous boolean,banned_until timestamptz);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);insert into auth.users values('${actor}',null,false,null);insert into auth.sessions values('90000000-0000-4000-8000-000000000001','${actor}',null);create function auth.jwt()returns jsonb language sql stable as $$select jsonb_build_object('session_id',current_setting('request.jwt.claim.session_id',true))$$;`);
 const authority=readFileSync(new URL('../../supabase/migrations/20261001170000_workspace_current_authority.sql',import.meta.url),'utf8');await query(authority.slice(authority.indexOf('create function zoi.suite_current_session()'),authority.indexOf('create function zoi.assert_workspace_write(')));
 const call=(fn,args,user=actor)=>query(`select public.${fn}(${args});`,user).then(JSON.parse),j=x=>literal(JSON.stringify(x))+'::jsonb',req=n=>`80000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const execute=(n,action,args,user=actor)=>call('creator_mutation_execute',`'${req(n)}',${literal(action)},${j(args)}`,user);
 const company=(await call('ops_record_save',`'${ws}','company','{"title":"QA sponsor","sector":"creator"}',null,0`)).record;
 await call('inquiry_settings_save',`'${ws}','${event}',true,0`);
 let seq=1000;
 const offer=()=>({event_id:event,kind:'sponsor',name:'QA package',description:'Original',benefits:['Original screen benefit'],price_cents:10000,currency:'CAD',capacity:20,closes_at:new Date(Date.now()+7*86400000).toISOString(),timezone:'UTC',active:true});
 const form={organisation:'QA customer',contact_name:'QA',contact_email:'qa@example.invalid',category:'sponsor',units:1,notes:'Local only'};
 async function application(approve=true){const p=(await call('festival_package_save',`'${ws}','${req(++seq)}',0,${j(offer())}`)).package;let a=(await call('festival_apply',`'${p.id}',1,'${req(++seq)}',${j(form)}`,other)).application;if(approve)a=(await call('festival_application_decide',`'${ws}','${a.id}',1,'approve',''`)).application;return a;}
 const convert=(a,n=++seq)=>execute(n,'creator_convert',{p_workspace:ws,p_inquiry:a.inquiry_id,p_company:company.id,p_kind:'sponsorship'});
 const draft={title:'QA campaign',summary:'Original obligations',planned_fee_cents:0,currency:'CAD',channels:['other'],usage_terms:'Agreed',disclosure_notes:'Sponsored'};
 const deliverable={title:'Original screen benefit',description:'Review exact promise',channel:'other',due_at:null};
 // Existing campaign is retained and bound without changing historical customer data.
 const prior=await application();const priorC=await convert(prior);
 await query(readFileSync(new URL('../../supabase/migrations/20261002165444_sponsor_fulfillment_binding.sql',import.meta.url),'utf8'));
 assert.equal(await query(`select application_id from zoi.festival_creator_bindings where campaign_id='${priorC.campaign_id}';`),prior.id);pass('existing exact sponsor campaign backfilled');
 const capability=await call('festival_fulfillment_source',`'${ws}','${prior.id}'`);assert.equal(capability.capability,'festival_creator_binding_v1');assert.equal(capability.application.id,prior.id);assert.equal(capability.campaign_id,priorC.campaign_id);
 await query('alter table zoi.creator_submissions disable trigger festival_creator_submission_write;');await rejects(`select public.festival_fulfillment_source('${ws}','${prior.id}');`,actor,/festival_fulfillment_unavailable/);await query('alter table zoi.creator_submissions enable trigger festival_creator_submission_write;');pass('capability requires exact enabled guard triggers and scoped application');
 await query(`update auth.sessions set not_after=clock_timestamp()-interval '1 minute';`);await rejects(`select public.festival_fulfillment_source('${ws}','${prior.id}');`,actor,/suite_session_unavailable/);await query('update auth.sessions set not_after=null;');pass('capability current session expiry denied');

 await rejects('select * from zoi.festival_creator_bindings;',actor,/permission denied/);await rejects(`select zoi.festival_creator_require_active('${priorC.campaign_id}');`,actor,/permission denied/);pass('private binding and internal guard unavailable directly');
 const pending=await application(false);await rejects(`select public.creator_convert('${ws}','${pending.inquiry_id}','${company.id}','sponsorship','${req(++seq)}');`,actor,/festival_fulfillment_not_approved/);assert.equal(await query(`select count(*) from zoi.creator_campaigns where inquiry_id='${pending.inquiry_id}';`),'0');pass('unapproved conversion rolls back campaign/project');
 const a=await application();
 await rejects(`select public.creator_convert('${ws}','${a.inquiry_id}','${company.id}','performance','${req(++seq)}');`,actor,/festival_fulfillment_identity_mismatch/);
 const created=await convert(a),id=created.campaign_id;pass('sponsor source cannot convert through performance kind');
 await call('festival_package_save',`'${ws}','${a.package_id}',1,${j({...offer(),benefits:['Changed future offer']})}`);
 assert.deepEqual(JSON.parse(await query(`select terms->'benefits' from zoi.festival_creator_bindings where campaign_id='${id}';`)),['Original screen benefit']);
 await execute(1,'creator_draft_save',{p_campaign:id,p_expected_version:1,p_data:draft});
 const d=await execute(2,'creator_deliverable_save',{p_campaign:id,p_expected_version:0,p_data:deliverable});
 const d2=await execute(8,'creator_deliverable_save',{p_campaign:id,p_expected_version:0,p_data:{...deliverable,title:'Second promise'}});
 const shared=await execute(3,'creator_brief_share',{p_campaign:id,p_expected_version:4});
 await execute(4,'creator_brief_decide',{p_brief:shared.entity_id,p_decision:'accepted',p_note:'Reviewed'},other);
 const sent=await execute(5,'creator_submission_send',{p_campaign:id,p_deliverable:d.entity_id,p_url:'https://proof.example.test/approved',p_note:'Proof'});
 await call('creator_draft_save',`'${id}',${Number(await query(`select version from zoi.creator_campaigns where id='${id}';`))},${j({...draft,title:'Unshared change'})}`);
 pass('approved immutable original terms support real campaign/deliverable/brief/proof writers');
 const taskBefore=await query(`select to_jsonb(r) from zoi.ops_records r where id=(select task_id from zoi.creator_deliverables where id='${d.entity_id}');`);
 await call('festival_application_decide',`'${ws}','${a.id}',2,'cancel','Cancelled by organiser'`);
 const version=Number(await query(`select version from zoi.creator_campaigns where id='${id}';`));
 await rejects(`select public.creator_draft_save('${id}',${version},${j({...draft,title:'No longer authorized'})});`,actor,/festival_fulfillment_not_approved/);
 await rejects(`select public.creator_deliverable_save('${id}','${d.entity_id}',1,${j({...deliverable,title:'Changed after cancel'})});`,actor,/festival_fulfillment_not_approved/);
 await rejects(`select public.creator_brief_share('${id}',${version},'${req(++seq)}');`,actor,/festival_fulfillment_not_approved/);
 await rejects(`select public.creator_submission_send('${id}','${d2.entity_id}','https://proof.example.test/other','No','${req(++seq)}');`,actor,/festival_fulfillment_not_approved/);
 await rejects(`select public.creator_submission_decide('${sent.entity_id}','accepted','No after cancel','${req(++seq)}');`,other,/festival_fulfillment_not_approved/);
 assert.equal(await query(`select to_jsonb(r) from zoi.ops_records r where id=(select task_id from zoi.creator_deliverables where id='${d.entity_id}');`),taskBefore);
 assert.equal((await call('creator_request_status',`'${req(2)}',false`)).state,'saved');assert.equal((await call('creator_get',`'${id}'`,other)).ok,true);pass('cancel blocks legacy writes/customer proof and rolls linked task back; history/receipts readable');
 const b=await application(),bc=await convert(b);await execute(10,'creator_draft_save',{p_campaign:bc.campaign_id,p_expected_version:1,p_data:draft});await execute(11,'creator_deliverable_save',{p_campaign:bc.campaign_id,p_expected_version:0,p_data:deliverable});const bs=await execute(12,'creator_brief_share',{p_campaign:bc.campaign_id,p_expected_version:3});await call('festival_application_withdraw',`'${b.id}',2,'Customer withdrew'`,other);
 await rejects(`select public.creator_brief_decide('${bs.entity_id}','accepted','No after withdraw','${req(++seq)}');`,other,/festival_fulfillment_not_approved/);pass('withdraw blocks new customer brief decisions');
 await rejects(`update zoi.festival_applications set terms=terms||'{"benefits":["Replacement"]}'::jsonb where id='${prior.id}';`,null,/festival_application_identity_immutable/);await rejects(`update zoi.festival_applications set units=2 where id='${prior.id}';`,null,/festival_bound_quantity_immutable/);pass('bound source terms/identity/quantity cannot drift');
 // Authorized proof acceptance completes the original linked Operations task.
 await execute(30,'creator_draft_save',{p_campaign:priorC.campaign_id,p_expected_version:1,p_data:draft});
 const pd=await execute(31,'creator_deliverable_save',{p_campaign:priorC.campaign_id,p_expected_version:0,p_data:deliverable});
 const pb=await execute(32,'creator_brief_share',{p_campaign:priorC.campaign_id,p_expected_version:3});
 await execute(33,'creator_brief_decide',{p_brief:pb.entity_id,p_decision:'accepted',p_note:'Reviewed'},other);
 const ps=await execute(34,'creator_submission_send',{p_campaign:priorC.campaign_id,p_deliverable:pd.entity_id,p_url:'https://proof.example.test/current',p_note:'Current'});
 await execute(35,'creator_submission_decide',{p_submission:ps.entity_id,p_decision:'accepted',p_note:'Accepted'},other);
 assert.equal(await query(`select status from zoi.creator_submissions where id='${ps.entity_id}';`),'accepted');pass('approved customer proof acceptance remains functional');
 await query(`update zoi.workspace_members set role='viewer' where workspace_id='${ws}' and profile_id='${actor}';`);
 await rejects(`select public.creator_draft_save('${priorC.campaign_id}',4,${j(draft)});`,actor,/creator_permission_denied/);
 await query(`update zoi.workspace_members set role='owner' where workspace_id='${ws}' and profile_id='${actor}';`);pass('existing current workspace role gate preserved');
 // Generic Creator campaigns keep their existing contract.
 const g=(await call('inquiry_start',`'${event}','Generic','QA','${req(++seq)}'`,other)).thread;const gc=await convert({inquiry_id:g.id});await execute(20,'creator_draft_save',{p_campaign:gc.campaign_id,p_expected_version:1,p_data:draft});assert.equal(await query(`select count(*) from zoi.festival_creator_bindings where campaign_id='${gc.campaign_id}';`),'0');pass('ordinary Creator workflow remains unbound and writable');
 const barrier=async name=>{for(let k=0;k<100;k++){if(Number(await query(`select count(*) from pg_stat_activity where query like '%${name}%' and wait_event='PgSleep';`)))return;await new Promise(r=>setTimeout(r,20));}throw Error('isolated barrier timeout');};
 const demotion=query(`begin;select 1 from zoi.workspaces where id='${ws}' for update;update zoi.workspace_members set role='viewer' where workspace_id='${ws}' and profile_id='${actor}';select pg_sleep(0.7) /* CAPABILITY_ROLE_WAIT */;commit;`);await barrier('CAPABILITY_ROLE_WAIT');await rejects(`select public.festival_fulfillment_source('${ws}','${prior.id}');`,actor,/festival_permission_denied/);await demotion;await query(`update zoi.workspace_members set role='owner' where workspace_id='${ws}' and profile_id='${actor}';`);pass('capability rereads current role after workspace wait');
 // Cancellation and write serialize in both orders with existing public writers.
 for(const cancelFirst of [true,false]){const x=await application(),xc=await convert(x),name='SPONSOR_ORDER_'+cancelFirst;const cancel=`select public.festival_application_decide('${ws}','${x.id}',2,'cancel','QA cancellation');`,write=`select public.creator_draft_save('${xc.campaign_id}',1,${j(draft)});`;
 const winner=query(`begin;${cancelFirst?cancel:write}select pg_sleep(0.7) /* ${name} */;commit;`,actor);await barrier(name);const loser=query(cancelFirst?write:cancel,actor);const results=await Promise.allSettled([winner,loser]);assert.equal(results[0].status,'fulfilled');if(cancelFirst){assert.equal(results[1].status,'rejected');assert.match(results[1].reason.stderr,/festival_fulfillment_not_approved/);}else assert.equal(results[1].status,'fulfilled');pass('concurrent '+(cancelFirst?'cancel prevents stale write':'completed write precedes cancellation'));}
 // Hostile service linkage race: both sides lock the same inquiry even when absent.
 for(const appFirst of [true,false]){const t=(await call('inquiry_start',`'${event}','Late attachment','QA','${req(++seq)}'`,other)).thread;const p=(await call('festival_package_save',`'${ws}','${req(++seq)}',0,${j(offer())}`)).package;const app=`insert into zoi.festival_applications(package_id,workspace_id,event_id,profile_id,request_id,initial_data,data,terms,units,total_cents,inquiry_id) values('${p.id}','${ws}','${event}','${other}','${req(++seq)}','{}','{}',${j({kind:'sponsor',benefits:['Original']})},1,0,'${t.id}');`;const conv=`select public.creator_convert('${ws}','${t.id}','${company.id}','sponsorship','${req(++seq)}');`,name='SPONSOR_LINK_'+appFirst;
 const winner=query(`begin;${appFirst?app:conv}select pg_sleep(0.7) /* ${name} */;commit;`,appFirst?null:actor);await barrier(name);const loser=query(appFirst?conv:app,appFirst?actor:null);const results=await Promise.allSettled([winner,loser]);assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'rejected');assert.match(results[1].reason.stderr,appFirst?/festival_fulfillment_not_approved/:/festival_campaign_already_exists/);pass('concurrent absent-counterpart '+(appFirst?'application first':'campaign first')+' cannot create unbound sponsorship');}
 console.log(`${checks} sponsor fulfillment database checks passed`);
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

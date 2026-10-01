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
const port=15519;const env={...process.env,PGHOST:dir,PGPORT:String(port),PGDATABASE:'postgres'};
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
 await query(`alter table zoi.user_profiles add column display_name text;alter table zoi.listings add column name text default 'QA business';update zoi.workspace_members set role='viewer' where profile_id='${member}';`);
 for(const file of ['20260930001738_business_operations_foundation.sql','20260930014346_private_business_inquiries.sql','20260930021401_creator_briefs_and_deliverables.sql','20261001004632_creator_mutation_receipts.sql'])await query(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 const call=(fn,args,user=actor)=>query(`select public.${fn}(${args});`,user).then(JSON.parse);
 const req=n=>`80000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const j=x=>literal(JSON.stringify(x))+'::jsonb';
 const execute=(n,action,args,user=actor)=>call('creator_mutation_execute',`'${req(n)}',${literal(action)},${j(args)}`,user);
 const status=(n,cancel=false,user=actor)=>call('creator_request_status',`'${req(n)}',${cancel}`,user);
 const replay=async(n,action,args,user=actor)=>{const a=await execute(n,action,args,user);assert.equal(a.state,'saved');assert.deepEqual(await execute(n,action,args,user),a);assert.deepEqual(await status(n,false,user),a);return a;};
 const company=(await call('ops_record_save',`'${ws}','company','{"title":"Recovery company","sector":"creator"}',null,0`)).record;
 await call('inquiry_settings_save',`'${ws}','${event}',true,0`);
 const inquiry=(await call('inquiry_start',`'${event}','Recovery test','Synthetic only','${req(100)}'`,other)).thread;
 const converted=await replay(1,'creator_convert',{p_workspace:ws,p_inquiry:inquiry.id,p_company:company.id,p_kind:'sponsorship'}),id=converted.campaign_id;
 assert.equal(await query("select count(*) from zoi.ops_records where kind='project';"),'1');pass('convert same nonce creates one project and exact receipt');
 const draft={title:'Synthetic campaign',summary:'Synthetic brief',planned_fee_cents:100,currency:'EUR',channels:['instagram'],usage_terms:'Organic',disclosure_notes:'Sponsored'};
 const dargs={p_campaign:id,p_expected_version:1,p_data:draft};await replay(2,'creator_draft_save',dargs);assert.equal(await query(`select count(*) from zoi.creator_audit where campaign_id='${id}' and action='draft_saved';`),'1');pass('lost committed draft reply replays without duplicate audit/version');
 const data={title:'Synthetic video',description:'Local only',channel:'instagram',due_at:null};const made=await replay(3,'creator_deliverable_save',{p_campaign:id,p_expected_version:0,p_data:data});assert.equal(made.entity_id,req(3));assert.equal(await query("select count(*) from zoi.ops_records where kind='task';"),'1');pass('deliverable fallback nonce ID creates one linked task');
 await replay(4,'creator_deliverable_save',{p_campaign:id,p_id:made.entity_id,p_expected_version:1,p_data:{...data,title:'Updated video'}});assert.equal(await query(`select version from zoi.creator_deliverables where id='${made.entity_id}';`),'2');pass('deliverable update receipt avoids repeating task update');
 const shared=await replay(5,'creator_brief_share',{p_campaign:id,p_expected_version:4});
 await replay(6,'creator_brief_decide',{p_brief:shared.entity_id,p_decision:'accepted',p_note:'Synthetic acceptance'},other);
 const sent=await replay(7,'creator_submission_send',{p_campaign:id,p_deliverable:made.entity_id,p_url:'https://example.test/proof',p_note:'Synthetic proof'});
 await replay(8,'creator_submission_decide',{p_submission:sent.entity_id,p_decision:'accepted',p_note:'Synthetic approval'},other);
 assert.equal(await query(`select count(*) from zoi.ops_audit where record_id=(select task_id from zoi.creator_deliverables where id='${made.entity_id}') and actor_profile_id='${other}';`),'1');pass('all seven actions exact replay; customer decisions complete task once');
 await rejects(`select public.creator_mutation_execute('${req(2)}','creator_draft_save',${j({...dargs,p_data:{...draft,title:'Conflict'}})});`,actor,/creator_request_conflict/);pass('same nonce changed arguments refused');
 assert.equal((await status(2,false,other)).state,'missing');await rejects(`select * from zoi.creator_mutation_receipts;`,other,/permission denied/);await rejects(`set role anon;select public.creator_request_status('${req(2)}',false);`,null,/permission denied/);pass('actor isolation and private ledger/anonymous grants');
 await query(`update zoi.workspace_members set role='viewer' where profile_id='${actor}' and workspace_id='${ws}';`);await rejects(`select public.creator_request_status('${req(2)}',false);`,actor,/creator_permission_denied/);await rejects(`select public.creator_mutation_execute('${req(2)}','creator_draft_save',${j(dargs)});`,actor,/creator_permission_denied/);assert.equal((await status(6,false,other)).state,'saved');await query(`update zoi.workspace_members set role='owner' where profile_id='${actor}' and workspace_id='${ws}';`);pass('revoked operator cannot read or replay receipt; customer own receipt survives');
 assert.equal((await status(20)).state,'missing');assert.equal((await status(20,true)).state,'cancelled');await rejects(`select public.creator_mutation_execute('${req(20)}','creator_draft_save',${j({p_campaign:id,p_expected_version:5,p_data:draft})});`,actor,/creator_request_cancelled/);pass('cancellation tombstone blocks later delayed execute');
 await rejects(`select public.creator_mutation_execute('${req(21)}','creator_draft_save',${j({p_campaign:id,p_expected_version:999,p_data:draft})});`,actor,/creator_version_conflict/);assert.equal((await status(21)).state,'missing');await rejects(`select public.creator_mutation_execute('${req(22)}','unknown','{}');`,actor,/invalid_creator_request/);assert.equal((await status(22)).state,'missing');pass('failed/invalid mutation has no phantom receipt');
 // Hold the exact advisory lock in the winning transaction; poll only isolated PG
 // for its receipt before starting the competing client, guaranteeing both orders.
 const waitReceipt=async n=>{for(let i=0;i<50;i++){const v=await query(`select count(*) from pg_stat_activity where query like '%RECOVERY_WINNER_${n}%' and wait_event='PgSleep';`);if(Number(v)>0)return;await new Promise(r=>setTimeout(r,20));}throw Error('winner did not reach controlled barrier');};
 for(const cancelFirst of[true,false]){const n=cancelFirst?30:31;const version=Number(await query(`select version from zoi.creator_campaigns where id='${id}';`));const args={p_campaign:id,p_expected_version:version,p_data:{...draft,title:'Concurrent '+n}};const mutation=`select public.creator_mutation_execute('${req(n)}','creator_draft_save',${j(args)});`,cancel=`select public.creator_request_status('${req(n)}',true);`;
 const winner=query(`begin;${cancelFirst?cancel:mutation}select pg_sleep(0.6) /* RECOVERY_WINNER_${n} */;commit;`,actor);await waitReceipt(n);const loser=query(cancelFirst?mutation:cancel,actor);const results=await Promise.allSettled([winner,loser]);assert.equal(results[0].status,'fulfilled');if(cancelFirst){assert.equal(results[1].status,'rejected');assert.match(results[1].reason.stderr,/creator_request_cancelled/);assert.equal((await status(n)).state,'cancelled');assert.equal(Number(await query(`select version from zoi.creator_campaigns where id='${id}';`)),version);}else{assert.equal(results[1].status,'fulfilled');assert.equal(JSON.parse(results[1].value).state,'saved');assert.equal(Number(await query(`select version from zoi.creator_campaigns where id='${id}';`)),version+1);}pass('concurrent '+(cancelFirst?'cancel wins; writer blocked':'save wins; cancel returns saved receipt'));}
 console.log(`${checks} creator recovery database checks passed`);
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

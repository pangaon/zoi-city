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
const port=15487;const env={...process.env,PGHOST:dir,PGPORT:String(port),PGDATABASE:'postgres'};
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
 for(const file of ['20260930001738_business_operations_foundation.sql','20260930014346_private_business_inquiries.sql','20260930013535_creator_briefs_and_deliverables.sql'])await query(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 const call=(fn,args,user=actor)=>query(`select public.${fn}(${args});`,user).then(JSON.parse);
 const req=n=>`80000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const j=x=>literal(JSON.stringify(x))+'::jsonb';
 const company=(await call('ops_record_save',`'${ws}','company','{"title":"Creator business","sector":"creator"}',null,0`)).record;
 await call('inquiry_settings_save',`'${ws}','${event}',true,0`);
 const inquiry=(await call('inquiry_start',`'${event}','Sponsorship','A paid collaboration brief','${req(1)}'`,other)).thread;
 const convert=`'${ws}','${inquiry.id}','${company.id}','sponsorship','${req(2)}'`;
 let campaign=(await call('creator_convert',convert)).campaign;const id=campaign.id;
 assert.equal((await call('creator_convert',convert)).campaign.id,id);assert.equal(await query(`select count(*) from zoi.ops_records where kind='project';`),'1');pass('idempotent conversion creates one real Operations project');
 await rejects(`select public.creator_get('${id}');`,other,/creator_permission_denied/);assert.equal((await call('creator_customer_list','',other)).campaigns.length,0);await rejects(`select public.creator_list('${ws}');`,member,/creator_permission_denied/);pass('drafts hidden from customers and viewer role');
 const draft={title:'Greek summer launch',summary:'Three creator videos',planned_fee_cents:25000,currency:'EUR',channels:['instagram'],usage_terms:'Organic use for30days',disclosure_notes:'Clearly label sponsorship'};
 campaign=(await call('creator_draft_save',`'${id}',1,${j(draft)}`)).campaign;assert.equal(campaign.version,2);
 const did=req(3),ddata={title:'Sponsored video',description:'One original video',channel:'instagram',due_at:'2026-10-01T12:00:00Z'};
 await rejects(`select public.creator_deliverable_save('${id}','${did}',0,${j({...ddata,due_at:'2026-10-01T12:00'})});`,actor,/creator_timezone_required/);await rejects(`select public.creator_deliverable_save('${id}','${did}',0,${j({...ddata,due_at:'infinity'})});`,actor,/creator_timezone_required|invalid_creator_deadline/);pass('deliverable deadlines reject ambiguous timezone and infinite dates');
 const dargs=`'${id}','${did}',0,${j(ddata)}`;const d=(await call('creator_deliverable_save',dargs)).deliverable;assert.equal((await call('creator_deliverable_save',dargs)).deliverable.id,d.id);assert.equal(await query(`select count(*) from zoi.ops_records where kind='task';`),'1');pass('deliverable creation retries create one linked Operations task');
 let got=await call('creator_get',`'${id}'`);campaign=got.campaign;
 await rejects(`select public.creator_submission_send('${id}','${did}','https://example.com/video','','${req(4)}');`,actor,/creator_accepted_brief_required/);
 const shareargs=`'${id}',${campaign.version},'${req(5)}'`,brief=(await call('creator_brief_share',shareargs)).brief;assert.equal((await call('creator_brief_share',shareargs)).brief.id,brief.id);pass('explicit share records one immutable snapshot');
 got=await call('creator_get',`'${id}'`,other);assert.equal(got.campaign.draft,undefined);assert.equal(got.campaign.project_id,undefined);assert.equal(got.deliverables[0].task_id,undefined);assert.equal(got.audit.length,0);assert.equal(got.briefs[0].payload.brief.title,draft.title);pass('customer sees shared brief only, never private draft or Operations IDs');
 await rejects(`select public.creator_brief_decide('${brief.id}','accepted','','${req(6)}');`,actor,/creator_permission_denied/);
 assert.equal((await call('creator_brief_decide',`'${brief.id}','accepted','Agreed','${req(6)}'`,other)).brief.status,'accepted');assert.equal((await call('creator_brief_decide',`'${brief.id}','accepted','Agreed','${req(6)}'`,other)).brief.id,brief.id);pass('only source customer can acknowledge agreed version idempotently');
 await rejects(`select public.creator_submission_send('${id}','${did}','javascript:alert(1)','','${req(7)}');`,actor,/invalid_creator_delivery_link/);
 const sent=(await call('creator_submission_send',`'${id}','${did}','https://example.com/video','Published proof','${req(8)}'`)).submission;assert.equal((await call('creator_submission_send',`'${id}','${did}','https://example.com/video','Published proof','${req(8)}'`)).submission.id,sent.id);pass('validated HTTPS delivery proof persists exactly once');
 await call('creator_submission_decide',`'${sent.id}','changes_requested','Please change caption','${req(9)}'`,other);
 assert.equal(await query(`select status from zoi.ops_records where id='${d.task_id}';`),'open');
 const revision=(await call('creator_submission_send',`'${id}','${did}','https://example.com/revised','Revised caption','${req(10)}'`)).submission;
 await call('creator_submission_decide',`'${revision.id}','accepted','Approved','${req(11)}'`,other);
 assert.equal(await query(`select status from zoi.ops_records where id='${d.task_id}';`),'completed');assert.equal(await query(`select count(*) from zoi.ops_audit where record_id='${d.task_id}' and actor_profile_id='${other}';`),'1');pass('customer revision and approval complete only linked task with actor audit');
 await call('creator_submission_decide',`'${revision.id}','accepted','Approved','${req(11)}'`,other);assert.equal(await query(`select count(*) from zoi.ops_audit where record_id='${d.task_id}' and actor_profile_id='${other}';`),'1');pass('repeated approval cannot duplicate task completion audit');
 campaign=(await call('creator_get',`'${id}'`)).campaign;await call('creator_draft_save',`'${id}',${campaign.version},${j({...draft,title:'Private unshared revision'})}`);
 got=await call('creator_get',`'${id}'`,other);assert.equal(got.campaign.title,draft.title);assert.equal(got.briefs[0].payload.brief.title,draft.title);pass('later draft edits cannot alter customer accepted snapshot');
 const performanceInquiry=(await call('inquiry_start',`'${event}','Live performance','Private concert booking','${req(20)}'`,other)).thread;
 let perf=(await call('creator_convert',`'${ws}','${performanceInquiry.id}','${company.id}','performance','${req(21)}'`)).campaign;
 const perfData={title:'Live concert',summary:'Greek music performance',planned_fee_cents:50000,currency:'EUR',venue:'Athens hall',event_at:'2026-10-10T20:00:00+03:00',duration_minutes:90,technical_requirements:'Two microphones'};
 await rejects(`select public.creator_draft_save('${perf.id}',1,${j({...perfData,event_at:'2026-10-10T20:00'})});`,actor,/creator_timezone_required/);await rejects(`select public.creator_draft_save('${perf.id}',1,${j({...perfData,event_at:'infinity'})});`,actor,/creator_timezone_required|invalid_creator_brief/);
 perf=(await call('creator_draft_save',`'${perf.id}',1,${j(perfData)}`)).campaign;
 await rejects(`select public.creator_brief_share('${perf.id}',${perf.version},'${req(22)}');`,actor,/creator_deliverables_required/);
 const pd=(await call('creator_deliverable_save',`'${perf.id}','${req(23)}',0,${j({title:'90-minute live set',description:'Agreed repertoire',channel:'live',due_at:null})}`));perf=pd.campaign;
 const pb=(await call('creator_brief_share',`'${perf.id}',${perf.version},'${req(24)}'`)).brief;assert.equal(pb.payload.brief.duration_minutes,90);assert.equal(new Date(pb.payload.brief.event_at).toISOString(),'2026-10-10T17:00:00.000Z');pass('performance-specific venue, timezone, duration and rider snapshot persists');
 const decisions=await Promise.allSettled([call('creator_brief_decide',`'${pb.id}','accepted','Approved','${req(25)}'`,other),call('creator_brief_decide',`'${pb.id}','changes_requested','Changes','${req(26)}'`,other)]);assert.equal(decisions.filter(x=>x.status==='fulfilled').length,1);pass('concurrent customer decisions commit only one immutable acknowledgment');
 await rejects(`select public.creator_brief_share('${perf.id}',${perf.version+1},'${req(27)}');`,actor,/creator_no_changes_to_share/);pass('unchanged plan cannot manufacture duplicate shared versions');
 const roleError=`select public.creator_draft_save('${id}',${campaign.version+1},${j(draft)});`;await rejects(roleError,other,/creator_permission_denied/);pass('customer cannot modify creator internal draft');
 await query(`update zoi.listings set marketplace_status='hidden' where id='${event}';`);assert.equal((await call('creator_get',`'${id}'`,other)).can_write,false);await rejects(`select public.creator_brief_share('${id}',5,'${req(12)}');`,actor,/creator_business_changed/);pass('hidden business freezes new shared work while retaining history');
 await query(`update zoi.listings set marketplace_status='',owner_workspace_id='10000000-0000-4000-8000-000000000002' where id='${event}';insert into zoi.workspace_members values('10000000-0000-4000-8000-000000000002','${member}','owner');`);await rejects(`select public.creator_get('${id}');`,member,/creator_permission_denied/);assert.equal((await call('creator_get',`'${id}'`,other)).can_write,false);pass('new owner never inherits previous customers’ shared briefs');
 await rejects('select * from zoi.creator_briefs;',other,/permission denied/);pass('underlying brief tables are private');
 console.log(`${checks} creator database checks passed`);
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

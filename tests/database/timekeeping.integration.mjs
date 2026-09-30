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
const port=15488;const env={...process.env,PGHOST:dir,PGPORT:String(port),PGDATABASE:'postgres'};
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
 await query(`alter table zoi.user_profiles add column display_name text;update zoi.workspace_members set role='viewer' where profile_id='${member}';insert into zoi.workspace_members values('${ws}','${other}','editor');`);
 for(const file of ['20260930001738_business_operations_foundation.sql','20260930015525_matter_timekeeping.sql'])await query(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 const call=(fn,args,user=actor)=>query(`select public.${fn}(${args});`,user).then(JSON.parse);
 const req=n=>`80000000-0000-4000-8000-${String(n).padStart(12,'0')}`;const j=x=>literal(JSON.stringify(x))+'::jsonb';
 const company=(await call('ops_record_save',`'${ws}','company','{"title":"Law practice","sector":"lawyer"}',null,0`)).record;
 const project=(await call('ops_record_save',`'${ws}','project',${j({title:'Matter001',company_id:company.id,sector:'lawyer'})},null,0`)).record;
 const data={project_id:project.id,task_id:null,started_at:new Date(Date.now()-86400000*2).toISOString(),seconds:3600,description:'Private matter research',rate_cents:20000,currency:'EUR',billable:true};
 const range=`'${ws}',now()-interval '30days',now()+interval '1day'`;
 await rejects(`select public.timekeeping_dashboard(${range});`,member,/time_permission_denied/);pass('viewer cannot access private narratives or rates');
 const entry=(await call('time_entry_save',`'${ws}','${req(1)}',0,${j(data)}`)).entry;assert.equal(entry.estimated_cents,20000);assert.equal((await call('time_entry_save',`'${ws}','${req(1)}',0,${j(data)}`)).entry.id,entry.id);pass('manual entry saves exact rate snapshot and idempotent receipt');
 await rejects(`select public.time_entry_save('${ws}','${req(2)}',0,${j(data)});`,actor,/time_overlap/);await rejects(`select public.time_entry_save('${ws}','${req(3)}',0,${j({...data,started_at:'2026-09-20T10:00'})});`,actor,/time_timezone_required/);pass('overlapping and ambiguous local timestamps rejected');
 assert.equal((await call('timekeeping_export',range)).entries.length,0);await call('time_entry_transition',`'${ws}','${entry.id}',1,'submit',''`);
 await rejects(`select public.time_entry_save('${ws}','${entry.id}',2,${j(data)});`,actor,/time_entry_locked/);pass('submitted data locked; unapproved work excluded from export');
 const approvals=await Promise.allSettled([call('time_entry_transition',`'${ws}','${entry.id}',2,'approve',''`),call('time_entry_transition',`'${ws}','${entry.id}',2,'approve',''`)]);assert.equal(approvals.filter(x=>x.status==='fulfilled').length,1);assert.equal((await call('timekeeping_export',range)).entries.length,1);pass('concurrent approval writes once and unlocks approved timesheet export');
 const editorEntry=(await call('time_entry_save',`'${ws}','${req(4)}',0,${j({...data,currency:'USD'})}`,other)).entry;
 assert.equal((await call('timekeeping_dashboard',range,other)).entries.length,1);await rejects(`select public.time_entry_history('${ws}','${entry.id}');`,other,/time_permission_denied/);pass('editor sees only own time, never colleague narratives');
 await call('time_entry_transition',`'${ws}','${editorEntry.id}',1,'submit',''`,other);await rejects(`select public.time_entry_transition('${ws}','${editorEntry.id}',2,'approve','');`,other,/time_transition_not_allowed/);
 await call('time_entry_transition',`'${ws}','${editorEntry.id}',2,'return','Add research detail'`);assert.equal((await call('timekeeping_dashboard',range,other)).entries[0].review_reason,'Add research detail');pass('admin returns time with visible reason; editor cannot selfapprove');
 const corrected=(await call('time_entry_save',`'${ws}','${editorEntry.id}',3,${j({...data,currency:'USD',description:'Research with references'})}`,other)).entry;await call('time_entry_transition',`'${ws}','${corrected.id}',4,'submit',''`,other);await call('time_entry_transition',`'${ws}','${corrected.id}',5,'approve',''`);assert.equal((await call('timekeeping_export',range)).totals.length,2);pass('approved currency totals remain separate');
 const timerData={project_id:project.id,task_id:null,description:'Review meeting',rate_cents:18000,currency:'EUR',billable:true};
 const starts=await Promise.allSettled([call('time_timer_start',`'${ws}','${req(5)}',${j(timerData)}`),call('time_timer_start',`'${ws}','${req(6)}',${j(timerData)}`)]);assert.equal(starts.filter(x=>x.status==='fulfilled').length,1);const timer=starts.find(x=>x.status==='fulfilled').value.timer;assert.equal((await call('time_timer_start',`'${ws}','${timer.request_id}',${j(timerData)}`)).timer.id,timer.id);pass('concurrent timer starts produce one active timer');
 await query(`insert into zoi.workspace_members values('10000000-0000-4000-8000-000000000002','${actor}','owner');`);await rejects(`select public.time_timer_start('10000000-0000-4000-8000-000000000002','${req(30)}',${j(timerData)});`,actor,/time_timer_already_running/);const elsewhere=await call('timekeeping_dashboard',`'10000000-0000-4000-8000-000000000002',now()-interval '30days',now()+interval '1day'`);assert.equal(elsewhere.active_other_workspace,true);assert.equal(elsewhere.active_timer,null);pass('one active timer across workspaces, cross-workspace indicator hides details');
 await query(`update zoi.time_timers set started_at=clock_timestamp()-interval '120seconds' where id='${timer.id}';`);
 const stopped=await call('time_timer_stop',`'${ws}','${timer.id}','${req(7)}'`);assert.ok(stopped.entry.seconds>=120&&stopped.entry.seconds<125);assert.equal(stopped.entry.source,'timer');assert.equal((await call('time_timer_stop',`'${ws}','${timer.id}','${req(7)}'`)).entry.id,stopped.entry.id);pass('server clock creates exactly one draft when timer stops');
 const stale=(await call('time_timer_start',`'${ws}','${req(8)}',${j(timerData)}`)).timer;await query(`update zoi.time_timers set started_at=clock_timestamp()-interval '25hours' where id='${stale.id}';`);await rejects(`select public.time_timer_stop('${ws}','${stale.id}','${req(9)}');`,actor,/time_timer_requires_correction/);await call('time_timer_discard',`'${ws}','${stale.id}',1,'Forgot to stop overnight'`);pass('stale timer cannot silently bill25hours; reasoned discard recorded');
 await call('time_entry_transition',`'${ws}','${entry.id}',3,'void','Superseded by corrected record'`);assert.equal((await call('timekeeping_export',range)).entries.length,1);assert.ok((await call('time_entry_history',`'${ws}','${entry.id}'`)).audit.length>=4);pass('void retains audit and removes approved amount from export');
 const archivedTimer=(await call('time_timer_start',`'${ws}','${req(31)}',${j(timerData)}`,other)).timer;await query(`update zoi.time_timers set started_at=clock_timestamp()-interval '10seconds' where id='${archivedTimer.id}';`);await call('ops_record_archive',`'${ws}','${project.id}',1`);const historical=(await call('time_timer_stop',`'${ws}','${archivedTimer.id}','${req(32)}'`,other)).entry;assert.equal(historical.project_id,project.id);assert.equal(historical.source,'timer');pass('timer preserves worked time even if matter is archived during work');
 await rejects('select * from zoi.time_entries;',other,/permission denied/);pass('raw timekeeping tables private');
 console.log(`${checks} timekeeping database checks passed`);
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

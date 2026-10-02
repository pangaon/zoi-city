import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';

// Run against a retained, isolated recovery fixture, never production.
const db=JSON.parse(readFileSync('.recovery/youth-recovery-pg.json','utf8'));
assert(db.dir.startsWith('/tmp/zoi-youth-pg-'));
const run=promisify(execFile),env={...process.env,PGHOST:db.dir,PGPORT:String(db.port),PGDATABASE:'postgres'};
const lit=value=>value===null?'null':typeof value==='boolean'||typeof value==='number'?String(value):"'"+String(typeof value==='object'?JSON.stringify(value):value).replaceAll("'","''")+"'"+(typeof value==='object'?'::jsonb':'');
const sql=async(text,actor)=>{const result=await run(join(db.bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',(actor?`set role authenticated;select set_config('request.jwt.claim.sub',${lit(actor)},false);`:'')+text],{env});return result.stdout.trim().split('\n').at(-1);};
const call=(name,args,actor)=>sql(`select public.${name}(${Object.entries(args).map(([key,value])=>`${key}=>${lit(value)}`).join(',')});`,actor).then(JSON.parse);
const deny=async(fn,pattern)=>{let error;try{await fn();}catch(e){error=e;}assert(error,'Expected current authority refusal');assert.match(error.stderr||error.message,pattern);};
let count=0;const pass=label=>{count++;console.log('PASS independent '+label);};

const program=(await call('youth_program_save',{p_workspace:db.ws,p_id:null,p_expected_version:0,p_request:randomUUID(),p_data:{listing_id:db.listing,title:'Independent authority lifecycle',description:'Isolated reviewer fixture',min_age:8,max_age:12,capacity:2,terms:'Guardian consent for private attendance in this independent test programme.',status:'published'}},db.owner)).program;
const child=(await call('youth_child_save',{p_id:null,p_expected_version:0,p_request:randomUUID(),p_name:'Independent child',p_archived:false},db.guardian)).child;
let registration=(await call('youth_enrol',{p_program:program.id,p_child:child.id,p_expected_version:0,p_program_version:program.version,p_request:randomUUID(),p_data:{declared_age:10,guardian_name:'Independent guardian',contact_email:'review@example.invalid',contact_phone:'',authority_confirmed:true,consent_confirmed:true}},db.guardian)).registration;
registration=(await call('youth_registration_decide',{p_workspace:db.ws,p_registration:registration.id,p_expected_version:registration.version,p_request:randomUUID(),p_status:'approved'},db.owner)).registration;
await call('youth_staff_set',{p_workspace:db.ws,p_program:program.id,p_profile:db.editor,p_enabled:true,p_request:randomUUID()},db.owner);
await call('youth_class_link',{p_workspace:db.ws,p_program:program.id,p_event:db.event,p_enabled:true,p_request:randomUUID()},db.owner);
const savedRequest=randomUUID(),attendanceArgs={p_workspace:db.ws,p_registration:registration.id,p_event:db.event,p_expected_version:0,p_request:savedRequest,p_status:'present'};
await call('youth_attendance_set',attendanceArgs,db.editor);
pass('fresh assigned instructor can mark an approved current-consent registration');

await sql(`delete from zoi.workspace_members where workspace_id=${lit(db.ws)} and profile_id=${lit(db.editor)};`);
for(const args of [attendanceArgs,{...attendanceArgs,p_request:randomUUID(),p_expected_version:1,p_status:'absent'}])await deny(()=>call('youth_attendance_set',args,db.editor),/not_authorized|no_access_to_workspace/);
const scope={workspace:db.ws,registration:registration.id,event:db.event};
await deny(()=>call('youth_operation_request',{p_request:savedRequest,p_operation:'youth_attendance_set',p_scope:scope,p_cancel_if_missing:false,p_legacy_workspace:null},db.editor),/not_authorized|no_access_to_workspace/);
await deny(()=>call('youth_operation_request',{p_request:randomUUID(),p_operation:'youth_attendance_set',p_scope:null,p_cancel_if_missing:true,p_legacy_workspace:db.ws},db.editor),/not_authorized|no_access_to_workspace/);
assert.equal(await sql(`select status from zoi.youth_attendance where registration_id=${lit(registration.id)};`),'present');
pass('removed workspace member cannot replay or write attendance, recover its receipt or create a legacy cancellation');

await sql(`insert into zoi.workspace_members values(${lit(db.ws)},${lit(db.editor)},'editor');`);
const blocker=run(join(db.bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',`begin;select id from zoi.workspaces where id=${lit(db.ws)} for update;select pg_sleep(1);commit;`],{env});
for(let n=0;n<60;n++){if(await sql(`select count(*) from pg_stat_activity where query like '%select pg_sleep(1)%' and wait_event='PgSleep';`)!=='0')break;await new Promise(resolve=>setTimeout(resolve,10));}
const delayedRequest=randomUUID(),delayed=call('youth_attendance_set',{...attendanceArgs,p_request:delayedRequest,p_expected_version:1,p_status:'excused'},db.editor).then(value=>({value}),error=>({error}));
// Observer verifies a live blocked operation before revoking membership.
let blocked=false;for(let n=0;n<60;n++){if(await sql(`select count(*) from pg_stat_activity where query like '%${delayedRequest}%' and wait_event_type='Lock';`)!=='0'){blocked=true;break;}await new Promise(resolve=>setTimeout(resolve,10));}
assert(blocked,'Attendance writer must actually wait on the held workspace lock');
await sql(`delete from zoi.workspace_members where workspace_id=${lit(db.ws)} and profile_id=${lit(db.editor)};`);
await deny(async()=>{const result=await delayed;if(result.error)throw result.error;return result.value;},/not_authorized|no_access_to_workspace/);await blocker;
assert.equal(await sql(`select count(*) from zoi.youth_requests where request_id=${lit(delayedRequest)};`),'0');
assert.equal(await sql(`select status from zoi.youth_attendance where registration_id=${lit(registration.id)};`),'present');
pass('membership removed during an observed workspace lock wait prevents both attendance and receipt');
await sql(`insert into zoi.workspace_members values(${lit(db.ws)},${lit(db.editor)},'editor');`);

for(const role of ['anon','authenticated']){
 assert.equal(await sql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='zoi' and p.proname like 'youth_%' and has_function_privilege(${lit(role)},p.oid,'EXECUTE');`),'0');
 assert.equal(await sql(`select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='zoi' and c.relname like 'youth_%' and c.relkind='r' and (has_table_privilege(${lit(role)},c.oid,'SELECT') or has_table_privilege(${lit(role)},c.oid,'INSERT') or has_table_privilege(${lit(role)},c.oid,'UPDATE') or has_table_privilege(${lit(role)},c.oid,'DELETE'));`),'0');
}
assert.equal(await sql(`select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='zoi' and c.relname like 'youth_%' and c.relkind='r' and not c.relrowsecurity;`),'0');
assert.equal(await sql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'youth_%' and p.proname<>'youth_catalog' and has_function_privilege('anon',p.oid,'EXECUTE');`),'0');
pass('actual catalogue ACLs and RLS deny direct private helpers, records and anonymous private endpoints');

registration=(await call('youth_withdraw',{p_registration:registration.id,p_expected_version:registration.version,p_request:randomUUID()},db.guardian)).registration;
assert.equal(registration.status,'withdrawn');
assert.equal((await call('youth_family',{},db.guardian)).registrations.find(row=>row.id===registration.id).status,'withdrawn');
pass('guardian retains working withdrawal after authorization refusals');
console.log(`${count} independent Youth authority checks passed`);

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
const port=15529;const env={...process.env,PGHOST:dir,PGPORT:String(port),PGDATABASE:'postgres'};
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
 for(const file of ['20260930001738_business_operations_foundation.sql','20261001010515_operations_mutation_receipts.sql'])await query(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 const call=(fn,args,user=actor)=>query(`select public.${fn}(${args});`,user).then(JSON.parse);
 const req=n=>`80000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const j=x=>literal(JSON.stringify(x))+'::jsonb';
 const execute=(n,action,args,user=actor)=>call('ops_mutation_execute',`'${ws}','${req(n)}',${literal(action)},${j(args)}`,user);
 const status=(n,cancel=false,user=actor)=>call('ops_request_status',`'${ws}','${req(n)}',${cancel}`,user);
 await query(`insert into zoi.workspace_members(workspace_id,profile_id,role) values('${ws}','${other}','admin') on conflict do nothing;`);
 const data={p_kind:'company',p_data:{title:'Receipt test',sector:'business'},p_id:null,p_expected_version:0};
 const a=await execute(1,'save',data);assert.equal(a.state,'saved');assert.equal(a.version,1);assert.deepEqual(await execute(1,'save',data),a);assert.deepEqual(await status(1),a);assert.equal(await query("select count(*) from zoi.ops_records;"),'1');assert.equal(await query("select count(*) from zoi.ops_audit;"),'1');pass('lost response replay creates one company and audit');
 const updated=await execute(2,'save',{...data,p_id:a.record_id,p_expected_version:1,p_data:{title:'Updated'}});assert.equal(updated.version,2);assert.equal((await execute(3,'archive',{p_id:a.record_id,p_expected_version:2})).version,3);assert.equal((await status(3)).action,'archive');pass('save and archive return minimal stable receipts');
 await rejects(`select public.ops_mutation_execute('${ws}','${req(1)}','save',${j({...data,p_data:{title:'Different'}})});`,actor,/ops_request_conflict/);pass('changed payload cannot reuse nonce');
 assert.equal((await status(1,false,other)).state,'missing');await rejects(`select * from zoi.ops_mutation_receipts;`,actor,/permission denied/);await rejects(`set role anon;select public.ops_request_status('${ws}','${req(1)}',false);`,null,/permission denied/);pass('actor isolation, ledger ACL and anonymous refusal');
 await query(`update zoi.workspace_members set role='viewer' where profile_id='${actor}' and workspace_id='${ws}';`);await rejects(`select public.ops_request_status('${ws}','${req(1)}',false);`,actor,/ops_permission_denied/);await query(`update zoi.workspace_members set role='owner' where profile_id='${actor}' and workspace_id='${ws}';`);pass('removed writer cannot read old receipt');
 assert.equal((await status(20)).state,'missing');assert.equal((await status(20,true)).state,'cancelled');await rejects(`select public.ops_mutation_execute('${ws}','${req(20)}','save',${j(data)});`,actor,/ops_request_cancelled/);pass('cancel tombstone prevents delayed insertion');
 const results=await Promise.all([execute(30,'save',data),execute(30,'save',data)]);assert.deepEqual(results[0],results[1]);assert.equal(await query("select count(*) from zoi.ops_records;"),'2');pass('concurrent identical writes insert once');
 const race=await Promise.allSettled([execute(31,'save',data),status(31,true)]);const final=await status(31);assert.ok(['saved','cancelled'].includes(final.state));if(final.state==='cancelled')assert.equal(race[0].status,'rejected');else assert.equal(race[0].status,'fulfilled');pass('cancel and execute race serialize into one outcome');
 await query(`update zoi.workspace_members set role='editor' where profile_id='${actor}' and workspace_id='${ws}';`);await rejects(`select public.ops_request_status('${ws}','${req(1)}',false);`,actor,/ops_permission_denied/);await rejects(`select public.ops_mutation_execute('${ws}','${req(40)}','save',${j(data)});`,actor,/insufficient_permission/);const contact=await execute(41,'save',{...data,p_kind:'contact',p_data:{title:'Contact'}});assert.equal(contact.kind,'contact');pass('editor can save contacts but not companies or company receipts');
 await rejects(`select public.ops_mutation_execute('${ws}','${req(42)}','archive',${j({p_id:contact.record_id,p_expected_version:1})});`,actor,/insufficient_permission/);pass('editor cannot archive');
 await rejects(`select public.ops_mutation_execute('${ws}','${req(43)}','save',${j({...data,unexpected:true})});`,actor,/invalid_ops_request/);assert.equal((await status(43)).state,'missing');pass('invalid payload leaves no phantom receipt');
 console.log(`${checks} Operations receipt checks passed`);
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync,chmodSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {synchronizeQueue} from '../../scripts/delivery/queue.mjs';
import {collectRequirements} from '../../scripts/delivery/ledger.mjs';

const script=fileURLToPath(new URL('../../scripts/delivery/queue.mjs',import.meta.url));
const now='2026-10-16T01:00:00.000Z';
const item=(id,text)=>({id,source:'docs/recovery-scope.json',area:'Maps',text,status:'planned',evidence:[]});
function maintained(rows){return {
 execution_queue:rows,latest_user_instruction:'Keep all existing work and current instruction.',
 lanes:{maps:{owner:'/root/current-specialist',current:'Current owned work',next:['Current next step'],status:'active'}},
 current_release_queue:{base_commit:'current',components:['Current accepted packet'],stage:'in review',deferred:['Actual external gate']},
 bounded_reconciliation:{at:'current checkpoint',active_worktree:'/workspaces/current',active_main:'current',scope_requirements:rows.length},
 work_packets:[{id:'current',owner:'current',evidence:['actual receipt']}],
 native_android_acceptance:{state:'actual installed failure retained'},
 groups:[{id:'custom',label:'Manually assigned group',owner:'current owner',status:'blocked',acceptance:{state:'open'},total_requirements:99}],
 scope_change:{reason:'Last explicit review',extra:'retain'},rule:'Current rule',authoritative:true
};}

test('existing IDs retain all maintained state and acceptance despite a stale report; sync does not mutate its inputs',()=>{
 const row={...item('one','Find the correct address'),group:'custom',status:'verified',evidence:['docs/current-proof.json'],current_evidence:[],scope_status:'independently checked; release open',implementation_status:'complete source; production open',responsible_workstream:'explicit-current-owner',acceptance_test:['Specific exercised acceptance'],release_destination:'Current selected release',revision:'a'.repeat(40),checked_at:now,custom:{keep:true}};
 const board=maintained([row]),scope={latest_execution_instruction:{instruction:'Stale scope wording'}};
 const snapshot=JSON.stringify(board),report={items:[{...item('one',row.text),status:'blocked',evidence:['docs/stale-proof.json'],note:'Stale report note absent from the maintained board',report_only_field:'must not be merged'}]};
 const result=synchronizeQueue(board,scope,report,{now});
 assert.equal(JSON.stringify(board),snapshot);
 assert.deepEqual(result.execution_queue[0],row);
 for(const key of ['lanes','current_release_queue','bounded_reconciliation','work_packets','native_android_acceptance','latest_user_instruction','scope_change','rule','authoritative'])assert.deepEqual(result[key],board[key],key);
 assert.deepEqual(result.groups[0],{...board.groups[0],total_requirements:1});
});

test('existing priority/order, explicit clears and custom groups survive; new requirements append with open defaults',()=>{
 const first={...item('first','First address'),group:'custom',acceptance_test:[],current_evidence:null,dependencies:[],responsible_workstream:null,scope_status:'',remaining_work:[]};
 const second={...item('second','Second address'),group:'custom'};
 const board=maintained([first,second]);
 const result=synchronizeQueue(board,{}, {items:[item('second','Second address'),item('new','New address'),item('first','First address')]},{now});
 assert.deepEqual(result.execution_queue.map(x=>x.id),['first','second','new']);
 for(const key of ['acceptance_test','current_evidence','dependencies','responsible_workstream','scope_status','remaining_work'])assert.deepEqual(result.execution_queue[0][key],first[key],key);
 assert.equal(result.execution_queue[2].scope_status,'not started');
 assert.equal(result.execution_queue[2].implementation_status,'not yet individually assessed');
 assert.ok(result.execution_queue[2].acceptance_test.length);
 assert.deepEqual(result.lanes,board.lanes);assert.deepEqual(result.current_release_queue,board.current_release_queue);assert.deepEqual(result.bounded_reconciliation,board.bounded_reconciliation);
 assert.equal(result.groups.find(x=>x.id==='custom').total_requirements,2);
 assert.equal(result.groups.find(x=>x.id==='maps').status,'not assessed');
 assert.deepEqual([result.scope_change.previous_count,result.scope_change.current_count],[2,3]);
});

test('removed, duplicated, malformed or reused identities refuse rather than erase or repurpose recorded work',()=>{
 const board=maintained([item('one','Original address')]),before=JSON.stringify(board);
 assert.throws(()=>synchronizeQueue(board,{}, {items:[]},{now}),/remove recorded IDs/);
 assert.throws(()=>synchronizeQueue(board,{}, {items:[item('one','Original address'),item('one','Duplicate')]},{now}),/duplicate ID/);
 assert.throws(()=>synchronizeQueue({...board,execution_queue:[...board.execution_queue,...board.execution_queue]}, {},{items:board.execution_queue},{now}),/duplicate ID/);
 assert.throws(()=>synchronizeQueue(board,{}, {items:[item('one','Different address')]},{now}),/identity changed/);
 assert.throws(()=>synchronizeQueue(board,{}, {items:[{...item('one','Original address'),source:'another source'}]},{now}),/identity changed/);
 assert.throws(()=>synchronizeQueue(board,{}, {items:[{id:'one'}]},{now}),/Invalid requirement report/);
 assert.equal(JSON.stringify(board),before);
});

test('new board metadata may initialize from scope, but explicit current empty/null instructions and owner fields never reset',()=>{
 const scope={latest_execution_instruction:{instruction:'Current original scope instruction'}};
 const initial=synchronizeQueue({execution_queue:[]},scope,{items:[item('new','Find an address')]},{now});
 assert.equal(initial.latest_user_instruction,scope.latest_execution_instruction.instruction);
 assert.equal('lanes' in initial,false);assert.equal('current_release_queue' in initial,false);assert.equal('bounded_reconciliation' in initial,false);
 for(const value of ['',null]){
  const board={execution_queue:[],latest_user_instruction:value,lanes:null,current_release_queue:null,bounded_reconciliation:null,authoritative:false};
  const result=synchronizeQueue(board,scope,{items:[]},{now});
  for(const key of ['latest_user_instruction','lanes','current_release_queue','bounded_reconciliation','authoritative'])assert.deepEqual(result[key],board[key],key);
 }
});

function fixture(run){
 const root=mkdtempSync(join(tmpdir(),'zoi-delivery-queue-'));mkdirSync(join(root,'docs'));
 try{return run(root);}finally{rmSync(root,{recursive:true,force:true});}
}
const write=(root,file,value)=>writeFileSync(join(root,file),JSON.stringify(value,null,2)+'\n');
const invoke=root=>spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8'});

test('actual CLI adds new requirement while preserving current owners/release/reconciliation/acceptance; second sync is stable',()=>fixture(root=>{
 const oldScope={scope:[{area:'Maps',requirements:['Find the real address']}],latest_execution_instruction:{instruction:'Scope wording'}};
 const [record]=collectRequirements(oldScope,'docs/recovery-scope.json');
 const oldRow={...record,status:'verified',evidence:['docs/current-proof.json'],current_evidence:['docs/current-proof.json'],group:'custom',customer_outcome:'Manually maintained customer outcome',acceptance_test:['Current independent journey'],responsible_workstream:'current-specialist',scope_status:'source accepted; production open'};
 const board=maintained([oldRow]);write(root,'docs/recovery-delivery-board.json',board);
 const scope={...oldScope,scope:[{area:'Maps',requirements:['Find the real address','Retain a new requirement']}]};write(root,'docs/recovery-scope.json',scope);
 write(root,'docs/delivery-evidence.json',[{id:record.id,status:'planned',evidence:[]}]);
 chmodSync(join(root,'docs/recovery-delivery-board.json'),0o664);
 let result=invoke(root);assert.equal(result.status,0,result.stderr);
 const updated=JSON.parse(readFileSync(join(root,'docs/recovery-delivery-board.json')));
 assert.deepEqual(updated.execution_queue[0],oldRow);assert.equal(updated.execution_queue.length,2);
 for(const key of ['lanes','current_release_queue','bounded_reconciliation','latest_user_instruction','native_android_acceptance'])assert.deepEqual(updated[key],board[key],key);
 assert.equal(statSync(join(root,'docs/recovery-delivery-board.json')).mode&0o777,0o664);
 assert.ok(readdirSync(join(root,'docs')).every(x=>!x.endsWith('.tmp')));
 result=invoke(root);assert.equal(result.status,0,result.stderr);
 const again=JSON.parse(readFileSync(join(root,'docs/recovery-delivery-board.json')));
 delete updated.updated_at;delete again.updated_at;assert.deepEqual(again,updated);
}));

test('actual CLI removal refusal leaves complete board bytes unchanged with no temporary leftovers',()=>fixture(root=>{
 const scope={scope:[{area:'Maps',requirements:['Original recorded requirement']}]};
 const [record]=collectRequirements(scope,'docs/recovery-scope.json');
 write(root,'docs/recovery-delivery-board.json',maintained([record]));write(root,'docs/recovery-scope.json',{scope:[]});
 const before=readFileSync(join(root,'docs/recovery-delivery-board.json'));
 const result=invoke(root);assert.equal(result.status,1);assert.match(result.stderr,/remove recorded IDs; explicit reconciliation is required/);
 assert.deepEqual(readFileSync(join(root,'docs/recovery-delivery-board.json')),before);
 assert.ok(readdirSync(join(root,'docs')).every(x=>!x.endsWith('.tmp')));
}));

test('importing queue tooling performs no board reads or writes',()=>fixture(root=>{
 const before=readdirSync(root);
 const result=spawnSync(process.execPath,['--input-type=module','-e','await import('+JSON.stringify(new URL('../../scripts/delivery/queue.mjs',import.meta.url).href)+')'],{cwd:root,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);assert.deepEqual(readdirSync(root),before);
 assert.deepEqual(readdirSync(join(root,'docs')),[]);
}));

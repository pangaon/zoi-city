import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../assets/suite/operations.js',import.meta.url),'utf8').replace('  global.ZoiSuite=','  global.__ops={receipt,payload,esc,errorText};\n  global.ZoiSuite=');
const context={};vm.runInNewContext(source,context);const {receipt,payload,esc,errorText}=context.__ops;
const record={id:'00000000-0000-0000-0000-000000000001',workspace_id:'ws',kind:'task',version:2};
test('operations success requires the matching workspace, record, kind and next version',()=>{
 assert.equal(receipt({ok:true,record},'ws',record.id,1,'task'),record);
 for(const changed of [{workspace_id:'foreign'},{kind:'company'},{version:1},{id:'invalid'}])assert.throws(()=>receipt({ok:true,record:{...record,...changed}},'ws',record.id,1,'task'),/did not confirm/);
 assert.throws(()=>receipt({ok:false,record},'ws',record.id,1,'task'),/did not confirm/);
});
test('operations editing preserves persisted fields and identifies version conflicts',()=>{
 const saved={...record,title:'Task',status:'completed',due_at:'2026-10-01T10:00:00Z',data:{notes:'Keep notes',sector:'lawyer'}};
 const result=payload(saved);assert.equal(result.notes,'Keep notes');assert.equal(result.due_at,saved.due_at);assert.equal(result.status,'completed');
 assert.match(errorText(new Error('version_conflict')),/form is preserved/);assert.equal(esc('<script>'), '&lt;script&gt;');
});

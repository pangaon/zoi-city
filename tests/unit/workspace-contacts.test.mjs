import test from 'node:test';import assert from 'node:assert/strict';import{workspaceContacts}from'../../assets/contacts/workspace-picker.mjs';
const ws='30000000-0000-4000-8000-000000000001',id='40000000-0000-4000-8000-000000000001';
const row={id,workspace_id:ws,kind:'contact',title:' Alex ',data:{email:'private@example.test',phone:'123456789'}};
test('contact projection only returns name and CRM id; no private channel/identity mapping',()=>{assert.deepEqual(workspaceContacts({ok:true,role:'viewer',records:[row]},ws),[{id,name:'Alex'}]);});
test('whole response fails closed for wrong workspace/type/archive/role/malformed identity',()=>{for(const change of[{workspace_id:id},{kind:'company'},{archived_at:'2026-01-01'},{id:'bad'},{title:''}])assert.throws(()=>workspaceContacts({ok:true,role:'owner',records:[{...row,...change}]},ws));for(const role of[null,'guest',''])assert.throws(()=>workspaceContacts({ok:true,role,records:[row]},ws));});

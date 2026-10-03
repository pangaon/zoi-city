import test from 'node:test';import assert from 'node:assert/strict';
import {nativeCompanyConsole,assignedName,companyDeadline} from '../src/companyConsole.ts';
import {createRequire} from 'node:module';import path from 'node:path';import {fileURLToPath} from 'node:url';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,ws=id(1),now=Date.parse('2026-10-03T12:00:00Z');
const row=(n,kind,x={})=>({id:id(n),workspace_id:ws,kind,title:kind+n,version:1,status:'open',data:{},...x});
const rows=[row(2,'company'),row(3,'company'),row(4,'project',{company_id:id(2),title:'Festival'}),row(5,'project',{company_id:id(3)}),row(6,'task',{project_id:id(4),due_at:'2026-10-02T23:59:59Z',assignee_profile_id:id(20)}),row(7,'task',{project_id:id(5),status:'blocked'}),row(8,'task',{project_id:id(4),due_at:'2026-10-04T23:59:59Z',assignee_profile_id:id(21)}),row(9,'task',{project_id:id(4),status:'completed',due_at:'2026-10-01T00:00:00Z'})];
test('actual shared queue distinguishes cross-company urgency and selected company filters',()=>{
 assert.deepEqual(nativeCompanyConsole(rows,ws,{now}).visible.map(t=>t.id),[id(7),id(6)]);
 assert.deepEqual(nativeCompanyConsole(rows,ws,{now,companyId:id(2),filter:'upcoming',assignee:id(21),query:'festival'}).visible.map(t=>t.id),[id(8)]);
 assert.deepEqual(nativeCompanyConsole(rows,ws,{now,filter:'completed'}).visible.map(t=>t.id),[id(9)]);
 assert.deepEqual(nativeCompanyConsole(rows,ws,{now,filter:'unassigned'}).visible.map(t=>t.id),[id(7)]);
});
test('sparse and retired work does not create deadlines or company completion',()=>{
 const sparse=nativeCompanyConsole([rows[0]],ws,{now});assert.equal(sparse.total,0);assert.equal(sparse.companies[0].journey.percent,null);
 const retired=rows.map(r=>r.id===id(4)?{...r,archived_at:'2026-10-03'}:r);assert.deepEqual(nativeCompanyConsole(retired,ws,{now,filter:'all'}).visible.map(t=>t.id),[id(7)]);
 assert.equal(companyDeadline(null),'No deadline');assert.equal(companyDeadline('invalid'),'Deadline needs review');
 assert.equal(companyDeadline(rows[6].due_at),'Due '+new Date(rows[6].due_at).toLocaleString());
});
test('unknown assignee remains assigned, profile identity is not the signed-in actor',()=>{
 assert.equal(assignedName(rows[4],[{profile_id:id(20),display_name:'Maria'}]),'Maria');
 assert.equal(assignedName(rows[4],[]),'Assigned member unavailable');assert.equal(assignedName(rows[5],[]),'Unassigned');
});
for(const mode of ['foreign','duplicate','invalid-data','missing-company'])test('queue rejects '+mode+' saved scope',()=>{
 const records=mode==='foreign'?rows.map(r=>({...r,workspace_id:id(99)})):mode==='duplicate'?[...rows,rows[0]]:mode==='invalid-data'?rows.map(r=>({...r,data:null})):rows.filter(r=>r.id!==id(2));
 assert.throws(()=>nativeCompanyConsole(records,ws,{companyId:id(2)}));
});
test('Metro resolves only the exact shared Company CDN edge without altering packages or queries',()=>{
 const require=createRequire(import.meta.url),config=require('../metro.config.js'),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),origin=path.join(root,'assets/operations/company-console-model.mjs'),seen=[];
 const context={originModulePath:origin,resolveRequest:(_context,name,platform)=>{seen.push({name,platform});return {type:'sourceFile',filePath:name};}};
 config.resolver.resolveRequest(context,'./company-journey.mjs?v=20261003-company-console','ios');assert.equal(seen.pop().name,'./company-journey.mjs');
 for(const name of ['company-journey.mjs?v=20261003-company-console','../company-journey.mjs?v=20261003-company-console','./company-journey.mjs?secret=value','./company-journey.mjs?v=unreviewed','./company-journey.mjs?v=20261003-company-console&other=1','expo?v=20261003-company-console']){config.resolver.resolveRequest(context,name,'android');assert.equal(seen.pop().name,name);}
 const source='./company-journey.mjs?v=20261003-company-console';for(const other of [path.join(root,'mobile/src/companyConsole.ts'),path.join(root,'node_modules/assets/operations/company-console-model.mjs')]){config.resolver.resolveRequest({...context,originModulePath:other},source,'web');assert.equal(seen.pop().name,source);}
});

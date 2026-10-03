import test from 'node:test';
import assert from 'node:assert/strict';
import {companyWork,companyJourney} from '../../assets/operations/company-journey.mjs';
import {documentProjectContext} from '../../assets/documents/project-context.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ws=id(1),company=id(2),project=id(3);
const row=(kind,n,extra={})=>({id:id(n),workspace_id:ws,title:kind+' '+n,kind,status:'open',version:1,...extra});
const base=[row('company',2),row('project',3,{company_id:company})];
const journey=(tasks=[],extra=[])=>companyJourney(companyWork([...base,...tasks,...extra],ws,company),{now:Date.parse('2026-10-02T12:00:00Z')});
test('sparse company directs authorized caller toward first project without fabricated progress',()=>{
 const j=companyJourney(companyWork([base[0]],ws,company));
 assert.equal(j.percent,null);assert.equal(j.next.action,'create_project');assert.equal(j.counts.total,0);
 assert.equal(journey().next.action,'create_task');assert.equal(journey().projects[0].files,null);
});
test('saved blocked and overdue tasks drive actionable next steps, completed deadlines are excluded',()=>{
 const j=journey([row('task',4,{project_id:project,status:'blocked',due_at:'2026-10-01T12:00:00Z'}),row('task',5,{project_id:project,status:'completed',due_at:'2020-01-01T00:00:00Z'}),row('task',6,{project_id:project,due_at:'2026-10-01T12:00:00Z',assignee_profile_id:id(7)})]);
 assert.deepEqual(j.counts,{total:3,completed:1,blocked:1,overdue:2,unassigned:1});assert.equal(j.percent,33);assert.equal(j.next.record.id,id(4));
 assert.equal(journey([row('task',4,{project_id:project,due_at:'2026-10-01T12:00:00Z',assignee_profile_id:id(7)})]).next.label,'Review overdue task');
});
test('project/task completion disagreement remains visible and never changes saved records',()=>{
 const complete=journey([row('task',4,{project_id:project,status:'completed'})]);assert.equal(complete.next.label,'Review project completion');assert.equal(base[1].status,'open');
 const model=companyWork([{...base[0]},{...base[1],status:'completed'},row('task',4,{project_id:project})],ws,company);
 assert.equal(companyJourney(model).next.label,'Review remaining work');assert.equal(model.projects[0].status,'completed');
});
test('archived and unrelated companies/projects/tasks are not included in completion',()=>{
 const j=journey([row('task',4,{project_id:id(9)}),row('task',5,{project_id:project,archived_at:'2026-10-01'}),row('task',6,{project_id:id(8)})],[row('project',8,{company_id:company,archived_at:'2026-10-01'}),row('project',9,{company_id:id(10)})]);assert.equal(j.counts.total,0);assert.equal(j.projects.length,1);
});
for(const patch of[{workspace_id:id(99)},{version:0},{title:''},{status:'pretend'},{id:'bad'}])test('malformed authority data fails closed '+JSON.stringify(patch),()=>assert.throws(()=>companyWork([...base,row('task',4,{project_id:project,...patch})],ws,company)));
const doc={id:id(11),workspace_id:ws,project_id:project,current_version:2,title:'Budget'},reply={ok:true,role:'editor',projects:[{id:project,title:'Programme'},{id:id(12),title:'Other project'}],documents:[doc]};
test('document project context exposes only exact active project and saved document versions',()=>{
 const scoped=documentProjectContext(reply,ws,project);assert.equal(scoped.project.id,project);assert.equal(scoped.projects.length,1);assert.equal(scoped.documents[0].current_version,2);assert.equal(reply.projects.length,2);
});
for(const [name,mutate] of Object.entries({viewer:r=>({...r,role:'viewer'}),foreign:r=>({...r,documents:[{...doc,workspace_id:id(99)}]}),other_project:r=>({...r,documents:[{...doc,project_id:id(12)}]}),removed_project:r=>({...r,projects:[]}),duplicate_project:r=>({...r,projects:[r.projects[0],r.projects[0]]}),bad_version:r=>({...r,documents:[{...doc,current_version:-1}]})}))test('private project documents reject '+name,()=>assert.throws(()=>documentProjectContext(mutate(reply),ws,project)));

import {companyWork,companyJourney,validateCompanyRecords} from './company-journey.mjs?v=20261003-company-console';

export const WORK_FILTERS = {attention:'Needs attention',all:'All work',overdue:'Overdue',upcoming:'Next 7 days',blocked:'Blocked',unassigned:'Unassigned',completed:'Completed'};
const due = row => row.due_at && Number.isFinite(Date.parse(row.due_at)) ? Date.parse(row.due_at) : null;
const compare = (a,b) => (a.status==='blocked'?0:1)-(b.status==='blocked'?0:1) || (due(a)??Infinity)-(due(b)??Infinity) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);

/** The console describes the saved workspace. It never infers a legal obligation. */
export function companyConsole(records,workspace,{companyId=null,now=Date.now(),query='',filter='attention',assignee=''}={}) {
 validateCompanyRecords(records,workspace);
 const companies=records.filter(r=>r.kind==='company'&&!r.archived_at);
 // companyWork validates the complete response, including records outside this company.
 const all=companies.map(c=>companyWork(records,workspace,c.id));
 if(companyId&&!all.some(m=>m.company.id===companyId))throw Error('This company is unavailable in the current workspace.');
 const models=companyId?all.filter(m=>m.company.id===companyId):all;
 const projects=models.flatMap(m=>m.projects),tasks=models.flatMap(m=>m.tasks),contacts=models.flatMap(m=>m.contacts);
 const projectsById=new Map(projects.map(p=>[p.id,p])),companiesById=new Map(models.map(m=>[m.company.id,m.company]));
 const open=tasks.filter(t=>t.status!=='completed');
 const counts={companies:models.length,projects:projects.length,contacts:contacts.length,open:open.length,overdue:open.filter(t=>due(t)!==null&&due(t)<now).length,blocked:open.filter(t=>t.status==='blocked').length,unassigned:open.filter(t=>!t.assignee_profile_id).length,upcoming:open.filter(t=>due(t)!==null&&due(t)>=now&&due(t)<=now+7*86400000).length};
 const predicates={all:()=>true,attention:t=>t.status!=='completed'&&(t.status==='blocked'||!t.assignee_profile_id||(due(t)!==null&&due(t)<now)),overdue:t=>t.status!=='completed'&&due(t)!==null&&due(t)<now,upcoming:t=>t.status!=='completed'&&due(t)!==null&&due(t)>=now&&due(t)<=now+7*86400000,blocked:t=>t.status==='blocked',unassigned:t=>t.status!=='completed'&&!t.assignee_profile_id,completed:t=>t.status==='completed'};
 const q=String(query).trim().toLocaleLowerCase().slice(0,100),predicate=predicates[filter]||predicates.attention;
 const visible=tasks.filter(t=>predicate(t)&&(!assignee||t.assignee_profile_id===assignee)&&(!q||[t.title,projectsById.get(t.project_id)?.title,companiesById.get(projectsById.get(t.project_id)?.company_id)?.title].join(' ').toLocaleLowerCase().includes(q))).sort(compare).map(t=>({...t,project:projectsById.get(t.project_id),company:companiesById.get(projectsById.get(t.project_id)?.company_id),overdue:t.status!=='completed'&&due(t)!==null&&due(t)<now}));
 return {models,counts,visible,projects,contacts,companies:models.map(m=>({...m.company,journey:companyJourney(m,{now})})),total:tasks.length};
}

export function companyRecordChecklist(company) {
 const d=company.data||{};
 return [
  {key:'legal_name',label:'Legal name',value:d.legal_name},
  {key:'jurisdiction',label:'Country / jurisdiction',value:d.jurisdiction},
  {key:'registration_number',label:'Registration number',value:d.registration_number},
 ].map(x=>({...x,recorded:typeof x.value==='string'&&!!x.value.trim()}));
}

export function companyHandover(model,{documents=null,now=new Date().toISOString()}={}) {
 // Caller must hold current workspace authority at the instant of export.
 return {format:'zoi-company-records',version:1,exported_at:now,company:model.company,projects:model.projects,tasks:model.tasks,contacts:model.contacts,document_records:documents,notice:'Team-maintained company records. This export is not a government filing, legal opinion or a copy of document contents.'};
}

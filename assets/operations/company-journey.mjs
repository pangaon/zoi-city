const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kinds=new Set(['company','project','task','contact']);
const states=new Set(['open','in_progress','blocked','completed']);
export function companyWork(records,workspace,companyId){
 if(!UUID.test(workspace)||!UUID.test(companyId)||!Array.isArray(records)||records.some(r=>!UUID.test(r.id||'')||r.workspace_id!==workspace||!Number.isInteger(r.version)||r.version<1||typeof r.title!=='string'||!r.title.trim()||!kinds.has(r.kind)||(r.status!==undefined&&!states.has(r.status)))||new Set(records.map(r=>r.id)).size!==records.length)throw Error('Company records could not be verified.');
 const companies=records.filter(r=>r.id===companyId&&r.kind==='company'&&!r.archived_at);if(companies.length!==1)throw Error('This company is unavailable in the current workspace.');
 const projects=records.filter(r=>r.kind==='project'&&r.company_id===companyId&&!r.archived_at),ids=new Set(projects.map(p=>p.id));
 return{company:companies[0],projects,tasks:records.filter(r=>r.kind==='task'&&ids.has(r.project_id)&&!r.archived_at),contacts:records.filter(r=>r.kind==='contact'&&r.company_id===companyId&&!r.archived_at)};
}
export function companyDocuments(result,workspace,projects){
 if(result?.ok!==true||!['owner','admin','editor'].includes(result.role)||!Array.isArray(result.documents)||!Array.isArray(result.projects)||result.documents.some(d=>!UUID.test(d.id||'')||d.workspace_id!==workspace||!UUID.test(d.project_id||'')||!Number.isInteger(d.current_version)||d.current_version<0)||result.projects.some(p=>!UUID.test(p.id||'')||(p.workspace_id&&p.workspace_id!==workspace)))throw Error('Private document records could not be verified.');
 const ids=new Set(projects.map(p=>p.id));return result.documents.filter(d=>ids.has(d.project_id)&&!d.archived_at);
}
/** Progress describes persisted work; it never completes records or treats files as mandatory. */
export function companyJourney(model,{documents=null,now=Date.now()}={}){
 const open=model.tasks.filter(t=>t.status!=='completed');
 const counts={total:model.tasks.length,completed:model.tasks.length-open.length,blocked:open.filter(t=>t.status==='blocked').length,overdue:open.filter(t=>t.due_at&&Number.isFinite(Date.parse(t.due_at))&&Date.parse(t.due_at)<now).length,unassigned:open.filter(t=>!t.assignee_profile_id).length};
 const projects=model.projects.map(project=>{
  const tasks=model.tasks.filter(t=>t.project_id===project.id),unfinished=tasks.filter(t=>t.status!=='completed');
  const blocked=unfinished.find(t=>t.status==='blocked'),overdue=unfinished.find(t=>t.due_at&&Date.parse(t.due_at)<now),unassigned=unfinished.find(t=>!t.assignee_profile_id);
  let next;
  if(project.status==='completed'&&unfinished.length)next={action:'task',record:unfinished[0],label:'Review remaining work',detail:'The project is marked completed but still has unfinished tasks.'};
  else if(blocked)next={action:'task',record:blocked,label:'Resolve blocked work',detail:blocked.title};
  else if(overdue)next={action:'task',record:overdue,label:'Review overdue task',detail:overdue.title};
  else if(unassigned)next={action:'task',record:unassigned,label:'Assign the next task',detail:unassigned.title};
  else if(!tasks.length&&project.status!=='completed')next={action:'create_task',record:project,label:'Add the first task',detail:'Break this project into work your team can complete.'};
  else if(tasks.length&&!unfinished.length&&project.status!=='completed')next={action:'project',record:project,label:'Review project completion',detail:'All saved tasks are completed. Review the project before marking it completed.'};
  else next={action:'project',record:project,label:'Open project',detail:project.title};
  const files=documents===null?null:documents.filter(d=>d.project_id===project.id);
  return{project,tasks,unfinished:unfinished.length,completed:tasks.length-unfinished.length,percent:tasks.length?Math.round((tasks.length-unfinished.length)*100/tasks.length):null,files,next};
 });
 return{...model,counts,projects,percent:counts.total?Math.round(counts.completed*100/counts.total):null,next:projects.length?projects.find(p=>p.next.action==='task')?.next||projects.find(p=>p.next.action==='create_task')?.next||projects[0].next:{action:'create_project',record:model.company,label:'Start your first project',detail:'Keep tasks, deadlines and documents together.'}};
}

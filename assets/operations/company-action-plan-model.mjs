import {companyWork,validateCompanyRecords} from './company-journey.mjs';
export const ACTION_PLANS=Object.freeze([
 {id:'records',title:'Company record review',description:'Bring company details, responsible people and supporting files together.',tasks:['Review company identity and registration details','Confirm the people responsible for company records','Collect supporting documents in project files','Review outstanding decisions with the team']},
 {id:'employee',title:'Welcome a team member',description:'Coordinate an agreed start, documents, access and first-week follow-up.',tasks:['Confirm the role and agreed start date','Collect the agreed onboarding documents','Arrange the required tools and access','Schedule the first-week check-in']},
 {id:'contractor',title:'Start a contractor engagement',description:'Keep the scope, agreement, point of contact and delivery review connected.',tasks:['Agree the scope and deliverables','Review the agreement with the responsible person','Collect supporting documents in project files','Set the first delivery review']},
 {id:'custom',title:'Build your own plan',description:'Start with your own outcome and add the work that gets it done.',tasks:['Define the first action']}
]);
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const text=(v,max,label)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw Error('Check '+label+'.');return v.trim();};
export function actionPlanDraft(templateId){const t=ACTION_PLANS.find(t=>t.id===templateId);if(!t)throw Error('Choose a supported team plan.');return{title:t.title,notes:'',contact_id:null,tasks:t.tasks.map(title=>({title,notes:'',assignee_profile_id:null,due_at:null}))};}
export function actionPlanContext(result,workspace,companyId){
 if(result?.ok!==true||!['owner','admin','editor'].includes(result.role)){const e=Error('Your current role cannot save this plan.');e.code='insufficient_permission';throw e;}
 validateCompanyRecords(result.records,workspace);const model=companyWork(result.records,workspace,companyId);
 if(!Array.isArray(result.members)||result.members.some(m=>!uuid(m?.profile_id))||new Set(result.members.map(m=>m.profile_id)).size!==result.members.length)throw Error('Current team members could not be verified.');
 return{...model,role:result.role,members:result.members};
}
export function validateActionPlan(draft,context){
 const contact=draft.contact_id||null;if(contact&&!context.contacts.some(c=>c.id===contact))throw Error('Choose a current contact in this company.');
 if(!Array.isArray(draft.tasks)||draft.tasks.length<1||draft.tasks.length>12)throw Error('A plan needs between 1 and 12 actions.');
 const notes=typeof draft.notes==='string'?draft.notes:'';if(notes.length>2000)throw Error('Keep plan notes under 2,000 characters.');
 return{title:text(draft.title,200,'the plan title'),notes,contact_id:contact,tasks:draft.tasks.map(task=>{
  const member=task.assignee_profile_id||null;if(member&&!context.members.some(m=>m.profile_id===member))throw Error('Choose a current workspace member for each assignment.');
  const when=task.due_at||null;if(when&&(typeof when!=='string'||!Number.isFinite(Date.parse(when))))throw Error('Check each action deadline.');
  const note=typeof task.notes==='string'?task.notes:'';if(note.length>2000)throw Error('Keep action notes under 2,000 characters.');
  return{title:text(task.title,200,'each action title'),notes:note,assignee_profile_id:member,due_at:when?new Date(when).toISOString():null};
 })};
}
export function actionPlanArgs(plan,companyId,projectId,index){
 if(!uuid(companyId))throw Error('Company scope is unavailable.');
 const common={status:'open',contact_id:plan.contact_id,company_id:companyId};
 if(index===0)return{p_kind:'project',p_id:null,p_expected_version:0,p_data:{...common,title:plan.title,notes:plan.notes}};
 if(!uuid(projectId)||!plan.tasks[index-1])throw Error('The saved project must be verified before creating actions.');
 return{p_kind:'task',p_id:null,p_expected_version:0,p_data:{...common,project_id:projectId,...plan.tasks[index-1]}};
}

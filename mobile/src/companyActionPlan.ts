import {actionPlanDraft} from '../../assets/operations/company-action-plan-model.mjs';

export type PlanAction = {title:string; notes:string; assignee_profile_id:string|null; due_at:string|null; localDate?:string; localTime?:string};
export type PlanDraft = {title:string; notes:string; contact_id:string|null; tasks:PlanAction[]};

export function nativeActionPlanDraft(templateId:string):PlanDraft {
  return actionPlanDraft(templateId);
}

/** Reject normalized/ambiguous text rather than silently moving the deadline. */
export function nativeActionDeadline(date:string, time:string):string|null {
  if (!date && !time) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw Error('Enter a deadline date as YYYY-MM-DD and time as HH:mm, or leave both empty.');
  }
  const [year,month,day]=date.split('-').map(Number), [hour,minute]=time.split(':').map(Number);
  const value=new Date(year,month-1,day,hour,minute,0,0);
  if (year<100 || value.getFullYear()!==year || value.getMonth()!==month-1 || value.getDate()!==day || value.getHours()!==hour || value.getMinutes()!==minute) {
    throw Error('Enter a valid deadline in your device timezone.');
  }
  return value.toISOString();
}

export function nativeActionPlanPayload(draft:PlanDraft):PlanDraft {
  return {...draft,tasks:draft.tasks.map((task,index)=>{
    let due_at;
    try {due_at=nativeActionDeadline(task.localDate||'',task.localTime||'');}
    catch(e) {throw Error('Action '+(index+1)+': '+(e instanceof Error?e.message:'Check the deadline.'));}
    return {title:task.title,notes:task.notes,assignee_profile_id:task.assignee_profile_id,due_at};
  })};
}

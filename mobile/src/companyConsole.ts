import {companyConsole, WORK_FILTERS} from '../../assets/operations/company-console-model.mjs';
import {isOpsRecord, type OpsRecord} from './operations.ts';

export type CompanyMember = {profile_id:string;display_name?:string;role?:string};
export type CompanyFilters = {companyId?:string|null;filter?:string;query?:string;assignee?:string;now?:number};
export {WORK_FILTERS};
export function nativeCompanyConsole(records:OpsRecord[],workspace:string,options:CompanyFilters={}) {
  if(!records.every(row=>isOpsRecord(row,workspace)))throw Error('Company records could not be verified.');
  return companyConsole(records,workspace,options as any);
}
export function assignedName(task:OpsRecord,members:CompanyMember[]) {
  if(!task.assignee_profile_id)return 'Unassigned';
  return members.find(member=>member.profile_id===task.assignee_profile_id)?.display_name||'Assigned member unavailable';
}
export function companyDeadline(value:string|null|undefined) {
  if(!value)return 'No deadline';
  if(!Number.isFinite(Date.parse(value)))return 'Deadline needs review';
  return 'Due '+new Date(value).toLocaleString();
}

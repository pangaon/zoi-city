import{isOpsRecord,type OpsRecord}from'./operations.ts';
import{companyWork}from'../../assets/operations/company-workspace.mjs';
export function nativeCompanyWork(records:OpsRecord[],workspace:string,companyId:string):{company:OpsRecord;projects:OpsRecord[];tasks:OpsRecord[];contacts:OpsRecord[]}{
 if(!records.every(r=>isOpsRecord(r,workspace)))throw Error('Company records could not be verified.');
 return companyWork(records,workspace,companyId);
}
export function companyForRecord(records:OpsRecord[],row:OpsRecord,workspace:string){
 if(!isOpsRecord(row,workspace)||row.archived_at)return null;
 const id=row.kind==='company'?row.id:row.kind==='project'?row.company_id:row.kind==='task'?records.find(p=>p.kind==='project'&&p.id===row.project_id&&!p.archived_at)?.company_id:null;
 return records.find(r=>r.kind==='company'&&r.id===id&&!r.archived_at&&isOpsRecord(r,workspace))||null;
}

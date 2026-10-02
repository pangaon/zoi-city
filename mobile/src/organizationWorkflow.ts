import {isOpsRecord} from './operations.ts';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Client={session:{user:{id:string}}|null;token:()=>Promise<string>;request:(path:string,body:unknown,token:string)=>Promise<any>};
export async function organizationRpc(client:Client,actor:string,current:()=>boolean,name:string,args:Record<string,unknown>){
 const check=()=>{if(!UUID.test(actor)||client.session?.user.id!==actor||!current())throw Error('Your account or workspace changed.');};
 if(!['ops_records_list','ops_audit_list','ops_mutation_execute','ops_request_status'].includes(name))throw Error('Unsupported organization request.');
 check();const token=await client.token();check();const result=await client.request('/rest/v1/rpc/'+name,args,token);check();return result;
}
export async function projectDocumentsLink({workspace,project,current,rpc}:{workspace:string;project:string;current:()=>boolean;rpc:(name:string,args:Record<string,unknown>)=>Promise<any>}){
 if(!UUID.test(workspace)||!UUID.test(project)||!current())throw Error('Choose a current workspace project.');
 const result=await rpc('ops_records_list',{p_workspace:workspace,p_kind:null,p_include_archived:false});
 if(!current())throw Error('Your account or workspace changed.');
 if(result?.ok!==true||!['owner','admin','editor'].includes(result.role)||!Array.isArray(result.records)||!result.records.every((r:unknown)=>isOpsRecord(r,workspace)))throw Error('Your current role cannot open project documents.');
 const matches=result.records.filter((r:any)=>r.id===project&&r.kind==='project'&&!r.archived_at);
 if(matches.length!==1)throw Error('This project is no longer available in your workspace.');
 return 'https://www.zoi.city/social?workspace='+workspace.toLowerCase()+'#documents/project/'+project.toLowerCase();
}

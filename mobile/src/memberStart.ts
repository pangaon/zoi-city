const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Client={session:{user:{id:string}}|null;token:()=>Promise<string>;request:(path:string,body:unknown,token:string)=>Promise<any>};
export async function memberRpc(client:Client,actor:string,workspace:string,current:()=>boolean,name:string,args:Record<string,unknown>){
 const check=()=>{if(!UUID.test(actor)||!UUID.test(workspace)||client.session?.user.id!==actor||!current())throw Error('Your account or workspace changed.');};
 if(!['workspace_team_get','ops_records_list','social_list_posts','booking_operator_list'].includes(name)||args.p_workspace!==workspace)throw Error('Invalid workspace request.');
 check();const token=await client.token();check();const result=await client.request('/rest/v1/rpc/'+name,args,token);check();return result;
}
export function memberWork(team:any,result:any,workspace:string){
 if(team?.ok!==true||team.workspace_id!==workspace||!UUID.test(team.actor_profile_id||'')||!['owner','admin','editor','viewer'].includes(team.role)||result?.ok!==true||result.role!==team.role||!Array.isArray(result.records))throw Error('Current membership could not be verified.');
 if(result.records.some((r:any)=>!UUID.test(r.id||'')||r.workspace_id!==workspace||r.kind!=='task'||!Number.isInteger(r.version)||r.version<1||typeof r.title!=='string'||!['open','in_progress','blocked','completed'].includes(r.status)))throw Error('Tasks did not match your workspace.');
 return{role:team.role,rows:result.records.filter((r:any)=>!r.archived_at&&r.assignee_profile_id===team.actor_profile_id).sort((a:any,b:any)=>(a.status==='completed'?1:0)-(b.status==='completed'?1:0)||(Date.parse(a.due_at)||Infinity)-(Date.parse(b.due_at)||Infinity)||a.id.localeCompare(b.id))};
}

type Client={session:{user:{id:string}}|null;token:()=>Promise<string>;request:(path:string,body:unknown,token:string)=>Promise<any>};
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
/** Fence each private document RPC around token refresh and response waits. */
export async function documentRpc(client:Client,actor:string,workspace:string,current:()=>boolean,name:string,args:Record<string,unknown>){
 if(!['documents_list','document_history','document_archive'].includes(name)||!uuid(workspace)||args.p_workspace!==workspace||name==='documents_list'&&args.p_project!==null&&!uuid(args.p_project)||name!=='documents_list'&&!uuid(args.p_document))throw Error('Choose a current workspace document.');
 const check=()=>{if(!uuid(actor)||client.session?.user.id!==actor||!current())throw Error('Your account or project changed.');};
 check();const token=await client.token();check();const value=await client.request('/rest/v1/rpc/'+name,args,token);check();return value;
}

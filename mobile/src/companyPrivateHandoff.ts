const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function openCompanyPrivate({workspace,company,current,read,open}:{workspace:string;company:string;current:()=>boolean;read:(name:string,args:Record<string,unknown>)=>Promise<any>;open:(url:string)=>Promise<unknown>}){
 if(!UUID.test(workspace)||!UUID.test(company))throw Error('Select a company in your current workspace.');
 if(!current())return false;
 const value=await read('ops_records_list',{p_workspace:workspace,p_kind:null,p_include_archived:false});
 if(!current())return false;
 if(value?.ok!==true||!['owner','admin'].includes(value.role)||!Array.isArray(value.records)||value.records.some((r:any)=>r.workspace_id!==workspace)||new Set(value.records.map((r:any)=>r.id)).size!==value.records.length||!value.records.some((r:any)=>r.id===company&&r.kind==='company'&&!r.archived_at))throw Error('Private Company records require current owner or administrator access to this company.');
 // Browser sign-in stays separate. The URL carries only canonical scope IDs.
 const url='https://www.zoi.city/social/?workspace='+encodeURIComponent(workspace)+'&company_private='+encodeURIComponent(company)+'#operations/company/'+encodeURIComponent(company);
 if(!current())return false;
 await open(url);
 return current();
}

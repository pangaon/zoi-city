const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function openOwnerEditor({workspace,listing,current,rpc,open}:{workspace:string;listing:string;current:()=>boolean;rpc:(name:string,args:Record<string,unknown>)=>Promise<unknown>;open:(url:string)=>Promise<unknown>}){
  if(!UUID.test(workspace)||!UUID.test(listing))throw new Error('Select a business and workspace first.');
  if(!current())return false;
  const value:any=await rpc('home_content_get',{p_workspace:workspace,p_listing:listing});
  if(!current())return false;
  if(value?.ok!==true||value.workspace_id!==workspace||value.listing_id!==listing||typeof value.version!=='string'||!value.version)throw new Error('Your editing access could not be confirmed. Try again.');
  // Browser authentication stays separate. Never transfer native credentials.
  await open('https://www.zoi.city/social/bizpage?workspace='+encodeURIComponent(workspace)+'&listing='+encodeURIComponent(listing));
  return current();
}

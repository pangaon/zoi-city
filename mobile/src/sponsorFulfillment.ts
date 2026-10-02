const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Client={session:{user:{id:string}}|null;token:()=>Promise<string>;request:(path:string,body:unknown,token:string)=>Promise<any>};
export async function sponsorFulfillmentLink({client,actor,workspace,application,event,offset=0,current}:{client:Client;actor:string;workspace:string;application:string;event:string;offset?:number;current:()=>boolean}){
 const check=()=>{if(![actor,workspace,application,event].every(x=>UUID.test(x))||!Number.isInteger(offset)||offset<0||offset>100000||client.session?.user.id!==actor||!current())throw Error('Your sponsorship account or workspace changed.');};
 check();const token=await client.token();check();const result=await client.request('/rest/v1/rpc/festival_fulfillment_source',{p_workspace:workspace,p_application:application},token);check();
 if(result?.capability!=='festival_creator_binding_v1')throw Error('Sponsorship fulfillment is not available yet. Try again later.');
 if(result?.ok!==true||result.workspace_id!==workspace||!['owner','admin','editor'].includes(result.role))throw Error('Your current role cannot open sponsorship fulfillment.');
 const a=result.application;
 if(!a||a.id!==application||a.workspace_id!==workspace||a.event_id!==event||!UUID.test(a.inquiry_id||'')||a.status!=='approved'||a.terms?.kind!=='sponsor'||!Array.isArray(a.terms.benefits)||a.terms.benefits.length>20||a.terms.benefits.some((x:any)=>typeof x!=='string'||!x.trim()||x.length>200))throw Error('This approved sponsorship is no longer available. Refresh its applications.');
 return `https://www.zoi.city/social/festival?workspace=${workspace.toLowerCase()}&sponsor_event=${event.toLowerCase()}&sponsor_application=${application.toLowerCase()}&sponsor_offset=${offset}`;
}

import { ownerEntity } from '../../assets/suite/owner-entity.mjs';
import { sourceReviewState } from '../../assets/suite/source-health.mjs';
import { businessPayload, editableBusinesses } from './businessEdit.ts';

export const OWNER_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const OWNER_VERSION = /^[a-f0-9]{32}$/;
export type OwnerSnapshot = {ok:true;workspace_id:string;listing_id:string;version:string;base:Record<string,any>;profile:Record<string,any>;owner_content?:Record<string,any>;entity_type:string;category_slug?:string};
export type OwnerSave = {p_workspace:string;p_listing:string;p_expected_version:string;p_request:string;p_base:Record<string,unknown>;p_profile:Record<string,unknown>};
type RPC = (name:string,args:Record<string,unknown>)=>Promise<any>;
const clone = <T,>(value:T):T => JSON.parse(JSON.stringify(value));
export function checkOwnerScope(workspace:string,listing?:string){if(!OWNER_UUID.test(workspace)||(listing!==undefined&&!OWNER_UUID.test(listing)))throw Error('Choose a workspace and business first.');}
export function ownerChoices(value:any,workspace:string){checkOwnerScope(workspace);if(value?.ok!==true||value.workspace_id!==workspace||!Array.isArray(value.owned)||!Array.isArray(value.claims))throw Error('Business ownership could not be verified.');const rows=editableBusinesses(value);if(!rows.every(r=>OWNER_UUID.test(r.id)))throw Error('Business ownership could not be verified.');return rows;}
export function ownerSnapshot(value:any,workspace:string,listing:string):OwnerSnapshot{checkOwnerScope(workspace,listing);ownerEntity(value,{workspace,listing} as any);if(value.base.id!==listing)throw Error('The saved business identity could not be verified.');return clone(value);}
export function ownerDraft(snapshot:OwnerSnapshot){return clone(snapshot.base);}
export function ownerSource(snapshot:OwnerSnapshot,draft:Record<string,any>){return sourceReviewState(ownerEntity(snapshot,{workspace:snapshot.workspace_id,listing:snapshot.listing_id,name:snapshot.base.name,slug:snapshot.base.slug} as any),draft.website||'');}
/** Only changed base fields are sent. Untouched menu/profile/explicit clears remain server-owned. */
export function ownerSavePayload(snapshot:OwnerSnapshot,draft:Record<string,any>,request:string):OwnerSave{
 if(!OWNER_UUID.test(request))throw Error('The save reference could not be created.');
 const changed:Record<string,unknown>={};for(const key of ['description','phone','email','website','hours','price_range','photo_url','social_links'])if(JSON.stringify(draft[key])!==JSON.stringify(snapshot.base[key]))changed[key]=key==='social_links'?clone(draft[key]):draft[key]||null;
 if(!Object.keys(changed).length)throw Error('There are no changes to save.');
 // Reuse existing field validation without rewriting unrelated stored social formats.
 const validation={social_links:{},...changed};businessPayload(snapshot.workspace_id,snapshot.listing_id,validation);
 return {p_workspace:snapshot.workspace_id,p_listing:snapshot.listing_id,p_expected_version:snapshot.version,p_request:request,p_base:changed,p_profile:{}};
}
export function ownerSaveReceipt(value:any,pending:OwnerSave){if(value?.ok!==true||value.workspace_id!==pending.p_workspace||value.listing_id!==pending.p_listing||value.request_id!==pending.p_request||!OWNER_VERSION.test(value.version||''))throw Error('The save response could not be confirmed. Retry the same save.');return clone(value);}
export async function readOwner({workspace,listing,current,rpc}:{workspace:string;listing:string;current:()=>boolean;rpc:RPC}){
 checkOwnerScope(workspace,listing);if(!current())throw Error('The account or workspace changed.');
 const value=await rpc('home_content_get',{p_workspace:workspace,p_listing:listing});if(!current())throw Error('The account or workspace changed.');const snapshot=ownerSnapshot(value,workspace,listing);
 const choices=ownerChoices(await rpc('bizpage_status',{p_workspace:workspace}),workspace);if(!current())throw Error('The account or workspace changed.');if(!choices.some(r=>r.id===listing))throw Error('Your workspace no longer has access to this business.');return snapshot;
}
/** Token waits are fenced before dispatch as well as after the response. */
export async function ownerRPC(client:{token:()=>Promise<string>;request:(path:string,args:unknown,token:string)=>Promise<any>},current:()=>boolean,name:string,args:Record<string,unknown>){if(!current())throw Error('The account or workspace changed.');const token=await client.token();if(!current())throw Error('The account or workspace changed.');const value=await client.request('/rest/v1/rpc/'+name,args,token);if(!current())throw Error('The account or workspace changed.');return value;}
export async function publishOwner({pending,current,rpc}:{pending:OwnerSave;current:()=>boolean;rpc:RPC}){
 // An identical replay must still reauthorize, but its old CAS version is intentional.
 await readOwner({workspace:pending.p_workspace,listing:pending.p_listing,current,rpc});if(!current())throw Error('The account or workspace changed.');
 const receipt=ownerSaveReceipt(await rpc('home_content_save',clone(pending)),pending);if(!current())throw Error('The account or workspace changed.');
 return {receipt,snapshot:await readOwner({workspace:pending.p_workspace,listing:pending.p_listing,current,rpc})};
}

export function ownerAccessRefused(error:any){return [401,403].includes(error?.status)||['suite_session_unavailable','invitation_unavailable','verified_account_required','not_authorized','no_access_to_listing','no_access_to_workspace','not_signed_in'].includes(error?.code)||/not_authorized|no_access_to_listing|workspace role|no longer has access|verified_account_required/i.test(String(error?.message||''));}

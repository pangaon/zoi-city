import{UUID}from'./model.mjs';
import{sessionIdentity}from'../community/session-state.mjs';
const KINDS=['settings','service','resource','slot'];
const stable=v=>Array.isArray(v)?JSON.stringify(v.map(x=>JSON.parse(stable(x)))):v&&typeof v==='object'?JSON.stringify(Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(stable(v[k]))]))):JSON.stringify(v);
export function ownerPayload(kind,payload){
 const keys=kind==='settings'?['expected_version','listing','timezone','currency','enabled']:kind==='slot'?['id','expected_version','service','resource','starts_at','active']:['id','expected_version','data'];
 if(!KINDS.includes(kind)||!payload||Array.isArray(payload)||Object.keys(payload).length!==keys.length||keys.some(k=>!Object.hasOwn(payload,k))||!Number.isInteger(payload.expected_version)||payload.expected_version<0||payload.expected_version>2147483647||new TextEncoder().encode(JSON.stringify(payload)).length>8192)throw Error('invalid_booking_owner_request');
 if(kind==='settings'){if(!UUID.test(payload.listing||'')||typeof payload.timezone!=='string'||typeof payload.currency!=='string'||typeof payload.enabled!=='boolean')throw Error('invalid_booking_owner_request');}
 else{if(payload.id!==null&&!UUID.test(payload.id||''))throw Error('invalid_booking_owner_request');if(kind==='slot'){if(!UUID.test(payload.service||'')||!UUID.test(payload.resource||'')||typeof payload.starts_at!=='string'||!Number.isFinite(Date.parse(payload.starts_at))||typeof payload.active!=='boolean')throw Error('invalid_booking_owner_request');}else{const d=payload.data,fields=kind==='service'?['name','active','duration_minutes','buffer_minutes','price_cents']:['name','active','kind','capacity'];if(!d||Array.isArray(d)||Object.keys(d).length!==fields.length||fields.some(k=>!Object.hasOwn(d,k))||typeof d.name!=='string'||typeof d.active!=='boolean'||(kind==='service'?['duration_minutes','buffer_minutes','price_cents'].some(k=>!Number.isInteger(d[k])||d[k]<0):typeof d.kind!=='string'||!Number.isInteger(d.capacity)||d.capacity<0))throw Error('invalid_booking_owner_request');}}
 return JSON.parse(JSON.stringify(payload));
}
export function ownerSaveReceipt(value,pending){
 const fail=()=>{throw Error('booking_owner_receipt_unconfirmed');};
 if(value?.ok!==true||value.account!==pending.actor||value.workspace!==pending.workspace||value.request!==pending.request||value.kind!==pending.kind||!UUID.test(value.actor||'')||stable(value.payload)!==stable(pending.payload)||value.receipt?.ok!==true)fail();
 const p=pending.payload,r=value.receipt[pending.kind==='settings'?'settings':pending.kind==='slot'?'slot':'item'];
 if(!r||r.version!==p.expected_version+1||r.workspace_id!==pending.workspace)fail();
 if(pending.kind==='settings'){if(r.listing_id!==p.listing||r.timezone!==p.timezone||r.currency!==p.currency||r.enabled!==p.enabled||value.client_listing_id!==p.listing)fail();}
 else{if(!UUID.test(r.id||'')||(p.id!==null&&r.id!==p.id))fail();if(pending.kind==='slot'){if(r.service_id!==p.service||r.resource_id!==p.resource||Date.parse(r.starts_at)!==Date.parse(p.starts_at)||r.active!==p.active)fail();}else{for(const[k,v]of Object.entries(p.data))if(r[k]!== (k==='name'?v.trim():v))fail();}}
 return value;
}
export function createOwnerSave({C,workspace,actor=sessionIdentity(C),storage=globalThis.localStorage,current=()=>true,newRequest=()=>crypto.randomUUID()}){
 if(!UUID.test(actor||'')||!UUID.test(workspace||''))throw Error('booking_owner_scope_unavailable');
 const key='zoi:booking-owner-save:v1:'+actor+':'+workspace;
 const scoped=()=>{if(!current()||sessionIdentity(C)!==actor)throw Error('booking_owner_scope_changed');};
 function pending(){let p;try{const raw=storage.getItem(key);if(!raw)return null;p=JSON.parse(raw);if(p.actor!==actor||p.workspace!==workspace||!UUID.test(p.request||'')||!KINDS.includes(p.kind)||typeof p.uncertain!=='boolean')throw Error('bad');ownerPayload(p.kind,p.payload);return p;}catch{throw Error('booking_owner_pending_unavailable');}}
 function persist(p){try{storage.setItem(key,JSON.stringify(p));if(stable(pending())!==stable(p))throw Error('bad');}catch{throw Error('booking_owner_pending_unavailable');}}
 async function execute(p){scoped();persist({...p,uncertain:true});try{
  const result=await C.api.rpc('booking_owner_save',{p_workspace:workspace,p_request:p.request,p_kind:p.kind,p_payload:p.payload},{auth:'require',beforeDispatch:scoped});scoped();const receipt=ownerSaveReceipt(result,p);
  const saved=pending();if(!saved||saved.request!==p.request||stable(saved.payload)!==stable(p.payload))throw Error('booking_owner_pending_changed');storage.removeItem(key);if(storage.getItem(key)!==null)throw Error('booking_owner_pending_unavailable');return{status:'saved',receipt};
 }catch(error){
  // Only the first conclusively non-writing validation/authority failure can
  // unlock a correction. Earlier unknown retries must retain the original marker.
  const known=[400,403].includes(Number(error?.status))&&/invalid_booking_owner_request|invalid_booking_item|invalid_booking_kind|invalid_booking_settings|invalid_booking_time|booking_setup_incomplete|published_owned_listing_required|availability_overlap|version_conflict|slot_has_reservation|resource_kind_has_history|booking_item_unavailable|slot_unavailable|booking_owner_client_unavailable|workspace_permission_denied|suite_session_unavailable|no_access_to_workspace/.test(String(error?.message||''));
  if(!p.uncertain&&known&&current()&&sessionIdentity(C)===actor){try{const original=pending();if(original?.request===p.request&&stable(original.payload)===stable(p.payload))storage.removeItem(key);}catch{}}
  throw error;
 }}
 return{pending,async save(kind,payload){scoped();if(pending())throw Error('booking_owner_original_retry_required');const p={actor,workspace,request:newRequest(),kind,payload:ownerPayload(kind,payload),uncertain:false};if(!UUID.test(p.request||''))throw Error('invalid_booking_owner_request');persist(p);return execute(p);},async retry(){scoped();const p=pending();if(!p)throw Error('booking_owner_pending_unavailable');return execute(p);}};
}

export async function ownerSaveAvailable(C,workspace,{actor=sessionIdentity(C),current=()=>true}={}){const scoped=()=>{if(!current()||sessionIdentity(C)!==actor)throw Error('booking_owner_scope_changed');};scoped();try{const value=await C.api.rpc('booking_owner_save_capabilities',{p_workspace:workspace},{auth:'require',beforeDispatch:scoped});scoped();return value?.ok===true&&value.schema_version===1&&value.workspace===workspace&&value.account===actor&&value.immutable_receipts===true&&KINDS.every(k=>value.kinds?.includes(k));}catch(error){scoped();if(Number(error?.status)===404)return false;throw error;}}

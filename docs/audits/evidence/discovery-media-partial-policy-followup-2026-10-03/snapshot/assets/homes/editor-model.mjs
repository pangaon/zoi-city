export const TEMPLATES=['atelier','concierge','table','parea'];
export const SECTIONS=['intro','offerings','gallery','calendar','media','socials','contact'];
export const COPY_FIELDS=['headline','intro','offerings_title','gallery_title','calendar_title','media_title','contact_title'];
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const clone=value=>JSON.parse(JSON.stringify(value));
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function normalizeDesign(value){
 if(!value||value.schema_version!==1||!TEMPLATES.includes(value.template))throw Error('invalid_home_design');
 if(Object.keys(value).some(k=>!['schema_version','template','section_order','hidden_sections','copy','item_order'].includes(k)))throw Error('invalid_home_design');
 for(const k of ['section_order','hidden_sections'])if(!Array.isArray(value[k])||value[k].some(x=>!SECTIONS.includes(x))||new Set(value[k]).size!==value[k].length)throw Error('invalid_home_sections');
 if(!value.copy||typeof value.copy!=='object'||Array.isArray(value.copy)||Object.entries(value.copy).some(([k,v])=>!COPY_FIELDS.includes(k)||typeof v!=='string'||v.length>(k==='intro'?2000:160)))throw Error('invalid_home_copy');
 const items=value.item_order?.offerings;
 if(!value.item_order||Object.keys(value.item_order).some(k=>k!=='offerings')||!Array.isArray(items)||items.length>200||items.some(x=>typeof x!=='string'||!/^(booking|festival|property):[0-9a-f-]{36}$/i.test(x))||new Set(items).size!==items.length)throw Error('invalid_home_item_order');
 return clone(value);
}
export function displayOrder(saved,available){const valid=new Set(available);return [...saved.filter(x=>valid.has(x)),...available.filter(x=>!saved.includes(x))];}
export function moveItem(list,id,before){
 if(!list.includes(id)||(before!==null&&!list.includes(before)))throw Error('invalid_home_move');
 if(id===before)return [...list];
 const next=list.filter(x=>x!==id);next.splice(before===null?next.length:next.indexOf(before),0,id);return next;
}
export function moveBy(list,id,delta){const index=list.indexOf(id),target=index+delta;if(index<0||target<0||target>=list.length)return [...list];const next=[...list];[next[index],next[target]]=[next[target],next[index]];return next;}
export function requestPayload({workspace,listing,request,version,action,design,restoreVersion}){
 if(!UUID.test(workspace)||!UUID.test(listing)||!UUID.test(request)||!Number.isSafeInteger(version)||version<0||!['save','publish','restore'].includes(action))throw Error('invalid_home_request');
 if(action==='restore'&&(!Number.isSafeInteger(restoreVersion)||restoreVersion<1))throw Error('invalid_home_request');
 return {p_workspace:workspace,p_listing:listing,p_request:request,p_expected_version:version,p_action:action,p_design:action==='save'?normalizeDesign(design):null,p_restore_version:action==='restore'?restoreVersion:null};
}
export function confirmedReceipt(value,payload){
 if(value?.ok!==true||value.listing!==payload.p_listing||value.workspace!==payload.p_workspace||value.request!==payload.p_request||value.action!==payload.p_action||value.version!==payload.p_expected_version+1)throw Error('home_change_unconfirmed');
 return value;
}
export function pendingStore(storage,account,workspace,listing,value){
 if(!UUID.test(account)||!UUID.test(workspace)||!UUID.test(listing))throw Error('home_session_changed');
 const key=`zoi_home_change_${account}_${workspace}_${listing}`;
 if(value===null){storage.removeItem(key);return null;}
 if(value===undefined){const text=storage.getItem(key);if(!text)return null;const payload=JSON.parse(text);if(payload.p_workspace!==workspace||payload.p_listing!==listing)throw Error('home_retry_scope_changed');return requestPayload({workspace,listing,request:payload.p_request,version:payload.p_expected_version,action:payload.p_action,design:payload.p_design,restoreVersion:payload.p_restore_version});}
 const canonical=requestPayload({workspace,listing,request:value.p_request,version:value.p_expected_version,action:value.p_action,design:value.p_design,restoreVersion:value.p_restore_version});
 const text=JSON.stringify(canonical);storage.setItem(key,text);if(storage.getItem(key)!==text)throw Error('home_retry_storage_unavailable');return canonical;
}
export function friendlyError(error){const text=String(error?.message||'');if(text.includes('version_conflict'))return 'Someone changed this home. Reload its latest draft before editing again.';if(text.includes('permission_denied'))return 'Your workspace no longer has permission to edit this home.';if(text.includes('offering_no_longer_available'))return 'An offering changed. Reload the current offerings before saving.';if(text.includes('storage'))return 'This browser could not preserve a retry receipt. No request was sent.';if(text.includes('session'))return 'Your signed-in account changed. Reopen the editor.';return 'The change is not confirmed. Retry the same request before making another change.';}

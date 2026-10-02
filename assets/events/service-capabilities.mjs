const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const permission={menu:['owner','admin','editor'],setup:['owner','admin'],queue:['owner','admin','editor'],lifecycle:['owner','admin','guest']};
export function serviceCapability({rpc,actor,workspace=null,event=null,current=()=>true}){
 let available=false;
 const unavailable=()=>Object.assign(new Error('This service tool is not available here yet. Reload to check again. Saved requests are kept for recovery.'),{code:'service_capability_unavailable'});
 function validate(r,feature){
  if(!current()||!UUID.test(actor||'')||(workspace===null)===(event===null)||!UUID.test(workspace||event||'')||!permission[feature]||r?.ok!==true||r.version!==1||r.auth_user_id!==actor||!UUID.test(r.actor_profile_id||'')||r.workspace_id!==workspace||r.event_id!==event||!permission[feature].includes(r.role)||event!==null&&r.role!=='guest'||workspace!==null&&r.role==='guest'||!r.capabilities||Object.keys(permission).some(k=>![0,1].includes(r.capabilities[k]))||r.capabilities[feature]!==1)throw unavailable();
  return r;
 }
 async function require(feature){
  available=false;if(!current()||!permission[feature]||!UUID.test(actor||'')||(workspace===null)===(event===null)||!UUID.test(workspace||event||''))throw unavailable();
  try{const r=validate(await rpc('event_service_capabilities',{p_workspace:workspace,p_event:event}),feature);available=true;return r;}catch(e){available=false;if([401,403].includes(Number(e?.status||e?.statusCode))||e?.code==='42501')throw e;throw unavailable();}
 }
 return{require,state:()=>({available})};
}

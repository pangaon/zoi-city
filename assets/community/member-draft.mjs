const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function memberDraftPayload(value){
 const out={body:String(value.body||''),media:[...(value.media||[])],listing:value.listing||null,context:{intent:value.context?.intent||'moment',topics:[...(value.context?.topics||[])],city:value.context?.city?.trim()||null,country:value.context?.country?.trim()||null,media_alts:{...(value.context?.media_alts||{})}}};
 if(out.body.length>1000||out.media.length>4||out.media.some(x=>!UUID.test(x))||new Set(out.media).size!==out.media.length||out.listing&&!UUID.test(out.listing)||!['moment','question','recommendation','event'].includes(out.context.intent)||out.context.topics.length>5||(out.context.city||'').length>120||(out.context.country||'').length>120)throw Error('Check the draft text, media and public locality.');return out;
}
export function memberDraftSignature(value){return JSON.stringify(memberDraftPayload(value),(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);}
function checkedDraft(d){if(!d||!UUID.test(d.id)||!Number.isSafeInteger(d.version)||d.version<1||!['draft','published','discarded'].includes(d.state)||d.state==='published'&&!UUID.test(d.post_id))throw Error('The private draft response could not be verified.');if(typeof d.payload?.body!=='string'||!Array.isArray(d.payload.media)||!d.payload.context||!Array.isArray(d.payload.context.topics))throw Error('The private draft response could not be verified.');memberDraftPayload(d.payload);return d;}
function checkedReceipt(v,request,action){if(v.request_id!==request||!['saved','deleted','cancelled','missing'].includes(v.state))throw Error('Draft receipt did not match the request.');if(v.state==='saved')checkedDraft(v.draft);if(v.state==='deleted'&&!UUID.test(v.post_id))throw Error('Delete receipt did not identify the post.');if(action&&v.state!==(action==='delete'?'deleted':'saved'))throw Error('The Community change was not confirmed.');return v;}
export function createMemberDraft({actor,current,call,storage,nonce,lock,changed=()=>{}}){
 let draft=null,marker=null,payload=null,ready=false,busy=false;
 const check=()=>{if(!current())throw Error('Your Community account changed.');};
 const schema=v=>{if(v?.ok!==true||v.schema_version!==1)throw Error('Private Community drafts are unavailable. Try again after the service is updated.');return v;};
 const notify=()=>{if(current())changed();};
 const run=async fn=>{if(busy)throw Error('Wait for the current draft request.');busy=true;notify();try{check();return await fn();}catch(e){if(e?.status===401||e?.status===403||/suite_session_unavailable|community_profile_required/.test(String(e?.message))){draft=null;payload=null;ready=false;}throw e;}finally{busy=false;notify();}};
 const locked=fn=>lock('zoi:community-draft:'+actor,fn);
 const readMarker=async()=>{const v=await storage.load();check();if(v&&!(v.v===1&&v.actor===actor&&UUID.test(v.request)&&['save','discard','publish','delete'].includes(v.action)))throw Error('The previous private draft reference could not be read.');return v;};
 async function resolve(cancel=false){return run(()=>locked(async()=>{marker=await readMarker();if(!marker)return null;const v=schema(await call('community_draft_request',{p_request:marker.request,p_cancel_if_missing:cancel}));check();checkedReceipt(v,marker.request);if(v.state==='missing')return v;if(!['saved','deleted','cancelled'].includes(v.state))throw Error('Draft receipt was not confirmed.');if(v.draft)draft=v.draft;ready=true;await storage.clear();check();marker=null;payload=null;notify();return v;}));}
 async function execute(action,args,retry=false){return run(()=>locked(async()=>{const old=await readMarker();if(retry){if(!marker||!payload||old?.request!==marker.request)throw Error('Check the saved receipt before continuing.');}else{if(old){marker=old;throw Error('Check the previous Community request before starting another.');}check();const request=nonce();marker={v:1,actor,request,action};payload={name:action==='delete'?'community_delete_post':'community_draft_mutate',args:{...args,p_request:request}};await storage.save(marker);check();}const result=schema(await call(payload.name,payload.args));check();checkedReceipt(result,marker.request,marker.action);if(result.draft)draft=result.draft;await storage.clear();check();marker=null;payload=null;return result;}));}
 return{
  state:()=>({draft,marker,ready,busy,canRetry:!!payload,blocked:!!marker||!ready||busy}),
  load:()=>run(()=>locked(async()=>{marker=await readMarker();const v=schema(await call('community_draft_get',{p_draft:null}));check();draft=v.draft===null?null:checkedDraft(v.draft);ready=true;return v;})),
  save:value=>execute('save',{p_action:'save',p_draft:draft?.state==='draft'?draft.id:null,p_expected_version:draft?.state==='draft'?draft.version:0,p_payload:memberDraftPayload(value)}),
  publish:()=>{if(!draft||draft.state!=='draft')throw Error('Save a private draft before publishing.');return execute('publish',{p_action:'publish',p_draft:draft.id,p_expected_version:draft.version,p_payload:null});},
  discard:()=>{if(!draft||draft.state!=='draft')throw Error('No private draft is selected.');return execute('discard',{p_action:'discard',p_draft:draft.id,p_expected_version:draft.version,p_payload:null});},
  deletePost:post=>{if(!UUID.test(post))throw Error('Select your own post.');return execute('delete',{p_post:post});},
  check:()=>resolve(false),cancel:()=>resolve(true),retry:()=>execute(null,null,true),
  history:()=>run(async()=>{check();if(!draft)return[];const v=schema(await call('community_draft_history',{p_draft:draft.id,p_before:null}));check();return v.versions;}),
  drop:()=>{draft=null;payload=null;ready=false;}
 };
}

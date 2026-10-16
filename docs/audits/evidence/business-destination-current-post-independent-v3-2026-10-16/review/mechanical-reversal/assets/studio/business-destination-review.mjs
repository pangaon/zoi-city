import {creativeScope} from './business-creative.mjs';

const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const copy=v=>JSON.parse(JSON.stringify(v));
export function destinationError(error){
 const text=String(error?.message||error||'');
 const localMessages=['This browser cannot coordinate a saved draft review. Use a supported browser; your draft is unchanged.','Draft review recovery is unavailable. No change was sent.','The original edited copy is no longer in memory. Check the saved result or cancel the unsaved review before making another change.'];
 if(localMessages.includes(text))return text;
 for(const [code,message] of Object.entries({
  business_destination_media_review_required:'Use text only by removing the image, or create a supported image in Image layout before reviewing destinations.',
  business_destination_source_changed:'Business details changed. Reopen the private draft and review the current business details first.',
  business_destination_version_conflict:'This post changed elsewhere. Reopen it and review the current draft before continuing.',
  business_destination_not_private:'This post already has a destination or schedule. Open its current version in Calendar.',
  business_destination_context_invalid:'This business draft could not be confirmed. Reopen it from Calendar.',
  business_destination_request_conflict:'This review reference belongs to different details. Check the original saved result.',
  business_destination_request_limit:'The daily manual draft limit has been reached. Your saved draft is unchanged.'
 }))if(text.includes(code))return message;
 return 'The saved draft could not be confirmed. Check its result before starting another review.';
}
export function destinationContext(value,{workspace,post}){
 if(value?.ok!==true||value.workspace!==workspace||value.post_id!==post||value.post?.id!==post||value.post.workspace_id!==workspace||!UUID.test(value.listing||'')||!['private','reviewed'].includes(value.stage)||typeof value.source_current!=='boolean'||typeof value.post.updated_at!=='string')throw Error('business_destination_context_invalid');
 if(value.stage==='private'&&(value.post.status!=='draft'||value.post.scheduled_at!==null||!Array.isArray(value.post.channels)||value.post.channels.length))throw Error('business_destination_context_invalid');
 return copy(value);
}
export function createDestinationWorkflow({C,workspace,post,current=()=>true,storage=globalThis.localStorage,locks=globalThis.navigator?.locks,uuid=()=>crypto.randomUUID()}={}){
 const scope=creativeScope(C),actor=scope.split(':')[0],key='zoi.business-destination:'+scope+':'+workspace+':'+post;let savePayload=null;
 if(!scope||!UUID.test(workspace||'')||!UUID.test(post||''))throw Error('Sign in to this workspace again.');
 const active=()=>current()&&creativeScope(C)===scope;
 function check(){if(!active())throw Error('Your account, session or workspace changed.');}
 function pending(){check();const raw=storage.getItem(key);if(!raw)return null;let v;try{v=JSON.parse(raw);}catch{throw Error('Draft review recovery is unavailable.');}if(v.scope!==scope||v.workspace!==workspace||v.post!==post||!UUID.test(v.request||'')||typeof v.expected!=='string'||!['prepare','save'].includes(v.kind))throw Error('Draft review recovery is unavailable.');return copy(v);}
 function remember(v){const raw=JSON.stringify(v);storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw Error('Draft review recovery is unavailable. No change was sent.');}
 async function rpc(fn,args){check();if(!await C.auth.ensureFresh())throw Error('Sign in again.');check();const value=await C.api.rpc(fn,args,{auth:'require',beforeDispatch:active});check();return value;}
 async function exclusive(fn){check();if(!locks?.request)throw Error('This browser cannot coordinate a saved draft review. Use a supported browser; your draft is unchanged.');return locks.request(key,{mode:'exclusive'},async()=>{check();return fn();});}
 function receipt(v,p){
  if(v?.ok!==true||v.actor!==actor||v.workspace!==workspace||v.post_id!==post||v.request!==p.request||!['missing','saved','removed','cancelled'].includes(v.state))throw Error('Draft review receipt could not be confirmed.');
  if(v.state==='saved'&&(v.operation_kind!==(p.kind==='save'?'reviewed_community_draft_edit':'community_destination_draft')||v.snapshot?.id!==post||v.snapshot.workspace_id!==workspace||v.snapshot.status!=='draft'||v.snapshot.scheduled_at!==null||JSON.stringify(v.snapshot.channels)!=='["zoi"]'||!UUID.test(v.snapshot.meta?.destination_review?.request||'')||p.kind==='prepare'&&v.snapshot.meta.destination_review.request!==p.request||v.snapshot.meta.destination_review.kind!=='reviewed_community_draft'||typeof v.current_matches_snapshot!=='boolean'||v.current_post?.id!==post||v.current_post.workspace_id!==workspace))throw Error('Draft review receipt could not be confirmed.');
  if(v.state!=='missing'){storage.removeItem(key);savePayload=null;}
  return copy(v);
 }
 async function dispatch(p){
  if(p.kind==='prepare')return receipt(await rpc('business_creative_destinations_prepare',{p_workspace:workspace,p_post:post,p_request:p.request,p_expected_updated_at:p.expected}),p);
  if(!savePayload)throw Error('The original edited copy is no longer in memory. Check the saved result or cancel the unsaved review before making another change.');
  return receipt(await rpc('business_creative_destinations_save',{p_workspace:workspace,p_post:post,p_request:p.request,p_payload:copy(savePayload)}),p);
 }
 return {active,pending,
  context:async()=>destinationContext(await rpc('business_creative_destinations_context',{p_workspace:workspace,p_post:post}),{workspace,post}),
  prepare:context=>exclusive(async()=>{
   let p=pending();if(!p){const c=destinationContext(context,{workspace,post});if(c.stage!=='private'||!c.source_current)throw Error('business_destination_source_changed');p={scope,workspace,post,request:uuid(),kind:'prepare',expected:c.post.updated_at};remember(p);}
   if(p.kind!=='prepare')throw Error('Check the earlier draft save first.');return dispatch(p);
  }),
  save:input=>exclusive(async()=>{let p=pending();if(!p){if(typeof input?.expected_updated_at!=='string')throw Error('Reopen this saved draft before editing.');savePayload=copy(input);p={scope,workspace,post,request:uuid(),kind:'save',expected:input.expected_updated_at};remember(p);}if(p.kind!=='save')throw Error('Check the earlier destination review first.');return dispatch(p);}),
  retry:()=>exclusive(async()=>{const p=pending();if(!p)throw Error('No unconfirmed draft review is saved.');return dispatch(p);}),
  recover:(cancel=false)=>exclusive(async()=>{const p=pending();if(!p)throw Error('No unconfirmed review is saved.');return receipt(await rpc('business_creative_destinations_recover',{p_workspace:workspace,p_post:post,p_request:p.request,p_cancel_if_missing:cancel}),p);}),
  releaseCopy:()=>{savePayload=null;},
  clearPrivate:()=>{savePayload=null;try{storage.removeItem(key);}catch{}}
 };
}
export function mountDestinationReview(host,{C,workspace,postId,active=()=>true,onPrepared=()=>{},onCurrentPost=()=>{},storage=globalThis.localStorage,locks=globalThis.navigator?.locks,workflow:providedWorkflow}={}){
 const doc=host.ownerDocument,scope=creativeScope(C);let ended=false,busy=false,context=null;
 host.style.cssText='display:grid;gap:10px;padding:16px;border:1px solid var(--bdr,var(--line));border-radius:14px;min-width:0';
 const live=()=>!ended&&host.isConnected&&active()&&creativeScope(C)===scope;
 const workflow=providedWorkflow||createDestinationWorkflow({C,workspace,post:postId,current:live,storage,locks});
 const el=(tag,text)=>{const n=doc.createElement(tag);if(text)n.textContent=text;if(tag==='p')n.style.cssText='margin:0;font-size:13px;line-height:1.5';if(tag==='h3')n.style.cssText='margin:0;font-size:16px;line-height:1.4';return n;};
 // A disposed view can expose a scoped Auth facade whose token method now
 // refuses calls. That is not proof the account changed, and must not erase a
 // successor view's same-post recovery marker. The marker contains no copy.
 function destroy(){if(ended)return;ended=true;clearInterval(timer);workflow.releaseCopy();host.replaceChildren();context=null;}
 const timer=setInterval(()=>{if(!live())destroy();},250);
 function acceptContext(value){context=value;if(live()&&context?.source_current)onCurrentPost(copy(context.post));}
 function render(message=''){
  if(!live())return;host.replaceChildren();host.append(el('h3',context?.stage==='reviewed'?'Zoi Community draft':'Review destinations'),el('p',context?.stage==='reviewed'?'Saved privately. Not scheduled or published.':'Choose where to prepare this draft. Nothing is scheduled or sent.'));
  if(message){const p=el('p',message);p.setAttribute('role','status');host.append(p);}
  let pending;try{pending=workflow.pending();}catch(e){host.append(el('p',e.message));return;}
  const button=(label,fn)=>{const b=el('button',label);b.type='button';b.className='zk-btn zc-btn';b.disabled=busy;b.onclick=()=>act(fn);host.append(b);};
  if(pending){host.append(el('p','The previous review is unconfirmed. Checking or retrying keeps its original saved post and review reference.'));button('Check saved result',()=>workflow.recover());button(pending.kind==='save'?'Retry original draft save':'Retry original review',()=>workflow.retry());button('Cancel if not saved',()=>workflow.recover(true));return;}
  if(context?.stage==='private'){
   if(!context.source_current){host.append(el('p','Business details changed. Reopen the private draft and review the current details.'));return;}
   button('Prepare Zoi Community draft',()=>workflow.prepare(context));
  }else if(context?.stage==='reviewed')host.append(el('p','Edit this draft in Composer. Publishing and scheduling are not available yet.'));
 }
 async function act(fn){if(busy||!live())return;busy=true;render('Checking the saved draft…');try{const result=await fn();if(!live())return;if(result.state==='saved'){acceptContext(await workflow.context());if(!live())return;if(context.stage!=='reviewed'||!context.source_current){render('The saved result is recorded, but current business details need review. Reopen the draft from Calendar before editing.');return;}await onPrepared(context.post,result);if(!live())return;render(result.current_matches_snapshot?'Destination saved.':'The original review was saved; this post has since changed. Its current version is shown.');}else if(result.state==='cancelled'){acceptContext(await workflow.context());render('The unsaved review was cancelled. Your saved post is unchanged. You can edit its image or text before reviewing destinations again.');}else{if(result.state==='removed')context=null;render(result.state==='removed'?'This saved post was removed. It was not recreated.':'No saved result is confirmed yet. Retry the original review.');}}catch(e){if(live()){if([401,403].includes(Number(e.status))||/not_authorized|insufficient_permission|suite_session_unavailable|no_access_to/.test(String(e.message))){destroy();return;}render(destinationError(e));}}finally{busy=false;if(live())for(const b of host.querySelectorAll('button'))b.disabled=false;}}
 render('Reading the saved draft…');workflow.context().then(value=>{if(live()){acceptContext(value);render();}}).catch(e=>{if(live())render(destinationError(e));});
 return {destroy,workflow,refresh:()=>render()};
}

const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const providers={facebook:'Facebook',instagram:'Instagram',linkedin:'LinkedIn',twitter:'X',youtube:'YouTube',tiktok:'TikTok'};
const labels={prepared:'Preparing delivery',dispatching:'Delivery result pending',published:'Provider receipt recorded',rejected:'Provider rejected this attempt',unknown:'Delivery needs review',closed:'Closed without automatic retry',abandoned:'Not dispatched'};
function reportedURL(raw){const u=new URL(raw);if(u.protocol!=='https:'||!['facebook.com','www.facebook.com','linkedin.com','www.linkedin.com','twitter.com','www.twitter.com','x.com','www.x.com','instagram.com','www.instagram.com','youtube.com','www.youtube.com','tiktok.com','www.tiktok.com'].includes(u.hostname)||u.username||u.password||[...u.searchParams.keys()].some(k=>/access_token|refresh_token|authorization|secret|api_key/i.test(k)))throw Error('Use a public post link from the selected provider.');return u.href;}
export function mountDeliveryReview(host,{C,workspace,postId,active=()=>true,storage=globalThis.localStorage}={}){
 const doc=host.ownerDocument,actor=C.auth?.load?.()?.user_id;let ended=false,version=0,pending=null,rows=[],draft=null;
 const key='zoi_delivery_review:'+actor+':'+workspace+':'+postId;
 const current=()=>!ended&&host.isConnected&&active()&&C.auth?.load?.()?.user_id===actor;
 const el=(tag,text,cls)=>{const n=doc.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 function destroy(){if(ended)return;ended=true;version++;clearInterval(timer);host.replaceChildren();}
 const timer=setInterval(()=>{if(!current())destroy();},250);
 const rpc=(fn,args)=>C.api.rpc(fn,args,{auth:'require',beforeDispatch:current});
 function remember(){storage.setItem(key,JSON.stringify(pending));}
 try{const saved=JSON.parse(storage.getItem(key)||'null');if(saved&&saved.workspace===workspace&&saved.post_id===postId&&saved.actor===actor&&uuid.test(saved.request_id)&&uuid.test(saved.attempt_id))pending=saved;}catch{}
 function message(text){if(current()){const p=el('p',text,'zk-hint');p.setAttribute('role','status');host.replaceChildren(p);}}
 async function mutate(attempt,action,details){
  if(!current())return;
  if(!pending&&new TextEncoder().encode(JSON.stringify(details)).length>2000){render('Shorten the post link or review note before saving.');return;}
  if(!pending){pending={actor,workspace,post_id:postId,attempt_id:attempt.id,request_id:crypto.randomUUID(),action,details,uncertain:false};try{remember();}catch{pending=null;message('Recovery storage is unavailable. This update was not sent.');return;}}
  const original={...pending};message('Saving your review…');
  try{
   const receipt=await rpc('social_delivery_reconcile',{p_workspace:workspace,p_attempt:original.attempt_id,p_request:original.request_id,p_action:original.action,p_details:original.details});
   if(!current())return;
   const recorded=receipt?.attempt?.reconciliation?.find(r=>r.request_id===original.request_id);
   if(receipt?.ok!==true||receipt.attempt?.id!==original.attempt_id||recorded?.evidence_state!=='owner_reported'||recorded.action!==original.action||recorded.details?.url!==original.details.url||recorded.details?.note!==original.details.note)throw Error('Review receipt could not be confirmed.');
   pending=null;storage.removeItem(key);await load();
  }catch(error){if(!current())return;if(!original.uncertain&&/invalid_delivery_reconciliation|delivery_reconciliation_limit|delivery_not_in_reconciliation/.test(String(error?.message||error))){draft=original;pending=null;try{storage.removeItem(key);}catch{}render('This review was not saved. Check the details or reload the current attempts.');return;}pending={...original,uncertain:true};try{remember();}catch{}render('The earlier review is unconfirmed. Retry keeps its original action and details; no delivery will be retried.');}
 }
 function render(note=''){
  if(!current())return;host.replaceChildren();host.append(el('h3','Delivery review'),el('p','Review the recorded attempt. Reporting a link or closing a review keeps automatic retry blocked.','zk-hint'));
  if(note)host.append(el('p',note,'zk-hint'));
  if(pending){const box=el('section');box.append(el('p','Unconfirmed review: '+(pending.action==='close_without_retry'?'Close without retry':'Report an existing post'),'zk-hint'));const retry=el('button','Retry original review','zk-btn');retry.type='button';retry.onclick=()=>mutate({id:pending.attempt_id},pending.action,pending.details);box.append(retry);host.append(box);return;}
  if(!rows.length){host.append(el('p','No delivery attempts are recorded for this post.','zk-hint'));return;}
  for(const attempt of rows){
   const section=el('section');section.style.cssText='border-top:1px solid var(--bd);padding:12px 0;display:grid;gap:8px;min-width:0;overflow-wrap:anywhere';
   section.append(el('strong',(labels[attempt.state||attempt.status]||'Delivery record')+' · '+(attempt.channel?.display_name||attempt.channel?.handle||providers[attempt.platform]||'Selected account')));
   if(attempt.created_at)section.append(el('p','Recorded '+new Date(attempt.created_at).toLocaleString(),'zk-hint'));
   if(attempt.external_url){try{const link=el('a','Open recorded provider post');link.href=reportedURL(attempt.external_url);link.target='_blank';link.rel='noopener noreferrer';section.append(link);}catch{}}
   for(const report of attempt.reconciliation||[]){section.append(el('p',report.action==='close_without_retry'?'Owner closed this review without retry.':'Owner reported a visible post link; provider delivery remains unverified.','zk-hint'));if(report.details?.note)section.append(el('p',report.details.note,'zk-hint'));}
   if((attempt.state||attempt.status)==='unknown'){
    const form=el('form'),url=el('input'),notes=el('textarea'),urlLabel=el('label','Existing provider post link'),noteLabel=el('label','Review note (optional)'),save=el('button','Report existing post','zk-btn'),close=el('button','Close without retry','zk-btn');
    url.type='url';url.maxLength=1200;url.className='zk-in';url.required=true;url.placeholder='https://…';url.setAttribute('aria-label','Existing provider post link');notes.className='zk-in';notes.maxLength=500;notes.rows=2;notes.setAttribute('aria-label','Review note (optional)');if(draft?.attempt_id===attempt.id){url.value=draft.details.url||'';notes.value=draft.details.note||'';}urlLabel.append(url);noteLabel.append(notes);save.type='submit';close.type='button';form.append(urlLabel,noteLabel,save,close);form.style.cssText='display:grid;gap:10px';form.onsubmit=e=>{e.preventDefault();try{mutate(attempt,'report_existing_post',{url:reportedURL(url.value),note:notes.value.trim()});}catch(error){const alert=el('p',error.message,'zk-hint');alert.setAttribute('role','alert');form.append(alert);}};close.onclick=()=>mutate(attempt,'close_without_retry',{note:notes.value.trim()});section.append(form);
   }
   if(attempt.state==='closed')section.append(el('p','Automatic retry remains blocked. This closure does not claim that a provider published the post.','zk-hint'));
   host.append(section);
  }
 }
 async function load(){const generation=++version;message('Reading delivery attempts…');try{const result=await rpc('social_delivery_attempts_get',{p_workspace:workspace,p_post:postId});if(!current()||generation!==version)return;if(result?.ok!==true||result.workspace!==workspace||result.post_id!==postId||!Array.isArray(result.attempts))throw Error('Delivery records could not be confirmed.');rows=result.attempts;render();}catch(error){if(current()&&generation===version){message('Delivery review could not load. Reopen it after checking your workspace access.');}}}
 if(!uuid.test(actor||'')||!uuid.test(workspace||'')||!uuid.test(postId||'')){message('Choose a saved post in the current workspace.');return{destroy};}
 load();return{destroy,reload:load};
}

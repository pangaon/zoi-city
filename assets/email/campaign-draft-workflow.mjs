const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clone=value=>JSON.parse(JSON.stringify(value));
export function campaignScope(C,workspace){
 try{const auth=C.auth.load(),token=C.auth.token(),payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))),actor=String(payload.sub||'').toLowerCase(),session=String(payload.session_id||'').toLowerCase();if(!UUID.test(actor)||!UUID.test(session)||!UUID.test(workspace||'')||auth?.user_id&&auth.user_id.toLowerCase()!==actor)return null;return{actor,session,workspace};}catch{return null;}
}
export const sameCampaignScope=(C,scope)=>!!scope&&JSON.stringify(campaignScope(C,scope.workspace))===JSON.stringify(scope);
const key=(kind,scope)=>'zoi.email.'+kind+':'+scope.actor+':'+scope.session+':'+scope.workspace;
function write(storage,k,value){try{storage.setItem(k,JSON.stringify(value));if(storage.getItem(k)!==JSON.stringify(value))throw Error();}catch{throw Error('Browser recovery storage is unavailable. Restore session storage before saving.');}}
export function segmentHandoff({C,workspace,tag,storage=globalThis.sessionStorage,now=Date.now()}){
 const scope=campaignScope(C,workspace);if(!scope||typeof tag!=='string'||!tag.trim()||tag!==tag.trim()||tag==='all'||tag.length>100)throw Error('Choose one specific audience tag before drafting an email.');write(storage,key('segment',scope),{scope,tag,expires:now+300000});return scope;
}
export function takeSegment({scope,storage=globalThis.sessionStorage,now=Date.now()}){
 const k=key('segment',scope);let value;try{value=JSON.parse(storage.getItem(k)||'null');storage.removeItem(k);}catch{throw Error('Audience handoff could not be read. Reopen Contacts and choose the tag again.');}
 if(!value)return null;if(JSON.stringify(value.scope)!==JSON.stringify(scope)||value.expires<now||typeof value.tag!=='string'||!value.tag.trim()||value.tag!==value.tag.trim()||value.tag==='all'||value.tag.length>100)throw Error('This audience handoff expired. Reopen Contacts and choose the tag again.');return value.tag;
}
export function validateDraftReceipt(value,scope,request,payload=null){
 if(value?.ok!==true||value.actor_id!==scope.actor||value.workspace_id!==scope.workspace||value.request_id!==request||!['saved','removed','missing','cancelled'].includes(value.state))throw Error('Draft save returned no matching canonical receipt.');
 if(['saved','removed'].includes(value.state)){
  const s=value.snapshot,c=value.campaign;if(!UUID.test(value.campaign_id||'')||s?.id!==value.campaign_id||s?.workspace_id!==scope.workspace||s?.status!=='draft')throw Error('Draft snapshot could not be verified.');
  if(payload&&(['subject','body','preheader','from_name'].some(k=>(s[k]??null)!==(payload[k]??null))||(s.audience_tag??null)!==(payload.audience?.trim()||null)||(payload.id!==null&&payload.id!==s.id)))throw Error('Draft snapshot does not match the original save.');
  if(value.state==='saved'&&(!c||c.id!==s.id||c.workspace_id!==scope.workspace||typeof c.body!=='string'||typeof c.subject!=='string'||typeof c.status!=='string')||value.state==='removed'&&c!==null)throw Error('Current saved campaign could not be verified.');
 }
 return clone(value);
}
export function createCampaignDraftWorkflow({scope,rpc,active,storage=globalThis.sessionStorage,uuid=()=>crypto.randomUUID()}){
 if(!scope||!UUID.test(scope.actor)||!UUID.test(scope.workspace)||!UUID.test(scope.session))throw Error('Please sign in again before opening Email.');
 const k=key('pending',scope);let marker=null,payload=null;
 try{const raw=storage.getItem(k);if(raw){marker=JSON.parse(raw);if(JSON.stringify(marker.scope)!==JSON.stringify(scope)||!UUID.test(marker.request||''))throw Error();}}catch{throw Error('Saved draft recovery is unavailable. Restore session storage before saving.');}
 const check=()=>{if(!active())throw Error('Account or workspace changed.');};
 const clear=()=>{try{storage.removeItem(k);if(storage.getItem(k)!==null)throw Error();}catch{throw Error('The save was confirmed, but its local recovery marker could not be cleared. Check the saved receipt again.');}marker=null;payload=null;};
 async function receive(call){check();const request=marker.request,original=payload;const raw=await call();check();const value=validateDraftReceipt(raw,scope,request,original);if(value.state!=='missing')clear();return value;}
 return{
  pending:()=>marker?{request:marker.request,canRetry:!!payload}:null,
  async save(value){check();if(marker&&!payload)throw Error('Check the saved receipt before starting another draft.');if(!marker){payload=clone(value);marker={scope,request:uuid()};try{write(storage,k,marker);}catch(error){marker=null;payload=null;throw error;}}
   const result=await receive(()=>rpc('email_campaign_draft_save',{p_workspace:scope.workspace,p_request:marker.request,p_payload:clone(payload)}));if(result.state==='removed')throw Error('This saved campaign was later removed. No replacement draft was created.');if(result.state!=='saved')throw Error('The draft was not saved.');return result;
  },
  async recover(mode='check'){check();if(!marker)throw Error('No unresolved save to check.');if(mode==='retry'){if(!payload)throw Error('The original text is no longer in memory. Check its receipt or cancel the unsaved request.');return receive(()=>rpc('email_campaign_draft_save',{p_workspace:scope.workspace,p_request:marker.request,p_payload:clone(payload)}));}return receive(()=>rpc('email_campaign_draft_status',{p_workspace:scope.workspace,p_request:marker.request,p_cancel_if_missing:mode==='cancel'}));},
  clearPrivate({dropMarker=false}={}){payload=null;if(dropMarker){try{storage.removeItem(k);}catch{}}marker=null;}
 };
}

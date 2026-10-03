import {mountPublicityEditor} from './publicity-editor.mjs';
import {validatePublicity} from './publicity.mjs';
import {renderSalesMilestone} from './publicity-view.mjs';
import {HOST_UUID} from '../tickets/host-allocation-client.mjs';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const clone=v=>JSON.parse(JSON.stringify(v));
const version=v=>/^[a-f0-9]{32}$/.test(v||'');
export function eventOwnerSnapshot(raw,workspace,event,identity){
 if(raw?.ok!==true||raw.workspace_id!==workspace||raw.listing_id!==event||raw.entity_type!=='event'||!version(raw.version)||!object(raw.profile)||!object(raw.base)||identity?.id!==event||typeof identity.name!=='string'||!identity.name.trim()||typeof identity.slug!=='string'||!identity.slug.trim())throw Error('The current event page could not be confirmed.');
 return {...clone(raw),identity:clone(identity),event_url:'https://www.zoi.city/event/'+encodeURIComponent(identity.slug)};
}
export function eventAnnouncementPayload(snapshot,value,request){
 if(!HOST_UUID.test(request||''))throw Error('A save reference is required.');
 const publicity=validatePublicity(value);
 if(publicity&&publicity.event_url!==snapshot.event_url)throw Error('This announcement must belong to the current event page.');
 return{p_workspace:snapshot.workspace_id,p_listing:snapshot.listing_id,p_expected_version:snapshot.version,p_request:request,p_base:{},p_profile:{event_publicity:publicity}};
}
/** Narrow adapter for the existing versioned home writer. Other page fields never enter the payload. */
export function createEventAnnouncementClient({call,getActor,workspace,event,storage}={}){
 let actor=getActor(),pending=null,invalid=false;const key=()=>`zoi.event-announcement:${actor}:${workspace}:${event}`;
 function current(){if(getActor()!==actor)throw Error('Your account changed.');}
 function checked(payload){if(!object(payload)||payload.p_workspace!==workspace||payload.p_listing!==event||!HOST_UUID.test(payload.p_request||'')||!version(payload.p_expected_version)||!object(payload.p_base)||Object.keys(payload.p_base).length||!object(payload.p_profile)||Object.keys(payload.p_profile).join()!=='event_publicity')throw Error('This announcement request does not match the event.');validatePublicity(payload.p_profile.event_publicity);return clone(payload);}
 function read(){pending=null;invalid=false;try{const bytes=storage?.getItem(key());if(!bytes)return;const saved=JSON.parse(bytes);if(saved.actor!==actor||saved.payload.p_workspace!==workspace||saved.payload.p_listing!==event||!HOST_UUID.test(saved.payload.p_request||'')||!version(saved.payload.p_expected_version)||Object.keys(saved.payload.p_base||{}).length||Object.keys(saved.payload.p_profile||{}).join()!=='event_publicity')throw Error();pending=checked(saved.payload);}catch{invalid=true;}}
 function clear(){pending=null;invalid=false;try{storage?.removeItem(key());}catch{}}
 read();
 async function retry(){current();if(invalid||!pending)throw Error('Reopen the existing Website editor to review this save.');const payload=clone(pending),owner=actor;
  try{const r=await call('home_content_save',payload);current();if(actor!==owner||r?.ok!==true||r.workspace_id!==workspace||r.listing_id!==event||r.request_id!==payload.p_request||!version(r.version))throw Error('The save response is incomplete.');clear();return r;}catch(e){current();if(/version_conflict|not_authorized|no_access_to_listing|invalid_|unsupported_|rate_limit|request_payload_conflict/.test(e.message||''))clear();throw e;}
 }
 return{state:()=>({pending:pending?clone(pending):null,invalid}),async save(payload){current();if(pending||invalid)throw Error('Check the previous save first.');pending=checked(payload);try{if(typeof storage?.setItem!=='function')throw Error();const bytes=JSON.stringify({actor,payload:pending});storage.setItem(key(),bytes);if(storage.getItem(key())!==bytes)throw Error();}catch{pending=null;throw Error('This device cannot retain a save reference. Use the Website editor instead.');}return retry();},retry,sync(){const next=getActor();if(next!==actor){actor=next;read();}},destroy(){pending=null;invalid=false;}};
}
export function mountEventHostControls(root,{core,workspace,event,storage=globalThis.sessionStorage,location=globalThis.location}={}){
 if(!HOST_UUID.test(workspace||'')||!HOST_UUID.test(event||''))throw Error('Choose one organiser workspace and event.');
 let actor=core.auth.load()?.user_id||null,epoch=0,dead=false,busy=false,snapshot=null,editor=null,dirty=false,loadTurn=0;
 const doc=root.ownerDocument,abort=new AbortController(),initialSearch=location.search,locked=new WeakMap();
 root.classList.add('event-host-controls');root.setAttribute('aria-label','Event organiser controls');
 const client=createEventAnnouncementClient({call:rpc,getActor:()=>core.auth.load()?.user_id||null,workspace,event,storage});
 function valid(turn,owner){return !dead&&root.isConnected&&epoch===turn&&actor===owner&&core.auth.load()?.user_id===owner&&location.search===initialSearch;}
 async function rpc(fn,args){const turn=epoch,owner=actor;if(!valid(turn,owner)||!owner)throw Error('Your account or event changed.');const fresh=await core.auth.ensureFresh();if(!valid(turn,owner))throw Error('Your account or event changed.');if(!fresh){const e=Error('not_authorized');e.status=401;throw e;}const r=await core.api.rpc(fn,args,{auth:'prefer'});if(!valid(turn,owner))throw Error('Your account or event changed.');return r;}
 function node(tag,text,parent=root){const n=doc.createElement(tag);if(text)n.textContent=text;parent.append(n);return n;}
 function button(label,action,parent=root){const n=node('button',label,parent);n.type='button';n.addEventListener('click',action,{signal:abort.signal});return n;}
 function lock(){const pending=client.state();root.querySelectorAll('input,button,select,textarea,fieldset').forEach(n=>{if(busy||pending.pending||pending.invalid){if(!locked.has(n))locked.set(n,n.disabled);n.disabled=true;}else if(locked.has(n)){n.disabled=locked.get(n);locked.delete(n);}});const retry=root.querySelector('[data-announcement-retry]');if(retry)retry.disabled=busy||pending.invalid;}
 function message(text){const n=root.querySelector('[data-host-status]');if(n)n.textContent=text;}
 function render(){root.replaceChildren();editor=null;if(!actor){node('p','Sign in to manage your own event announcements and permitted arrangements.');return;}
  const header=node('header'),tag=node('p','EVENT CONTROL DESK',header);tag.className='event-host-eyebrow';node('h2',snapshot?.identity.name||'Your event',header);node('p','Publish a dated update, then review the event’s real booking and payment settings.',header);
  const status=node('p','');status.dataset.hostStatus='';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const pending=client.state();if(pending.pending||pending.invalid){node('p','A previous announcement save needs confirmation before another edit. Its exact changes remain locked.');if(!pending.invalid){const b=button('Retry and confirm the same announcement',()=>act(async()=>{await client.retry();await load();message('Announcement save confirmed.');}));b.dataset.announcementRetry='';}else node('p','The saved reference cannot be verified. Use Website to review the current page; no new request is sent here.');}
  if(!snapshot){if(!pending.pending&&!pending.invalid)button('Load my event controls',()=>act(load));lock();return;}
  const actions=node('nav');actions.setAttribute('aria-label','Event owner tools');const guest=node('a','Open guest event page ↗',actions);guest.href=snapshot.event_url;guest.target='_blank';guest.rel='noopener noreferrer';
  const site=node('a','Open full Website editor',actions);site.href='/social/bizpage?workspace='+encodeURIComponent(workspace)+'&listing='+encodeURIComponent(event);
  button('Booking options & table setup',()=>{const target=doc.querySelector('[data-action="organizer-setup"]');if(target&&!target.disabled){target.click();doc.querySelector('[data-organizer-setup-host]')?.scrollIntoView({block:'start'});}else message('Table settings require the current event owner or administrator. Load allocations below, then retry; editorial access alone does not grant inventory access.');},actions);
  button('Allowed payment arrangements',()=>{const target=doc.querySelector('#parea-payment-arrangements');target?.scrollIntoView({block:'start'});target?.focus();if(!target)message('Open the current event’s allocation tools below to review permitted payment arrangements.');},actions);
  node('p','Table setup controls whether actual configured timed holds are enabled. Pay at the door remains unpaid; online collection is not connected. Editing a sales report does not change stock, prices or allocations.');
  const card=node('section');card.className='event-host-announcement';node('h3','What your guests will see',card);const preview=node('div',null,card);preview.dataset.hostGuestPreview='';
  const current=snapshot.profile.event_publicity;preview.innerHTML=renderSalesMilestone(current,[snapshot.event_url]);if(!preview.children.length)node('p','No current ticket-sales announcement is displayed.',preview);
  const edit=node('details');edit.open=!current&&!pending.pending&&!pending.invalid;node('summary','Edit ticket-sales announcement & event posts',edit);const slot=node('div',null,edit);slot.dataset.hostAnnouncementEditor='';
  let value=pending.pending?pending.pending.p_profile.event_publicity:current;try{if(value!==null&&value!==undefined){value=validatePublicity(value);if(value.event_url!==snapshot.event_url){node('p','The saved announcements refer to a different event link. Review the existing posts before saving them for this event.',slot);value={...value,event_url:snapshot.event_url};}}else value={event_url:snapshot.event_url,sales:null,highlights:[],posts:[]};}catch{value=current;}
  editor=mountPublicityEditor(slot,{value,onDirty:()=>{dirty=true;}});
  const explanation=slot.querySelector(':scope > p');if(explanation)explanation.textContent='Ticket counts are dated organiser reports, never live availability. Save event announcements publishes only these updates; other page details stay unchanged.';
  const scope=slot.querySelector('input[type=url]');if(scope&&scope.value===snapshot.event_url){scope.readOnly=true;scope.setAttribute('aria-label','Current event page link');}
  for(const section of slot.querySelectorAll(':scope > section')){const fold=doc.createElement('details'),summary=doc.createElement('summary');summary.textContent=section.querySelector('h4')?.textContent||'Event posts';section.before(fold);fold.append(summary,section);}
  const sales=slot.querySelector('details');if(sales)sales.open=true;
  const controls=node('div');controls.className='event-host-save';button('Save event announcements',()=>act(async()=>{const value=editor.read();if(value===undefined){message('No announcement changes to save.');return;}const payload=eventAnnouncementPayload(snapshot,value,crypto.randomUUID());await client.save(payload);await load();message('Event announcements saved. Open the guest page to see the published update.');}),controls);
  button('Reload saved event details',()=>{if(dirty&&!globalThis.confirm('Discard these unsaved announcement changes and reload?'))return;act(load);},controls);lock();
 }
 async function load(){const turn=epoch,id=++loadTurn;const status=await rpc('bizpage_status',{p_workspace:workspace});const identities=[...(status?.owned||[]),...(status?.claims||[])];const identity=identities.find(r=>(r.id||r.listing_id)===event);if(!identity)throw Error('no_access_to_listing');const raw=await rpc('home_content_get',{p_workspace:workspace,p_listing:event});if(turn!==epoch||id!==loadTurn||dead)return;snapshot=eventOwnerSnapshot(raw,workspace,event,{id:event,name:identity.name,slug:identity.slug});dirty=false;render();}
 async function act(fn){if(busy||dead)return;const turn=epoch;busy=true;lock();try{await fn();}catch(e){if(turn!==epoch||dead)return;if(e.status===401||e.status===403||/not_authorized|no_access_to_listing/.test(e.message||'')){snapshot=null;render();message('Only a currently authorized owner, administrator or editor can publish this event’s announcements.');}else if(e.message==='version_conflict'){snapshot=null;render();message('The event changed elsewhere. Reload current details before editing again.');}else {if(client.state().pending)render();message(client.state().pending?'Save result uncertain. Confirm the same request before making another change.':e.message||'Event controls could not load. Retry.');}}finally{if(turn===epoch&&!dead){busy=false;lock();}}}
 function account(){if(location.search!==initialSearch){destroy();return;}const next=core.auth.load()?.user_id||null;if(next===actor)return;actor=next;epoch++;loadTurn++;busy=false;snapshot=null;dirty=false;client.sync();render();if(actor)act(load);}
 function destroy(){if(dead)return;dead=true;epoch++;abort.abort();client.destroy();root.replaceChildren();}
 for(const event of ['zoi:auth-change','storage','focus','popstate'])globalThis.addEventListener(event,account,{signal:abort.signal});globalThis.addEventListener('pagehide',destroy,{once:true,signal:abort.signal});render();if(actor)act(load);return{refresh:()=>act(load),destroy};
}

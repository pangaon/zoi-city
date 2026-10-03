// Public table cards. Availability and holds are supplied by an authenticated,
// scoped adapter; source drawings alone never enable Reserve.
const states = new Set(['available','held','sold','unavailable','unconfigured']);
const uuid = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const text = (v,max=160) => typeof v === 'string' ? v.replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,max) : '';
const integer = v => Number.isSafeInteger(v) && v >= 0 ? v : null;
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function tableSponsor(raw,eventId,tableId,now=Date.now()) {
 if (!raw || raw.approved !== true || raw.event_id !== eventId || raw.table_id !== tableId) return null;
 const start=Date.parse(raw.starts_at),end=Date.parse(raw.ends_at);
 if(!Number.isFinite(start)||!Number.isFinite(end)||start>now||end<=now||end<=start) return null;
 let url;try{url=new URL(raw.url,'https://zoi.city');}catch{return null;}
 if(url.protocol!=='https:'||url.username||url.password||!text(raw.name))return null;
 return {name:text(raw.name),url:url.href};
}
export function tableCard(raw,{eventId,configured=false,now=Date.now()}={}) {
 if(!raw||!text(raw.id,100))throw new Error('Table identity is missing.');
 const capacity=integer(raw.capacity),minimum=integer(raw.min_party_size),version=integer(raw.pricing_version),price=integer(raw.per_guest_cents),currency=/^[A-Z]{3}$/.test(raw.currency||'')?raw.currency:null;
 const state=configured&&states.has(raw.state)?raw.state:'unconfigured';
 const fees=raw.fees_included===true?'included':raw.fees_included===false?'excluded':'unknown';
 return {id:text(raw.id,100),label:text(raw.label)||`Table ${text(raw.id,100)}`,capacity:capacity>0?capacity:null,min_party_size:minimum>0?minimum:1,pricing_version:version,per_guest_cents:price,currency,fees,
  total_cents:capacity>0&&price!==null&&Number.isSafeInteger(capacity*price)?capacity*price:null,state,
  sponsor:tableSponsor(raw.sponsor,eventId,raw.id,now)};
}
export function tableMoney(cents,currency){
 if(cents===null)return 'Not confirmed';
 if(!currency)return `${(cents/100).toLocaleString(undefined,{maximumFractionDigits:2})} · currency unconfirmed`;
 try{return new Intl.NumberFormat(undefined,{style:'currency',currency,currencyDisplay:'code'}).format(cents/100);}catch{return 'Not confirmed';}
}
export function tableHoldState(raw,{eventId,tableId,now=Date.now()}={}){
 if(!raw||raw.event_id!==eventId||raw.table_id!==tableId||!uuid(raw.hold_id))return null;
 const server=Date.parse(raw.server_time),expires=Date.parse(raw.expires_at);
 if(!Number.isFinite(server)||!Number.isFinite(expires)||!['active','expired','released','reserved','cancelled','invalidated'].includes(raw.status))return null;
 return {hold_id:raw.hold_id,event_id:eventId,table_id:tableId,status:raw.status,expires_at:expires,server_delta:server-now,party_size:integer(raw.party_size),total_cents:integer(raw.total_cents),currency:/^[A-Z]{3}$/.test(raw.currency||'')?raw.currency:null};
}
export function tableHoldSeconds(hold,now=Date.now()){
 return hold?.status==='active'?Math.max(0,Math.ceil((hold.expires_at-now-hold.server_delta)/1000)):0;
}
const storageKey=(actor,eventId)=>`zoi.table-hold.v1:${actor}:${eventId}`;
export function readTablePending(storage,actor,eventId){
 if(!uuid(actor)||!uuid(eventId))return null;
 const raw=storage.getItem(storageKey(actor,eventId));if(!raw)return null;
 let p;try{p=JSON.parse(raw);}catch{throw new Error('A saved request needs review before another hold.');}
 if(p.protocol!==1||p.actor!==actor||p.event_id!==eventId||!uuid(p.request_id)||!text(p.table_id,100)||!Number.isFinite(p.created_at)||!Number.isSafeInteger(p.party_size)||p.party_size<1||!Number.isSafeInteger(p.pricing_version)||p.pricing_version<1)throw new Error('A saved request needs review before another hold.');
 return {protocol:1,actor,event_id:eventId,request_id:p.request_id,table_id:p.table_id,party_size:p.party_size,pricing_version:p.pricing_version,created_at:p.created_at};
}
export function writeTablePending(storage,actor,eventId,tableId,requestId,partySize,pricingVersion,now=Date.now()){
 if(!uuid(actor)||!uuid(eventId)||!uuid(requestId)||!text(tableId,100)||!Number.isSafeInteger(partySize)||partySize<1||!Number.isSafeInteger(pricingVersion)||pricingVersion<1)throw new Error('Sign in again before requesting a hold.');
 const pending={protocol:1,actor,event_id:eventId,table_id:text(tableId,100),party_size:partySize,pricing_version:pricingVersion,request_id:requestId,created_at:now};
 storage.setItem(storageKey(actor,eventId),JSON.stringify(pending));return pending;
}

/**
 * Adapter contract (no default network or invented inventory):
 * map(eventId) -> {event_id,configured, tables:[public tableCard input]}
 * recover({eventId,requestId,tableId}) -> {found,hold?}; found:false is uncertain.
 * hold({eventId,requestId,tableId}) -> any; ALWAYS recover before rendering held.
 * release({eventId,holdId}) -> any; ALWAYS recover before rendering released.
 * hold contains event_id/table_id/hold_id/status/server_time/expires_at.
 */
export function mountTableAvailability({root,eventId,configured=false,tables=[],getActor=()=>null,api=null,onSignIn=()=>{},storage=globalThis.sessionStorage,authTarget=globalThis.window}={}){
 if(!root)throw new Error('A card container is required.');
 let partySize=1,suppressFocus=false;
 let records=tables,enabled=configured===true&&!!api&&uuid(eventId),actor=getActor(),epoch=0,selected=null,trigger=null,hold=null,pending=null,busy=false,message='',alive=true;
 const cleanups=[];
 root.classList.add('ta-card');root.hidden=true;root.setAttribute('aria-label','Table details');root.setAttribute('role','region');root.tabIndex=-1;
 function scope(){const next=getActor();if(next!==actor){actor=next;epoch++;hold=null;pending=null;busy=false;message='';root.replaceChildren();root.hidden=true;if(selected){message='Account changed. Review this table and select Reserve when ready.';render();}}return actor;}
 function current(e,a){scope();return alive&&e===epoch&&a===actor;}
 function card(){return selected?tableCard(selected,{eventId,configured:enabled}):null;}
 function render(){
  if(!alive||!selected)return;const c=card();root.hidden=false;
  let savedError='';try{pending=readTablePending(storage,actor,eventId);}catch(e){savedError=e.message;}
  const own=hold?.table_id===c.id?hold:null,seconds=tableHoldSeconds(own),status=own?.status==='active'?(seconds?'Held for you':'Hold time elapsed — refresh status'):own?.status==='reserved'?'Reservation recorded':({available:'Available to request',held:'Temporarily held',sold:'Sold',unavailable:'Unavailable',unconfigured:'Reservations not configured'}[c.state]);
  const locked=!!pending||!!savedError;
  partySize=Math.max(c.min_party_size,Math.min(c.capacity||1,partySize));
  const reservable=c.capacity&&c.min_party_size<=c.capacity&&c.pricing_version>0&&c.currency&&c.per_guest_cents!==null&&c.fees==='included';
  root.innerHTML=`<header><div><p class="ta-eyebrow">Your table</p><h3>${esc(c.label)}</h3></div><button type="button" data-ta="close" aria-label="Close table details">×</button></header><p class="ta-state" data-state="${c.state}">${esc(status)}</p><dl><div><dt>Capacity</dt><dd>${c.capacity?`${c.capacity} guests`:'Not confirmed'}</dd></div><div><dt>Per guest</dt><dd>${esc(tableMoney(c.per_guest_cents,c.currency))}</dd></div><div><dt>Full-table subtotal</dt><dd>${esc(tableMoney(c.total_cents,c.currency))}</dd></div><div><dt>Taxes & fees</dt><dd>${c.fees==='included'?'Included':c.fees==='excluded'?'Additional charges apply':'Not confirmed'}</dd></div></dl>${c.sponsor?`<aside class="ta-sponsor"><span>Sponsored</span><a href="${esc(c.sponsor.url)}" target="_blank" rel="noopener noreferrer">${esc(c.sponsor.name)} <span aria-hidden="true">↗</span></a></aside>`:''}${own?`<p class="ta-hold-summary">Your held party: ${own.party_size||'Not confirmed'} guests · ${esc(tableMoney(own.total_cents,own.currency))}</p>`:''}<p class="ta-timer" data-timer ${own?.status==='active'?'':'hidden'}>${seconds?`Hold ends in ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:'Refresh the server status before continuing.'}</p>${enabled&&c.state==='available'&&!own&&!locked&&reservable?`<label class="ta-party">Guests in your party<input data-party type="number" min="${c.min_party_size}" max="${c.capacity}" value="${partySize}" inputmode="numeric"><span>Whole table held exclusively. Your party subtotal: <strong data-party-total>${esc(tableMoney(c.per_guest_cents*partySize,c.currency))}</strong></span></label>`:''}<div class="ta-actions">${api&&uuid(eventId)?`<button type="button" data-ta="refresh" ${busy?'disabled':''}>Refresh status</button>`:''}${enabled&&c.state==='available'&&!own&&!locked&&reservable?`<button type="button" class="ta-primary" data-ta="reserve" ${busy?'disabled':''}>${actor?'Reserve — request timed hold':'Sign in to reserve'}</button>`:''}${own?.status==='active'&&seconds?`<button type="button" data-ta="release" ${busy?'disabled':''}>Release hold</button>`:''}${pending&&!hold?`<button type="button" data-ta="recover" ${busy?'disabled':''}>Check my pending request</button><button type="button" data-ta="retry" ${busy?'disabled':''}>Retry the same request</button>`:''}</div><p class="ta-notice" role="status" aria-live="polite">${esc(savedError||message||(locked&&!hold?'A previous request needs a server check. Another hold is blocked.':enabled?'Selecting a table does not reserve it. A hold is not a paid ticket.':'This drawing shows table choices, not live availability.'))}</p>`;
 }
 async function recover(){
  if(!actor)return null;
  const request=pending;
  const result=await api.recover({eventId,requestId:request?.request_id,tableId:request?.table_id});
  if(!result?.found)return null;
  const resolved=tableHoldState(result.hold,{eventId,tableId:request?.table_id||result.hold?.table_id});
  if(!resolved)throw new Error('The server status could not be verified. Keep this request and refresh.');
  if(!request&&resolved.status==='active')return {...resolved,recovered_request:result.request};
  return resolved;
 }
 async function action(kind){
  scope();if(busy||!selected||!api||(!enabled&&!['refresh','recover','retry'].includes(kind)))return;
  if(kind==='reserve'&&!actor){onSignIn({eventId,tableId:selected.id});message='After signing in, select Reserve again to request a hold.';render();return;}
  const a=actor,e=epoch;let firstSend=false;busy=true;message='Checking with the ticket server…';render();
  try{
   if(kind==='reserve'){
    const chosen=card();if(!chosen||chosen.state!=='available'||!Number.isSafeInteger(partySize)||partySize<chosen.min_party_size||partySize>chosen.capacity)throw new Error('Review your party size.');
    if(pending)throw new Error('Check your existing request before another hold.');
    pending=writeTablePending(storage,a,eventId,selected.id,crypto.randomUUID(),partySize,chosen.pricing_version);firstSend=true;
    await api.hold({eventId,requestId:pending.request_id,tableId:pending.table_id,partySize:pending.party_size,pricingVersion:pending.pricing_version});
   }else if(kind==='retry'&&pending){await api.hold({eventId,requestId:pending.request_id,tableId:pending.table_id,partySize:pending.party_size,pricingVersion:pending.pricing_version});}else if(kind==='release'&&hold){await api.release({eventId,holdId:hold.hold_id});}
   if(!current(e,a))return;
   const resolved=await recover();if(!current(e,a))return;
   if(resolved){if(resolved.recovered_request&&!pending){const r=resolved.recovered_request;pending=writeTablePending(storage,a,eventId,resolved.table_id,r.request_id,r.party_size,r.pricing_version);}hold=resolved;selected=records.find(t=>t.id===resolved.table_id)||selected;if(['expired','released','cancelled','invalidated'].includes(resolved.status)){storage.removeItem(storageKey(a,eventId));pending=null;hold=null;}}
   if(kind==='refresh'||kind==='recover'||kind==='release'){
    const map=await api.map(eventId);if(!current(e,a))return;
    if(map?.event_id!==eventId||!Array.isArray(map.tables))throw new Error('Availability could not be verified.');
    enabled=map.configured===true;records=map.tables;selected=records.find(t=>t.id===selected?.id)||{...selected,state:'unavailable'};
   }
   message=resolved?(resolved.status==='active'?'Your timed hold is confirmed by the server. No payment has been taken.':`Server status: ${resolved.status}.`):pending?'No confirmed result yet. Keep this request; do not start another.':'Availability refreshed.';
  }catch(error){if(current(e,a)){if(firstSend&&error?.definitive===true){storage.removeItem(storageKey(a,eventId));pending=null;enabled=false;message='The server refused this hold. Refresh availability before choosing again.';}else message='The request could not be confirmed. Check its status or retry the exact same request.';}}
  finally{if(current(e,a)){busy=false;if(selected)render();else{root.replaceChildren();root.hidden=true;}}}
 }
 const input=e=>{if(!e.target.matches('[data-party]'))return;partySize=Number(e.target.value);const c=card(),out=root.querySelector('[data-party-total]');if(out)out.textContent=Number.isInteger(partySize)&&partySize>=c.min_party_size&&partySize<=c.capacity?tableMoney(c.per_guest_cents*partySize,c.currency):'Choose a valid party size';const b=root.querySelector('[data-ta=reserve]');if(b)b.disabled=!Number.isInteger(partySize)||partySize<c.min_party_size||partySize>c.capacity;};
 const click=e=>{const b=e.target.closest('[data-ta]');if(!b)return;if(b.dataset.ta==='close')close();else action(b.dataset.ta);};
 function close(){root.hidden=true;suppressFocus=true;trigger?.focus?.();suppressFocus=false;}
 const key=e=>{if(e.key==='Escape'){e.preventDefault();close();}};
 root.addEventListener('input',input);root.addEventListener('click',click);root.addEventListener('keydown',key);
 const auth=()=>scope();authTarget?.addEventListener('zoi:auth-change',auth);
 const timer=setInterval(()=>{scope();const node=root.querySelector('[data-timer]');if(node&&hold?.status==='active'){const s=tableHoldSeconds(hold);node.textContent=s?`Hold ends in ${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`:'Hold time elapsed. Refresh the server status.';if(!s)root.querySelector('[data-ta="release"]')?.setAttribute('disabled','');}},1000);
 return {
  show(tableId,{trigger:opener,focus=false}={}){scope();const record=records.find(t=>t.id===tableId);if(!record)return false;selected=record;trigger=opener||null;render();if(focus)root.focus();return true;},
  bind(button,tableId){const show=()=>{if(!suppressFocus)this.show(tableId,{trigger:button});};const activate=()=>this.show(tableId,{trigger:button,focus:true});button.addEventListener('pointerenter',show);button.addEventListener('focus',show);button.addEventListener('click',activate);cleanups.push(()=>{button.removeEventListener('pointerenter',show);button.removeEventListener('focus',show);button.removeEventListener('click',activate);});},
  refresh:()=>action('refresh'),
  destroy(){alive=false;epoch++;clearInterval(timer);cleanups.forEach(fn=>fn());authTarget?.removeEventListener('zoi:auth-change',auth);root.removeEventListener('input',input);root.removeEventListener('click',click);root.removeEventListener('keydown',key);root.replaceChildren();root.hidden=true;hold=null;pending=null;}
 };
}

// Exact table API adapter; callers supply their existing scoped RPC client.
// Does not enable a page, create inventory, or infer table UUIDs from a drawing.
export function createTableAvailabilityApi(call){
 if(typeof call!=='function')throw new Error('A scoped RPC client is required.');
 const check=r=>{if(!r||r.ok!==true)throw new Error('Table status is unavailable.');return r;};
 return {
  async map(eventId){const r=check(await call('table_inventory_map',{p_event:eventId},true));if(r.event_id!==eventId||!Array.isArray(r.tables))throw new Error('Wrong event response.');return {event_id:eventId,configured:r.configured===true,tables:r.tables.map(t=>({id:t.table_id,label:t.label||t.source_label,capacity:t.capacity,min_party_size:t.min_party_size,per_guest_cents:t.price_per_guest_cents,currency:t.currency,pricing_version:t.pricing_version,fees_included:t.fees_included,state:t.availability}))};},
  async hold({eventId,tableId,partySize,pricingVersion,requestId}){try{return check(await call('table_hold_create',{p_event:eventId,p_table:tableId,p_party_size:partySize,p_expected_version:pricingVersion,p_request:requestId}));}catch(error){if(error?.code==='P0001'&&['invalid_request','table_inventory_unavailable','pricing_version_conflict','invalid_party_size','active_hold_exists','table_unavailable','hold_rate_limited'].includes(error.message)){const refusal=new Error('The server refused this hold.');refusal.definitive=true;throw refusal;}throw error;}},
  async recover({eventId,requestId,tableId}){const r=check(await call('table_hold_status',{p_event:eventId,p_request:requestId||null}));if(!Array.isArray(r.holds)||r.holds.length>(requestId?1:20))throw new Error('Invalid hold status.');const active=requestId?r.holds:r.holds.filter(h=>h.status==='active');if(active.length>1)throw new Error('Invalid hold status.');const h=active[0];if(!h)return {found:false};if((requestId&&h.request_id!==requestId)||h.event_id!==eventId||(tableId&&h.table_id!==tableId))throw new Error('Wrong hold response.');return {found:true,request:{request_id:h.request_id,party_size:h.party_size,pricing_version:h.pricing_version},hold:{hold_id:h.id,event_id:h.event_id,table_id:h.table_id,status:h.status,expires_at:h.expires_at,server_time:r.server_time,party_size:h.party_size,total_cents:h.total_cents,currency:h.currency}};},
  async release({holdId}){return check(await call('table_hold_release',{p_hold:holdId}));}
 };
}

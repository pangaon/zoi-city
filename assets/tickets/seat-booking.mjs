import {paintReferenceFloor,paintVenuePhoto} from './venue-evidence.mjs';
import {layoutViewImage} from './venue-reference.mjs';
import {parseLayout} from './venue-model.mjs';
import {createVenueClient} from './venue-api.mjs';
const eventId=new URL(location.href).searchParams.get('e');
if(eventId&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId))init();
function init(){
 const root=document.createElement('section');root.id='seat-booking';root.className='venue-studio';
 root.hidden=window.zoiTicketEventAvailable!==true;
 window.addEventListener('zoi:ticket-event',e=>{root.hidden=!e.detail.available;});
 document.getElementById('app').after(root);
 root.innerHTML=`<div class="vs-body" style="border-top:1px solid var(--line2)"><h2>Choose your seats</h2><p class="vs-intro">For events with a published seating plan, choose up to 10 seats. Sign in to hold your selection for five minutes and confirm a free reservation.</p><div class="vs-bar"><button id="sb-load" type="button">Check seat availability</button><button id="sb-release" type="button" hidden>Release my hold</button></div><div id="sb-auth" hidden><form id="sb-signin" class="vs-bar"><label>Email<input id="sb-email" type="email" autocomplete="email" required></label><button>Send sign-in code</button></form><form id="sb-verify" class="vs-bar" hidden><label>Sign-in code<input id="sb-code" inputmode="numeric" pattern="[0-9]{6,8}" maxlength="8" required></label><button>Verify code</button></form></div><div id="sb-map" class="vs-plan-wrap" hidden><div id="sb-floor" class="vs-plan"></div></div><p id="sb-reference-note" class="vs-intro"></p><div id="sb-photos" class="vs-evidence-photo"></div><p id="sb-selection" class="vs-selection"></p><button id="sb-hold" type="button" disabled>Hold selected seats</button><form id="sb-confirm" class="vs-bar" hidden><label>Your name<input id="sb-name" maxlength="120" autocomplete="name" required></label><label>Confirmation email<input id="sb-buyer-email" type="email" maxlength="160" autocomplete="email" required></label><button>Confirm free reservation</button></form><p id="sb-countdown" class="vs-selection"></p><p id="sb-status" class="vs-status" role="status" aria-live="polite"></p><div id="sb-receipt" class="vs-selection"></div></div>`;
 const $=id=>root.querySelector('#sb-'+id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const api=createVenueClient({getToken:()=>window.getAuth?.()?.access_token});
 let state=null,selected=new Set(),hold=null,busy=false,requestId=null,email='',serverDelta=0,lastRefresh=0;
 const message=(text,error=false)=>{$('status').textContent=text;$('status').dataset.error=String(error);};
 function render(){
  const signedIn=!!window.getAuth?.();$('auth').hidden=signedIn;
  $('release').hidden=!hold;$('confirm').hidden=!hold;$('hold').disabled=busy||!signedIn||!selected.size||!!hold;
  if(!state)return;
  const layout=state.layout,seats=new Map(state.seats.map(s=>[s.id,s]));
  $('map').hidden=false;$('floor').style.width='1000px';$('floor').style.aspectRatio=`${layout.width}/${layout.depth}`;
  $('floor').innerHTML=layout.objects.map(o=>{const seat=seats.get(o.id),available=seat?.state==='available';return `<button type="button" class="vs-object" data-id="${esc(o.id)}" data-kind="${o.kind}" data-accessible="${o.accessible}" data-excluded="${!available}" aria-pressed="${selected.has(o.id)}" aria-label="${esc(o.label)}, ${o.kind}${seat?', '+seat.state:''}${o.accessible?', accessible':''}" ${!available||hold?'disabled':''} style="left:${o.x/layout.width*100}%;top:${o.y/layout.depth*100}%;width:${o.width/layout.width*100}%;height:${o.depth/layout.depth*100}%">${esc(o.label)}</button>`;}).join('');
  paintReferenceFloor($('floor'),layout,t=>message(t,true));$('reference-note').textContent=layout.reference?'Organizer-provided floor-plan reference, calibrated using the organizer’s measurements. The layout is a geometric plan, not a surveyed or photorealistic reconstruction.':'';$('photos').replaceChildren();for(const id of selected){const object=layout.objects.find(o=>o.id===id),photo=layoutViewImage(layout,object);if(photo){const box=document.createElement('div');paintVenuePhoto(box,photo);$('photos').append(box);}}
  $('selection').textContent=selected.size?'Selected: '+[...selected].map(id=>seats.get(id)?.label||id).join(', '):'Available seats can be selected. Held and reserved seats are unavailable.';
 }
 async function action(fn){if(busy)return;busy=true;root.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){message(e.message,true);}finally{busy=false;root.querySelectorAll('button').forEach(b=>b.disabled=false);render();}}
 async function load(){
  const data=await api('tickets_seat_map',{p_event:eventId},true);
  if(!data.available){state=null;hold=null;selected.clear();requestId=null;$('map').hidden=true;$('photos').replaceChildren();$('reference-note').textContent='';$('selection').textContent='';$('countdown').textContent='';message('This event does not have a published seating plan. Use the ticket tiers above.');return;}
  state={...data,layout:parseLayout(JSON.stringify(data.layout))};
  if(!hold)selected=new Set([...selected].filter(id=>state.seats.some(s=>s.id===id&&s.state==='available')));
  if(window.getAuth?.()){
   const status=await api('tickets_seat_status',{p_event:eventId});
   serverDelta=Date.parse(status.server_time)-Date.now();if(!Number.isFinite(serverDelta))serverDelta=0;
   hold=status.active_hold||null;if(hold)selected=new Set(hold.seat_ids);
   $('receipt').innerHTML=(status.reservations||[]).map(r=>`<div class="vs-cloud"><h3>${r.status==='cancelled'?'Cancelled reservation':'Reservation confirmed'}</h3><p>Code: <strong>${esc(r.receipt.code)}</strong></p><p>Seats: ${esc(r.seat_ids.map(id=>state.seats.find(s=>s.id===id)?.label||id).join(', '))} · Free</p>${r.status==='reserved'?`<button type="button" data-cancel="${esc(r.hold_id)}">Cancel reservation</button>`:''}</div>`).join('');
  }
  lastRefresh=Date.now();
  window.zoiSeating={event_id:eventId,ticket_type_id:String(data.ticket_type_id)};
  if(typeof window.paintPublic==='function')window.paintPublic();
  message('Availability loaded from the ticket server. Selecting a seat does not hold it until you confirm the hold.');
 }
  $('receipt').addEventListener('click',e=>{const button=e.target.closest('[data-cancel]');if(!button)return;if(!confirm('Cancel this reservation and make its seats available again?'))return;action(async()=>{const result=await api('tickets_seat_cancel',{p_hold_id:button.dataset.cancel});if(!result.cancelled)throw new Error('Cancellation was not confirmed. Refresh your reservation status.');await load();message('Reservation cancelled and seats released.');});});
 $('load').addEventListener('click',()=>action(load));
 $('floor').addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(!b||b.disabled)return;const id=b.dataset.id;if(selected.has(id))selected.delete(id);else{if(selected.size>=10){message('Choose up to 10 seats.',true);return;}selected.add(id);}requestId=null;render();root.querySelector(`[data-id="${id}"]`)?.focus();});
 $('hold').addEventListener('click',()=>action(async()=>{requestId ||= crypto.randomUUID();const result=await api('tickets_seat_hold',{p_event:eventId,p_seat_ids:[...selected],p_request_id:requestId});if(!result?.ok||!result.hold_id||!Number.isFinite(Date.parse(result.expires_at)))throw new Error('The seat hold was not confirmed. Refresh before retrying.');hold=result;message('Your seats are held. Confirm your details before the hold expires.');}));
 $('release').addEventListener('click',()=>action(async()=>{await api('tickets_seat_release',{p_hold_id:hold.hold_id});hold=null;requestId=null;selected.clear();$('countdown').textContent='';await load();message('Seat hold released.');}));
 $('confirm').addEventListener('submit',e=>{e.preventDefault();action(async()=>{const receipt=await api('tickets_seat_reserve',{p_hold_id:hold.hold_id,p_name:$('name').value.trim(),p_email:$('buyer-email').value.trim()});if(!receipt?.ok||!receipt.code||Number(receipt.amount_cents)!==0)throw new Error('Reservation was not confirmed. Keep your hold and refresh before retrying.');const labels=state.seats.filter(s=>receipt.seat_ids?.includes(s.id)).map(s=>s.label);$('receipt').innerHTML=`<h3>Reservation confirmed</h3><p>Confirmation code: <strong>${esc(receipt.code)}</strong></p><p>Seats: ${esc(labels.join(', '))} · Free</p><p>Keep this code for entry.</p>`;hold=null;requestId=null;selected.clear();$('countdown').textContent='';await load();message('Your free reservation is confirmed.');});});
 $('signin').addEventListener('submit',e=>{e.preventDefault();action(async()=>{email=$('email').value.trim();await window.sendOtp(email);$('verify').hidden=false;message('Sign-in code sent. Enter it below.');$('code').focus();});});
 $('verify').addEventListener('submit',e=>{e.preventDefault();action(async()=>{await window.verifyOtp(email,$('code').value.trim());$('buyer-email').value=email;if(state)await load();message('Signed in. Choose your seats and request a hold.');});});
 const timer=setInterval(()=>{if(!hold)return;const seconds=Math.max(0,Math.ceil((Date.parse(hold.expires_at)-Date.now()-serverDelta)/1000));$('countdown').textContent=`Hold expires in ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;if(!seconds){hold=null;requestId=null;selected.clear();state=null;$('map').hidden=true;render();message('Your hold expired. Refresh availability before choosing seats again.',true);}},1000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state&&Date.now()-lastRefresh>15000)action(load);});
 addEventListener('pagehide',e=>{if(!e.persisted)clearInterval(timer);});render();
}

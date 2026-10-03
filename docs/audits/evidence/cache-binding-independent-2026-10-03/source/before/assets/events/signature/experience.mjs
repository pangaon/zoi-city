import {publicPublicity} from '../publicity.mjs';
import {openPosterDialog} from '../../sharing/poster-dialog.mjs';
import {mountSignatureCustomer} from './customer-a.mjs?v=20261003-host-authority';
import {mountVenueExperience} from './venue-experience.mjs?v=20261003-company-parea-rooms';
import {mountGuestPlanning} from '../guest-planning.mjs';
const C=window.ZoiCore,customerRoot=document.querySelector('#signature-customer'),venueRoot=document.querySelector('#signature-room'),saveRoot=document.querySelector('#signature-save');
let customer,venue,planTools,shareDialog,disposed=false;
const actor=()=>{try{return (C.auth.load(),C.auth.isSignedIn())?C.auth.load()?.user_id||null:null;}catch{return null;}};
let lastActor=actor();
function mount(){const eventSlug=location.pathname.split('/').filter(Boolean).at(-1);let mountedVenue;
 customer=mountSignatureCustomer({root:customerRoot,C,onPlanSave:()=>{planTools.requestSave();saveRoot.scrollIntoView({block:'center'});},resolveEvent:()=>C.api.rpc('home_entity',{p_slug:eventSlug},{auth:'anon'}),onEventIdentity:entity=>{if(disposed||venue!==mountedVenue)return;customer.setPublicity(publicPublicity(entity),['https://www.zoi.city/event/'+encodeURIComponent(eventSlug),'https://www.zoi.city/events/'+encodeURIComponent(eventSlug)+'/',entity.website]);mountedVenue.connectPlacements(entity.id,(fn,args)=>C.api.rpc(fn,args,{auth:'anon'}));}});
 planTools=mountGuestPlanning({root:saveRoot,planner:customer,C});
 venue=mountVenueExperience({root:venueRoot,onSelection:selection=>customer.setTableSelection(selection.table_ids),onRequest:selection=>{customer.setTableSelection(selection.table_ids);customer.showGroupSetup();document.querySelector('#sig-request').scrollIntoView({block:'start'});}});mountedVenue=venue;
 customerRoot.querySelector('[data-share-event]')?.addEventListener('click',event=>{shareDialog?.destroy();shareDialog=openPosterDialog({title:'Giannis Ploutarchos & Andromache · Toronto · 20 March 2027',url:'https://www.zoi.city/events/giannis-ploutarchos-andromache-toronto-2027/',poster:'/assets/events/signature/poster.jpg'},{opener:event.currentTarget});});
 customerRoot.querySelectorAll('.sig-a-nav a[href="#sig-request"],.sig-a-title a[href="#sig-request"]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();document.querySelector('#sig-request').scrollIntoView({block:'start'});customer.showGroupSetup();}));
 const explore=customerRoot.querySelector('[data-floor]');explore.textContent='Explore tables & lounges ↓';explore.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();venue.enterFullscreen();venueRoot.querySelector('h2')?.setAttribute('tabindex','-1');venueRoot.querySelector('[data-theater]')?.focus({preventScroll:true});});
 // Put the interactive room between the event hero and the planning form.
 customerRoot.querySelector('.sig-a-plan').before(venueRoot);
}
function clearViews(){shareDialog?.destroy();shareDialog=null;planTools?.destroy();venueRoot.remove();venue?.destroy();customer?.();planTools=venue=customer=null;}
function authChanged(){if(disposed||lastActor===actor())return;lastActor=actor();clearViews();mount();}
window.addEventListener('zoi:auth-change',authChanged);window.addEventListener('storage',authChanged);window.addEventListener('focus',authChanged);
window.addEventListener('pagehide',event=>{if(event.persisted)return;disposed=true;clearViews();});
window.addEventListener('pageshow',event=>{if(!event.persisted)return;if(disposed){disposed=false;lastActor=actor();mount();}else authChanged();});
mount();

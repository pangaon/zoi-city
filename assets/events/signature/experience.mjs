import {mountSignatureCustomer} from './customer-a.mjs';
import {mountVenueExperience} from './venue-experience.mjs';
import {createPrivatePlan} from './private-plan.mjs';
const C=window.ZoiCore,customerRoot=document.querySelector('#signature-customer'),venueRoot=document.querySelector('#signature-room'),saveRoot=document.querySelector('#signature-save');
let customer,venue,adapter,disposed=false;
const actor=()=>{try{return (C.auth.load(),C.auth.isSignedIn())?C.auth.load()?.user_id||null:null;}catch{return null;}};
let lastActor=actor();
function action(label,callback){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await callback();}finally{if(b.isConnected)b.disabled=false;}};saveRoot.querySelector('[data-save-actions]').append(b);return b;}
function state(value){if(disposed)return;saveRoot.querySelector('[data-save-status]').textContent=value.message;saveRoot.querySelector('[data-save-actions]').replaceChildren();
 if(value.reason==='sign_in_required'){const a=document.createElement('a');a.href='/social/';a.textContent='Sign in to save';saveRoot.querySelector('[data-save-actions]').append(a);}
 if(value.phase==='uncertain'){action('Retry the same save',()=>adapter.retry());action('Check save',()=>adapter.check());}
 if(value.phase==='recovery_required'){action('Review saved plans',()=>adapter.list());}
 if(['ready','saved','loaded','error'].includes(value.phase)&&actor()){action('Review saved plans',()=>adapter.list());action('Check pending save',()=>adapter.check());}
 if(value.phase==='listed'){for(const plan of value.plans||[]){action(plan.title||'Open saved plan',()=>adapter.load(plan.id));}}
 if(value.reviewPlan||value.phase==='loaded'){const details=document.createElement('details'),summary=document.createElement('summary'),text=document.createElement('textarea');summary.textContent='Read saved plan';text.readOnly=true;text.setAttribute('aria-label','Saved private group plan');text.value=(value.reviewPlan||value.plan)?.data?.private_notes||'';details.append(summary,text);saveRoot.querySelector('[data-save-actions]').append(details);}
}
function requestContact(data){
 if(!actor()){state({phase:'error',reason:'sign_in_required',message:'Sign in to save your private plan. Your group details remain on this page.'});return;}
 const contactActor=actor(),saveAdapter=adapter;
 state({phase:'contact',message:'Add your contact details to your private plan. Nothing is sent to the organizer.'});
 const form=document.createElement('form');form.className='signature-contact';
 const nameLabel=document.createElement('label'),name=document.createElement('input'),emailLabel=document.createElement('label'),email=document.createElement('input'),submit=document.createElement('button'),note=document.createElement('p');
 nameLabel.textContent='Your name';name.name='customer_name';name.type='text';name.required=true;name.maxLength=120;name.autocomplete='name';nameLabel.append(name);
 emailLabel.textContent='Your email';email.name='customer_email';email.type='email';email.required=true;email.maxLength=160;email.autocomplete='email';emailLabel.append(email);
 submit.type='submit';submit.textContent='Save private plan';note.textContent='Saved only to your account. This does not send a ticket request, hold a table or collect payment.';
 form.append(nameLabel,emailLabel,note,submit);saveRoot.querySelector('[data-save-actions]').append(form);
 form.addEventListener('submit',async event=>{event.preventDefault();if(disposed||actor()!==contactActor||adapter!==saveAdapter)return;if(!form.reportValidity())return;submit.disabled=true;try{await saveAdapter.save({...data,customer_name:name.value.trim(),customer_email:email.value.trim()});}finally{if(submit.isConnected)submit.disabled=false;}});
 name.focus({preventScroll:true});
}
function mount(){adapter=createPrivatePlan({C,onState:state});customer=mountSignatureCustomer({root:customerRoot,onPlanSave:async data=>{requestContact(data);saveRoot.scrollIntoView({block:'center'});}});venue=mountVenueExperience({root:venueRoot,onSelection:selection=>customer.setTableSelection(selection.table_ids),onRequest:selection=>{customer.setTableSelection(selection.table_ids);customer.showGroupSetup();document.querySelector('#sig-request').scrollIntoView({block:'start'});}});
 const explore=customerRoot.querySelector('[data-floor]');explore.textContent='Explore tables & lounges ↓';explore.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();venueRoot.scrollIntoView({block:'start'});venueRoot.querySelector('h2')?.setAttribute('tabindex','-1');venueRoot.querySelector('h2')?.focus({preventScroll:true});});
 // Put the interactive room between the event hero and the planning form.
 customerRoot.querySelector('.sig-a-plan').before(venueRoot);
}
function clearViews(){adapter?.destroy();venueRoot.remove();venue?.destroy();customer?.();saveRoot.querySelector('[data-save-actions]').replaceChildren();adapter=venue=customer=null;}
function authChanged(){if(disposed||lastActor===actor())return;lastActor=actor();clearViews();mount();state({phase:'ready',message:'Account changed. Private names and plan details have been cleared from this page.'});}
window.addEventListener('zoi:auth-change',authChanged);window.addEventListener('storage',authChanged);window.addEventListener('focus',authChanged);
window.addEventListener('pagehide',()=>{disposed=true;clearViews();saveRoot.querySelector('[data-save-status]').textContent='Private details cleared while this page is away.';});
window.addEventListener('pageshow',event=>{if(!event.persisted||!disposed)return;disposed=false;lastActor=actor();mount();state({phase:'ready',message:'Welcome back. Private names were cleared; check a pending save or review your saved plans.'});});
mount();state({phase:'ready',message:'Save your plan privately when you’re ready. Choosing a table is a preference, not a reservation.'});

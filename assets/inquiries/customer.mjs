import {UUID,esc,errorText} from './model.mjs';import {mount} from './workspace.mjs?v=20260930-inquiry-recovery';
const root=document.querySelector('#inquiries-app'),C=window.ZoiCore,listing=new URL(location.href).searchParams.get('listing');let email='',busy=false,generation=0,actor=C.auth.load()?.user_id||null;
async function load(){
 const epoch=++generation;root.__zoiInquiryDispose?.();email='';busy=false;root.innerHTML='<p role="status">Loading enquiries…</p>';
 const current=()=>epoch===generation;
 if(listing&&!UUID.test(listing)){root.innerHTML='<h1>Invalid enquiry link</h1><p>Open the contact link on the business page.</p>';return;}
 let availability=null;if(listing){try{availability=await C.api.rpc('inquiry_availability',{p_listing:listing},{auth:'anon'});}catch{if(!current())return;root.innerHTML='<h1>Enquiries could not load</h1><p>We could not check this business right now.</p><button data-retry>Try again</button><a href="/inquiries/">Your existing conversations</a>';root.querySelector('[data-retry]').addEventListener('click',load);return;}if(!current())return;if(availability?.available!==true){root.innerHTML='<h1>Enquiries unavailable</h1><p>This business has not enabled customer enquiries here. Use the contact details on its business page.</p><a href="/inquiries/">Your existing conversations</a>';return;}}
 if(!current())return;if(C.auth.isSignedIn()){root.className='';await mount(root,{C,listing});return;}
 root.innerHTML=`<h1>${availability?'Contact '+esc(availability.name):'Your enquiries'}</h1><p>Sign in to send a private enquiry and read replies from the business team. No external notifications are sent.</p><div role="status" aria-live="polite" id="status"></div><form id="signin"><label>Email<input type="email" name="email" required autocomplete="email"></label><button>Send sign-in code</button></form><form id="verify" hidden><label>Sign-in code<input name="code" inputmode="numeric" pattern="[0-9]{6,8}" required autocomplete="one-time-code"></label><button>Verify</button></form>`;
 async function act(fn){if(busy||!current())return;busy=true;const buttons=[...root.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{await fn();}catch(error){if(current()&&root.querySelector('#status'))root.querySelector('#status').textContent=errorText(error);}finally{if(current()){busy=false;buttons.forEach(b=>b.disabled=false);}}}
 root.querySelector('#signin').addEventListener('submit',event=>{event.preventDefault();act(async()=>{email=new FormData(event.target).get('email').trim();await C.otp.send(email);if(!current())return;root.querySelector('#verify').hidden=false;root.querySelector('#status').textContent='Sign-in code sent.';});});
 root.querySelector('#verify').addEventListener('submit',event=>{event.preventDefault();act(async()=>{await C.otp.verify(email,new FormData(event.target).get('code').trim());if(current()){actor=C.auth.load()?.user_id||null;await load();}});});
}
function account(){const next=C.auth.load()?.user_id||null;if(next===actor)return;actor=next;load();}
for(const name of ['zoi:auth-change','storage','focus'])addEventListener(name,account);
load();

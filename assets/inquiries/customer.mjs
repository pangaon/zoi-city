import {UUID,esc,errorText} from './model.mjs';import {mount} from './workspace.mjs';
const root=document.querySelector('#inquiries-app'),C=window.ZoiCore,listing=new URL(location.href).searchParams.get('listing');let email='',busy=false;
async function load(){
 if(listing&&!UUID.test(listing)){root.innerHTML='<h1>Invalid enquiry link</h1><p>Open the contact link on the business page.</p>';return;}
 let availability=null;if(listing){availability=await C.api.rpc('inquiry_availability',{p_listing:listing},{auth:'anon'});if(availability?.available!==true){root.innerHTML='<h1>Enquiries unavailable</h1><p>This business has not enabled customer enquiries here. Use the contact details on its business page.</p><a href="/inquiries/">Your existing conversations</a>';return;}}
 if(C.auth.isSignedIn()){root.className='';await mount(root,{C,listing});return;}
 root.innerHTML=`<h1>${availability?'Contact '+esc(availability.name):'Your enquiries'}</h1><p>Sign in to send a private enquiry and read replies from the business team. No external notifications are sent.</p><div role="status" aria-live="polite" id="status"></div><form id="signin"><label>Email<input type="email" name="email" required autocomplete="email"></label><button>Send sign-in code</button></form><form id="verify" hidden><label>Sign-in code<input name="code" inputmode="numeric" pattern="[0-9]{6,8}" required autocomplete="one-time-code"></label><button>Verify</button></form>`;
 root.querySelector('#signin').addEventListener('submit',event=>{event.preventDefault();act(async()=>{email=new FormData(event.target).get('email').trim();await C.otp.send(email);root.querySelector('#verify').hidden=false;root.querySelector('#status').textContent='Sign-in code sent.';});});
 root.querySelector('#verify').addEventListener('submit',event=>{event.preventDefault();act(async()=>{await C.otp.verify(email,new FormData(event.target).get('code').trim());await load();});});
}
async function act(fn){if(busy)return;busy=true;const buttons=[...root.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{await fn();}catch(error){const status=root.querySelector('#status');if(status)status.textContent=errorText(error);else root.textContent=errorText(error);}finally{busy=false;buttons.forEach(b=>b.disabled=false);}}
act(load);

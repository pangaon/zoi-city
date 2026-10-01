import {mount} from './studio.mjs?v=20261001-creator-recovery';
import {errorText} from './model.mjs';
const root=document.querySelector('#creator-app'),C=window.ZoiCore;
let generation=0,actor=C.auth.load()?.user_id||null;
async function load(){
 const epoch=++generation;root.__zoiCreatorDispose?.();
 const initialActor=C.auth.load()?.user_id||null;
 const current=()=>epoch===generation&&(C.auth.load()?.user_id||null)===initialActor;
 let email='',busy=false;
 root.innerHTML='<p role="status">Loading shared work…</p>';
 if(C.auth.isSignedIn()){try{await mount(root,{C});}catch(error){if(current())root.textContent=errorText(error);}return;}
 root.innerHTML='<section class="zinq"><h1>Shared briefs & deliveries</h1><p>Sign in with the same account you used for your enquiry to read the creator’s shared brief and respond.</p><div id="status" role="status" aria-live="polite"></div><form id="signin"><label>Email<input name="email" type="email" autocomplete="email" required></label><button>Send sign-in code</button></form><form id="verify" hidden><label>Sign-in code<input name="code" inputmode="numeric" pattern="[0-9]{6,8}" autocomplete="one-time-code" required></label><button>Verify</button></form></section>';
 async function act(fn){if(busy||!current())return;busy=true;const buttons=[...root.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{await fn();}catch(error){if(current()){const node=root.querySelector('#status');if(node)node.textContent=errorText(error);}}finally{busy=false;if(current())buttons.forEach(b=>b.disabled=false);}}
 root.querySelector('#signin').addEventListener('submit',event=>{event.preventDefault();act(async()=>{email=new FormData(event.target).get('email').trim();await C.otp.send(email);if(!current())return;root.querySelector('#verify').hidden=false;root.querySelector('#status').textContent='Sign-in code sent.';});});
 root.querySelector('#verify').addEventListener('submit',event=>{event.preventDefault();act(async()=>{await C.otp.verify(email,new FormData(event.target).get('code').trim());if(epoch===generation){actor=C.auth.load()?.user_id||null;await load();}});});
}
function account(){const next=C.auth.load()?.user_id||null;if(next===actor)return;actor=next;load();}
for(const name of ['zoi:auth-change','zoi:authchange','storage','focus'])addEventListener(name,account);
load();

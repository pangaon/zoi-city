import {HOST_UUID} from './host-allocation-client.mjs';
import {mountContactPicker,confirmedContact} from '../contacts/picker.mjs';
export function invitationMessage(url,{origin,title='Your table allocation'}={}){
 const u=new URL(url);if(u.origin!==origin||u.protocol!=='https:'||u.pathname!=='/tickets/hosts/'||u.username||u.password||!/^#claim=[a-f0-9]{64}$/.test(u.hash))throw Error('Invalid private invitation.');
 const event=u.searchParams.get('event');if([...u.searchParams.keys()].some(k=>k!=='event')||u.searchParams.getAll('event').length>1||(u.searchParams.has('event')&&!HOST_UUID.test(event||'')))throw Error('Invalid invitation context.');
 const heading=String(title).replace(/[\r\n\u0000-\u001f]/g,' ').trim().slice(0,120);
 return `${heading}\nHere is your private link to review your ticket allocation. Sign in to see the details before accepting. This is not a payment or admission ticket.\n${u.href}\nPlease keep this link private.`;
}
export function invitationChannels(contact,message,{ios=false}={}){
 const c=confirmedContact(contact);let phone=null;if(c.tel){if(!/^\+?[0-9 ()\-.]+$/.test(c.tel))throw Error('Use a mobile number without an extension for a text invitation.');phone=c.tel.replace(/[ ()\-.]/g,'');if(!/^\+?[0-9]{7,15}$/.test(phone))throw Error('Check the mobile number, including its country code where needed.');}return {
 email:c.email?'mailto:'+encodeURIComponent(c.email)+'?subject='+encodeURIComponent('Your table allocation')+'&body='+encodeURIComponent(message):null,
 sms:phone?'sms:'+phone+(ios?'&':'?')+'body='+encodeURIComponent(message):null
 };
}
export function mountInvitationShare(root,{url,origin=location.origin,title}={}){
 const message=invitationMessage(url,{origin,title}),abort=new AbortController();let picker=null,dead=false;
 root.classList.add('host-invite-share');root.innerHTML='<button type="button" data-compose aria-expanded="false">Text or email this link</button><section data-contact-area hidden><h3>Choose your recipient</h3><p>Pick one contact where supported, or enter their details. You review and send in your own messaging app.</p><p>Your device may open a blank text message. Copy the invitation below if needed.</p><button type="button" data-copy-message>Copy invitation message</button><p data-copy-status role="status"></p><details><summary>View invitation message</summary><textarea data-message readonly aria-label="Invitation message" rows="7"></textarea></details><div data-picker></div><div data-channels hidden><h4>Ready to share</h4><p data-recipient></p><div class="host-actions"></div><p>No message has been sent by Zoi. This link is not locked to an email or phone number; send it only to your intended guest.</p></div></section>';
 root.querySelector('[data-message]').value=message;
 root.querySelector('[data-copy-message]').addEventListener('click',async()=>{const status=root.querySelector('[data-copy-status]');try{await navigator.clipboard.writeText(message);if(!dead)status.textContent='Invitation copied. Paste it into your message and review before sending.';}catch{if(dead)return;status.textContent='Copy is unavailable. Select and copy the invitation message below.';const field=root.querySelector('[data-message]');field.closest('details').open=true;field.focus();field.select();}},{signal:abort.signal});
 function clearRecipient(){const target=root.querySelector('[data-channels]');target.hidden=true;target.querySelector('.host-actions').replaceChildren();target.querySelector('[data-recipient]').textContent='';}
 for(const event of ['input','change'])root.addEventListener(event,clearRecipient,{signal:abort.signal});
 root.addEventListener('click',e=>{if(e.target.closest('[data-phone],[data-manual]'))clearRecipient();},{signal:abort.signal});
 // This self-contained form must not trigger the enclosing host allocation controls.
 root.addEventListener('click',e=>e.stopPropagation(),{signal:abort.signal});root.addEventListener('submit',e=>e.stopPropagation(),{signal:abort.signal});
 root.querySelector('[data-compose]').addEventListener('click',()=>{if(dead)return;const area=root.querySelector('[data-contact-area]');area.hidden=!area.hidden;root.querySelector('[data-compose]').setAttribute('aria-expanded',String(!area.hidden));if(area.hidden||picker)return;picker=mountContactPicker({root:root.querySelector('[data-picker]'),onUse:contact=>{if(dead)return;const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),links=invitationChannels(contact,message,{ios}),target=root.querySelector('[data-channels]');target.hidden=false;target.querySelector('[data-recipient]').textContent=contact.name;const actions=target.querySelector('.host-actions');actions.replaceChildren();for(const [key,label]of[['sms','Open text message'],['email','Open email']])if(links[key]){const a=document.createElement('a');a.href=links[key];a.textContent=label;a.className='host-compose-link';a.rel='noreferrer';actions.append(a);}actions.querySelector('a')?.focus();}});},{signal:abort.signal});
 return()=>{dead=true;abort.abort();picker?.destroy();root.replaceChildren();root.classList.remove('host-invite-share');};
}

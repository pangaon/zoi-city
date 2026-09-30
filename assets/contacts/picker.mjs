/** Selected-contact import only. No network, address-book enumeration or storage. */
const clean=(value,max)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max):'';
export function contactOptions(raw){
 if(!raw||typeof raw!=='object')throw Error('invalid_contact');
 const values=(key,max,valid=()=>true)=>[...new Set((Array.isArray(raw[key])?raw[key]:[]).slice(0,20).map(v=>clean(v,max)).filter(v=>v&&valid(v)))];
 return{name:values('name',120),email:values('email',254,v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)),tel:values('tel',50,v=>/^[+\d ()\-.xext]{3,50}$/i.test(v)&&v.replace(/\D/g,'').length>=3)};
}
export function confirmedContact(raw){
 const name=clean(raw?.name,120),email=clean(raw?.email,254),tel=clean(raw?.tel,50);
 if(!name)throw Error('Enter a contact name.');
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Check the email address.');
 if(tel&&(!/^[+\d ()\-.xext]{3,50}$/i.test(tel)||tel.replace(/\D/g,'').length<3))throw Error('Check the phone number.');
 if(!email&&!tel)throw Error('Choose or enter an email address or phone number.');
 return{name,email:email||null,tel:tel||null};
}
export function createContactPicker({navigatorObject=globalThis.navigator,windowObject=globalThis.window}={}){
 let props=[],dead=false,working=false;
 const supported=()=>{try{return !!windowObject?.isSecureContext&&windowObject.top===windowObject.self&&typeof navigatorObject?.contacts?.select==='function'&&typeof navigatorObject?.contacts?.getProperties==='function';}catch{return false;}};
 return{
  async prepare(){if(!supported())return false;try{const available=await navigatorObject.contacts.getProperties();if(dead)return false;props=['name','email','tel'].filter(p=>available.includes(p));return props.includes('email')||props.includes('tel');}catch{return false;}},
  async select(){
   if(dead||working||!supported()||!props.some(p=>p==='email'||p==='tel'))return{status:'unavailable'};
   if(navigatorObject.userActivation&&navigatorObject.userActivation.isActive===false)return{status:'gesture_required'};
   working=true;
   try{
    // Keep this invocation before any await: it must run in the user's gesture.
    const pending=navigatorObject.contacts.select([...props],{multiple:false});
    const contacts=await pending;if(dead)return{status:'cancelled'};
    if(!Array.isArray(contacts)||contacts.length===0)return{status:'cancelled'};
    if(contacts.length!==1)return{status:'error'};
    return{status:'selected',contact:contactOptions(contacts[0])};
   }catch(error){return{status:error?.name==='AbortError'?'cancelled':'error'};}
   finally{working=false;}
  },
  destroy(){dead=true;props=[];}
 };
}
export function mountContactPicker({root,onUse,navigatorObject=globalThis.navigator,windowObject=globalThis.window}={}){
 if(!root||typeof onUse!=='function')throw Error('contact_picker_config');
 if(!document.querySelector('link[data-contact-picker]')){const css=document.createElement('link');css.rel='stylesheet';css.href='/assets/contacts/picker.css';css.dataset.contactPicker='';document.head.append(css);}
 const api=createContactPicker({navigatorObject,windowObject});let dead=false,busy=false;
 root.classList.add('z-contact-picker');
 root.innerHTML='<div class="zcp-actions"><button type="button" data-phone hidden>Choose from phone contacts</button><button type="button" data-manual>Enter details</button></div><p data-status role="status" aria-live="polite">Enter a contact below.</p><form><div data-fields></div><button type="submit">Use these details</button></form><small>Only the details you confirm are used. Nothing is sent here.</small>';
 const form=root.querySelector('form'),fields=root.querySelector('[data-fields]'),status=root.querySelector('[data-status]'),button=root.querySelector('[data-phone]');
 function show(options=null){fields.replaceChildren();for(const [key,label]of[['name','Name'],['email','Email'],['tel','Phone']]){const wrap=document.createElement('label');wrap.append(label);let field;const list=options?.[key]||[];if(list.length){field=document.createElement('select');field.append(new Option(key==='name'?'Choose a name':'Do not use this field',''));for(const value of list)field.append(new Option(value,value));}else{field=document.createElement('input');field.type=key==='name'?'text':key==='tel'?'tel':'email';field.maxLength=key==='name'?120:key==='email'?254:50;field.autocomplete='off';}field.name=key;if(key==='name')field.required=true;wrap.append(field);fields.append(wrap);}form.hidden=false;}
 show();
 api.prepare().then(available=>{if(dead)return;button.hidden=!available;if(!available)status.textContent='Phone contact access is unavailable here. Enter the details you want to use.';});
 button.onclick=async()=>{if(dead||busy)return;busy=true;button.disabled=true;const pending=api.select();status.textContent='Choose one contact on your device.';const result=await pending;if(dead)return;busy=false;button.disabled=false;if(result.status==='selected'){show(result.contact);status.textContent='Choose which name, email and phone number to use.';fields.querySelector('select,input')?.focus();}else status.textContent=result.status==='cancelled'?'Contact selection cancelled. Your form is unchanged.':'Phone contacts could not open. Enter details or try again.';};
 root.querySelector('[data-manual]').onclick=()=>{if(busy)return;show();status.textContent='Enter the details you want to use.';fields.querySelector('input')?.focus();};
 form.onsubmit=event=>{event.preventDefault();if(dead||busy)return;try{const contact=confirmedContact(Object.fromEntries(new FormData(form)));onUse(contact);status.textContent='Details added for review. No message has been sent.';}catch(error){status.textContent=error?.message||'Check the contact details.';}};
 return{destroy(){dead=true;api.destroy();root.replaceChildren();root.classList.remove('z-contact-picker');}};
}

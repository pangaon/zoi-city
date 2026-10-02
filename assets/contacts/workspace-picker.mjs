import {sessionIdentity} from '../community/session-state.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function workspaceContacts(value,workspace){
 if(value?.ok!==true||!['owner','admin','editor','viewer'].includes(value.role)||!Array.isArray(value.records))throw Error('Contact access could not be verified.');
 if(value.records.some(r=>!UUID.test(r?.id||'')||r.workspace_id!==workspace||r.kind!=='contact'||r.archived_at||typeof r.title!=='string'||!r.title.trim()))throw Error('The contacts did not match this workspace.');
 return value.records.map(r=>({id:r.id,name:r.title.trim()}));
}
export function mountWorkspaceContactPicker(root,{core,workspace,current,onUse}){
 const identity=()=>typeof core.auth.token==='function'?sessionIdentity(core):'',actor=identity(),abort=new AbortController();let dead=false,observer,busy=false,rows=[];
 const removed=records=>records.some(r=>Array.from(r.removedNodes).some(n=>n===root||n.contains?.(root)));
 function destroy(){dead=true;observer?.disconnect();abort.abort();rows=[];root.replaceChildren();}
 function active(){if(!dead&&(!root.isConnected||!current()||identity()!==actor||removed(observer?.takeRecords()||[])))destroy();return !dead;}
 observer=new MutationObserver(records=>{if(removed(records)||!active())destroy();});observer.observe(root.ownerDocument.documentElement,{childList:true,subtree:true});
 if(!UUID.test(actor)||!UUID.test(workspace)){destroy();return{destroy};}
 root.innerHTML='<button type="button" data-contacts-open>Use a workspace contact</button><section hidden data-contact-search><label>Find a workspace contact<input type="search" autocomplete="off" maxlength="120" data-contact-query></label><p role="status" data-contact-status></p><div data-contact-results></div><p>Choose a name, then review the guest allocation. Nothing is sent.</p></section>';
 const open=root.querySelector('[data-contacts-open]'),area=root.querySelector('section'),query=root.querySelector('input'),status=root.querySelector('[data-contact-status]'),results=root.querySelector('[data-contact-results]');
 function render(){if(!active())return;results.replaceChildren();const q=query.value.trim().toLocaleLowerCase(),matches=rows.filter(r=>r.name.toLocaleLowerCase().includes(q));status.textContent=matches.length?matches.length+' matching contact'+(matches.length===1?'':'s')+(matches.length>30?' · Refine your search to see more.':'.'):'No matching contacts. You can enter the guest name manually.';for(const r of matches.slice(0,30)){const b=document.createElement('button');b.type='button';b.textContent=r.name;b.addEventListener('click',()=>{if(!active())return;if(r.name.length>80){status.textContent='This contact name is longer than the guest label limit. Enter a shorter label manually.';return;}onUse(r.name);if(active())status.textContent='Name added. Review the ticket quantity before saving.';},{signal:abort.signal});results.append(b);}}
 open.addEventListener('click',async()=>{if(busy||!active())return;busy=true;rows=[];results.replaceChildren();open.disabled=true;area.hidden=false;status.textContent='Loading your workspace contacts…';try{const fresh=await core.auth.ensureFresh();if(!active())return;if(!fresh)throw Error('Sign in again to view workspace contacts.');const value=await core.api.rpc('ops_records_list',{p_workspace:workspace,p_kind:'contact',p_include_archived:false},{auth:'prefer'});if(!active())return;rows=workspaceContacts(value,workspace);render();query.focus();}catch{if(active()){rows=[];results.replaceChildren();status.textContent='Workspace contacts could not load. Retry, or enter a name manually.';}}finally{if(active()){busy=false;open.disabled=false;open.textContent='Reload workspace contacts';}}},{signal:abort.signal});
 query.addEventListener('input',render,{signal:abort.signal});query.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();results.querySelector('button')?.focus();}if(e.key==='Enter')e.preventDefault();},{signal:abort.signal});
 root.addEventListener('click',e=>e.stopPropagation(),{signal:abort.signal});
 for(const name of ['zoi:auth-change','zoi:authchange','storage','focus'])globalThis.addEventListener(name,active,{signal:abort.signal});
 return{destroy};
}

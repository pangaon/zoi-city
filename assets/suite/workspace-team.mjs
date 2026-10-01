// Existing organization members. Invitations and delivery are separate capabilities.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const roles=['owner','admin','editor','viewer'];
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
export function mountWorkspaceTeam(root,{C,ws,active=()=>true,onAccessLost=()=>{}}){
 const actor=C.auth.load?.()?.user_id,key=`zoi_team_request:${actor}:${ws}`;
 let ended=false,busy=false,snapshot=null,pending=null;
 const current=()=>!ended&&root.isConnected&&active()&&C.auth.load?.()?.user_id===actor;
 const heading=node('h3','Your team'),intro=node('p','Manage the people who already belong to this organization. Owners and administrators control access.','zs-hint'),status=node('p','','zs-hint'),body=node('div');
 status.setAttribute('role','status');root.classList.add('zs-card');root.replaceChildren(heading,intro,status,body);
 function destroy(){ended=true;root.replaceChildren();}
 function denied(e){return [401,403].includes(Number(e?.status||e?.statusCode))||/42501|not_authorized/.test(`${e?.code} ${e?.message}`);}
 async function rpc(name,args){if(!current())throw Error('Account changed.');try{const r=await C.api.rpc(name,args,{auth:'require'});if(!current())throw Error('Account changed.');return r;}catch(e){if(current()&&denied(e)){destroy();root.textContent='Your team access changed. Reopen Settings to continue.';onAccessLost();}throw e;}}
 function button(text,fn){const b=node('button',text,'zs-btn zs-ghost');b.type='button';b.onclick=fn;b.disabled=busy;return b;}
 function store(value){if(value){const raw=JSON.stringify(value);sessionStorage.setItem(key,raw);if(sessionStorage.getItem(key)!==raw)throw Error('Recovery storage unavailable.');}else{sessionStorage.removeItem(key);if(sessionStorage.getItem(key)!==null)throw Error('Recovery storage unavailable.');}pending=value;}
 function validate(r){return r?.ok===true&&r.workspace_id===ws&&roles.includes(r.role)&&uuid.test(r.actor_profile_id)&&Array.isArray(r.members)&&r.members.every(m=>uuid.test(m.id)&&uuid.test(m.profile_id)&&uuid.test(m.revision)&&typeof m.name==='string'&&roles.includes(m.role)&&typeof m.protected==='boolean');}
 async function read(){const r=await rpc('workspace_team_get',{p_workspace:ws});if(!validate(r))throw Error('Team response could not be verified.');snapshot=r;}
 function render(){if(!current())return;body.replaceChildren();if(pending){const box=node('div');box.append(node('p','A team change needs confirmation. Check its result before making another change.'));const actions=node('div',null,'zs-actions');actions.append(button('Check team change',()=>recover(false)),button('Cancel unconfirmed change',()=>recover(true)));box.append(actions);body.append(box);return;}
 if(!snapshot){body.append(button('Retry loading team',load));return;}
 if(!snapshot.members.length)body.append(node('p','No additional team members are listed.'));
 for(const m of snapshot.members){const row=node('section');row.style.cssText='border-top:1px solid var(--line);padding:14px 0;overflow-wrap:anywhere';row.setAttribute('aria-label',`Team member ${m.name}`);const name=node('strong',m.name);row.append(name,node('p',m.role[0].toUpperCase()+m.role.slice(1)+(m.profile_id===snapshot.actor_profile_id?' · You':''),'zs-hint'));
 const manage=!m.protected&&(snapshot.role==='owner'||snapshot.role==='admin'&&!['owner','admin'].includes(m.role));
 if(manage){const actions=node('div',null,'zs-actions'),select=node('select');select.style.cssText='max-width:100%;padding:10px;border-radius:9px;background:var(--bg3);color:var(--tx);border:1px solid var(--line)';select.setAttribute('aria-label',`Role for ${m.name}`);for(const role of (snapshot.role==='owner'?['admin','editor','viewer']:['editor','viewer'])){const o=node('option',role[0].toUpperCase()+role.slice(1));o.value=role;select.append(o);}select.value=m.role;select.disabled=busy;actions.append(select,button('Save role',()=>change(m,'role',select.value)),button('Remove member',()=>confirmRemove(row,m)));row.append(actions);}
 body.append(row);}
 body.append(button('Refresh team',load));
 }
 function confirmRemove(row,m){row.querySelector('[data-confirm]')?.remove();const box=node('div');box.dataset.confirm='true';box.setAttribute('role','group');box.append(node('p',`Remove ${m.name} from this organization? They will lose its workspace access.`));const actions=node('div',null,'zs-actions');actions.append(button('Keep member',()=>{box.remove();}),button('Confirm removal',()=>change(m,'remove',null)));box.append(actions);row.append(box);actions.lastChild.focus();}
 async function settle(result){if(result?.workspace_id!==ws||result?.request_id!==pending?.request)throw Error('The team change could not be verified.');let message;
 if(result.ok===true&&uuid.test(result.member_id)&&uuid.test(result.profile_id))message='Team change confirmed.';
 else if(result.cancelled===true)message='Unconfirmed change cancelled.';
 else if(['membership_conflict','member_missing'].includes(result.error))message='This membership changed elsewhere. Review the refreshed team before trying again.';
 else throw Error('Team change is not confirmed.');
 await read();store(null);status.textContent=message;
 }
 async function recover(cancel){if(!current()||busy||!pending)return;busy=true;render();try{const r=await rpc('workspace_team_request',{p_workspace:ws,p_request:pending.request,p_cancel_if_missing:cancel});if(r?.ok!==true||r.workspace_id!==ws||r.request_id!==pending.request)throw Error('Recovery response could not be verified.');if(r.found)await settle(r.result);else status.textContent='No completed change was found. Check again or safely cancel it.';}catch(e){if(current())status.textContent=`Could not confirm the team change: ${e.message}`;}finally{busy=false;render();}}
 async function change(member,action,role){if(!current()||busy||pending)return;if(action==='role'&&role===member.role){status.textContent='This role is already saved.';return;}busy=true;try{store({request:crypto.randomUUID()});}catch(e){busy=false;status.textContent='Nothing was submitted. Browser recovery storage is unavailable.';return;}render();try{const result=await rpc('workspace_team_save',{p_workspace:ws,p_request:pending.request,p_profile:member.profile_id,p_member:member.id,p_revision:member.revision,p_action:action,p_role:role});await settle(result);}catch(e){if(current()){if(/team_request_limit|team_receipt_capacity|invalid_team_request|owner_membership_protected|self_membership_protected|owner_required|bad_role/.test(String(e?.message||''))){try{store(null);status.textContent='No change was made. Refresh the team; if the limit persists, contact support.';}catch(_){status.textContent='No change was made, but browser recovery storage could not be cleared.';}}else status.textContent='This team change is not confirmed. Check its result before trying another change.';}}finally{busy=false;render();}}
 async function load(){if(!current()||busy)return;busy=true;status.textContent='Loading your team…';render();try{const raw=sessionStorage.getItem(key);if(raw){const r=JSON.parse(raw);if(!uuid.test(r?.request)||Object.keys(r).length!==1)throw Error('Recovery reference could not be read.');pending=r;}await read();status.textContent=snapshot.role==='owner'||snapshot.role==='admin'?'Owners retain control of ownership. Administrators can manage editors and viewers.':'You can view the team. An owner or administrator manages access.';}catch(e){if(current()){snapshot=null;status.textContent=`Could not load your team: ${e.message}`;}}finally{busy=false;render();}}
 load();return {destroy};
}

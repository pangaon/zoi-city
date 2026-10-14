import {sessionIdentity} from '../community/session-state.mjs';
const uuid=x=>/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(x||'');
const key=(workspace,actor)=>'zoi.editorial.open:'+workspace+':'+actor;
export function stageEditorialHandoff({workspace,actor,link},store=globalThis.sessionStorage,now=Date.now()){
 if(![workspace,actor,link].every(uuid))throw Error('Account or editorial draft identity changed.');const value=JSON.stringify({workspace,actor,link,expires:now+300000});try{store.setItem(key(workspace,actor),value);if(store.getItem(key(workspace,actor))!==value)throw Error();}catch{throw Error('The draft is saved, but browser storage could not preserve its open action.');}return true;
}
export async function takeEditorialHandoff({C,workspace,active=()=>true,store=globalThis.sessionStorage,now=Date.now()}={}){
 const actor=sessionIdentity(C);if(!uuid(actor)||!uuid(workspace)||!active())return null;const k=key(workspace,actor);let value;try{const raw=store.getItem(k);if(!raw)return null;value=JSON.parse(raw);}catch{throw Error('Saved editorial open action could not be read.');}
 if(value.actor!==actor||value.workspace!==workspace||!uuid(value.link)||value.expires<now){store.removeItem(k);throw Error('Editorial open action expired. Reopen the saved draft from Calendar.');}
 const guard=()=>active()&&sessionIdentity(C)===actor;const result=await C.api.rpc('editorial_draft_get',{p_workspace:workspace,p_link:value.link},{auth:'require',beforeDispatch:guard});if(!guard())throw Error('Account or workspace changed.');
 if(result?.ok!==true||result.workspace!==workspace||result.link?.id!==value.link||result.link.workspace_id!==workspace||!uuid(result.post?.id)||result.post.workspace_id!==workspace||!['draft','scheduled'].includes(result.post.status))throw Error('The saved editorial draft could not be confirmed.');store.removeItem(k);return result;
}

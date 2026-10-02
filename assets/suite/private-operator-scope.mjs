import {sessionIdentity} from '../community/session-state.mjs?v=20261001-uuid-scope';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Keep a private operator's requests and surface with its original account/workspace. */
export function privateOperatorScope(root,ctx,{onDispose=()=>{}}={}){
  root.__zoiPrivateOperator?.destroy();
  const C=ctx.C||window.ZoiCore,workspace=ctx.ws,stored=C.auth.load()?.user_id;
  const actor=UUID.test(stored||'')?stored.toLowerCase():'',events=new AbortController();
  let ended=false,host=null,observer=null,timer=null;
  const ownsSurface=()=>root.isConnected&&(!host||root.contains(host));
  function destroy(note=''){
    if(ended)return;
    ended=true;events.abort();observer?.disconnect();clearInterval(timer);onDispose();
    if(!host||root.contains(host))root.textContent=note;
  }
  function current(){
    if(ended)return false;
    if(!actor||!UUID.test(workspace||'')||sessionIdentity(C)!==actor||ctx.ws!==workspace||!ownsSurface()){
      destroy('Your account or workspace changed. Reopen these private tools.');return false;
    }
    return true;
  }
  function assert(){if(!current())throw Error('private_operator_scope_changed');}
  async function rpc(name,args){
    assert();
    try{
      const fresh=await C.auth.ensureFresh();assert();
      if(!fresh){const error=Error('Please sign in again.');error.status=401;throw error;}
      const result=await C.api.rpc(name,args,{auth:'prefer'});assert();return result;
    }catch(error){
      if(current()&&([401,403].includes(Number(error?.status))||/permission_denied|not_authorized|not_signed_in|suite_session_unavailable|42501/.test(String(error?.code||'')+' '+String(error?.message||'')))){
        destroy('Your workspace access changed. Reopen these private tools.');
      }
      throw error;
    }
  }
  const scope={C,actor,workspace,signal:events.signal,current,rpc,destroy,unmount:destroy,
    attach(surface){host=surface;if(!current())return;observer=new MutationObserver(current);observer.observe(root.ownerDocument.body,{childList:true,subtree:true});timer=setInterval(current,500);}
  };
  root.__zoiPrivateOperator=scope;
  for(const name of ['focus','storage','zoi:auth-change','zoi:authchange'])window.addEventListener(name,current,{signal:events.signal});
  document.addEventListener('visibilitychange',current,{signal:events.signal});
  current();return scope;
}

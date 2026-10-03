import {mountTableInventory} from './table-inventory-operator.mjs?v=20261001-inventory-draft';
import {HOST_UUID} from './host-allocation-client.mjs?v=20261001-host-recovery';
const METHODS=new Set(['table_inventory_operator','table_inventory_configure','table_inventory_configure_receipt','table_identity_get','table_identity_save','table_identity_receipt']);
/** Embeds the existing versioned identity/pricing writers, never a second setup model. */
export function mountOrganizerSetup(container,{core,workspace,event,current=()=>true,storage=globalThis.sessionStorage,onClose=()=>{}}={}){
 if(!HOST_UUID.test(workspace||'')||!HOST_UUID.test(event||'')||!HOST_UUID.test(core?.auth.load()?.user_id||''))throw Error('Choose your current organiser workspace and event.');
 if(!container.ownerDocument.querySelector('link[data-organizer-setup-style]')){const css=container.ownerDocument.createElement('link');css.rel='stylesheet';css.href='/assets/tickets/table-inventory-operator.css?v=20260930-1';css.dataset.organizerSetupStyle='';container.ownerDocument.head.append(css);}
 const actor=core.auth.load().user_id,root=container.ownerDocument.createElement('section');root.dataset.organizerSetup='';container.replaceChildren(root);
 const abort=new AbortController();let dead=false,dispose=null,observer;
 function retired(records=[]){return records.some(r=>Array.from(r.removedNodes).some(n=>n===root||n.contains?.(root)));}
 function valid(){return !dead&&root.isConnected&&container.contains(root)&&core.auth.load()?.user_id===actor&&current()&&!retired(observer?.takeRecords()||[]);}
 function destroy(){if(dead)return;dead=true;observer?.disconnect();abort.abort();dispose?.();dispose=null;root.replaceChildren();root.remove();}
 function check(){if(!valid()){destroy();throw Error('Your organiser setup view changed. Reopen it for the current account and event.');}}
 const call=async(name,args)=>{
  check();if(!METHODS.has(name)||args?.p_workspace!==workspace||args?.p_event!==event)throw Error('This setup request does not match the selected event.');
  try{const fresh=await core.auth.ensureFresh();check();if(!fresh){const e=Error('Please sign in again.');e.status=401;throw e;}
   const value=await core.api.rpc(name,args,{auth:'prefer'});check();return value;
  }catch(error){if([401,403].includes(error.status)&&valid()){destroy();onClose(error);}throw error;}
 };
 root.innerHTML='<header><h2 tabindex="-1">Prepare this event for your parea</h2><p>Start with your own confirmed table labels and capacities, then review prices, included taxes and fees, and the event start. Saving settings does not allocate a host, send invitations or collect payment.</p></header><div data-inventory-editor></div><footer><p>Return after saving to refresh the current table choices. Unsaved edits are discarded when you leave this setup; an uncertain save keeps its request reference for recovery.</p><button type="button" data-setup-close>Return to allocations and refresh</button></footer>';
 root.querySelector('h2').focus();
 // Inventory and identity forms have their own event handlers. They must never activate host delegated controls.
 for(const name of ['click','submit','input','change'])root.addEventListener(name,e=>e.stopPropagation(),{signal:abort.signal});
 root.querySelector('[data-setup-close]').addEventListener('click',()=>{check();destroy();onClose();},{signal:abort.signal});
 observer=new MutationObserver(records=>{if(!root.isConnected||retired(records))destroy();});observer.observe(root.ownerDocument.documentElement,{childList:true,subtree:true});
 for(const name of ['zoi:auth-change','storage','focus'])globalThis.addEventListener(name,()=>{if(!valid())destroy();},{signal:abort.signal});
 dispose=mountTableInventory(root.querySelector('[data-inventory-editor]'),{workspace,event,call,getActor:()=>valid()?actor:null,storage});
 return destroy;
}

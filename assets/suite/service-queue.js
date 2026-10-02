(function(global){'use strict';global.ZoiSuite=global.ZoiSuite||{modules:[]};global.ZoiSuite.modules.push({id:'service-queue',label:'Service queue',order:75,mount:async function(container,ctx){
 const C=ctx.C,ws=ctx.ws,actor=C.auth.load()?.user_id,root=container.ownerDocument.createElement('div');container.replaceChildren(root);let dead=false,child=null,identity=null,observer;
 const removed=records=>records.some(r=>Array.from(r.removedNodes).some(n=>n===root||n.contains?.(root)));
 function destroy(){dead=true;observer?.disconnect();child?.destroy?.();root.replaceChildren();}
 const current=()=>{if(!dead&&(!root.isConnected||!container.contains(root)||ctx.ws!==ws||C.auth.load()?.user_id!==actor||identity&&identity(C)!==actor||removed(observer?.takeRecords()||[])))destroy();return !dead;};
 observer=new container.ownerDocument.defaultView.MutationObserver(records=>{if(removed(records)||!current())destroy();});observer.observe(container.ownerDocument.documentElement,{childList:true,subtree:true});
 const handle={destroy,hasUnsavedChanges:()=>!dead&&!!child?.hasUnsavedChanges?.()};
 const state=await import('/assets/community/session-state.mjs');identity=state.sessionIdentity;if(!current())return handle;
 const module=await import('/assets/events/service-queue.mjs?v=20261002-installed-service');if(!current())return handle;
 child=await module.mount(root,ctx);if(!current())child?.destroy?.();return handle;
}});})(typeof window!=='undefined'?window:globalThis);

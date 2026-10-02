(function(global){'use strict';global.ZoiSuite=global.ZoiSuite||{modules:[]};global.ZoiSuite.modules.push({id:'service-menu',label:'Menu & bottles',order:74,icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v7m4-7v7M4 3v5a4 4 0 0 0 8 0V3M8 12v9m10-18v18m0-18c-4 3-4 8 0 9"/></svg>',mount:async function(container,ctx){
 const ws=ctx.ws,C=ctx.C,actor=C.auth.load()?.user_id,root=container.ownerDocument.createElement('div');container.replaceChildren(root);
 let identity=null,catalogue=null,setup=null,operations=null,dead=false,observer=null;
 const removed=records=>records.some(r=>Array.from(r.removedNodes).some(n=>n===root||n.contains?.(root)));
 function destroy(){dead=true;observer?.disconnect();catalogue?.destroy?.();setup?.destroy?.();operations?.destroy?.();root.replaceChildren();}
 const current=()=>{if(!dead&&(!root.isConnected||!container.contains(root)||ctx.ws!==ws||C.auth.load()?.user_id!==actor||identity&&identity(C)!==actor||removed(observer?.takeRecords()||[])))destroy();return !dead;};
 observer=new container.ownerDocument.defaultView.MutationObserver(records=>{if(removed(records)||!current())destroy();});observer.observe(container.ownerDocument.documentElement,{childList:true,subtree:true});
 const empty=()=>({destroy,hasUnsavedChanges:()=>false});
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actor||'')){root.textContent='Sign in again to verify your account before opening the catalogue.';return empty();}
 const state=await import('/assets/community/session-state.mjs');identity=state.sessionIdentity;if(!current())return empty();
 const menu=await import('/assets/events/service-menu.mjs?v=20261002-installed-service');if(!current())return empty();
 const catalogueRoot=document.createElement('div'),setupRoot=document.createElement('div'),operationsRoot=document.createElement('div');root.replaceChildren(catalogueRoot,setupRoot,operationsRoot);catalogue=await menu.mount(catalogueRoot,ctx);if(!current()){catalogue?.destroy?.();return empty();}
 if(['owner','admin'].includes(ctx.role)){
  for(const item of[{label:'Set up event service',target:setupRoot,path:'/assets/events/event-service-configuration.mjs?v=20261002-installed-service',assign:value=>setup=value},{label:'Manage event service',target:operationsRoot,path:'/assets/events/event-service-session.mjs?v=20261002-installed-service',assign:value=>operations=value}]){
   const button=document.createElement('button');button.type='button';button.textContent=item.label;button.style.cssText='margin:24px 0;padding:12px 16px;border:1px solid var(--line2);border-radius:12px;background:var(--bg3);color:var(--tx);font:inherit';item.target.append(button);
   button.onclick=async()=>{if(!current()||button.disabled)return;button.disabled=true;try{const module=await import(item.path);if(!current()||!item.target.contains(button))return;const child=await module.mount(item.target,ctx);item.assign(child);if(!current())child?.destroy?.();}catch{if(current()&&item.target.contains(button))item.target.textContent='Event service could not open. Reopen Menu & bottles to try again.';}};
  }
 }
 return{destroy,hasUnsavedChanges:()=>!dead&&(!!catalogue?.hasUnsavedChanges?.()||!!setup?.hasUnsavedChanges?.()||!!operations?.hasUnsavedChanges?.())};
}});})(typeof window!=='undefined'?window:globalThis);

import {UUID} from '../inquiries/model.mjs';
import {esc} from './model.mjs';
export function approvedBenefitContext(application,workspace){
 if(!UUID.test(workspace||'')||!application||!UUID.test(application.id||'')||application.workspace_id!==workspace||!UUID.test(application.event_id||'')||!UUID.test(application.inquiry_id||'')||application.status!=='approved'||application.terms?.kind!=='sponsor'||!Array.isArray(application.terms.benefits)||application.terms.benefits.length>20||application.terms.benefits.some(x=>typeof x!=='string'||!x.trim()||x.length>200))throw Error('This approved sponsorship could not be verified.');
 return {application:application.id,event:application.event_id,inquiry:application.inquiry_id,workspace,version:application.version,name:String(application.terms.name||''),benefits:[...application.terms.benefits],terms:JSON.stringify(application.terms)};
}
export async function mountFulfillment(container,{C,ws,application,offset=0,isCurrent=()=>true,onAccessLost=()=>{}}){
 const source=approvedBenefitContext(application,ws),root=container.ownerDocument.createElement('section');root.className='card';container.replaceChildren(root);
 let dead=false,studio=null,observer;const actor=C.auth.load()?.user_id,abort=new AbortController(),campaigns=new Set();
 const removed=records=>records.some(r=>Array.from(r.removedNodes).some(n=>n===root||n.contains?.(root)));
 function destroy(){if(dead)return;dead=true;abort.abort();observer?.disconnect();studio?.destroy();root.replaceChildren();}
 function current(){if(!dead&&(!UUID.test(actor||'')||C.auth.load()?.user_id!==actor||!root.isConnected||!container.contains(root)||!isCurrent()||removed(observer?.takeRecords()||[])))destroy();return !dead;}
 function assert(){if(!current())throw Error('This sponsorship workspace changed.');}
 observer=new MutationObserver(records=>{if(removed(records)||!current())destroy();});observer.observe(root.ownerDocument.documentElement,{childList:true,subtree:true});
 for(const name of ['zoi:auth-change','zoi:authchange','storage','focus'])window.addEventListener(name,current,{signal:abort.signal});
 async function call(fn,args){assert();const fresh=await C.auth.ensureFresh();assert();if(!fresh)throw Object.assign(Error('Sign in again.'),{status:401});const value=await C.api.rpc(fn,args,{auth:'prefer'});assert();return value;}
 async function approval(){const result=await call('festival_fulfillment_source',{p_workspace:ws,p_application:source.application});if(result?.ok!==true||result.capability!=='festival_creator_binding_v1'||result.workspace_id!==ws||!['owner','admin','editor'].includes(result.role))throw Object.assign(Error('Sponsorship fulfillment is not available for this workspace yet.'),{status:403});const latest=approvedBenefitContext(result.application,ws);if(latest.application!==source.application||latest.inquiry!==source.inquiry||latest.event!==source.event||latest.terms!==source.terms)throw Object.assign(Error('The approved sponsorship changed. Refresh its application.'),{status:403});}

 const scopedCore={...C,auth:C.auth,api:{...C.api,rpc:async(fn,args)=>{try{
  if(fn==='creator_list'||fn==='creator_mutation_execute')await approval();
  if(fn==='creator_mutation_execute'){const p=args.p_args;if(args.p_action==='creator_convert'){if(p?.p_workspace!==ws||p.p_inquiry!==source.inquiry||p.p_kind!=='sponsorship')throw Error('The campaign does not match this sponsorship.');}else if(p?.p_campaign&&!campaigns.has(p.p_campaign))throw Error('Choose this sponsorship campaign before saving.');}
  const value=await call(fn,args);
  if(fn==='creator_list'){if(value?.ok!==true||!Array.isArray(value.campaigns)||!Array.isArray(value.inquiries))throw Error('Campaigns could not be verified.');value.campaigns=value.campaigns.filter(c=>c.inquiry_id===source.inquiry&&c.workspace_id===ws&&c.kind==='sponsorship');value.campaigns.forEach(c=>campaigns.add(c.id));value.inquiries=value.inquiries.filter(i=>i.id===source.inquiry);}
  if(fn==='creator_get'){if(value?.campaign?.inquiry_id!==source.inquiry||value.campaign.workspace_id!==ws||value.campaign.kind!=='sponsorship')throw Error('The campaign does not match this sponsorship.');campaigns.add(value.campaign.id);}
  return value;
 }catch(error){if(current()&&([401,403].includes(Number(error.status))||/approved sponsorship|Sponsorship access/.test(error.message))){destroy();onAccessLost();}throw error;}}}};
 async function readPlacementStatus(){
  const target=root.querySelector('[data-public-placement-status]'),button=root.querySelector('[data-check-public]');button.disabled=true;target.textContent='Checking current public artwork…';
  try{await approval();const value=await call('festival_placement_operator',{p_workspace:ws,p_event:source.event});if(value?.ok!==true||!Array.isArray(value.placements)||!Array.isArray(value.scopes))throw Error('Public artwork could not be verified.');
   const own=value.placements.filter(p=>p.application_id===source.application);if(own.some(p=>p.event_id!==source.event||p.workspace_id!==ws||!UUID.test(p.id)))throw Error('Artwork scope did not match.');
   const visible=new Set();for(const scope of value.scopes){if(scope.event_id!==source.event||scope.workspace_id!==ws||!['front','side'].includes(scope.configuration)||!Number.isInteger(scope.version)||scope.version<1)throw Error('Artwork scope did not match.');const feed=await call('festival_placements_public',{p_event:source.event,p_configuration:scope.configuration,p_configuration_version:scope.version});if(feed?.ok!==true||!Array.isArray(feed.placements)||feed.placements.length>3||!Number.isFinite(Date.parse(feed.server_time)))throw Error('Public artwork could not be verified.');for(const p of feed.placements){if(p.event_id!==source.event||p.configuration!==scope.configuration||p.configuration_version!==scope.version||p.approval!=='approved'||!(Date.parse(p.starts_at)<=Date.parse(feed.server_time)&&Date.parse(feed.server_time)<Date.parse(p.ends_at)))throw Error('Public artwork scope did not match.');visible.add(p.id);}}
   assert();target.replaceChildren();if(!own.length)target.textContent='No artwork is saved for this approved application. Use Manage artwork to prepare it.';for(const p of own){const line=document.createElement('p');line.textContent=p.title+' · '+(visible.has(p.id)?'Included in the current public room feed.':'Not currently included in the public room feed.');target.append(line);}
  }catch(error){if(current()){target.textContent='Public artwork could not be confirmed. Check again; benefit acknowledgments do not imply public placement.';if([401,403].includes(Number(error.status))){destroy();onAccessLost();}}}finally{if(current())button.disabled=false;}
 }
 root.innerHTML='<h3>Deliver the promised benefits</h3><p>'+esc(source.name)+'</p><p>The original approved benefits are available below to prepare deliverables. Saving a task does not publish artwork or confirm payment. A benefit is acknowledged only when the customer accepts its submitted proof.</p><button type="button" data-check-public>Check public artwork</button><div role="status" data-public-placement-status></div><div data-fulfillment-studio></div>';
 root.querySelector('[data-check-public]').addEventListener('click',readPlacementStatus,{signal:abort.signal});
 try{await approval();assert();const module=await import('../creator/studio.mjs?v=20261002-sponsor-fulfillment');assert();studio=await module.mount(root.querySelector('[data-fulfillment-studio]'),{C:scopedCore,workspace:ws,isCurrent:current,sourceContext:source});assert();}catch(error){if(current()){root.innerHTML='<p>'+esc(error.message||'Sponsorship fulfillment could not open. Refresh the application and try again.')+'</p>';}}
 return {destroy,hasUnsaved:()=>!dead&&!!studio?.hasUnsaved?.()};
}

import {sessionIdentity} from '../community/session-state.mjs?v=20261001-uuid-scope';
import {mountMemberStart} from '../suite/member-start.mjs?v=20261002-member-start';
import {mountReportActions} from '../intelligence/today.mjs';
import {prioritize} from './engine.mjs';
import {loadSources} from './sources.mjs';
import {operationsDenied} from '../operations/recovery.mjs?v=20261003-current-suite-authority';
export {loadSources} from './sources.mjs';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const AREAS = {operations: {label:'Tasks & deadlines',action:'Open task',icon:'↗'}, publishing:{label:'Publishing',action:'Review publication',icon:'↗'},bookings:{label:'Bookings',action:'Review bookings',icon:'↗'}};
function displayFact(fact) {if(fact.startsWith('Deadline: ')){const at=Date.parse(fact.slice(10));return Number.isFinite(at)?'Due '+new Date(at).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):fact;}if(fact.startsWith('Service window: ')){const parts=fact.slice(16).split(' – ');if(parts.length===2&&parts.every(p=>Number.isFinite(Date.parse(p))))return new Date(parts[0]).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})+' – '+new Date(parts[1]).toLocaleString(undefined,{timeStyle:'short'});}return fact;}
function actionHref(issue) {return issue.source === 'operations' ? '/social#operations/task/' + issue.recordId : issue.href;}
function actionCard(issue,featured = false) {
 const area = AREAS[issue.source];
 return `<article class="zpri-issue${featured?' zpri-featured':''}"><div class="zpri-issue-top"><span class="zpri-tag">${esc(area.label)}</span>${featured?'<span class="zpri-next">Start here</span>':''}</div><h3>${esc(issue.title)}</h3><p class="zpri-action">${esc(issue.action)}</p><ul>${issue.facts.map(f=>`<li>${esc(displayFact(f))}</li>`).join('')}</ul><div class="zpri-issue-bottom"><a class="zpri-open" href="${esc(actionHref(issue))}">${esc(area.action)} <span aria-hidden="true">${area.icon}</span></a><details><summary>Why this is here</summary><p>${esc(issue.confidence)}. Checked ${esc(new Date(issue.fetchedAt).toLocaleString())}.</p><p>Priority ${issue.score}/100: severity ${issue.components.severity}, urgency ${issue.components.urgency}, coordination ${issue.components.coordination}.</p><p>Record updated: ${issue.observedAt?esc(new Date(issue.observedAt).toLocaleString()):'Not provided'}.</p></details></div></article>`;
}
export async function mount(root,ctx) {
 if(!document.getElementById('zpri-style')) {const css=document.createElement('link');css.id='zpri-style';css.rel='stylesheet';css.href='/assets/priorities/style.css?v=20261003-today-workspace';document.head.append(css);}
 const actor=sessionIdentity(ctx.C),workspace=ctx.ws,events=new AbortController();
 let alive=true,busy=false,report=null,sources={},filter='all',query='',limit=6,member,website,memberLoading=null,verifiedRole=null,verifiedProfile=null,epoch=0;
 root.classList.add('zpri-workspace');
 root.innerHTML=`<section class="zpri"><header class="zpri-hero"><div><p class="zpri-eyebrow">Your workspace · Today</p><h2>A clear next move.</h2><p>Your work, deadlines and customer commitments in one place.</p></div><button class="zpri-refresh" data-refresh>Refresh workspace</button></header><div class="zpri-launches" aria-label="Workspace shortcuts"><a href="/social/operations">Company records <span aria-hidden="true">↗</span></a><a href="/social/inbox">Customer inbox <span aria-hidden="true">↗</span></a><a href="/social/documents">Private documents <span aria-hidden="true">↗</span></a></div><p role="status" aria-live="polite" data-status></p><div data-results></div><details class="zpri-assigned"><summary>Assigned to you <span>Open your work list</span></summary><div data-member-start></div></details><section class="zpri-website" data-website-actions></section></section>`;
 const surface=root.querySelector('.zpri'),button=root.querySelector('[data-refresh]'),status=root.querySelector('[data-status]'),results=root.querySelector('[data-results]');
 function destroy() {if(!alive)return;alive=false;epoch++;events.abort();observer.disconnect();report=null;sources={};query="";filter="all";verifiedRole=null;verifiedProfile=null;memberLoading=null;member?.destroy();website?.destroy();surface.replaceChildren();root.classList.remove('zpri-workspace');}
 function current() {if(alive&&(!root.isConnected||!root.contains(surface)||ctx.ws!==workspace||!actor||sessionIdentity(ctx.C)!==actor))destroy();return alive;}
 const observer=new MutationObserver(records=>{if(records.some(r=>[...r.removedNodes].some(n=>n===root||n===surface||n.contains?.(surface))))destroy();else current();});
 observer.observe(document.documentElement,{childList:true,subtree:true});
 for(const name of ['storage','zoi:auth-change','zoi:authchange'])window.addEventListener(name,current,{signal:events.signal});
 window.addEventListener('focus',()=>{if(current()&&!busy)refresh();},{signal:events.signal});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&current()&&!busy)refresh();},{signal:events.signal});
 function render() {
  if(!current()||!report)return;
  const selected=report.issues.filter(i=>(filter==='all'||i.source===filter)&&(!query||(i.title+' '+i.action+' '+i.facts.join(' ')).toLocaleLowerCase().includes(query.toLocaleLowerCase())));
  const unavailable=report.coverage.filter(c=>!c.available);
  results.innerHTML=`${unavailable.length?`<aside class="zpri-warning"><strong>Some of your workspace could not be checked.</strong><p>${unavailable.map(c=>esc(AREAS[c.name].label)).join(', ')} ${unavailable.length===1?'is':'are'} unavailable. The actions below only use the areas that loaded.</p><button data-retry>Retry unavailable areas</button></aside>`:''}<div class="zpri-overview">${report.coverage.map(c=>{const count=report.issues.filter(i=>i.source===c.name).length;return `<button class="zpri-area" data-area="${c.name}" aria-pressed="${filter===c.name}"><span>${esc(AREAS[c.name].label)}</span><strong>${c.available?count:'—'}</strong><small>${c.available?`${count===1?'action':'actions'} to review`:'Could not be checked'}</small></button>`;}).join('')}</div><section class="zpri-queue"><div class="zpri-queue-header"><div><p class="zpri-eyebrow">What needs attention</p><h3>${filter==='all'?'Your next actions':esc(AREAS[filter].label)}</h3></div><button class="zpri-all" data-all aria-pressed="${filter==='all'}">Show all areas</button></div><label class="zpri-search">Find an action<input type="search" data-search maxlength="120" autocomplete="off" placeholder="Search titles, deadlines or service names" value="${esc(query)}"></label><p class="zpri-muted" role="status" data-count>${selected.length} matching action${selected.length===1?'':'s'} · checked ${esc(new Date(report.asOf).toLocaleTimeString())}</p><div class="zpri-list">${selected.slice(0,limit).map((issue,i)=>actionCard(issue,i===0)).join('')||`<article class="zpri-empty"><h3>${query?'No matching actions':report.complete?'No urgent actions in these records':'Waiting for a complete view'}</h3><p>${query?'Try another title or clear your search.':report.complete?'No loaded records matched the deadline, booking or publishing rules. Your assigned work is below.':'Refresh the unavailable areas to see what needs attention there.'}</p>${query?'<button data-clear>Clear search</button>':''}</article>`}</div>${selected.length>limit?`<button class="zpri-more" data-more>Show ${Math.min(6,selected.length-limit)} more actions</button>`:''}</section><details class="zpri-coverage"><summary>What was checked</summary><div class="zpri-sources">${report.coverage.map(c=>`<article><strong>${esc(AREAS[c.name].label)}</strong><p>${c.available?'Records loaded':esc(c.reason)}</p><small>${c.fetchedAt?'Checked '+esc(new Date(c.fetchedAt).toLocaleTimeString()):'Not checked'}</small></article>`).join('')}</div><p>Publishing: the last 30 days through the next 7 days. Bookings: the previous and next 7 days. Only records loaded within 5 minutes are ranked.</p><p>Actions are ordered by recorded severity, deadline urgency and coordination needs. They are not revenue, engagement or delivery forecasts.</p></details>`;
  results.querySelector('[data-retry]')?.addEventListener('click',refresh);
  for(const area of results.querySelectorAll('[data-area]'))area.addEventListener('click',()=>{filter=filter===area.dataset.area?'all':area.dataset.area;limit=6;render();results.querySelector(`[data-area="${area.dataset.area}"]`)?.focus();});
  results.querySelector('[data-all]')?.addEventListener('click',()=>{filter='all';limit=6;render();results.querySelector('[data-all]').focus();});
  const search=results.querySelector('[data-search]');
  search.addEventListener('input',()=>{query=search.value;limit=6;renderList();});
  bindList();
 }
 function filtered() {return report.issues.filter(i=>(filter==='all'||i.source===filter)&&(!query||(i.title+' '+i.action+' '+i.facts.join(' ')).toLocaleLowerCase().includes(query.toLocaleLowerCase())));}
 function bindList() {
  results.querySelector('[data-clear]')?.addEventListener('click',()=>{query='';limit=6;results.querySelector('[data-search]').value='';renderList();results.querySelector('[data-search]').focus();});
  results.querySelector('[data-more]')?.addEventListener('click',()=>{limit+=6;renderList();results.querySelector('.zpri-list article:last-child a')?.focus();});
 }
 function renderList() {
  if(!current()||!report)return;
  const selected=filtered();
  results.querySelector('[data-count]').textContent=`${selected.length} matching action${selected.length===1?'':'s'} · checked ${new Date(report.asOf).toLocaleTimeString()}`;
  results.querySelector('.zpri-list').innerHTML=selected.slice(0,limit).map((issue,i)=>actionCard(issue,i===0)).join('')||`<article class="zpri-empty"><h3>${query?'No matching actions':report.complete?'No urgent actions in these records':'Waiting for a complete view'}</h3><p>${query?'Try another title or clear your search.':report.complete?'No loaded records matched the deadline, booking or publishing rules. Your assigned work is below.':'Refresh the unavailable areas to see what needs attention there.'}</p>${query?'<button data-clear>Clear search</button>':''}</article>`;
  results.querySelector('[data-more]')?.remove();
  if(selected.length>limit){const more=document.createElement('button');more.className='zpri-more';more.dataset.more='';more.textContent=`Show ${Math.min(6,selected.length-limit)} more actions`;results.querySelector('.zpri-queue').append(more);}
  bindList();
 }
 async function scopedRpc(name,args,requestEpoch) {
  if(!current()||requestEpoch!==epoch)throw Error('session_changed');
  if(await ctx.C.auth.ensureFresh()===false){destroy();throw Error('session_changed');}
  if(!current()||requestEpoch!==epoch)throw Error('session_changed');
  try{
   const value=await ctx.C.api.rpc(name,args,{auth:'prefer'});
   if(!current()||requestEpoch!==epoch)throw Error('session_changed');
   if(name==='workspace_team_get'&&verifiedRole&&(value?.role!==verifiedRole||value?.actor_profile_id!==verifiedProfile)){destroy();throw Error('session_changed');}
   return value;
  }catch(error){if(current()&&requestEpoch===epoch&&operationsDenied(error))destroy();throw error;}
 }
 async function openAssigned() {
  if(!current()||!verifiedRole||member||memberLoading===epoch)return;
  const requestEpoch=epoch;memberLoading=requestEpoch;
  const scopedCtx={...ctx,C:{...ctx.C,api:{...ctx.C.api,rpc:(name,args)=>scopedRpc(name,args,requestEpoch)}}};
  try{const next=await mountMemberStart(root.querySelector('[data-member-start]'),scopedCtx);if(!current()||requestEpoch!==epoch){next.destroy();return;}member=next;}finally{if(memberLoading===requestEpoch)memberLoading=null;}
 }
 async function refresh() {
  if(busy||!current())return;busy=true;const requestEpoch=++epoch;report=null;sources={};results.replaceChildren();button.disabled=true;status.textContent='Checking your workspace…';surface.setAttribute('aria-busy','true');
  member?.destroy();member=null;memberLoading=null;root.querySelector('[data-member-start]').replaceChildren();website?.destroy();website=null;
  try {
   const scopedCore={api:{rpc:(name,args)=>scopedRpc(name,args,requestEpoch)}};
   const team=await scopedCore.api.rpc('workspace_team_get',{p_workspace:workspace});
   if(team?.ok!==true||team.workspace_id!==workspace||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(team.actor_profile_id||'')||!['owner','admin','editor','viewer'].includes(team.role))throw Error('workspace_membership_unverified');
   if(verifiedRole&&(verifiedRole!==team.role||verifiedProfile!==team.actor_profile_id)){destroy();return;}verifiedRole=team.role;verifiedProfile=team.actor_profile_id;
   const nextSources=await loadSources(scopedCore,workspace);if(!current()||requestEpoch!==epoch)return;
   sources=nextSources;report=prioritize({workspace,sources});status.textContent=`${report.issues.length} action${report.issues.length===1?'':'s'} to review · ${report.coverage.filter(c=>c.available).length} of ${report.coverage.length} areas checked`;render();
   website=mountReportActions(root.querySelector('[data-website-actions]'),{...ctx,role:verifiedRole});
   if(root.querySelector('.zpri-assigned').open)await openAssigned();
  }catch {if(current()&&requestEpoch===epoch){status.textContent='Your workspace could not be checked. Use Refresh workspace to try again.';results.replaceChildren();}}
  finally {if(current()&&requestEpoch===epoch){busy=false;button.disabled=false;surface.removeAttribute('aria-busy');}}
 }
 button.addEventListener('click',refresh,{signal:events.signal});
 if(!current())return{destroy};
 root.querySelector('.zpri-assigned').addEventListener('toggle',()=>{if(root.querySelector('.zpri-assigned').open)void openAssigned();},{signal:events.signal});
 await refresh();return{destroy};
}

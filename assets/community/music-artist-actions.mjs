import {mountArtistDemand} from '../music/demand.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const mounts=new WeakMap();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function confirmedArtistEvents(result,artist,now=Date.now()){
 if(result?.ok!==true||!Array.isArray(result.shows))throw Error('Events could not be loaded. Try again.');
 const seen=new Set();return result.shows.slice(0,100).filter(s=>{
  if(!UUID.test(s?.id||'')||seen.has(s.id)||s.artist_id!==artist||!UUID.test(s.event_id||'')||typeof s.event_name!=='string'||!s.event_name.trim()||typeof s.timezone!=='string'||!s.timezone.trim()||typeof s.slug!=='string'||!s.slug.trim()||/[/?#\s]/.test(s.slug)||!Number.isFinite(Date.parse(s.starts_at))||Date.parse(s.starts_at)<now||Date.parse(s.ends_at)<=Date.parse(s.starts_at))return false;
  try{new Intl.DateTimeFormat('en',{timeZone:s.timezone}).format(new Date(s.starts_at));}catch{return false;}seen.add(s.id);return true;
 }).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at));
}
export function artistEventsHTML(shows){return shows.map(s=>{const when=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short',timeZone:s.timezone}).format(new Date(s.starts_at));return `<article class="zmp-context-event"><strong>${esc(s.event_name)}</strong><p><time datetime="${esc(s.starts_at)}">${esc(when)}</time> · ${esc(s.timezone)}${s.city?' · '+esc(s.city):''}</p><a href="/p/${encodeURIComponent(s.slug)}" target="_blank" rel="noopener noreferrer">Event details · new tab ↗</a></article>`;}).join('')||'<p>No confirmed upcoming events are listed on Zoi yet.</p>';}
/** No fetching, playback changes, or DOM side effects until explicitly mounted. */
export function mountArtistActions(root,artist,{C=globalThis.window?.ZoiCore}={}){
 if(!root)return()=>{};mounts.get(root)?.();if(!UUID.test(artist?.id||'')){root.replaceChildren();return()=>{};}
 const doc=root.ownerDocument,section=doc.createElement('section');section.className='zmp-context';section.setAttribute('aria-label',String(artist.name||'Artist')+' events and plans');
 section.innerHTML=`<div class="zmp-context-actions"><button type="button" data-player-events>Events</button><button type="button" data-demand-artist>Bring to my city</button><a href="/trips/?artist=${encodeURIComponent(artist.id)}" target="_blank" rel="noopener noreferrer">Greece plans ↗</a></div><p class="zmp-context-note">Plans open in a new tab; sign in to save. Music stays here.</p><div class="zmp-context-results" role="status" aria-live="polite"></div>`;root.append(section);
 let disposed=false,generation=0;const button=section.querySelector('[data-player-events]'),results=section.querySelector('.zmp-context-results');
 const cleanupDemand=mountArtistDemand({root:section,artist,C});
 if(!C?.auth||!C?.api?.rpc){const demand=section.querySelector('[data-demand-artist]');demand.disabled=true;demand.title='City requests are unavailable right now. Reload to retry.';}
 const load=async()=>{const request=++generation;button.disabled=true;results.textContent='Finding upcoming events…';try{if(!C?.api?.rpc)throw Error();const response=await C.api.rpc('artist_shows',{p_artist:artist.id},{auth:'anon'});if(disposed||request!==generation)return;results.innerHTML=artistEventsHTML(confirmedArtistEvents(response,artist.id));}catch{if(!disposed&&request===generation)results.textContent='Events could not be loaded. Select Events to try again.';}finally{if(!disposed&&request===generation)button.disabled=false;}};
 button.addEventListener('click',load);
 const cleanup=()=>{if(disposed)return;disposed=true;generation++;button.removeEventListener('click',load);cleanupDemand();section.remove();if(mounts.get(root)===cleanup)mounts.delete(root);};mounts.set(root,cleanup);return cleanup;
}

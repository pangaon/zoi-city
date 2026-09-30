import {parseMediaLink} from '../homes/shared-media-model.mjs';
import {mediaSelection} from '../community/media-provider.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function https(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function confirmedEventArtists(result,eventId,now=Date.now()){
 if(!UUID.test(eventId||'')||result?.ok!==true||result.event_id!==eventId||result.confirmation!=='event_and_artist_workspace'||!Array.isArray(result.artists)||result.artists.length>100)throw Error('Artist appearances could not be verified.');
 const seen=new Set();return result.artists.filter(a=>{
  if(!UUID.test(a?.id||'')||seen.has(a.id)||!UUID.test(a.artist_id||'')||a.event_id!==eventId||!['artist','creator'].includes(a.entity_type)||typeof a.artist_name!=='string'||!a.artist_name.trim()||typeof a.slug!=='string'||!a.slug||a.slug==='.'||a.slug==='..'||/[\\/?#\u0000-\u0020]/.test(a.slug)||!https(a.source_url))return false;
  const start=Date.parse(a.starts_at),end=Date.parse(a.ends_at);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end<now)return false;
  try{new Intl.DateTimeFormat('en',{timeZone:a.timezone}).format(new Date(start));}catch{return false;}if(typeof a.timezone!=='string'||!a.timezone)return false;
  seen.add(a.id);return true;
 }).map(a=>({...a,artist_name:a.artist_name.slice(0,180),url:'/'+a.entity_type+'/'+encodeURIComponent(a.slug),location:[a.city,a.country].filter(x=>typeof x==='string'&&x).join(', ').slice(0,220)})).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)||a.id.localeCompare(b.id));
}
// Supply only current authoritative/reviewed public selections. A provider URL by
// itself is not identity evidence; callers must honor owner media clears first.
export function eventArtistMedia(artistId,value){if(value?.artist_id!==artistId||value.reviewed!==true)return null;try{return{...mediaSelection(value),artist_id:artistId,image:https(value.image)||'',title:typeof value.title==='string'?value.title.slice(0,180):''};}catch{return null;}}
export function artistPageMedia(payload,owner,artistId){
 const a=payload?.artist;if(a?.id!==artistId)throw Error('Artist identity did not match.');
 if(owner && owner.listing!==artistId)throw Error('Artist media identity did not match.');
 const hidden=new Set(payload?.design?.hidden_sections||[]);
 const urls=owner?.authoritative===true?(Array.isArray(owner.items)&&owner.items.length<=24?owner.items.map(x=>({url:x.url,title:x.label})):[]):[...(!hidden.has('offerings')?[{url:a.spotify}]:[]),...(!hidden.has('media')?[{url:a.youtube}]:[])];
 for(const item of urls){try{const p=parseMediaLink(item.url);if(!p.embed||(owner?.authoritative===true&&hidden.has('media')))continue;return{...mediaSelection(p),image:https(a.portrait)||'',title:String(item.title||a.name||'Music').slice(0,180)};}catch{}}
 return null;
}
export function artistPageMediaFromHTML(html,artistId){
 // Read JSON text only: never insert or parse the full page into a browser DOM.
 function payload(id){const matches=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].filter(m=>new RegExp('\\bid=["\']'+id+'["\']','i').test(m[1])&&/\btype=["']application\/json["']/i.test(m[1]));if(matches.length>1)throw Error('Duplicate artist data.');return matches.length?JSON.parse(matches[0][2]):null;}
 return artistPageMedia(payload('music-home-content'),payload('zoi-owner-media-data'),artistId);
}
export async function loadArtistPageMedia(a,{fetcher=fetch,signal}={}){
 const response=await fetcher(a.url,{signal,credentials:'omit',redirect:'error',headers:{Accept:'text/html'}});if(!response.ok)throw Error('Artist profile unavailable.');
 if(Number(response.headers?.get('content-length'))>2000000)throw Error('Artist profile unavailable.');
 const reader=response.body?.getReader();let html='';if(reader){const decoder=new TextDecoder();let bytes=0;try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>2000000)throw Error('Artist profile unavailable.');html+=decoder.decode(part.value,{stream:true});}html+=decoder.decode();}finally{await reader.cancel();}}else{html=await response.text();if(html.length>2000000)throw Error('Artist profile unavailable.');}
 return artistPageMediaFromHTML(html,a.artist_id);

}
export function eventArtistsHTML(artists,{reviewedMediaByArtist={},limit=12}={}){return artists.slice(0,limit).map(a=>{const m=eventArtistMedia(a.artist_id,reviewedMediaByArtist[a.artist_id]),when=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short',timeZone:a.timezone}).format(new Date(a.starts_at));return `<article class="zea-card">${m?.image?`<img src="${esc(m.image)}" alt="${esc(a.artist_name)}" loading="lazy">`:`<span class="zea-initial" aria-hidden="true">${esc(a.artist_name.slice(0,1))}</span>`}<div><a class="zea-name" href="${esc(a.url)}">${esc(a.artist_name)}</a>${a.location?`<small>${esc(a.location)}</small>`:''}<time datetime="${esc(a.starts_at)}">${esc(when)} · ${esc(a.timezone)}</time></div><button type="button" data-ea-listen="${a.id}" aria-label="Explore music by ${esc(a.artist_name)}">♫ Music</button></article>`;}).join('');}
export function mountEventArtists(root,{eventId,core=globalThis.ZoiCore,C=core,reviewedMediaByArtist={},visible=true,hideEmpty=true,playerFactory=null,mediaLoader=loadArtistPageMedia}={}){
 if(!root||!UUID.test(eventId||''))throw Error('An actual event is required.');let ended=false,epoch=0,rows=[],limit=12,player=null;
 const abort=new AbortController();if(!visible){root.replaceChildren();return{refresh:async()=>{},destroy(){}};}
 if(!document.querySelector('link[data-event-artists-css]')){const l=document.createElement('link');l.rel='stylesheet';l.href='/assets/trips/event-artists.css?v=20260930';l.dataset.eventArtistsCss='';document.head.append(l);}
 root.classList.add('zoi-event-artists');const current=turn=>!ended&&turn===epoch&&root.isConnected;
 function render(){root.hidden=hideEmpty&&!rows.length;root.innerHTML=rows.length?`<div class="zea-heading"><h3>On stage</h3></div><div class="zea-grid">${eventArtistsHTML(rows,{reviewedMediaByArtist,limit})}</div>${rows.length>limit?'<button type="button" data-ea-more>More appearances</button>':''}<p data-ea-status role="status" aria-live="polite"></p>`:'<p>No confirmed artist appearances are listed for this event yet.</p>';}
 async function refresh(){const turn=++epoch;player?.destroy();player=null;root.hidden=false;root.innerHTML='<p role="status">Loading artist appearances…</p>';try{const result=await C.api.rpc('event_artists',{p_event:eventId},{auth:'anon'});if(!current(turn))return;rows=confirmedEventArtists(result,eventId);render();}catch{if(current(turn)){root.innerHTML='<p role="status">Artist appearances could not be loaded.</p><button type="button" data-ea-retry>Try again</button>';}}}
 root.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-ea-retry')){refresh();return;}if(b.hasAttribute('data-ea-more')){limit+=12;render();return;}if(!b.dataset.eaListen)return;const a=rows.find(a=>a.id===b.dataset.eaListen);if(!a)return;const turn=++epoch;b.disabled=true;try{const m=await mediaLoader(a,{signal:AbortSignal.any([abort.signal,AbortSignal.timeout(12000)])});if(!current(turn))return;if(!m){root.querySelector('[data-ea-status]').textContent='No playable music is currently shared here. Open the artist profile for their links.';return;}const factory=playerFactory||(await import('/assets/community/music-player.mjs?v=20260930-bounds')).createMusicPlayer;if(!current(turn))return;player?.destroy();player=factory({onClose:()=>{if(b.isConnected)b.focus();}});player.open({...m,artist:a.artist_name,title:m.title||a.artist_name,compact:true});root.querySelector('[data-ea-status]').textContent='';}catch{if(current(turn))root.querySelector('[data-ea-status]').textContent='Playback is unavailable. Try again or open the artist profile.';}finally{if(!ended&&b.isConnected)b.disabled=false;}},{signal:abort.signal});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!ended)refresh();},{signal:abort.signal});
 root.addEventListener('error',e=>{if(e.target.tagName==='IMG'){e.target.hidden=true;}},{capture:true,signal:abort.signal});refresh();return{refresh,destroy(){ended=true;epoch++;abort.abort();player?.destroy();root.replaceChildren();root.classList.remove('zoi-event-artists');}};
}

import {publishedAddressLookup,hasStreetPosition} from './loader.mjs';
import {quickLookDetails} from '../discovery/profile-preview.mjs?v=20261002-photo-authority';
const KEY='zoi.map.saved-places.v1';
function safeStorage(){try{return globalThis.localStorage}catch{return{getItem:()=>null,setItem:()=>{throw Error('storage_unavailable')}}}}
export function readSavedPlaces(storage=safeStorage()){try{const x=JSON.parse(storage.getItem(KEY)||'[]');return Array.isArray(x)?[...new Set(x.filter(v=>typeof v==='string'&&v.length>0&&v.length<=240))].slice(0,200):[]}catch{return []}}
export function toggleSavedPlace(storage,slug){if(typeof slug!=='string'||!slug||slug.length>240)throw Error('invalid_place');const old=readSavedPlaces(storage),saved=!old.includes(slug);if(saved&&old.length>=200)throw Error('saved_limit');const next=saved?[...old,slug]:old.filter(x=>x!==slug);storage.setItem(KEY,JSON.stringify(next));return{saved,slugs:next}}
const plain=v=>String(v||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
export function placeSummary(place,precision){return [plain(place.n),[place.city,place.country].map(plain).filter(Boolean).join(', '),place.addr?'Address: '+plain(place.addr):'Check the address before travelling.',plain(precision),'This is a place summary, not route guidance.'].filter(Boolean).join('. ').slice(0,700)}
export function mountPlacePreview(root,{place,home,directions,precision,onSaved=()=>{},storage=safeStorage(),speech=globalThis.speechSynthesis,utterance=globalThis.SpeechSynthesisUtterance,shareURL=()=>location.href,loadDetails=null,resolveDirections=null}={}){
 let alive=true,speaking=false,voiceId=0;const doc=root.ownerDocument;root.className='m-place-preview';root.setAttribute('aria-label','Selected place');root.setAttribute('role','region');
 const make=(tag,text,cls)=>{const e=doc.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e};
 const title=make('h3',place.n),location=make('p',[place.city,place.country].filter(Boolean).join(', '),'m-preview-location'),note=make('p',precision+(place.addr?' · '+place.addr:' · Confirm the address before travelling.'),'m-preview-note'),actions=make('div','','m-preview-actions'),status=make('p','','m-preview-status');status.setAttribute('role','status');
 const anchor=(label,url,external=false)=>{const a=make('a',label);a.href=url;if(external){a.target='_blank';a.rel='noopener noreferrer'}actions.append(a);return a};
 anchor('Open home ↗',home);const areaLookup=place.areaResult||!hasStreetPosition(place);let directionsLink=null;const providerNote=make('p','','m-preview-footnote');
 const updateDirections=action=>{const raw=typeof action==='string'?{href:action,label:'Directions ↗'}:action;let valid=false;try{const u=new URL(raw?.href);valid=u.protocol==='https:'&&u.hostname==='www.google.com'&&!u.username&&!u.password&&!u.hash&&['/maps/dir/','/maps/search/'].includes(u.pathname)&&u.searchParams.get('api')==='1'&&u.href.length<=2048;}catch{}
  if(!valid){directions=null;directionsLink?.remove();directionsLink=null;providerNote.textContent='Saved places stay on this device. Open the home to confirm the address before travelling.';return;}
  const lookup=new URL(raw.href).pathname==='/maps/search/',label=lookup?'Find published address ↗':'Directions ↗';providerNote.textContent=lookup?'Saved places stay on this device. Address lookup searches the published address in Google Maps; its exact location is not verified.':'Saved places stay on this device. Directions open your map provider.';
  directions=raw.href;if(!directionsLink)directionsLink=anchor(label,raw.href,true);else{directionsLink.href=raw.href;directionsLink.textContent=label;}
 };
 updateDirections(areaLookup?publishedAddressLookup(place):directions);
 const button=label=>{const b=make('button',label);b.type='button';actions.append(b);return b};
 const save=button('Save on this device'),share=button('Share place'),read=speech&&utterance?button('Read place aloud'):null,stop=read?button('Stop reading'):null;if(stop)stop.hidden=true;
 const update=()=>{const saved=readSavedPlaces(storage).includes(place.s);save.textContent=saved?'Saved on this device ✓':'Save on this device';save.setAttribute('aria-pressed',String(saved));};update();
 save.addEventListener('click',()=>{try{const result=toggleSavedPlace(storage,place.s);update();onSaved(result.slugs);status.textContent=result.saved?'Saved on this device. It is not synced to your account.':'Removed from this device’s saved places.'}catch(e){status.textContent=e.message==='saved_limit'?'You have saved 200 places. Remove one before adding another.':'This device could not save the place. Check browser storage settings.'}});
 share.addEventListener('click',async()=>{share.disabled=true;try{const url=shareURL();if(navigator.share)await navigator.share({title:place.n,text:[place.n,place.city,place.country].filter(Boolean).join(' · '),url});else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);if(alive)status.textContent='Link to this selected place copied.'}else{const link=make('a','Open the shareable place link');link.href=url;status.replaceChildren(link)}}catch(e){if(alive&&e.name!=='AbortError')status.textContent='Sharing was unavailable. Open the home to share its address.'}finally{if(alive)share.disabled=false}});
 const stopped=()=>{speaking=false;if(stop)stop.hidden=true;if(read)read.textContent='Read place aloud'};
 const cancel=()=>{voiceId++;if(speaking)speech.cancel();stopped()};
 read?.addEventListener('click',()=>{cancel();const u=new utterance(placeSummary(place,precision)),currentVoice=voiceId;u.onend=()=>{if(alive&&currentVoice===voiceId)stopped()};u.onerror=()=>{if(alive&&currentVoice===voiceId){stopped();status.textContent='Your browser could not read this place aloud.'}};speaking=true;stop.hidden=false;read.textContent='Read again';status.textContent='Reading this place summary. This is not turn-by-turn navigation.';speech.speak(u)});stop?.addEventListener('click',()=>{cancel();status.textContent='Reading stopped.'});
 const visibility=()=>{if(doc.hidden)cancel()};doc.addEventListener('visibilitychange',visibility);const changed=()=>update();globalThis.addEventListener?.('storage',changed);
 root.append(title,location,actions,note,providerNote,status);
 if(typeof loadDetails==='function'){
  Promise.resolve().then(()=>loadDetails(place.s)).then(value=>{
   if(!alive)return;const entity=Array.isArray(value)?value[0]:value;
   if(!entity||(entity.slug!==place.s&&entity.canonical_slug!==place.s))return;
   const details=quickLookDetails(entity);
   if(entity.marketplace_status==='hidden'||entity.publish_status&&entity.publish_status!=='published'){updateDirections(null);return;}
   if(areaLookup){updateDirections(publishedAddressLookup(place,{address:details.address,name:entity.name??place.n,city:Object.hasOwn(entity,'city')?entity.city:place.city,country:Object.hasOwn(entity,'country')?entity.country:place.country}));}
   else if(typeof resolveDirections==='function')updateDirections(resolveDirections(entity,place,details));
   if(details.description){const description=make('p',details.description,'m-preview-description');root.insertBefore(description,note);}
   note.textContent=precision+(details.address?' · '+details.address:' · Confirm the address before travelling.');
   if(details.photo){const image=make('img','','m-preview-image');image.alt=place.n+' · published photograph';image.src=details.photo;image.loading='lazy';image.addEventListener('error',()=>image.remove(),{once:true});root.insertBefore(image,note);}
   for(const link of details.links){if(link.label==='Directions'&&(areaLookup||typeof resolveDirections==='function'||directions))continue;anchor(link.label,link.href,!link.href.startsWith('tel:'));}
  }).catch(()=>{/* Base map actions remain usable when optional details are unavailable. */});
 }
 return{destroy(){alive=false;cancel();doc.removeEventListener('visibilitychange',visibility);globalThis.removeEventListener?.('storage',changed);root.replaceChildren()}};
}

import {publicURL,plain} from './profile.ts';
import {musicDraft} from './music.ts';
// Shared reviewed catalogue also powers canonical artist homes.
// @ts-ignore JavaScript source catalogue
import {ARTIST_SOURCES} from '../../assets/homes/templates/music/sources.mjs';
export const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function locality(v:unknown){return String(v??'').normalize('NFKC').replace(/\s+/g,' ').trim();}
export const localityKey=(v:unknown)=>locality(v).toLowerCase();
export function musicProvider(value:unknown){const safe=publicURL(value);if(!safe.startsWith('https://'))return null;const u=new URL(safe),h=u.hostname.toLowerCase().replace(/^www\./,'');if(u.port)return null;const provider=h==='open.spotify.com'&&/^\/(?:artist|album|track|playlist)\/[A-Za-z0-9]+\/?$/.test(u.pathname)?'Spotify':(['youtube.com','m.youtube.com'].includes(h)&&(/^\/(?:watch|playlist)$/.test(u.pathname)||/^\/(?:user|channel|@|shorts)/.test(u.pathname)))||h==='youtu.be'&&/^\/[\w-]+$/.test(u.pathname)?'YouTube':h==='music.apple.com'?'Apple Music':h==='soundcloud.com'?'SoundCloud':h==='bandcamp.com'||h.endsWith('.bandcamp.com')?'Bandcamp':null;return provider?{provider,url:u.href}:null;}
function sameWebsite(a:string,b:string){try{const x=new URL(a),y=new URL(b);return x.protocol==='https:'&&x.hostname.replace(/^www\./,'')===y.hostname.replace(/^www\./,'')&&(y.pathname==='/'||x.pathname.replace(/\/$/,'')===y.pathname.replace(/\/$/,''));}catch{return false;}}
export function artistPresentation(profile:any){
 if(!profile||profile.type!=='artist'||!uuid(profile.id))return null;
 const candidate=(ARTIST_SOURCES as Record<string,any>)[profile.id];
 const names=candidate?[candidate.name,candidate.greek_name,...(profile.id==='a558f28d-6c8f-4079-9730-838f483867fc'?['Giorgos Dalaras','Γιώργος Νταλάρας']:[])].map(localityKey):[];
 const source=candidate&&names.includes(localityKey(profile.name))&&(!profile.website&&profile.id==='78ee3fac-5a97-4e87-88af-57f1eb6a638d'||sameWebsite(profile.website,candidate.website))?candidate:null;
 const draft=musicDraft(profile.profile||{}),seen=new Set<string>();const links:any[]=[];
 const add=(label:string,value:unknown)=>{const p=musicProvider(value);if(p&&!seen.has(p.url)){seen.add(p.url);links.push({...p,label});}};
 if(source){add('Listen on Spotify',source.spotify);add('Watch on YouTube',source.video_playlist||source.youtube);}
 for(const [field,label]of [['spotify_url','Listen on Spotify'],['apple_music_url','Apple Music'],['youtube_url','Watch on YouTube'],['bandcamp_url','Bandcamp'],['soundcloud_url','SoundCloud']])add(label,draft[field]);
 for(const social of profile.socials||[])add(social.label,social.url);
 const releases=(source?.releases||draft.releases||[]).flatMap((r:any)=>{const p=musicProvider(r.url);return p&&plain(r.title)?[{title:plain(r.title),...p,image:publicURL(r.image).startsWith('https://')?publicURL(r.image):'',kind:plain(r.kind),year:Number.isInteger(r.year)?r.year:null}]:[]}).slice(0,30);
 const images:any[]=[];const photo=publicURL(source?.portrait||profile.photo);if(photo.startsWith('https://'))images.push({url:photo,caption:plain(source?.portrait_credit)||'Artist listing photo'});
 for(const r of source?.gallery||[]){const url=publicURL(typeof r==='string'?r:r.url);if(url.startsWith('https://')&&!images.some(p=>p.url===url))images.push({url,caption:plain(r.caption||r.credit)||'Source photo'});}
 return {name:profile.name,greekName:plain(source?.greek_name),story:plain(source?.story||profile.description||draft.press),images:images.slice(0,12),links,releases,source:source?{url:source.website,label:source.source_label||'Artist website',checkedAt:source.checked_at}:null,canonical:'https://www.zoi.city/artist/'+encodeURIComponent(profile.slug),showsArtist:profile.showsArtist||'',inquiryListing:profile.inquiryListing||''};
}
export type DemandRow={city:string;country:string;active:boolean;version:number};
export type DemandPayload={p_artist:string;p_city:string;p_country:string;p_active:boolean;p_request:string;p_expected_version:number};
export function demandPayload(artist:string,city:string,country:string,active:boolean,request:string,version:number):DemandPayload{city=locality(city);country=locality(country);const valid=(v:string)=>v.length>=2&&v.length<=100&&/^[\p{L}\p{M}\p{N} .,'’()-]+$/u.test(v)&&/\p{L}/u.test(v);if(!uuid(artist)||!uuid(request)||!valid(city)||!valid(country)||typeof active!=='boolean'||!Number.isSafeInteger(version)||version<0)throw Error('Enter a city and full country name.');return {p_artist:artist,p_city:city,p_country:country,p_active:active,p_request:request,p_expected_version:version};}
export function demandMine(value:any,artist:string):DemandRow[]{if(value?.ok!==true||value.artist!==artist||!Array.isArray(value.requests))throw Error('Your saved interest could not be verified.');return value.requests.map((r:any)=>{if(!r||typeof r.city!=='string'||typeof r.country!=='string'||typeof r.active!=='boolean'||!Number.isSafeInteger(r.version)||r.version<1)throw Error('Your saved interest could not be verified.');return {city:r.city,country:r.country,active:r.active,version:r.version};});}
export function demandSummary(value:any,artist:string){if(value?.ok!==true||value.artist!==artist||typeof value.available!=='boolean'||value.privacy_threshold!==5||!Array.isArray(value.cities)||value.cities.some((r:any)=>typeof r.city!=='string'||typeof r.country!=='string'||!Number.isSafeInteger(r.count)||r.count<5))throw Error('City interest is unavailable.');return {available:value.available,cities:value.cities as {city:string;country:string;count:number}[]};}
export function demandReceipt(value:any,p:DemandPayload){if(value?.ok!==true||value.artist!==p.p_artist||value.request!==p.p_request||value.active!==p.p_active||value.version!==p.p_expected_version+1)throw Error('The saved result could not be verified. Retry the same request.');return value;}

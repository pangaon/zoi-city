import {auxiliaryImage} from '../../supabase/functions/zoi-enrich/_image-context.js';
import {sharedBranchContactSource} from '../enrichment/branch-contact-scope.mjs';
import {websiteContacts} from '../homes/source-contact.mjs';
import {phoneHref} from '../homes/phone.mjs';
export const publicText=v=>typeof v==='string'?v.replace(/<[^>]*(?:>|$)/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim():'';
const text=publicText;
const own=(x,k)=>Object.hasOwn(x||{},k);
export function publicURL(v){try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function sourceIdentity(e){
 const q=e.profile?._enrich||{};
 if(q.source_kind==='association_directory'||q.identity_scope==='organization'||q.organization_identity_quarantine||q.source_affiliation||q.member?.affiliation)return false;
 try{const a=new URL(e.website),b=new URL(q.source_url);return a.protocol==='https:'&&b.protocol==='https:'&&!a.username&&!b.username&&a.hostname.replace(/^www\./,'')===b.hostname.replace(/^www\./,'')&&(a.pathname==='/'||a.pathname.replace(/\/$/,'')===b.pathname.replace(/\/$/,''));}catch{return false;}
}
function sourcePhoto(v){const url=publicURL(typeof v==='string'?v:v?.url);if(!url||!url.startsWith('https:')||auxiliaryImage(url))return null;let path=new URL(url).pathname;try{path=decodeURIComponent(path);}catch{}return /(?:^|[\/_. -])(?:logo|wordmark|icon|avatar|favicon|sprite|badge|placeholder|poster|flyer)(?:[\/_. -]|$)/i.test(path)?null:url;}
export function quickLookDetails(e){
 const o=e.owner_content||{},p=e.profile||{},op=o.profile||{},source=websiteContacts(e);
 const value=k=>own(o,k)?o[k]:own(op,k)?op[k]:own(p,k)?p[k]:e[k];
 const q=p._enrich||{},trusted=sourceIdentity(e),has=k=>own(o,k)||own(op,k)||own(p,k),locationSource=trusted&&!sharedBranchContactSource(e,q.source_url);
 const website=publicURL(value('website')),address=text(value('address'))||(!has('address')&&locationSource?[text(q.address_parts?.street),text(q.address_parts?.postcode)].filter(Boolean).join(', '):''),phone=phoneHref((own(o,'phone')||own(op,'phone')||own(p,'phone'))?value('phone'):(value('phone')||source.phone));
 const description=text(value('description'))||(!own(o,'description')&&!own(op,'description')&&!own(p,'description')&&trusted?text(q.description):'');
 const menu=publicURL(value('menu_url'))||(!has('menu_url')&&!has('menu')&&trusted?publicURL(q.menu_url):null);
 const photoKeys=['photo_url','photos','photo_urls','hero_url','hero_image','hero','gallery'];
 const photo=has('photo_url')?publicURL(value('photo_url')):publicURL(e.photo_url)||((!photoKeys.some(has)&&trusted)?[q.hero_url,...(Array.isArray(q.photo_urls)?q.photo_urls:[]),...(Array.isArray(q.photos)?q.photos:[])].map(sourcePhoto).find(Boolean)||null:null);
 const links=[];if(menu)links.push({href:menu,label:'View menu'});if(website)links.push({href:website,label:'Official website'});if(phone)links.push({href:phone,label:'Call'});
 if(address)links.push({href:'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent([e.name,address,e.city,e.country].filter(Boolean).join(', ')),label:'Directions'});
 const imageKind=value('hero_kind')==='event_poster'&&photo&&photo===publicURL(value('hero_url'))?'event_poster':null;
 return {description,address,photo,imageKind,links};
}

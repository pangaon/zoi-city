import {placeholderPhone} from '../../supabase/functions/zoi-enrich/_phone.js';
import {sourceIdentity,publicListingMedia,publicListingDescription} from './public-listing-media.mjs';
export {sourceIdentity} from './public-listing-media.mjs';
import {sharedBranchContactSource} from '../enrichment/branch-contact-scope.mjs';
import {websiteContacts} from '../homes/source-contact.mjs';
import {phoneHref} from '../homes/phone.mjs';
export const publicText=v=>typeof v==='string'?v.replace(/<[^>]*(?:>|$)/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim():'';
const text=publicText;
const own=(x,k)=>Object.hasOwn(x||{},k);
export function publicURL(v){try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function quickLookDetails(e){
 const o=e.owner_content||{},p=e.profile||{},op=o.profile||{},source=websiteContacts(e);
 const value=k=>own(o,k)?o[k]:own(op,k)?op[k]:own(p,k)?p[k]:e[k];
 const q=p._enrich||{},trusted=sourceIdentity(e),has=k=>own(o,k)||own(op,k)||own(p,k),locationSource=trusted&&!sharedBranchContactSource(e,q.source_url);
 const website=publicURL(value('website')),address=text(value('address'))||(!has('address')&&locationSource?[text(q.address_parts?.street),text(q.address_parts?.postcode)].filter(Boolean).join(', '):''),phone=phoneHref((own(o,'phone')||own(op,'phone')||own(p,'phone'))?value('phone'):(!placeholderPhone(value('phone'))&&value('phone')||source.phone));
 const description=publicListingDescription(e);
 const menu=publicURL(value('menu_url'))||(!has('menu_url')&&!has('menu')&&trusted?publicURL(q.menu_url):null);
 const media=publicListingMedia(e),photo=media.hero;
 const links=[];if(menu)links.push({href:menu,label:'View menu'});if(website)links.push({href:website,label:'Official website'});if(phone)links.push({href:phone,label:'Call'});
 if(address)links.push({href:'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent([e.name,address,e.city,e.country].filter(Boolean).join(', ')),label:'Directions'});
 const imageKind=media.imageKind,photoAuthoritative=true;
 return {description,address,photo,logo:media.logo,logoBackdrop:media.logoBackdrop,logoFit:media.logoFit,imageKind,photoAuthoritative,links};
}

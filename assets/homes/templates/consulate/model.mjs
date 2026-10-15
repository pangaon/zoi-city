import{officialSourceQuarantined}from'../../../enrichment/official-source-policy.mjs';
import{briefBlocked}from'../../../enrichment/client-brief.mjs';
import{DIPLOMATIC_SOURCE_PROFILES}from'./source-profiles.mjs';
import{orderedRecords}from'../design.mjs';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
export const text=v=>typeof v==='string'?v.replace(/\s+/g,' ').trim():'';
const norm=v=>text(v).normalize('NFKC').toLowerCase();
const has=(v,k)=>Object.hasOwn(object(v),k);
export function safeURL(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u.href:'';}catch{return '';}}
function documentKey(value){try{const u=new URL(safeURL(value));return u.hostname.replace(/^www\./,'')+u.pathname.replace(/\/$/,'')+u.search;}catch{return '';}}
export function diplomaticEntity(e){
 if(e?.entity_type!=='organization'||e.marketplace_status==='hidden'||e.publish_status&&e.publish_status!=='published'||e.moderation_status&&!['clean','cleared'].includes(e.moderation_status)||e.duplicate_status==='confirmed_duplicate')return false;
 const category=[e.category_slug,e.category_name,e.category].map(text).join(' ');
 return /\b(?:embass(?:y|ies)|consulat(?:e|es)|consular|diplomatic)\b/i.test(category)||/^(?:(?:honorary |general )?consulate(?: general)? of|embassy of|consular office(?: of)?)\b/i.test(text(e.name))||/^Greek (?:embassy|consulate)\b/i.test(text(e.name));
}
function countryMatches(actual,expected){return({ 'United Kingdom':['united kingdom','gb','uk','great britain'],Canada:['canada','ca'],Australia:['australia','au']}[expected]||[norm(expected)]).includes(norm(actual));}
function sourceProfile(e,website){const q=object(e.profile?._enrich);if(officialSourceQuarantined(e)||briefBlocked(q)||q.source_scope_mismatch===true||q.source_scope_mismatch==='true'||['association_directory','association_member','publisher_profile'].includes(q.source_kind)||q.identity_scope==='organization'||q.source_affiliation||q.member?.affiliation||q.association_member)return null;return DIPLOMATIC_SOURCE_PROFILES.find(p=>p.id===e.id&&norm(p.name)===norm(e.name)&&norm(p.city)===norm(e.city)&&countryMatches(e.country,p.country)&&documentKey(p.website)&&documentKey(p.website)===documentKey(website))||null;}
const email=v=>/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(text(v))?text(v):'';
const phone=v=>/^\+?[\d ()-]{7,30}$/.test(text(v))?text(v):'';
export function consulateContent(entity,design={}){
 if(!diplomaticEntity(entity))return null;
 const e=entity,raw=object(e.profile),owner=object(e.owner_content),op=object(owner.profile),layers=[owner,op,raw];
 const explicit=key=>layers.find(layer=>has(layer,key));
 const value=(key,fallback)=>{const layer=explicit(key);return layer?layer[key]:has(e,key)?e[key]:fallback;};
 const website=safeURL(value('website','')),source=sourceProfile(e,website);
 const serviceLayer=explicit('services')||(has(e,'services')?e:null),services=serviceLayer?(Array.isArray(serviceLayer.services)?serviceLayer.services:[]).map((v,i)=>typeof v==='string'?{id:'owner-'+i,name:text(v),summary:'',url:''}:{id:'owner-'+i,name:text(v?.name||v?.title),summary:text(v?.summary||v?.description),url:safeURL(v?.url)}).filter(v=>v.name).slice(0,30):source?.services||[];
 const bookingLayer=explicit('booking_url')||(has(e,'booking_url')?e:null);
 const appointment=bookingLayer?(safeURL(bookingLayer.booking_url)?{name:'Appointment link',url:safeURL(bookingLayer.booking_url),note:'Continue on the published appointment website. Zoi does not confirm availability.'}:null):!serviceLayer?source?.appointment||null:null;
 const contacts=(source?.contacts||[]).map(c=>({...c,email:explicit('email')?'':email(c.email),phone:explicit('phone')?'':phone(c.phone)}));
 if(!source)contacts.unshift({label:'Contact the mission',email:email(value('email','')),phone:phone(value('phone','')),source_url:''});
 else if(contacts.length&&(explicit('email')||explicit('phone')))contacts[0]={...contacts[0],label:'Published contact',email:explicit('email')?email(value('email','')):contacts[0].email,phone:explicit('phone')?phone(value('phone','')):contacts[0].phone};
 const addressLayer=explicit('address'),address=addressLayer?text(addressLayer.address):text(source?.address||e.address);
 const addressConflict=!!source?.address_conflict&&!addressLayer&&norm(e.address)!==norm(source.address);
 const introLayer=explicit('description'),intro=introLayer?text(introLayer.description):source?.intro||text(e.description);
 return{id:e.id,name:text(e.name),slug:text(e.canonical_slug||e.slug),kind:source?.kind||(/embassy/i.test(text(e.name))?'Embassy':'Consular mission'),city:text(e.city),country:text(e.country),website,intro,
  services:orderedRecords(services,design.item_order?.offerings),services_from_owner:!!serviceLayer,appointment,contacts:contacts.filter(c=>c.email||c.phone),address,address_conflict:addressConflict,
  jurisdiction:source?.jurisdiction||'',jurisdiction_url:source?.jurisdiction_url||'',visit_note:source?.visit_note||'Contact the mission to confirm the service, required documents and visiting arrangements before travelling.',visit_source:source?.visit_source||'',
  useful_links:source?.useful_links||[],source_url:source?.contact_url||website,source_checked_at:source?.checked_at||'',source_profile_applied:!!source,
  hours:explicit('hours')?text(explicit('hours').hours):'',photo:explicit('photo_url')?safeURL(explicit('photo_url').photo_url):'',
  source_coverage:source?'individually sourced mission pages':'published listing fields; individual mission research pending'};
}

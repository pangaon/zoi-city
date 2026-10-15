import{officialSourceQuarantined,selectedOutwardWebsite,selectedOfficialWebsite}from'../../../enrichment/official-source-policy.mjs';
import{briefBlocked,scopedSourceServices}from'../../../enrichment/client-brief.mjs';
import{orderedRecords}from'../design.mjs';
import{SCHOOL_SOURCE_PROFILES}from'./source-profiles.mjs';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const has=(v,k)=>Object.hasOwn(object(v),k);
export const text=v=>typeof v==='string'?v.replace(/\s+/g,' ').trim():'';
const norm=v=>text(v).normalize('NFKC').toLowerCase();
export function safeURL(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&!u.port?u.href:'';}catch{return '';}}
function documentKey(value){try{const u=new URL(safeURL(value));return u.protocol+'//'+u.hostname.replace(/^www\./,'')+u.pathname.replace(/\/$/,'')+u.search;}catch{return '';}}
export function schoolEntity(e){return e?.entity_type==='school'&&e.marketplace_status!=='hidden'&&(!e.publish_status||e.publish_status==='published')&&(!e.moderation_status||['clean','cleared'].includes(e.moderation_status))&&e.duplicate_status!=='confirmed_duplicate';}
function sourceHeld(e){const q=object(e.profile?._enrich);return officialSourceQuarantined(e)||briefBlocked(q)||q.crawl_status==='error'||q.source_scope_mismatch===true||q.source_scope_mismatch==='true'||['association_directory','association_member','supporting_publisher_profile','publisher_profile'].includes(q.source_kind)||q.identity_scope==='organization'||q.source_affiliation||q.member||q.association_member;}
function countryMatches(a,b){const groups=[['au','australia'],['us','usa','united states','united states of america']];return norm(a)===norm(b)||groups.some(g=>g.includes(norm(a))&&g.includes(norm(b)));}
function streetCore(value){const street=text(value).replace(/\([^)]*\)/g,'').match(/\b\d+[a-z]?(?:[-/]\d+[a-z]?)?\s+[^,]+/i)?.[0];return norm(street).replace(/[.]/g,'').replace(/\b(st|rd|ave|blvd|dr|tce)\b/g,v=>({st:'street',rd:'road',ave:'avenue',blvd:'boulevard',dr:'drive',tce:'terrace'})[v]).replace(/\s+/g,' ').trim();}
function sameStreet(a,b,country){const x=streetCore(a),y=streetCore(b);if(!x||x!==y)return false;const pattern=country==='Australia'?/\b\d{4}\b/g:/\b\d{5}(?:-\d{4})?\b/g,p=text(a).match(pattern)?.at(-1),q=text(b).match(pattern)?.at(-1);return !p||!q||p===q;}
export function schoolContent(entity,design={}){
 if(!schoolEntity(entity))return null;
 const e=entity,raw=object(e.profile),owner=object(e.owner_content),op=object(owner.profile),layers=[owner,op,raw];
 const explicit=key=>layers.find(v=>has(v,key));
 const value=(key,fallback)=>{const layer=explicit(key);return layer?layer[key]:has(e,key)?e[key]:fallback;};
 const website=safeURL(selectedOutwardWebsite(e)),registered=selectedOfficialWebsite(e),held=sourceHeld(e),source=!held?SCHOOL_SOURCE_PROFILES.find(p=>p.id===e.id&&norm(p.name)===norm(e.name)&&norm(p.city)===norm(e.city)&&countryMatches(p.country,e.country)&&documentKey(registered)===documentKey(p.website)):null;
 const servicesLayer=explicit('services')||(has(e,'services')?e:null),imported=!servicesLayer&&!held?scopedSourceServices({...e,website:registered}):[];
 const programmes=servicesLayer?(Array.isArray(servicesLayer.services)?servicesLayer.services:[]).map((s,i)=>({id:'owner-'+i,name:text(typeof s==='string'?s:s?.name||s?.title),summary:text(s?.description||s?.summary),url:safeURL(s?.url)})).filter(s=>s.name).slice(0,30):imported.length?imported.map((s,i)=>({id:'source-'+i,name:s.name,summary:s.description,url:''})):source?.programmes||[];
 const bookingLayer=explicit('booking_url')||(has(e,'booking_url')?e:null),application=bookingLayer?(safeURL(bookingLayer.booking_url)?{name:'Published application link',url:safeURL(bookingLayer.booking_url),note:'Continue with the school to check the process. Zoi does not submit an application or confirm a place.'}:null):!servicesLayer?source?.application||null:null;
 const address=text(value('address',source?.address||''));
 // A null base contact column is absence, while an explicit owner/profile clear
 // always suppresses a source contact. Curated source facts never override owners.
 const contact=key=>explicit(key)?value(key,''):text(e[key])||source?.[key]||'';
 const selectedEmail=text(contact('email')),selectedPhone=text(contact('phone')),publishedAddress=explicit('address')?address:text(e.address)||source?.address||'',addressConflict=!!source?.address&&!explicit('address')&&!!text(e.address)&&!sameStreet(e.address,source.address,source.country);
 return{id:e.id,name:text(e.name),slug:text(e.canonical_slug||e.slug),city:text(e.city),country:text(e.country),website,kind:source?.kind||'School & learning',stage:source?.stage||'unknown',intro:explicit('description')?text(value('description','')):source?.intro||text(e.description),programmes:orderedRecords(programmes,design.item_order?.offerings),services_from_owner:!!servicesLayer,curriculum:servicesLayer?[]:source?.curriculum||[],application,visit_note:source?.visit_note||'Contact the school to confirm programmes, age groups, dates, fees and application arrangements.',email:/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(selectedEmail)?selectedEmail:'',phone:/^\+?[\d ()-]{7,30}$/.test(selectedPhone)?selectedPhone:'',address:publishedAddress,address_conflict:addressConflict,source_address:addressConflict?source.address:'',resources:source?.resources||[],source_profile_applied:!!source,source_checked_at:source?.checked_at||'',source_url:source?.website||website};
}

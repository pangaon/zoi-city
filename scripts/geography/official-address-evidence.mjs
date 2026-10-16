import {Buffer} from 'node:buffer';
import {canonical,sha256} from '../quality/evidence.mjs';
import {inspectSourceDocument} from '../../supabase/functions/zoi-enrich/_document-quality.js';
import {wixSourceURL,scanWixJSON} from './wix-business-location-evidence.mjs';
import {officialSourceQuarantined,sourceIdentityContentHeld} from '../../assets/enrichment/official-source-policy.mjs';

export const ADDRESS_LIMITS=Object.freeze({document:1500000,card:8192,observations:8,maxAgeMs:7*86400000});
export const addressNorm=value=>typeof value==='string'?value.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]+/gu,' ').trim():'';
// Physical street identity must survive Unicode and punctuation counterexamples.
// Only benign ASCII case and whitespace differ; no aliases are silently made.
export const addressLiteralNorm=value=>typeof value==='string'?value.replace(/[A-Z]/g,c=>c.toLowerCase()).replace(/\s+/g,' ').trim():'';
// A whole explicit address component is required. Word boundaries alone would
// still accept a different road such as 'Rahway Avenue West'. Undelimited
// street+city prose remains held instead of guessing its component boundary.
export const canonicalStreetMatches=(value,street)=>{const expected=addressLiteralNorm(street);return !!expected&&typeof value==='string'&&value.split(/[,;()\[\]\r\n]+/).some(part=>addressLiteralNorm(part)===expected);};
const object=x=>x&&typeof x==='object'&&!Array.isArray(x),held=v=>v===true||v==='true';
const fail=code=>{throw Error(code);};
const hex=(v,n)=>typeof v==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(v);
export function addressContextAllowed(row){
 if(!row||row.public_eligible!==true||row.source_kind!=='official_website'||row.owner_managed||row.owner_user_id||row.owner_workspace_id||row.claim_status!=null&&row.claim_status!=='unclaimed'||row.duplicate_status==='confirmed_duplicate'||row.marketplace_status==='hidden')return false;
 if(row.owner_managed!==false&&!(Object.hasOwn(row,'owner_user_id')&&row.owner_user_id===null&&Object.hasOwn(row,'owner_workspace_id')&&row.owner_workspace_id===null))return false;
 if([row.source_context,row.profile?._enrich,row.enrichment].some(v=>v!=null&&!object(v))||row.profile!=null&&!object(row.profile)||object(row.profile)&&Object.hasOwn(row.profile,'_enrich')&&!object(row.profile._enrich))return false;
 for(const e of [row.source_context,row.profile?._enrich,row.enrichment].filter(object)){
  if(officialSourceQuarantined({...row,profile:{...row.profile,_enrich:e}})||sourceIdentityContentHeld({...row,profile:{...row.profile,_enrich:e}}))return false;
  for(const q of [e,...Object.hasOwn(e,'source_identity')?[e.source_identity]:[]]){
   if(!object(q))return false;
   if(['blocked','source_challenge','source_scope_mismatch','scope_review_required','organization_identity_quarantine','identity_conflict','branch_conflict','identity_review_required','entity_family_review_required','challenge','source_challenged','captcha','challenge_detected'].some(k=>Object.hasOwn(q,k)&&(![true,false,'true','false'].includes(q[k])||held(q[k])))||['blocked_reason','last_error'].some(k=>Object.hasOwn(q,k)&&q[k]!==null&&(typeof q[k]!=='string'||q[k]!==''))||['status','crawl_status'].some(k=>Object.hasOwn(q,k)&&q[k]!==null&&(typeof q[k]!=='string'||q[k]&&!['ok','success','complete','completed','fetched','verified'].includes(q[k])))||Object.hasOwn(q,'identity_match')&&q.identity_match!==true&&q.identity_match!=='true')return false;
  }
  if(e.source_identity&&(Object.hasOwn(e.source_identity,'verification')&&e.source_identity.verification!=='exact_name_typed_jsonld'||Object.hasOwn(e.source_identity,'name')&&(typeof e.source_identity.name!=='string'||addressNorm(e.source_identity.name)!==addressNorm(row.name))||Object.hasOwn(e.source_identity,'expected_entity_type')&&e.source_identity.expected_entity_type!==row.entity_type||Object.hasOwn(e.source_identity,'source_url')&&e.source_identity.source_url!==row.website))return false;
 }
 if([row.source_context,row.profile?._enrich,row.enrichment].filter(object).some(e=>['blocked','source_challenge','source_scope_mismatch','scope_review_required','organization_identity_quarantine'].some(k=>held(e[k]))||e.blocked_reason||e.source_kind==='association_member'||e.identity_scope==='organization'&&['artist','creator','professional'].includes(row.entity_type)))return false;
 if(object(row.profile)&&['name','address','city','country','website','latitude','longitude','geo_precision'].some(k=>Object.hasOwn(row.profile,k)&&canonical(row.profile[k])!==canonical(row[k]??null)))return false;
 return true;
}
export function addressSourceBytes(value){const bytes=Buffer.from(value);if(!bytes.length||bytes.length>ADDRESS_LIMITS.document)fail('address_document_size');let html;try{html=new TextDecoder('utf8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{fail('address_document_utf8');}if(typeof value==='string'&&html!==value)fail('address_document_utf8');return{bytes,html};}
function visibleCard(card){
 // Qualification is deliberately limited to a simple, visible contact block.
 // CSS classes cannot establish visibility: independent full-document review
 // remains explicit, and hidden/raw-text/foreign contexts are refused here.
 if(/<!--|<(?:script|style|noscript|template|svg|math|iframe|object|textarea|title|xmp|plaintext)\b|\bhidden(?:\s|=|>)|aria-hidden\s*=\s*["']true|display\s*:\s*none|visibility\s*:\s*hidden/i.test(card))fail('address_card_hidden_or_active');
 return card.replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&');
}
export const addressContext=row=>Object.fromEntries(['id','name','address','city','country','website'].map(k=>[k,row[k]??null]));
export function addressQuote(card,quote,literal){
 const bytes=Buffer.from(card);if(!object(quote)||!Number.isSafeInteger(quote.start_byte)||!Number.isSafeInteger(quote.end_byte)||quote.start_byte<0||quote.end_byte<=quote.start_byte||quote.end_byte>bytes.length||!hex(quote.sha256,64))fail('address_quote_invalid');
 const raw=bytes.subarray(quote.start_byte,quote.end_byte);if(sha256(raw)!==quote.sha256||raw.toString('utf8')!==literal)fail('address_quote_mismatch');
 return true;
}
/** Address observations are collection support, never provider admission or
 * official identity approval. A PostalAddress does not need a GeoCoordinates. */
export function observeOfficialAddresses(html,row,{sourceUrl=row?.website,httpStatus=200}={}){
 if(typeof html!=='string'||Buffer.byteLength(html)>ADDRESS_LIMITS.document||!addressContextAllowed(row)||httpStatus!==200||!wixSourceURL(sourceUrl,row.website))return null;
 const quality=inspectSourceDocument(html);if(quality.source_state==='source_challenge'||quality.requires_rendering)return null;
 const observations=[];let nodes=0;
 for(const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)){
  let parsed;try{parsed=scanWixJSON(m[1],{maxNodes:1000,maxDepth:12}).data;}catch{continue;}
  const walk=(n,depth=0)=>{if(++nodes>1500||depth>12)return;if(Array.isArray(n)){for(const x of n)walk(x,depth+1);return;}if(!object(n))return;
   const a=n.address;if(addressNorm(n.name)===addressNorm(row.name)&&object(a)&&a.streetAddress&&a.addressLocality&&a.addressCountry){const c=object(a.addressCountry)?a.addressCountry.name||a.addressCountry.identifier:a.addressCountry;observations.push({role:'structured_postal_address_without_coordinate_authority',source_name:n.name,address:{street:a.streetAddress,city:a.addressLocality,region:a.addressRegion||'',postal_code:a.postalCode||'',country:c},structured_geo_present:!!n.geo});}
   for(const v of Object.values(n))if(object(v)||Array.isArray(v))walk(v,depth+1);
  };walk(parsed);
 }
 // Plain pages are common. Preserve a cheap deterministic research locator
 // even when no schema.org address exists. This is text presence only: CSS
 // visibility, a unique branch and individual address parts still require the
 // separately retained/quoted contact-block qualification below.
 const prose=html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|noscript|template|svg|math|textarea|title)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<[^>]*>/g,' '),text=addressNorm(prose),literal=addressNorm(row.address);
 if(literal&&addressNorm(row.name)&&text.includes(literal)&&text.includes(addressNorm(row.name))&&addressNorm(row.city)&&text.includes(addressNorm(row.city)))observations.push({role:'stored_address_text_occurrence_requires_visible_branch_review',address_text:row.address,canonical_city_context:row.city,canonical_country_context:row.country,source_name_context:row.name,source_country_verified:false,visibility_verified:false,branch_verified:false});
 if(!observations.length)return null;
 return{kind:'official_address_observations',listing_id:row.id,source_url:sourceUrl,source_sha256:sha256(html),observations:observations.slice(0,ADDRESS_LIMITS.observations),truncated:observations.length>ADDRESS_LIMITS.observations,authority:'none',writer_eligible:false,provider_admission:false,independent_review_required:true};
}
export function validateQualifiedAddress(proof,snapshot,{now=Date.now()}={}){
 if(!object(proof)||proof.schema!==1||proof.kind!=='reviewed_official_public_address'||!addressContextAllowed(snapshot)||canonical(proof.canonical_context)!==canonical(addressContext(snapshot)))fail('address_current_context');
 const cap=proof.capture,a=proof.address,card=proof.card,identity=proof.identity;
 if(!object(cap)||cap.listing_id!==snapshot.id||cap.strategy!=='official_sources_v1'||!hex(cap.input_fingerprint,32)||!hex(cap.capture_result_hash,32)||!hex(cap.source_json_sha256,64)||!hex(cap.source_sha256,64)||!wixSourceURL(cap.source_url,snapshot.website)||cap.archive_format!=='decoded_utf8_sha256'||!/^[a-zA-Z0-9_-]{1,100}$/.test(cap.private_archive||'')||!Number.isSafeInteger(cap.source_bytes)||cap.source_bytes<1||cap.source_bytes>ADDRESS_LIMITS.document)fail('address_capture_binding');
 if(!Number.isFinite(Date.parse(cap.captured_at))||Date.parse(cap.captured_at)<now-ADDRESS_LIMITS.maxAgeMs||Date.parse(cap.captured_at)>now+300000)fail('address_capture_expired');
 if(!object(card)||typeof card.html!=='string'||Buffer.byteLength(card.html)>ADDRESS_LIMITS.card||!card.html.length||sha256(card.html)!==card.sha256||!Number.isSafeInteger(card.start_byte)||card.start_byte<0||card.end_byte!==card.start_byte+Buffer.byteLength(card.html)||card.end_byte>cap.source_bytes)fail('address_card_invalid');
 const text=visibleCard(card.html),phrase=(v)=>(' '+addressNorm(text)+' ').includes(' '+addressNorm(v)+' ');
 if(!object(a)||!['street','city','postal_code','country','house_number','road','country_code'].every(k=>typeof a[k]==='string'&&a[k].trim())||!/^\d+[\p{L}]?$/u.test(a.house_number)||a.street!==a.house_number+' '+a.road||!(/^[a-z]{2}$/).test(a.country_code)||a.city!==snapshot.city||a.country!==snapshot.country||!canonicalStreetMatches(snapshot.address,a.street))fail('address_complete_parts_required');
 if(!object(identity)||identity.official_source_confirmed!==true||identity.public_business_address!==true||identity.full_document_branch_reviewed!==true||identity.exact_name_confirmed!==true||identity.exact_address_confirmed!==true||identity.exact_country_confirmed!==true||identity.country_code_confirmed!==true||identity.country_code!==a.country_code||!identity.reviewer?.trim()||!Number.isFinite(Date.parse(identity.reviewed_at))||Date.parse(identity.reviewed_at)<now-ADDRESS_LIMITS.maxAgeMs||Date.parse(identity.reviewed_at)>now+300000)fail('address_independent_identity_review_required');
 if(addressNorm(identity.source_name)!==addressNorm(snapshot.name)&&identity.name_alias_confirmed!==true)fail('address_name_alias_review_required');
 for(const [k,v]of Object.entries({name:identity.source_name,street:a.street,city:a.city,postal_code:a.postal_code,country:a.country})){addressQuote(card.html,identity.quotes?.[k],v);if(!phrase(v))fail('address_visible_quote_required');}
 if(proof.authority!=='official_address_only'||proof.coordinate_authority!==false)fail('address_authority_invalid');
 return proof;
}
export function qualifyOfficialAddress({sourceBytes,snapshot,capture,selection,address,identity,now=Date.now()}={}){
 const {bytes,html}=addressSourceBytes(sourceBytes);if(sha256(bytes)!==capture?.source_sha256||bytes.length!==capture.source_bytes)fail('address_source_hash');
 const quality=inspectSourceDocument(html);if(quality.source_state==='source_challenge'||quality.requires_rendering)fail('address_document_blocked');
 const start=selection?.start_byte,end=selection?.end_byte;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<=start||end>bytes.length)fail('address_card_range');
 let card;try{card=new TextDecoder('utf8',{fatal:true,ignoreBOM:true}).decode(bytes.subarray(start,end));}catch{fail('address_card_range');}if(html.split(card).length!==2)fail('address_card_not_unique');
 const proof={schema:1,kind:'reviewed_official_public_address',canonical_context:addressContext(snapshot),capture,address,card:{html:card,start_byte:start,end_byte:end,sha256:sha256(card)},identity,authority:'official_address_only',coordinate_authority:false};validateQualifiedAddress(proof,snapshot,{now});return proof;
}

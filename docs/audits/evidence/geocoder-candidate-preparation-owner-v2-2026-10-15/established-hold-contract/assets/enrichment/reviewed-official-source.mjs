// SERVER-ONLY. SSR models may use this independently reviewed channel. Never
// import into client-brief, browser apps or native; it performs no network I/O.
// It does not clear crawler holds or qualify machine-imported facts.
// Callers pass only release-reviewed static receipts, never owner/profile data.
import{createHash}from'node:crypto';
import{selectedOfficialWebsite,officialSourceQuarantined}from'./official-source-policy.mjs';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:null;
const norm=v=>typeof v==='string'?v.normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase():'';
const flagged=v=>v===true||v==='true';
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const MAX_AGE=7*86400000;
const timestamp=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v))return NaN;const n=Date.parse(v);return Number.isFinite(n)&&new Date(n).toISOString()===v?n:NaN;};
function documentKey(value){try{if(typeof value!=='string'||value.length>3000)return null;const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u.protocol+'//'+u.hostname.replace(/^www\./,'')+u.pathname.replace(/\/$/,'')+u.search:null;}catch{return null;}}
function readerAge(value){if(value==='today')return 1;if(value==='yesterday')return 2;const match=typeof value==='string'&&value.match(/^(\d+) days? ago$/);return match&&Number(match[1])<=5?Number(match[1])+1:null;}
function country(value){const key=norm(value);return({uk:'gb',gb:'gb','great britain':'gb','united kingdom':'gb',ca:'ca',canada:'ca',au:'au',australia:'au',us:'us',usa:'us','united states':'us','united states of america':'us'})[key]||key;}
export function reviewedSourceContentSHA(source){
 let count=0;
 function canonical(value,depth=0){if(depth>16||++count>3000)throw Error('source_content_bound');if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);if(Array.isArray(value))return'['+value.map(v=>canonical(v,depth+1)).join(',')+']';if(object(value)&&Object.getPrototypeOf(value)===Object.prototype)return'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k],depth+1)).join(',')+'}';throw Error('source_content_type');}
 try{const serialized=canonical(source);return serialized.length<=100000?createHash('sha256').update(serialized).digest('hex'):null;}catch{return null;}
}
function mixedIdentityHold(entity){
 const original=entity?.profile?._enrich;if(original!=null&&!object(original))return true;
 const q=object(original)||{};
 if(['identity_conflict','branch_conflict','source_challenged','source_challenge','challenge','captcha','challenge_detected','identity_review_required','entity_family_review_required'].some(k=>flagged(q[k]))||q.identity_match===false||q.identity_match==='false')return true;
 if(officialSourceQuarantined(entity)||flagged(q.source_scope_mismatch)||q.identity_scope||q.source_affiliation||q.member||q.member_source||q.publisher_source_evidence||q.association_member)return true;
 if(typeof q.source_kind==='string'&&/(?:association|member|publisher|directory|supporting)/i.test(q.source_kind))return true;
 if(q.source_identity&&(!object(q.source_identity)||q.source_identity.verification&&q.source_identity.verification!=='exact_name_typed_jsonld'||q.source_identity.name&&norm(q.source_identity.name)!==norm(entity.name)||q.source_identity.expected_entity_type&&q.source_identity.expected_entity_type!==entity.entity_type||q.source_identity.source_url&&documentKey(q.source_identity.source_url)!==documentKey(selectedOfficialWebsite(entity))))return true;
 const state=[q.blocked_reason,q.last_error,q.status,q.crawl_status].filter(v=>typeof v==='string'&&v.trim());
 if(state.some(v=>/(?:challenge|captcha|identity|scope|review_required|member|publisher|directory)/i.test(v)))return true;
 // This exception covers only a plain transport HTTP403. Unknown other failures
 // do not gain authority from an unrelated successful manual review.
 if(q.blocked_reason&&q.blocked_reason!=='http403')return true;
 if(q.last_error&&q.last_error!=='http403')return true;
 const blocked=flagged(q.blocked)||['blocked','error'].includes(q.status)||['blocked','error'].includes(q.crawl_status);
 return blocked&&q.blocked_reason!=='http403';
}
function sourceURLs(source){return[source.contact_url,source.jurisdiction_url,source.visit_source,...(source.services||[]).map(v=>v.source_url||v.url),...(source.contacts||[]).map(v=>v.source_url),...(source.useful_links||[]).map(v=>v.url),source.appointment?.source_url||source.appointment?.url].filter(Boolean);}
export function reviewedOfficialSource(entity,source,receipt,options={}){
 try{
  if(!object(options))return false;const now=Object.hasOwn(options,'now')?options.now:Date.now();
  if(!object(entity)||!object(source)||!object(receipt)||receipt.version!==1||typeof receipt.review_id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(receipt.review_id)||receipt.channel!=='manual_reviewed_official_source'||receipt.review_method!=='retained_official_page_reader'||receipt.reviewed_by!=='zoi-delivery/enrichment-specialist'||receipt.identity_verified!==true||receipt.branch_verified!==true||receipt.challenge_free!==true||mixedIdentityHold(entity))return false;
  if(entity.marketplace_status==='hidden'||entity.publish_status&&entity.publish_status!=='published'||entity.moderation_status&&!['clean','cleared'].includes(entity.moderation_status)||entity.duplicate_status==='confirmed_duplicate')return false;
  const scope=receipt.scope,registered=documentKey(selectedOfficialWebsite(entity));
  if(!object(scope)||!registered||registered!==documentKey(source.website)||registered!==documentKey(scope.website)||entity.id!==source.id||entity.id!==scope.id||entity.entity_type!==scope.entity_type||!norm(entity.name)||norm(entity.name)!==norm(source.name)||norm(entity.name)!==norm(scope.name)||!norm(entity.city)||norm(entity.city)!==norm(source.city)||norm(entity.city)!==norm(scope.city)||!country(entity.country)||country(entity.country)!==country(source.country)||country(entity.country)!==country(scope.country))return false;
  const q=object(entity.profile?._enrich)||{};if(q.source_url&&documentKey(q.source_url)!==registered)return false;
  const instant=typeof now==='number'?now:timestamp(now),reviewed=timestamp(receipt.reviewed_at),expires=timestamp(receipt.expires_at);
  if(!Number.isFinite(instant)||!Number.isFinite(reviewed)||!Number.isFinite(expires)||reviewed>instant||instant>=expires||expires<=reviewed||expires-reviewed>MAX_AGE||instant-reviewed>MAX_AGE)return false;
  if(source.checked_at!==receipt.reviewed_at.slice(0,10))return false;
  if(!sha(receipt.content_sha256)||receipt.content_sha256!==reviewedSourceContentSHA(source)||!Array.isArray(receipt.documents)||!receipt.documents.length||receipt.documents.length>30)return false;
  const docs=new Map();for(const doc of receipt.documents){const key=documentKey(doc.url),retrieved=timestamp(doc.retrieved_at),age=readerAge(doc.reader_crawled);if(!key||docs.has(key)||!sha(doc.reader_document_sha256)||doc.reader_document_sha256===receipt.content_sha256||doc.artifact_kind!=='retained_page_reader_document'||doc.complete_reader_document!==true||doc.raw_http_status!==null||!age||!Number.isInteger(doc.bytes)||doc.bytes<100||doc.bytes>2000000||!Number.isFinite(retrieved)||retrieved>reviewed||reviewed-retrieved>MAX_AGE||instant-retrieved+age*86400000>MAX_AGE)return false;docs.set(key,doc);}
  const registeredURL=new URL(registered),host=registeredURL.hostname,namespace=registeredURL.pathname.split('/').filter(Boolean).length?'/'+registeredURL.pathname.split('/').filter(Boolean).slice(0,2).join('/')+'/':'/';let official=0;
  for(const [key,doc]of docs){if(doc.role==='official'&&new URL(key).hostname===host&&new URL(key).pathname.startsWith(namespace))official++;else if(doc.role==='linked_provider'){const primary=docs.get(documentKey(doc.linked_from));if(!primary||primary.role!=='official'||doc.reader_request_kind!=='click'||!Number.isInteger(doc.linked_from_link_id)||doc.linked_from_link_id<0||doc.linked_from_link_id>10000||!/^turn\d+view\d+$/.test(doc.linked_from_reader_ref||'')||primary.reader_ref!==doc.linked_from_reader_ref||primary.reader_document_sha256!==doc.linked_from_reader_sha256||new URL(primary.url).hostname.replace(/^www\./,'')!==host)return false;}else return false;}
  if(!official||sourceURLs(source).some(url=>!docs.has(documentKey(url))))return false;
  if(source.appointment?.url&&!docs.has(documentKey(source.appointment.url)))return false;
  return true;
 }catch{return false;}
}

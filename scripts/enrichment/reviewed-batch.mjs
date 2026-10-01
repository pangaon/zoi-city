/** Bind reviewed captured source evidence to an existing database enrichment lease.
 * Does not invent a lease or write around enrich_apply's owner/source fences.
 */
import {canonical,sha256} from '../quality/evidence.mjs';
const hashPattern=/^[a-f0-9]{64}$/;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);

export function reviewedEnrichmentBatch(report,review,lease){
 if(!report||!review||!lease||review.report_sha256!==sha256(canonical(report)))throw Error('review_artifact_mismatch');
 if(review.listing_id!==report.listing_id||lease.listing_id!==report.listing_id||lease.website!==report.website||!lease.lease_id||!lease.slug)throw Error('review_lease_mismatch');
 if(typeof lease.source_fingerprint!=='string'||!lease.source_fingerprint.trim()||report.source_fingerprint!==lease.source_fingerprint)throw Error('review_lease_fingerprint_mismatch');
 if(review.source_fingerprint!==report.source_fingerprint||review.identity_confirmed!==true||review.images_confirmed!==true||!review.reviewer||!review.reviewed_at)throw Error('source_review_required');
 if(report.capture_kind==='source_html')return reviewedSourceHTML(report,review,lease);
 if(report.capture_kind&&report.capture_kind!=='rendered')throw Error('source_not_approved');
 if(!report.render?.url||report.aggregator||report.status==='repair_required'||report.source?.http_status!==200||new URL(report.render.url).hostname.replace(/^www\./,'')!==new URL(report.website).hostname.replace(/^www\./,''))throw Error('source_not_approved');
 const allowed=new Set(['description','tagline','address_parts','brand_palette']);
 const overrides=review.approved_fields||{};for(const key of Object.keys(overrides))if(!allowed.has(key))throw Error('unapproved_review_field');
 const profile={...report.profile,...overrides,crawl_status:'ok',rendered_source_evidence:{sha256:review.report_sha256,source_sha256:report.source.sha256,render_sha256:report.render.sha256,reviewer:review.reviewer,reviewed_at:review.reviewed_at,source_fingerprint:report.source_fingerprint}};
 const provenance=Object.fromEntries(Object.keys(profile).filter(k=>k!=='crawl_status').map(k=>[k,'rendered-official-source:'+report.render.url]));
 for(const key of Object.keys(overrides))provenance[key]='reviewed-official-source:'+report.render.url;
 return[{slug:lease.slug,website:lease.website,lease_id:lease.lease_id,profile,provenance}];
}

function reviewedSourceHTML(report,review,lease){
 const source=report.source;
 if(report.schema!==2||report.source_scope!=='official_site'||report.render!==null||report.review_required!==true||report.aggregator||report.status==='repair_required'||source?.http_status!==200||source?.source_state!=='html_available'||source?.requires_rendering===true||!hashPattern.test(source?.sha256||'')||!hashPattern.test(report.extractor_sha256||'')||!object(report.profile))throw Error('source_not_approved');
 let url,website;try{url=new URL(source.url);website=new URL(report.website);}catch{throw Error('source_not_approved');}
 if(url.protocol!=='https:'||url.username||url.password||url.hostname.replace(/^www\./,'')!==website.hostname.replace(/^www\./,''))throw Error('source_not_approved');
 // The lease supplies the current prior machine profile. Approval is bound to it,
 // so a partial capture cannot silently erase another enrichment's useful fields.
 if(!object(lease.existing_enrich))throw Error('prior_machine_review_required');
 const {lease:ignored,...existing}=lease.existing_enrich;
 if(review.prior_machine_sha256!==sha256(canonical(existing)))throw Error('prior_machine_review_mismatch');
 const images=report.images;
 if(!Array.isArray(images)||!Array.isArray(review.approved_image_hashes)||new Set(review.approved_image_hashes).size!==review.approved_image_hashes.length)throw Error('source_image_review_required');
 const approved=new Set(review.approved_image_hashes),verified=new Map();
 for(const image of images){
  if(!hashPattern.test(image.sha256||'')||!['image/jpeg','image/png'].includes(image.mime)||!Number.isInteger(image.width)||!Number.isInteger(image.height)||image.width<1||image.height<1||image.width*image.height>20000000||!Number.isInteger(image.bytes)||image.bytes<1||image.bytes>8000000||image.role!=='photo')throw Error('source_image_evidence_invalid');
  for(const field of ['url','final_url']){let parsed;try{parsed=new URL(image[field]);}catch{throw Error('source_image_evidence_invalid');}if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw Error('source_image_evidence_invalid');}
  verified.set(image.sha256,image);
 }
 if([...approved].some(hash=>!verified.has(hash)))throw Error('source_image_review_mismatch');
 const allowed=new Set(['description','tagline','phone','email','social','site_lang','photo_urls','photo_url','hero_url']);
 for(const key of Object.keys(report.profile))if(!allowed.has(key))throw Error('unapproved_source_html_field');
 const overrides=review.approved_fields||{};
 for(const key of Object.keys(overrides))if(!['description','tagline'].includes(key)||typeof overrides[key]!=='string'||!overrides[key].trim())throw Error('unapproved_review_field');
 const urls=new Set([...approved].map(hash=>verified.get(hash).url));
 const fields=Object.fromEntries(Object.entries({...report.profile,...overrides}).filter(([key,value])=>!['photo_urls','photo_url','hero_url'].includes(key)&&value!==null&&value!==''&&(!Array.isArray(value)||value.length)&&(!object(value)||Object.keys(value).length)));
 const photos=(report.profile.photo_urls||[]).filter(value=>urls.has(value));
 if(!photos.length&&!fields.phone&&!fields.email&&String(fields.description||'').trim().length<40)throw Error('source_html_no_useful_fields');
 const {lease:oldLease,blocked,last_error,status,crawl_status,checked_at,last_attempt_at,source_url,provenance:oldProvenance,...previous}=existing;
 if(photos.length){fields.photo_urls=[...new Set([...photos,...(Array.isArray(previous.photo_urls)?previous.photo_urls:[])])];const hero=urls.has(report.profile.hero_url)?report.profile.hero_url:photos[0];fields.hero_url=hero;fields.photo_url=hero;}
 if(object(previous.social)&&object(fields.social))fields.social={...previous.social,...fields.social};
 const evidence={sha256:review.report_sha256,source_sha256:source.sha256,extractor_sha256:report.extractor_sha256,method:'reviewed_official_source_html',reviewer:review.reviewer,reviewed_at:review.reviewed_at,source_fingerprint:report.source_fingerprint,approved_image_hashes:[...approved],prior_machine_sha256:review.prior_machine_sha256,added_photo_urls:photos,preserved_photo_urls:(previous.photo_urls||[]).filter(url=>!photos.includes(url)),updated_social_channels:Object.keys(report.profile.social||{})};
 const profile={...previous,...fields,crawl_status:'ok',source_html_evidence:evidence};
 const provenance={...(object(oldProvenance)?oldProvenance:{}),...Object.fromEntries(Object.keys(fields).map(key=>[key,'official-source-html:'+source.url])),source_html_evidence:'reviewed-official-source-html:'+source.url};
 for(const key of Object.keys(overrides))provenance[key]='reviewed-official-source-html:'+source.url;
 return [{slug:lease.slug,website:lease.website,lease_id:lease.lease_id,profile,provenance}];
}

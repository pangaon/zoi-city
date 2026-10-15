import {validHospitalityFields,hospitalitySourceMatches} from '../../supabase/functions/zoi-enrich/_hospitality.js';
/** Bind reviewed captured source evidence to an existing database enrichment lease.
 * Does not invent a lease or write around enrich_apply's owner/source fences.
 */
import {buildClientBrief,sourceCopyPlaceholder,sourceCopyProfile,retainedSourceCopy} from '../../assets/enrichment/client-brief.mjs';
import {assessMachineSourceIdentity} from '../../supabase/functions/zoi-enrich/_source-identity.js';
import {canonical,sha256} from '../quality/evidence.mjs';
const hashPattern=/^[a-f0-9]{64}$/;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);

export function reviewedEnrichmentBatch(report,review,lease){
 if(!report||!review||!lease||review.report_sha256!==sha256(canonical(report)))throw Error('review_artifact_mismatch');
 if(review.listing_id!==report.listing_id||lease.listing_id!==report.listing_id||lease.website!==report.website||!lease.lease_id||!lease.slug)throw Error('review_lease_mismatch');
 if(typeof lease.source_fingerprint!=='string'||!lease.source_fingerprint.trim()||report.source_fingerprint!==lease.source_fingerprint)throw Error('review_lease_fingerprint_mismatch');
 if(review.source_fingerprint!==report.source_fingerprint||review.identity_confirmed!==true||review.images_confirmed!==true||!review.reviewer||!review.reviewed_at)throw Error('source_review_required');
 // Reassess retained reports too: an approval cannot revive a capture made before
 // the current replacement/parking guard existed, or sanitize it with overrides.
 const source=report.capture_kind==='source_html'?report.source:report.render;
 if(assessMachineSourceIdentity({website:lease.website,finalUrl:source?.url,name:lease.name,title:source?.title,description:report.profile?.description}).outcome!=='continue')throw Error('source_identity_review_required');
 if(report.capture_kind==='source_html')return reviewedSourceHTML(report,review,lease);
 if(report.capture_kind&&report.capture_kind!=='rendered')throw Error('source_not_approved');
 if(!report.render?.url||report.aggregator||report.status==='repair_required'||report.source?.http_status!==200||new URL(report.render.url).hostname.replace(/^www\./,'')!==new URL(report.website).hostname.replace(/^www\./,''))throw Error('source_not_approved');
 if(!validHospitalityFields(report.profile||{},report.render.url)||(['rooms','dining','venues','amenities'].some(k=>Object.hasOwn(report.profile||{},k))&&!hospitalitySourceMatches(report.render.url,report.website)))throw Error('source_hospitality_invalid');
 const allowed=new Set(['description','tagline','address_parts','brand_palette']);
 const overrides=review.approved_fields||{};for(const key of Object.keys(overrides))if(!allowed.has(key)||['description','tagline'].includes(key)&&sourceCopyPlaceholder(overrides[key]))throw Error('unapproved_review_field');
 const fresh=sourceCopyProfile({...report.profile,...overrides}),retained=retainedSourceCopy(lease,fresh,report.render.url);
 const profile={...retained.fields,...fresh,crawl_status:'ok',rendered_source_evidence:{sha256:review.report_sha256,source_sha256:report.source.sha256,render_sha256:report.render.sha256,reviewer:review.reviewer,reviewed_at:review.reviewed_at,source_fingerprint:report.source_fingerprint}};
 const provenance={...retained.provenance,...Object.fromEntries(Object.keys(fresh).map(k=>[k,'rendered-official-source:'+report.render.url])),rendered_source_evidence:'rendered-official-source:'+report.render.url};
 for(const key of Object.keys(overrides))provenance[key]='reviewed-official-source:'+report.render.url;
 return[{slug:lease.slug,website:lease.website,lease_id:lease.lease_id,profile,provenance}];
}

const foodSourceHeld=(prior,website)=>{
 const flagged=value=>value===true||value==='true';
 if(flagged(prior.blocked)||prior.status==='blocked'||['blocked','error'].includes(prior.crawl_status)||prior.blocked_reason==='source_scope_mismatch'||['scope_review_required','organization_identity_quarantine','source_scope_mismatch','source_challenge','challenge'].some(key=>flagged(prior[key]))||prior.identity_scope||prior.member||prior.association_member||prior.source_affiliation||['association_directory','association_member','supporting_publisher_profile'].includes(prior.source_kind))return true;
 const document=value=>{try{const url=new URL(value);return url.protocol+'//'+url.hostname.replace(/^www\./,'')+url.pathname.replace(/\/$/,'')+url.search;}catch{return null;}};
 if(prior.source_url)return !document(prior.source_url)||document(prior.source_url)!==document(website);
 return Object.keys(prior).some(key=>!['lease','_lease_source_context','provenance','checked_at','last_attempt_at','status','crawl_status'].includes(key));
};
const foodKeys=['menu','menu_source','menu_source_format','menu_total_items','menu_truncated','menu_url'];
function reviewedFoodOffering(report,review,lease){
 const evidence=report.food_offering,hasFields=foodKeys.some(key=>Object.hasOwn(report.profile,key)),prior=lease.existing_enrich||{};
 // A phone/photo-only report must not lift a held old menu or an unresolved
 // Food capture through the generic prior-machine merge below.
 if(evidence?.state==='unresolved')throw Error('food_offering_unresolved');
 if([...foodKeys,'menu_image_urls'].some(key=>Object.hasOwn(prior,key))&&foodSourceHeld(prior,lease.website))throw Error('food_source_hold_review_required');
 if(!hasFields)return null;
 if(!evidence||evidence.state!=='captured_pending_review'||review.food_offering_confirmed!==true||lease.owner_managed!==false||lease.owner_workspace_id)throw Error('food_offering_review_required');
 if(foodSourceHeld(prior,lease.website))throw Error('food_source_hold_review_required');
 if(!object(evidence.canonical_context)||canonical(evidence.canonical_context)!==canonical(prior._lease_source_context)||!evidence.canonical_context.city||!evidence.canonical_context.country)throw Error('food_source_context_changed');
 const identity=evidence.primary_identity;
 if(!identity||identity.verification!=='exact_name_typed_jsonld'||identity.name!==lease.name||identity.expected_entity_type!==lease.entity_type||identity.source_url!==report.source.url||evidence.primary_source_url!==report.source.url||evidence.linked_from_sha256!==report.source.sha256)throw Error('food_source_identity_changed');
 let source;try{source=new URL(evidence.source_url);}catch{throw Error('food_source_evidence_invalid');}
 if(source.protocol!=='https:'||source.username||source.password||source.origin!==new URL(report.source.url).origin||!hashPattern.test(evidence.source_sha256||'')||evidence.hash_basis!=='decoded_utf8'||!Number.isFinite(Date.parse(evidence.retrieved_at)))throw Error('food_source_evidence_invalid');
 const menu=report.profile.menu;
 if(evidence.kind==='menu_handoff'){
  if(evidence.source_format!=='source_document_handoff'||report.profile.menu_url!==source.href||foodKeys.some(key=>key!=='menu_url'&&Object.hasOwn(report.profile,key))||evidence.menu_sha256!==null||evidence.retained_items!==0||evidence.original_total!==null||evidence.truncated!==null)throw Error('food_menu_handoff_invalid');
 }else{
  if(evidence.kind!=='structured_menu'||!['schema.org','html-product-fields','html-semantic-food-fields'].includes(evidence.source_format)||report.profile.menu_source_format!==evidence.source_format||report.profile.menu_source!==source.href||!Array.isArray(menu)||!menu.length||menu.length>20||Buffer.byteLength(JSON.stringify(menu),'utf8')>120000||sha256(canonical(menu))!==evidence.menu_sha256)throw Error('food_menu_evidence_invalid');
  let count=0;for(const section of menu){if(!object(section)||typeof section.section!=='string'||section.section.length>100||!Array.isArray(section.items)||!section.items.length||section.items.length>300)throw Error('food_menu_fields_invalid');for(const item of section.items){if(!object(item)||typeof item.name!=='string'||!item.name.trim()||item.name.length>160||typeof item.price!=='string'||item.price.length>100||typeof item.note!=='string'||item.note.length>600||Object.keys(item).some(key=>!['name','price','note'].includes(key)))throw Error('food_menu_fields_invalid');count++;}}
  if(count>300||evidence.retained_items!==count||!(evidence.original_total===null||Number.isInteger(evidence.original_total)&&evidence.original_total>=count)||!(evidence.truncated===null||typeof evidence.truncated==='boolean')||evidence.original_total===null&&evidence.total_state!=='unreported_by_extractor'||evidence.original_total!==null&&(evidence.total_state!=='observed'||evidence.truncated!==(evidence.original_total>count))||Object.hasOwn(report.profile,'menu_total_items')&&report.profile.menu_total_items!==evidence.original_total||Object.hasOwn(report.profile,'menu_truncated')&&report.profile.menu_truncated!==evidence.truncated)throw Error('food_menu_coverage_changed');
 }
 return evidence;
}
function reviewedSourceHTML(report,review,lease){
 const source=report.source,publisher=report.source_scope==='record_label';
 if(publisher){const binding=report.publisher_identity;if(!object(binding)||binding.listing_id!==lease.listing_id||binding.name!==lease.name||lease.entity_type!=='artist'||binding.kind!=='label_artist_profile'||binding.source_url!==source?.url||review.publisher_scope_confirmed!==true||canonical(review.publisher_identity)!==canonical(binding)||report.profile?.source_kind!=='label_artist_profile')throw Error('publisher_identity_review_required');}

 if(report.schema!==2||!['official_site','record_label'].includes(report.source_scope)||report.render!==null||report.review_required!==true||report.aggregator||report.status==='repair_required'||source?.http_status!==200||source?.source_state!=='html_available'||source?.requires_rendering===true||!hashPattern.test(source?.sha256||'')||!hashPattern.test(report.extractor_sha256||'')||!object(report.profile))throw Error('source_not_approved');
 let url,website;try{url=new URL(source.url);website=new URL(report.website);}catch{throw Error('source_not_approved');}
 if(publisher&&(url.origin!==website.origin||url.pathname.replace(/\/$/,'')!==website.pathname.replace(/\/$/,'')))throw Error('publisher_source_path_changed');
 if(url.protocol!=='https:'||url.username||url.password||url.hostname.replace(/^www\./,'')!==website.hostname.replace(/^www\./,''))throw Error('source_not_approved');
 // The lease supplies the current prior machine profile. Approval is bound to it,
 // so a partial capture cannot silently erase another enrichment's useful fields.
 if(!object(lease.existing_enrich))throw Error('prior_machine_review_required');
 const {lease:ignored,...existing}=lease.existing_enrich;
 if(review.prior_machine_sha256!==sha256(canonical(existing)))throw Error('prior_machine_review_mismatch');
 if(publisher&&['phone','email','social','address','address_parts','rooms','dining','venues','amenities'].some(k=>existing[k]&&Object.keys(Object(existing[k])).length))throw Error('publisher_prior_contact_review_required');
 const food=reviewedFoodOffering(report,review,lease);
 const images=report.images;
 if(!Array.isArray(images)||!Array.isArray(review.approved_image_hashes)||new Set(review.approved_image_hashes).size!==review.approved_image_hashes.length)throw Error('source_image_review_required');
 const approved=new Set(review.approved_image_hashes),verified=new Map();
 for(const image of images){
  if(!hashPattern.test(image.sha256||'')||!['image/jpeg','image/png'].includes(image.mime)||!Number.isInteger(image.width)||!Number.isInteger(image.height)||image.width<1||image.height<1||image.width*image.height>20000000||!Number.isInteger(image.bytes)||image.bytes<1||image.bytes>8000000||image.role!=='photo')throw Error('source_image_evidence_invalid');
  for(const field of ['url','final_url']){let parsed;try{parsed=new URL(image[field]);}catch{throw Error('source_image_evidence_invalid');}if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw Error('source_image_evidence_invalid');}
  verified.set(image.sha256,image);
 }
 if([...approved].some(hash=>!verified.has(hash)))throw Error('source_image_review_mismatch');
 const allowed=new Set(['description','tagline','phone','email','email_conflict','social','site_lang','photo_urls','photo_url','hero_url','rooms','dining','venues','amenities']);
 if(!validHospitalityFields(report.profile,source.url)||(['rooms','dining','venues','amenities'].some(k=>Object.hasOwn(report.profile,k))&&!hospitalitySourceMatches(source.url,report.website)))throw Error('source_hospitality_invalid');
 if(food)for(const key of foodKeys)allowed.add(key);
 if(publisher){allowed.add('source_kind');allowed.add('listen');}
 for(const key of Object.keys(report.profile))if(!allowed.has(key))throw Error('unapproved_source_html_field');
 if(publisher){allowed.clear();for(const key of ['description','tagline','site_lang','photo_urls','photo_url','hero_url','source_kind','listen'])allowed.add(key);for(const key of Object.keys(report.profile))if(!allowed.has(key))throw Error('publisher_contact_scope_forbidden');const listen=report.profile.listen;if(listen!==undefined){if(!object(listen)||Object.keys(listen).some(k=>k!=='spotify')||typeof listen.spotify!=='string'||!/^https:\/\/open\.spotify\.com\/artist\/[A-Za-z0-9]{22}$/.test(listen.spotify))throw Error('publisher_listen_invalid');}}
 const conflict=report.profile.email_conflict;
 const email=value=>typeof value==='string'&&/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(value);
 if(conflict!==undefined&&conflict!==null){
  if(!object(conflict)||Object.keys(conflict).some(key=>!['structured','linked','source_url'].includes(key))||conflict.source_url!==source.url||report.profile.email!==null||!(conflict.structured===null||email(conflict.structured))||!Array.isArray(conflict.linked)||!conflict.linked.length||conflict.linked.length>100||!conflict.linked.every(email)||new Set([...(conflict.structured?[conflict.structured]:[]),...conflict.linked].map(value=>value.toLowerCase())).size<2)throw Error('source_email_conflict_invalid');
 }
 const overrides=review.approved_fields||{};
 for(const key of Object.keys(overrides))if(!['description','tagline'].includes(key)||typeof overrides[key]!=='string'||!overrides[key].trim()||sourceCopyPlaceholder(overrides[key]))throw Error('unapproved_review_field');
 const urls=new Set([...approved].map(hash=>verified.get(hash).url));
 const fields=Object.fromEntries(Object.entries(sourceCopyProfile({...report.profile,...overrides})).filter(([key,value])=>!['photo_urls','photo_url','hero_url'].includes(key)&&value!==undefined&&value!==null&&value!==''&&(!Array.isArray(value)||value.length)&&(!object(value)||Object.keys(value).length)));
 if(conflict){fields.email=null;fields.email_conflict=conflict;}
 else if(conflict===null&&email(fields.email))fields.email_conflict=null;
 const photos=(report.profile.photo_urls||[]).filter(value=>urls.has(value));
 if(!fields.menu?.length&&!fields.menu_url&&!photos.length&&!fields.phone&&!fields.email&&!['rooms','dining','venues','amenities'].some(k=>fields[k]?.length)&&String(fields.description||'').trim().length<40)throw Error('source_html_no_useful_fields');
 const freshFields={...fields,...(photos.length?{photo_urls:photos,hero_url:urls.has(report.profile.hero_url)?report.profile.hero_url:photos[0]}:{})};
 const {lease:oldLease,_lease_source_context:ignoredContext,blocked,last_error,status,crawl_status,checked_at,last_attempt_at,source_url,provenance:oldProvenance,...previous}=existing;
 const retained=retainedSourceCopy(lease,fields,source.url);for(const key of ['description','tagline'])delete previous[key];
 if(photos.length){fields.photo_urls=[...new Set([...photos,...(Array.isArray(previous.photo_urls)?previous.photo_urls:[])])];const hero=urls.has(report.profile.hero_url)?report.profile.hero_url:photos[0];fields.hero_url=hero;fields.photo_url=hero;}
 if(object(previous.social)&&object(fields.social))fields.social={...previous.social,...fields.social};
 const evidence={sha256:review.report_sha256,source_sha256:source.sha256,extractor_sha256:report.extractor_sha256,method:publisher?'reviewed_record_label_source_html':'reviewed_official_source_html',...(publisher?{publisher_identity:report.publisher_identity}:{}),reviewer:review.reviewer,reviewed_at:review.reviewed_at,source_fingerprint:report.source_fingerprint,approved_image_hashes:[...approved],prior_machine_sha256:review.prior_machine_sha256,added_photo_urls:photos,preserved_photo_urls:(previous.photo_urls||[]).filter(url=>!photos.includes(url)),updated_social_channels:Object.keys(report.profile.social||{})};
 const profile={...previous,...retained.fields,...fields,crawl_status:'ok',source_html_evidence:evidence};
 const provenance={...(object(oldProvenance)?oldProvenance:{}),...retained.provenance,...Object.fromEntries(Object.keys(fields).map(key=>[key,'official-source-html:'+source.url])),source_html_evidence:'reviewed-official-source-html:'+source.url};
 for(const key of Object.keys(overrides))provenance[key]='reviewed-official-source-html:'+source.url;
 for(const key of ['description','tagline'])if(!Object.hasOwn(profile,key))delete provenance[key];
 if(food){
  const proof='reviewed-source:'+food.source_url+'#sha256='+food.source_sha256+';retrieved_at='+food.retrieved_at;
  for(const key of foodKeys)if(Object.hasOwn(fields,key))provenance[key]=proof;
  profile.source_identity=food.primary_identity;provenance.source_identity='exact_name_typed_jsonld';
  profile.food_source_coverage={source_url:food.source_url,source_sha256:food.source_sha256,original_total:food.original_total,retained_items:food.retained_items,truncated:food.truncated,total_state:food.total_state,reviewer:review.reviewer,reviewed_at:review.reviewed_at,home_acceptance:'not_reviewed'};provenance.food_source_coverage=proof;
  const brief=buildClientBrief({listing:lease,profile:{...freshFields,source_identity:food.primary_identity},provenance,sourceURL:report.source.url,checkedAt:food.retrieved_at,sources:[{url:report.source.url,state:'fetched',purpose:'homepage'},{url:food.source_url,state:'fetched',purpose:'menu'}]});
  if(brief){profile.client_brief=brief;provenance.client_brief='deterministic-source-brief:review-required';}
 }
 return [{slug:lease.slug,website:lease.website,lease_id:lease.lease_id,profile,provenance}];
}

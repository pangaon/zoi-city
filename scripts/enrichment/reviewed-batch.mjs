/** Bind reviewed captured source evidence to an existing database enrichment lease.
 * Does not invent a lease or write around enrich_apply's owner/source fences.
 */
import {canonical,sha256} from '../quality/evidence.mjs';
export function reviewedEnrichmentBatch(report,review,lease){
 if(!report||!review||!lease||review.report_sha256!==sha256(canonical(report)))throw Error('review_artifact_mismatch');
 if(review.listing_id!==report.listing_id||lease.listing_id!==report.listing_id||lease.website!==report.website||!lease.lease_id||!lease.slug)throw Error('review_lease_mismatch');
 if(review.source_fingerprint!==report.source_fingerprint||review.identity_confirmed!==true||review.images_confirmed!==true||!review.reviewer||!review.reviewed_at)throw Error('source_review_required');
 if(report.aggregator||report.status==='repair_required'||report.source?.http_status!==200||new URL(report.render.url).hostname.replace(/^www\./,'')!==new URL(report.website).hostname.replace(/^www\./,''))throw Error('source_not_approved');
 const allowed=new Set(['description','tagline','address_parts','brand_palette']);
 const overrides=review.approved_fields||{};for(const key of Object.keys(overrides))if(!allowed.has(key))throw Error('unapproved_review_field');
 const profile={...report.profile,...overrides,crawl_status:'ok',rendered_source_evidence:{sha256:review.report_sha256,source_sha256:report.source.sha256,render_sha256:report.render.sha256,reviewer:review.reviewer,reviewed_at:review.reviewed_at,source_fingerprint:report.source_fingerprint}};
 const provenance=Object.fromEntries(Object.keys(profile).filter(k=>k!=='crawl_status').map(k=>[k,'rendered-official-source:'+report.render.url]));
 for(const key of Object.keys(overrides))provenance[key]='reviewed-official-source:'+report.render.url;
 return[{slug:lease.slug,website:lease.website,lease_id:lease.lease_id,profile,provenance}];
}

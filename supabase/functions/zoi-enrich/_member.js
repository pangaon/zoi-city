import { memberEnrichmentGuard } from '../../../assets/enrichment/member-source.mjs';
/** Lease metadata is authoritative; never infer identity from fetched branding. */
export function memberLeaseGuard(row, html = '', finalUrl = row.website) {
  if (!row.name || !row.entity_type) return {handled:true,skipSupplementary:true,profile:{crawl_status:'error',last_error:'lease_identity_missing'},provenance:{source_kind:'lease_identity_guard'}};
  const existing=row.existing_enrich&&typeof row.existing_enrich==='object'?row.existing_enrich:{};
  const listing={name:row.name,entity_type:row.entity_type,website:row.website,profile:{_enrich:existing}};
  const initial=memberEnrichmentGuard({listing,url:row.website,html:''});
  if(initial.handled) listing.source_kind='association_member';
  const result=memberEnrichmentGuard({listing,url:finalUrl,html});
  if(!result.handled)return result;
  // enrich_apply preserves existing reviewed data ONLY on its explicit error branch.
  // A review-required result is not a successful replacement of member details.
  if(result.profile?.crawl_status!=='member_identity_matched')return {...result,profile:{crawl_status:'error',last_error:result.profile?.last_error||'member_identity_review_required'}};
  const {lease,...prior}=existing;
  return {...result,profile:{...prior,...result.profile}};
}

import { identityMatches, sourceURL, memberEnrichmentGuard } from '../../../assets/enrichment/member-source.mjs';
import { extractAssociationCard } from '../../../assets/enrichment/association-cards.mjs';
/** Lease metadata is authoritative; never infer identity from fetched branding. */
export function memberLeaseGuard(row, html = '', finalUrl = row.website) {
  if (!row.name || !row.entity_type) return {handled:true,skipSupplementary:true,profile:{crawl_status:'error',last_error:'lease_identity_missing'},provenance:{source_kind:'lease_identity_guard'}};
  const existing=row.existing_enrich&&typeof row.existing_enrich==='object'?row.existing_enrich:{};
  const listing={name:row.name,entity_type:row.entity_type,website:row.website,profile:{_enrich:existing}};
  const initial=memberEnrichmentGuard({listing,url:row.website,html:''});
  if(initial.handled) listing.source_kind='association_member';
  let result=memberEnrichmentGuard({listing,url:finalUrl,html});
  if(!result.handled)return result;
  // Only reviewed, balanced person components may replace the guarded legal fallback.
  // Challenges remain errors even if a cached/embedded card is present in the page.
  const challenged=/one moment, please|request (?:is )?being verified|checking your browser|verify you are human|cf-chl-/i.test(html);
  const card=challenged?null:extractAssociationCard({url:finalUrl,html,expectedName:row.name});
  if(card){
    const old=existing.member;
    const sameReviewedIdentity=old&&identityMatches(row.name,old.name)&&sourceURL(old.source_url)?.href===sourceURL(card.source_url)?.href&&old.provenance?.identity_match===true;
    const member=sameReviewedIdentity?{...old,...Object.fromEntries(Object.entries(card).filter(([,v])=>v!==null&&(!Array.isArray(v)||v.length))),affiliation:{...old.affiliation,...card.affiliation}}:card;
    result={handled:true,skipSupplementary:true,profile:{source_kind:'association_member',identity_scope:'person',member,crawl_status:'member_identity_matched',tagline:null,description:null,photo_url:member.portrait_url,hero_url:null,logo_url:null,photo_urls:[],social:{},phone:member.phone,email:member.email},provenance:{member:'identity_matched_association_component:'+card.source_url,source_kind:'association_identity_guard',social:'organization_social_excluded',photo_url:'member_scope_only'}};
  }
  // enrich_apply preserves existing reviewed data ONLY on its explicit error branch.
  // A review-required result is not a successful replacement of member details.
  if(result.profile?.crawl_status!=='member_identity_matched')return {...result,profile:{crawl_status:'error',last_error:result.profile?.last_error||'member_identity_review_required'}};
  const {lease,...prior}=existing;
  return {...result,profile:{...prior,...result.profile}};
}

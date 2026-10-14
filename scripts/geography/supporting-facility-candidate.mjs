import {canonical,sha256} from '../quality/evidence.mjs';
import {coordinateSnapshot} from './source-coordinates.mjs';
const plain=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function secure(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u:null;}catch{return null;}}
/** Existing writer host restrictions remain intact. This prepares a new,
 * independently reviewed dual-source candidate; it never applies coordinates.
 * A public landowner's single facility point is a site position, not an entrance. */
export function supportingFacilityCandidate({listing,primary,supporting,review,collector='enrichment-source-collector'}){
 if(listing.owner_managed||listing.owner_workspace_id||listing.owner_user_id||listing.public_eligible!==true)throw Error('supporting_facility_listing_not_eligible');
 const registered=secure(listing.website),origin=secure(primary?.url),publisher=secure(supporting?.url);
 if(!registered||!origin||!publisher||registered.hostname.replace(/^www\./,'')!==origin.hostname.replace(/^www\./,''))throw Error('supporting_facility_primary_source_mismatch');
 if(primary.status!==200||supporting.status!==200||typeof primary.html!=='string'||typeof supporting.html!=='string'||primary.html.length>1500000||supporting.html.length>1500000)throw Error('supporting_facility_source_unavailable');
 if(!review||review.listing_id!==listing.id||review.snapshot_sha256!==coordinateSnapshot(listing)||review.primary_sha256!==sha256(primary.html)||review.supporting_sha256!==sha256(supporting.html)||review.primary_url!==primary.url||review.supporting_url!==supporting.url||!review.reviewer||plain(review.reviewer)===plain(collector))throw Error('independent_supporting_facility_review_required');
 for(const flag of ['official_primary_confirmed','supporting_landowner_confirmed','exact_listing_identity_confirmed','exact_venue_relationship_confirmed','exact_address_confirmed'])if(review[flag]!==true)throw Error('supporting_facility_review_incomplete');
 const timestamp=Date.parse(review.reviewed_at);if(!Number.isFinite(timestamp))throw Error('supporting_facility_review_date_required');
 const body=supporting.html.replace(/<(script|style|head)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
 const title=plain(body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
 const address=body.match(/<p\b[^>]*class=["'][^"']*\bfacility-address\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1];
 if(!plain(review.facility_name)||title!==plain(review.facility_name)||!plain(review.relationship_phrase)||!plain(body).includes(plain(review.relationship_phrase))||!plain(primary.html).includes(plain(review.primary_venue_name))||!plain(primary.html).includes(plain(review.primary_street)))throw Error('supporting_facility_identity_or_relationship_mismatch');
 if(!address||![review.supporting_street,review.supporting_locality,review.supporting_country].every(v=>plain(v)&&plain(address).includes(plain(v))))throw Error('supporting_facility_address_mismatch');
 const blocks=[...supporting.html.matchAll(/<div\b[^>]*class=["'][^"']*\bsingle-facility-map\b[^"']*["'][^>]*>\s*<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
 if(blocks.length!==1)throw Error('supporting_facility_single_point_required');
 const declaration=blocks[0][1].trim().match(/^window\.mapFacility\s*=\s*(\{[\s\S]*\});?$/);
 let point;try{point=JSON.parse(declaration?.[1]);}catch{throw Error('supporting_facility_point_json_required');}
 const location=point.location;if(point.locationType!=='point'||!Number.isSafeInteger(point.postId)||point.postId<1||!Array.isArray(location)||location.length!==2||location.some(v=>typeof v!=='number'||!Number.isFinite(v))||Math.abs(location[0])>180||Math.abs(location[1])>90||location.every(v=>v===0))throw Error('supporting_facility_invalid_site_point');
 return {schema:1,kind:'official_supporting_facility_coordinate_dry_run',status:'review_required',listing_id:listing.id,snapshot_sha256:coordinateSnapshot(listing),database_snapshot:listing.database_snapshot,
  primary_source:{url:primary.url,sha256:sha256(primary.html)},supporting_source:{url:supporting.url,sha256:sha256(supporting.html),authority:'reviewed_municipal_landowner'},review_sha256:sha256(canonical(review)),collector,
  candidate:{latitude:location[1],longitude:location[0],name:listing.name,facility_name:review.facility_name,address:{street:review.primary_street,city:review.supporting_locality,country:review.supporting_country},scope:'venue_site',entrance_verified:false,precision:'source_published',evidence_kind:'official_supporting_facility_point',evidence_path:'single-facility-map.window.mapFacility',publisher_post_id:point.postId},
  coordinate_writes:0,provider_calls:0,application_state:'requires_reviewed_dual_source_writer_or_scoped_cas'};
}

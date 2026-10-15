/** Shared deterministic geography diagnosis, not a geocoder or writer.
 * Keep valid legacy positions visible unless evidence establishes area scope.
 * Ambiguous shared buildings go to review; coordinates are never silently moved. */
const text=v=>typeof v==='string'?v.trim():'';
const fold=v=>text(v).normalize('NFKC').toLowerCase().replace(/\s+/g,' ');
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const numeric=v=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v.trim())?Number(v):null;
export function canonicalPositionPrecision(value){const names={rooftop:'street',address:'street',street:'street',neighborhood:'neighbourhood',neighbourhood:'neighbourhood',suburb:'neighbourhood',locality:'city',town:'city',city:'city',region:'region',country:'region',approx:'approximate',approximate:'approximate'},key=fold(value);return Object.hasOwn(names,key)?names[key]:'unknown';}
export function positionPair(row){const latitude=numeric(Object.hasOwn(row||{},'latitude')?row.latitude:row?.lat),longitude=numeric(Object.hasOwn(row||{},'longitude')?row.longitude:row?.lng);return{latitude,longitude,valid:latitude!==null&&longitude!==null&&Math.abs(latitude)<=90&&Math.abs(longitude)<=180&&(latitude!==0||longitude!==0)};}
export function reviewedPositionMatches(row){const p=positionPair(row),r=row?.reviewed_destination;return p.valid&&typeof row?.id==='string'&&!!row.id&&!!r&&r.listing_id===row.id&&typeof r.request_id==='string'&&!!r.request_id.trim()&&r.precision==='street'&&numeric(r.latitude)===p.latitude&&numeric(r.longitude)===p.longitude;}
export function positionCohorts(rows){
 const groups=new Map();for(const row of rows){const p=positionPair(row);if(!p.valid)continue;const key=p.latitude.toFixed(5)+','+p.longitude.toFixed(5);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
 const result=new Map();for(const group of groups.values()){
  const addresses=new Set(group.map(r=>fold(r.address??r.addr)).filter(Boolean)),cities=new Set(group.map(r=>[fold(r.city),fold(r.country)].join('|')).filter(v=>v!=='|'));
  const stats={records:group.length,distinct_addresses:addresses.size,distinct_city_country: cities.size,area_records:group.filter(r=>['city','region'].includes(canonicalPositionPrecision(r.geo_precision??r.precision))).length};
  for(const row of group)result.set(row.id||row.slug||row.s,stats);
 }return result;
}
function inExtent(point,extent){if(!extent||extent.reviewed!==true||!text(extent.source_url)||![extent.south,extent.north,extent.west,extent.east].every(Number.isFinite)||extent.south>=extent.north||extent.west===extent.east)return null;const latitude=point.latitude>=extent.south&&point.latitude<=extent.north;const longitude=extent.west<extent.east?point.longitude>=extent.west&&point.longitude<=extent.east:point.longitude>=extent.west||point.longitude<=extent.east;return latitude&&longitude;}
export function diagnosePosition(row,{cohort=null,countryExtent=null}={}){
 const p=positionPair(row),geo=object(row.geo_metadata||row.profile?._geo),raw=row.geo_precision??row.precision;
 const column=canonicalPositionPrecision(raw),metadata=canonicalPositionPrecision(geo.precision),claimed=column==='unknown'?metadata:column;
 const reasons=[],reviewed=reviewedPositionMatches(row),sourceArea=/^(?:city|town|village|country|region)\s+(?:centroid|centre|center)$/i.test(text(geo.method));
 let precision=claimed,state='unreviewed';
 if(!p.valid){state=p.latitude===null||p.longitude===null?'missing_coordinates':'invalid_coordinates';precision='unknown';reasons.push(state);}
 else if(reviewed){state='reviewed_street';precision='street';}
 else if(sourceArea){precision=/^(country|region)/i.test(geo.method)?'region':'city';state='source_area_position';if(claimed==='street')reasons.push('street_label_conflicts_with_centroid_source');}
 else if(claimed==='street'){state='legacy_street_unreviewed';}
 else state=claimed==='unknown'?'unknown_precision':'area_position';
 if(!reviewed&&column!=='unknown'&&metadata!=='unknown'&&column!==metadata)reasons.push('precision_sources_conflict');
 if(p.valid&&!reviewed&&cohort?.distinct_addresses>1){reasons.push('shared_point_distinct_addresses_requires_review');if(cohort.distinct_city_country>1)reasons.push('shared_point_multiple_localities_requires_review');}
 const countryMatch=p.valid?inExtent(p,countryExtent):null;
 if(countryMatch===false&&!reviewed){reasons.push('outside_reviewed_country_extent');if(inExtent({latitude:p.longitude,longitude:p.latitude},countryExtent)===true)reasons.push('possible_swapped_coordinates_requires_review');}
 const enrich=object(row.source_context||row.profile?._enrich);
 if(geo.scope_conflict===true||[enrich.scope_review_required,enrich.organization_identity_quarantine,enrich.source_scope_mismatch].some(v=>v===true||v==='true')||enrich.blocked_reason==='source_scope_mismatch'||enrich.identity_scope==='organization'&&['artist','creator','professional'].includes(row.entity_type)||enrich.source_kind==='association_member')reasons.push('source_branch_or_person_scope_requires_review');
 const cohortConflict=!reviewed&&(cohort?.distinct_city_country>1||cohort?.distinct_addresses>8);
 const contradictory=cohortConflict||reasons.some(reason=>['precision_sources_conflict','outside_reviewed_country_extent','source_branch_or_person_scope_requires_review'].includes(reason));
 const drawable=p.valid&&precision==='street'&&!contradictory;
 if(contradictory)state='conflicting_position_evidence';
 return {schema_version:1,listing_id:row.id||null,slug:row.slug||row.s||null,latitude:p.latitude,longitude:p.longitude,claimed_precision:claimed,effective_precision:precision,state,reviewed,
  drawable,route_to_coordinates:reviewed&&drawable,review_required:reasons.length>0||!reviewed&&claimed==='street',reasons,
  next_action:contradictory?'review_exact_identity_address_and_source_position':reviewed?'retain_reviewed_position':!p.valid?'verify_official_public_address_and_coordinates':sourceArea?'research_exact_official_place_position':reasons.length?'review_exact_identity_address_and_source_position':'research_and_review_exact_place_position'};
}

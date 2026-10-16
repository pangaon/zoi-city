import {Buffer} from 'node:buffer';
import {canonical,sha256} from '../quality/evidence.mjs';
import {addressNorm,addressLiteralNorm,validateQualifiedAddress} from './official-address-evidence.mjs';
import {scanWixJSON} from './wix-business-location-evidence.mjs';
export const NOMINATIM_ENDPOINT='https://nominatim.openstreetmap.org/search';
export const GEOCODED_ADDRESS_KIND='reviewed_geocoded_official_address';
export const NOMINATIM_LIMITS=Object.freeze({jobs:3,spacingMs:15000,responseBytes:16384,deadlineMs:65000,reportBytes:32768});
export const OSM_ATTRIBUTION='© OpenStreetMap contributors';
const fail=code=>{throw Error(code);},object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const seal=x=>sha256(canonical(x)),postcode=x=>String(x||'').toUpperCase().replace(/\s/g,''),numeric=x=>typeof x==='number'?x:typeof x==='string'&&/^-?\d+(?:\.\d+)?$/.test(x)?Number(x):NaN;
const countries={AU:'Australia',CA:'Canada',CY:'Cyprus',DE:'Germany',FR:'France',GB:'United Kingdom',GR:'Greece',KE:'Kenya',NZ:'New Zealand',US:'United States',ZA:'South Africa',SE:'Sweden',IT:'Italy',NL:'Netherlands'};
export function nominatimRequest(address){
 const code=address.country_code?.toUpperCase();if(!Object.hasOwn(countries,code)||addressNorm(countries[code])!==addressNorm(address.country)&&!(code==='US'&&address.country==='United States of America'))fail('nominatim_country_mapping_unreviewed');
 const params={format:'jsonv2',street:address.street,city:address.city,...address.region?{state:address.region}:{},postalcode:address.postal_code,country:address.country,countrycodes:address.country_code,addressdetails:'1',namedetails:'1',extratags:'1',limit:'3','accept-language':'en'};
 return{provider:'nominatim',endpoint:NOMINATIM_ENDPOINT,method:'GET',params,request_sha256:seal({provider:'nominatim',endpoint:NOMINATIM_ENDPOINT,params}),licence:'ODbL-1.0',attribution:OSM_ATTRIBUTION,licence_url:'https://www.openstreetmap.org/copyright'};
}
export function prepareNominatimBatch(entries,{observedAt=new Date().toISOString(),now=Date.now()}={}){
 if(!Array.isArray(entries)||!entries.length||entries.length>NOMINATIM_LIMITS.jobs||!Number.isFinite(Date.parse(observedAt))||Math.abs(now-Date.parse(observedAt))>300000||new Set(entries.map(e=>e.snapshot?.id)).size!==entries.length)fail('bounded_nominatim_entries_required');
 const bindings=[],queries=[];
 for(const {snapshot,addressProof}of entries){validateQualifiedAddress(addressProof,snapshot,{now});if(!/^[a-f0-9]{32}$/.test(snapshot.database_snapshot||'')||!/^[a-f0-9]{32}$/.test(snapshot.source_fingerprint||''))fail('nominatim_current_snapshot_required');const query=nominatimRequest(addressProof.address);if(!queries.some(q=>q.request_sha256===query.request_sha256))queries.push(query);bindings.push({listing_id:snapshot.id,database_snapshot:snapshot.database_snapshot,source_fingerprint:snapshot.source_fingerprint,address_proof_sha256:seal(addressProof),request_sha256:query.request_sha256});}
 const batch={schema:1,provider:'nominatim',observed_at:observedAt,bindings,queries,authority:'none',writer_eligible:false};return{...batch,batch_sha256:seal(batch)};
}
/** Exact address acceptance, independent of ranking/importance. place=house is
 * refused: it can denote interpolation/TIGER rather than a mapped building. */
export function parseNominatimAddressResponse(request,text,addressProof){
 if(typeof text!=='string'||!text.length||Buffer.byteLength(text)>NOMINATIM_LIMITS.responseBytes)fail('nominatim_response_size');
 const expected=nominatimRequest(addressProof.address);if(canonical(request)!==canonical(expected))fail('nominatim_request_changed');
 let rows;try{rows=scanWixJSON(text,{maxNodes:1500,maxDepth:10}).data;}catch{fail('nominatim_response_json');}
 if(!Array.isArray(rows)||rows.length>3)fail('nominatim_response_rows');
 const a=addressProof.address,accepted=[];
 for(const r of rows){if(!object(r)||!object(r.address))continue;const b=r.address;
  if(b.country_code!==a.country_code||addressLiteralNorm(b.house_number)!==addressLiteralNorm(a.house_number)||addressLiteralNorm(b.road)!==addressLiteralNorm(a.road)||postcode(b.postcode)!==postcode(a.postal_code))continue;
  if(!['city','town','village','municipality'].some(k=>addressLiteralNorm(b[k])===addressLiteralNorm(a.city)))continue;
  if(a.region&&!['state','ISO3166-2-lvl4'].some(k=>addressNorm(b[k])===addressNorm(a.region))&&addressProof.identity.provider_region_alias!==b.state)continue;
  const building=r.category==='building',venue=['amenity','shop','tourism','office','leisure','historic'].includes(r.category);
  if(!building&&!venue||typeof r.type!=='string'||!r.type||['parking','parking_entrance','bicycle_parking','bench','toilets','taxi','charging_station','waste_basket'].includes(r.type)||!['node','way','relation'].includes(r.osm_type)||!/^\d+$/.test(String(r.osm_id||''))||!Number.isSafeInteger(Number(r.osm_id)))continue;
  const names=[r.name,...object(r.namedetails)?Object.values(r.namedetails):[]].filter(v=>typeof v==='string'&&v.trim());
  const expectedNames=[addressProof.canonical_context.name,addressProof.identity.source_name,...addressProof.identity.provider_name_alias_confirmed===true?[addressProof.identity.provider_name_alias]:[]];
  const nameMatch=names.some(n=>expectedNames.some(e=>addressNorm(n)===addressNorm(e)));
  if(venue&&!nameMatch||building&&r.name&&!nameMatch)continue;
  const lat=numeric(r.lat),lng=numeric(r.lon),bbox=r.boundingbox?.map(numeric);if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180||lat===0&&lng===0||!Array.isArray(bbox)||bbox.length!==4||!bbox.every(Number.isFinite)||bbox[0]>lat||bbox[1]<lat||bbox[2]>lng||bbox[3]<lng||bbox[0]>bbox[1]||bbox[2]>bbox[3]||bbox[1]-bbox[0]>0.005||bbox[3]-bbox[2]>0.005)continue;
  accepted.push({latitude:lat,longitude:lng,accuracy:building?'mapped_building_centroid':'mapped_venue_centroid',venue_identity_verified:venue&&nameMatch,address_accuracy:'mapped_address',not_roof_or_entrance:true,osm_type:r.osm_type,osm_id:String(r.osm_id),category:r.category,type:r.type,provider_name:r.name||null,boundingbox:bbox});
 }
 if(accepted.length!==1)fail(accepted.length?'nominatim_ambiguous_address_results':'nominatim_exact_mapped_address_unresolved');
 return accepted[0];
}
export function createAddressGeocodeReport({snapshot,addressProof,request,responseText,providerCapture,collector,now=Date.now()}={}){
 validateQualifiedAddress(addressProof,snapshot,{now});if(typeof collector!=='string'||!collector.trim()||collector.length>160)fail('geocode_collector_required');
 const selected=parseNominatimAddressResponse(request,responseText,addressProof),p=providerCapture;
 if(!p||p.request_sha256!==request.request_sha256||p.response_sha256!==sha256(responseText)||p.response_bytes!==Buffer.byteLength(responseText)||p.endpoint!==NOMINATIM_ENDPOINT||p.status!==200||p.redirected!==false||!Number.isFinite(Date.parse(p.captured_at))||Date.parse(p.captured_at)<now-7*86400000||Date.parse(p.captured_at)>now+300000||p.private_archive!==addressProof.capture.private_archive||p.admission?.singleton_held!==true||p.admission?.max_queries!==3||p.admission?.minimum_spacing_ms!==15000||!p.admission?.receipt_id)fail('geocode_provider_capture_required');
 const provider={endpoint:p.endpoint,status:200,redirected:false,request_sha256:p.request_sha256,response_sha256:p.response_sha256,response_bytes:p.response_bytes,captured_at:p.captured_at,private_archive:p.private_archive,admission:{receipt_id:p.admission.receipt_id,singleton_held:true,max_queries:3,minimum_spacing_ms:15000}};
 const proof={schema:1,address_proof:addressProof,request,response_text:responseText,provider_capture:provider,selected};const candidate={evidence_kind:GEOCODED_ADDRESS_KIND,name:snapshot.name,address:addressProof.address,...selected,precision:'mapped_address',provider:'nominatim',attribution:OSM_ATTRIBUTION,licence:'ODbL-1.0',licence_url:'https://www.openstreetmap.org/copyright',geocode_evidence_text:canonical(proof)};
 const report={schema:1,kind:'official_address_geocode_review',status:'review_required',reason:'coordinate_plausibility_review_required',listing_id:snapshot.id,snapshot_sha256:seal(addressProof.canonical_context),source_fingerprint:snapshot.source_fingerprint,source_url:addressProof.capture.source_url,source_sha256:addressProof.capture.source_sha256,http_status:200,collector,candidate};const reportText=canonical(report);if(Buffer.byteLength(reportText)>NOMINATIM_LIMITS.reportBytes)fail('geocode_report_size');return{report,reportText,proof_sha256:sha256(candidate.geocode_evidence_text),coordinate_writes:0};
}
export function reviewedAddressGeocodeMatches(report,review,snapshot,{now=Date.now()}={}){
 if(report.kind!=='official_address_geocode_review'||report.candidate?.evidence_kind!==GEOCODED_ADDRESS_KIND)fail('geocode_kind_mismatch');
 let proof;try{proof=JSON.parse(report.candidate.geocode_evidence_text);}catch{fail('geocode_proof_invalid');}
 const built=createAddressGeocodeReport({snapshot,addressProof:proof.address_proof,request:proof.request,responseText:proof.response_text,providerCapture:proof.provider_capture,collector:report.collector,now});if(canonical(built.report)!==canonical(report))fail('geocode_proof_changed');
 for(const k of ['exact_identity_confirmed','exact_country_confirmed','visible_branch_confirmed','full_archived_raw_rehashed','full_document_branch_reviewed','provider_address_match_confirmed','not_roof_or_entrance_precision'])if(review[k]!==true)fail('geocode_independent_review_required');
 if(review.geocode_proof_sha256!==built.proof_sha256||review.specialist!==report.collector||review.reviewer===review.specialist||review.reviewer===proof.address_proof.identity.reviewer)fail('geocode_independent_review_required');return true;
}

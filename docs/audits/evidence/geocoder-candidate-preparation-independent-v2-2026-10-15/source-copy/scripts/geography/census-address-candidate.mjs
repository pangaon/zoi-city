import {createHash} from 'node:crypto';
import {officialSourceQuarantined,sourceIdentityContentHeld,selectedOfficialWebsite} from '../../assets/enrichment/official-source-policy.mjs';

// Offline preparation only. These values do not grant a ticket, approve a source,
// or satisfy geography_review_apply's reviewed official-source contract.
export const CENSUS_ENDPOINT='https://geocoding.geo.census.gov/geocoder/locations/addressbatch';
export const CENSUS_LIMITS=Object.freeze({jobs:4,requestBytes:1048576,responseBytes:1048576,field:500,deadlineMs:30000});
export const candidateHash=value=>createHash('sha256').update(value).digest('hex');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const fingerprint=/^[a-f0-9]{32}$/;
// Offline mock contract only: the retained V1 API-PDF download was rejected HTML.
// A successful primary document/benchmark binding remains a live-admission gate.
const benchmarkAllowed=b=>object(b)&&b.id==='4'&&b.name==='Public_AR_Current'&&Object.keys(b).length===2;
const states=new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const clean=v=>typeof v==='string'&&v.length<=CENSUS_LIMITS.field&&!/[\x00-\x1f\x7f]/.test(v)&&v.trim()===v;
// ASCII case/space comparison only; no Unicode normalization, case expansions,
// accent stripping or punctuation removal. Query deduplication uses exact bytes.
const norm=v=>v.replace(/[a-z]/g,c=>c.toUpperCase()).replace(/ +/g,' ').trim();
// Only a terminal road suffix is compared as an abbreviation. Do not rewrite
// street names or directions ("North Street" is not automatically "N Street").
const street=v=>norm(v).replace(/\b(STREET|ROAD|AVENUE|BOULEVARD|DRIVE|LANE|COURT|PLACE|PARKWAY|HIGHWAY)$/g,v=>({STREET:'ST',ROAD:'RD',AVENUE:'AVE',BOULEVARD:'BLVD',DRIVE:'DR',LANE:'LN',COURT:'CT',PLACE:'PL',PARKWAY:'PKWY',HIGHWAY:'HWY'}[v]));
export function candidateCanonical(v){if(Array.isArray(v))return '['+v.map(candidateCanonical).join(',')+']';if(object(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+candidateCanonical(v[k])).join(',')+'}';return JSON.stringify(v);}
function requireThat(test,code){if(!test)throw Error(code);}
const seal=value=>candidateHash(candidateCanonical(value));
function sourceHeld(row){
 if(row.profile!==undefined&&!object(row.profile))return true;
 for(const value of [row.source_context,row.profile?._enrich]){
  if(value===undefined)continue;if(!object(value))return true;
  const entity={...row,profile:{...row.profile,_enrich:value}};
  if(officialSourceQuarantined(entity)||sourceIdentityContentHeld(entity))return true;
  // Conservative superset of the private mixedIdentityHold contract in
  // assets/enrichment/reviewed-official-source.mjs and hospitality catalogValue.
  // Missing website is allowed; typed identity or review failures are not cleared.
  const typedHold=q=>{
   for(const key of ['blocked','scope_review_required','source_scope_mismatch','organization_identity_quarantine','source_challenge','challenge','identity_conflict','branch_conflict','source_challenged','captcha','challenge_detected','identity_review_required','entity_family_review_required'])if(Object.hasOwn(q,key)&&(![true,false,'true','false'].includes(q[key])||q[key]===true||q[key]==='true'))return true;
   if(Object.hasOwn(q,'identity_match')&&q.identity_match!==true&&q.identity_match!=='true')return true;
   for(const key of ['blocked_reason','last_error'])if(Object.hasOwn(q,key)&&q[key]!==null&&(typeof q[key]!=='string'||q[key]!==''))return true;
   for(const key of ['status','crawl_status'])if(Object.hasOwn(q,key)&&q[key]!==null&&(typeof q[key]!=='string'||q[key]&&!['ok','success','complete','completed','fetched','verified'].includes(q[key])))return true;
   return false;
  };
  if(typedHold(value))return true;
  if(Object.hasOwn(value,'source_identity')){
   const identity=value.source_identity;if(!object(identity)||typedHold(identity))return true;
   if(Object.hasOwn(identity,'verification')&&identity.verification!=='exact_name_typed_jsonld')return true;
   if(Object.hasOwn(identity,'name')&&(typeof identity.name!=='string'||norm(identity.name)!==norm(row.name||'')))return true;
   if(Object.hasOwn(identity,'expected_entity_type')&&identity.expected_entity_type!==row.entity_type)return true;
   if(Object.hasOwn(identity,'source_url')&&(typeof identity.source_url!=='string'||!selectedOfficialWebsite(entity)||identity.source_url!==selectedOfficialWebsite(entity)))return true;
  }
  for(const key of ['identity_scope','source_kind'])if(Object.hasOwn(value,key)&&value[key]!==null&&typeof value[key]!=='string')return true;
  if(value.identity_scope||['member','association_member','source_affiliation','member_source','publisher_source_evidence'].some(k=>Object.hasOwn(value,k))||typeof value.source_kind==='string'&&/(?:association|member|publisher|directory|supporting)/i.test(value.source_kind))return true;
 }return false;
}
function eligibility(job,row,observedAt){
 if(!['queued','needs_source','needs_address','unresolved'].includes(job.status))return 'existing_job_state_requires_reconciliation';
 if(!object(row)||row.id!==job.listing_id)return 'current_snapshot_missing';
 if(!fingerprint.test(job.input_fingerprint||'')||!fingerprint.test(job.database_snapshot||'')||job.input_fingerprint!==row.input_fingerprint||job.database_snapshot!==row.database_snapshot||!Number.isSafeInteger(job.source_generation)||job.source_generation<0||job.source_generation!==row.source_generation)return 'current_snapshot_binding_changed';
 if(!Number.isFinite(Date.parse(row.captured_at))||Date.parse(row.captured_at)>observedAt+300000||Date.parse(row.captured_at)<observedAt-300000)return 'current_snapshot_stale';
 if(!Object.hasOwn(row,'owner_user_id')||!Object.hasOwn(row,'owner_workspace_id')||row.owner_user_id!==null||row.owner_workspace_id!==null||row.owner_managed===true||row.claim_status!=='unclaimed')return 'owner_action';
 if(row.public_eligible!==true||row.public_address!==true||row.publish_status!=='published'||!['clean','cleared'].includes(row.moderation_status)||row.marketplace_status==='hidden'||row.duplicate_status==='confirmed_duplicate')return 'not_public_address_eligible';
 if(sourceHeld(row))return 'source_identity_or_scope_hold';
 if(row.reviewed_destination!=null)return 'existing_reviewed_destination_requires_reconciliation';
 if(!['US','USA','United States','United States of America'].includes(row.country))return 'outside_initial_us_scope';
 const region=row.region_code;
 if(!clean(row.address)||!/^\d+[A-Za-z]?(?:-\d+[A-Za-z]?)?\s+\S/.test(row.address)||!clean(row.city)||!row.city||!states.has(region)||!clean(row.postal_code??'')||row.postal_code&&!/^\d{5}(?:-\d{4})?$/.test(row.postal_code))return 'complete_us_address_parts_required';
 if(!object(job.original)||job.original.address!==row.address||job.original.city!==row.city||job.original.country!==row.country)return 'job_address_changed';
 return null;
}
const csvField=value=>'"'+value.replaceAll('"','""')+'"';
export function prepareCensusBatch({jobs,snapshots,observedAt=new Date().toISOString(),benchmark={id:'4',name:'Public_AR_Current'}}={}){
 const stamp=Date.parse(observedAt);
 requireThat(Array.isArray(jobs)&&jobs.length>=1&&jobs.length<=CENSUS_LIMITS.jobs&&Array.isArray(snapshots)&&snapshots.length<=CENSUS_LIMITS.jobs&&Number.isFinite(stamp),'bounded_census_snapshots_required');
 requireThat(benchmarkAllowed(benchmark),'explicit_census_benchmark_required');
 requireThat(jobs.every(j=>object(j)&&uuid.test(j.id||'')&&uuid.test(j.listing_id||''))&&new Set(jobs.map(j=>j.id)).size===jobs.length&&new Set(jobs.map(j=>j.listing_id)).size===jobs.length&&snapshots.every(r=>object(r)&&uuid.test(r.id||''))&&new Set(snapshots.map(r=>r.id)).size===snapshots.length&&snapshots.every(r=>jobs.some(j=>j.listing_id===r.id)),'census_snapshot_identity_invalid');
 const queries=[],bindings=[],excluded=[];
 for(const job of jobs){const row=snapshots.find(r=>r.id===job.listing_id),reason=eligibility(job,row,stamp);
  if(reason){excluded.push({job_id:job.id,listing_id:job.listing_id,reason});continue;}
  const address={street:row.address,city:row.city,state:row.region_code,zip:row.postal_code||''};
  const queryId=seal({provider:'census',benchmark,address});
  if(!queries.some(q=>q.id===queryId))queries.push({id:queryId,address});
  bindings.push({job_id:job.id,listing_id:job.listing_id,input_fingerprint:job.input_fingerprint,database_snapshot:job.database_snapshot,source_generation:job.source_generation,snapshot_sha256:seal({id:row.id,input_fingerprint:row.input_fingerprint,database_snapshot:row.database_snapshot,source_generation:row.source_generation,captured_at:row.captured_at,address}),query_id:queryId,address:{...address},address_authority:'canonical_unverified'});
 }
 const requestCsv=queries.map(q=>[q.id,q.address.street,q.address.city,q.address.state,q.address.zip].map(csvField).join(',')).join('\r\n')+(queries.length?'\r\n':'');
 requireThat(Buffer.byteLength(requestCsv)<=CENSUS_LIMITS.requestBytes,'census_request_byte_cap');
 const body={schema:'zoi.geography.census-candidate-batch.v1',provider:'census',endpoint:CENSUS_ENDPOINT,observed_at:observedAt,benchmark:{id:benchmark.id,name:benchmark.name},queries,bindings,excluded,request_csv:requestCsv,request_sha256:candidateHash(requestCsv),counts:{input_jobs:jobs.length,eligible_listings:bindings.length,excluded_listings:excluded.length,unique_address_queries:queries.length,deduplicated_queries:bindings.length-queries.length},authority:'none',writer_eligible:false,coordinate_writes:0,provider_calls:0};
 return {...body,batch_sha256:seal(body)};
}
export function validateCensusBatch(batch){
 requireThat(object(batch)&&Buffer.byteLength(JSON.stringify(batch))<=65536,'invalid_census_batch');
 const {batch_sha256,...body}=batch;
 requireThat(batch_sha256===seal(body)&&batch.schema==='zoi.geography.census-candidate-batch.v1'&&batch.provider==='census'&&batch.endpoint===CENSUS_ENDPOINT&&batch.authority==='none'&&batch.writer_eligible===false&&batch.coordinate_writes===0&&batch.provider_calls===0,'census_batch_changed');
 requireThat(Array.isArray(batch.queries)&&batch.queries.length<=CENSUS_LIMITS.jobs&&Array.isArray(batch.bindings)&&batch.bindings.length<=CENSUS_LIMITS.jobs&&batch.request_sha256===candidateHash(batch.request_csv)&&Buffer.byteLength(batch.request_csv)<=CENSUS_LIMITS.requestBytes,'invalid_census_batch');
 requireThat(benchmarkAllowed(batch.benchmark)&&Number.isFinite(Date.parse(batch.observed_at))&&Array.isArray(batch.excluded)&&batch.bindings.length+batch.excluded.length>=1&&batch.bindings.length+batch.excluded.length<=CENSUS_LIMITS.jobs,'invalid_census_batch');
 requireThat(new Set(batch.queries.map(q=>q?.id)).size===batch.queries.length&&batch.queries.every(q=>object(q)&&object(q.address)&&['street','city','state','zip'].every(k=>clean(q.address[k]))&&/^\d+[A-Za-z]?(?:-\d+[A-Za-z]?)?\s+\S/.test(q.address.street)&&q.address.city&&(!q.address.zip||/^\d{5}(?:-\d{4})?$/.test(q.address.zip))&&states.has(q.address.state)&&q.id===seal({provider:'census',benchmark:batch.benchmark,address:q.address})),'invalid_census_queries');
 const all=[...batch.bindings,...batch.excluded];
 requireThat(all.every(x=>object(x)&&uuid.test(x.job_id||'')&&uuid.test(x.listing_id||''))&&new Set(all.map(x=>x.job_id)).size===all.length&&new Set(all.map(x=>x.listing_id)).size===all.length&&batch.bindings.every(x=>fingerprint.test(x.input_fingerprint||'')&&fingerprint.test(x.database_snapshot||'')&&Number.isSafeInteger(x.source_generation)&&x.source_generation>=0&&/^[a-f0-9]{64}$/.test(x.snapshot_sha256||'')&&x.address_authority==='canonical_unverified'&&batch.queries.some(q=>q.id===x.query_id&&candidateCanonical(q.address)===candidateCanonical(x.address)))&&batch.queries.every(q=>batch.bindings.some(x=>x.query_id===q.id)),'invalid_census_bindings');
 const csv=batch.queries.map(q=>[q.id,q.address.street,q.address.city,q.address.state,q.address.zip].map(csvField).join(',')).join('\r\n')+(batch.queries.length?'\r\n':'');
 requireThat(csv===batch.request_csv&&candidateCanonical(batch.counts)===candidateCanonical({input_jobs:all.length,eligible_listings:batch.bindings.length,excluded_listings:batch.excluded.length,unique_address_queries:batch.queries.length,deduplicated_queries:batch.bindings.length-batch.queries.length}),'census_request_changed');
 return batch;
}
// Strict headerless RFC4180 subset. Newlines inside fields are parsed then
// rejected by address validation; malformed quoting never falls back to split(',').
function parseCsv(text){
 const rows=[];let row=[],field='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const ch=text[i];if(quoted){if(ch==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=ch;}
  else if(ch==='"'){requireThat(!field&&!closed,'census_csv_invalid');quoted=true;}
  else if(ch===','||ch==='\r'||ch==='\n'){row.push(field);field='';closed=false;if(ch!==','){if(ch==='\r'){requireThat(text[i+1]==='\n','census_csv_invalid');i++;}requireThat(row.some(x=>x!==''),'census_csv_empty_record');rows.push(row);row=[];requireThat(rows.length<=CENSUS_LIMITS.jobs,'census_response_row_cap');}}
  else{requireThat(!closed,'census_csv_invalid');field+=ch;}
  requireThat(field.length<=4096,'census_csv_field_cap');
 }
 requireThat(!quoted,'census_csv_invalid');if(field||row.length||closed){row.push(field);rows.push(row);}requireThat(rows.length<=CENSUS_LIMITS.jobs,'census_response_row_cap');return rows;
}
function matchAddress(raw,q){
 const parts=raw.split(',').map(x=>x.trim());
 return parts.length===4&&street(parts[0])===street(q.address.street)&&norm(parts[1])===norm(q.address.city)&&parts[2]===q.address.state&&/^\d{5}(?:-\d{4})?$/.test(parts[3])&&(!q.address.zip||parts[3]===q.address.zip);
}
export function parseCensusCandidates(batch,bytes,{observedAt=new Date().toISOString()}={}){
 validateCensusBatch(batch);requireThat(bytes instanceof Uint8Array&&bytes.byteLength>0&&bytes.byteLength<=CENSUS_LIMITS.responseBytes&&Number.isFinite(Date.parse(observedAt)),'census_response_byte_cap');
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),rows=parseCsv(text),responseHash=candidateHash(bytes);
 requireThat(rows.length===batch.queries.length,'census_response_membership_changed');const seen=new Set(),matches=new Map();
 for(const row of rows){const q=batch.queries.find(q=>q.id===row[0]);requireThat(q&&!seen.has(row[0])&&row.length>=3&&row.length<=8&&row.every(clean),'census_response_membership_changed');seen.add(row[0]);
  // The echoed input is useful evidence, but matching ID alone cannot approve an
  // unrelated address returned under that ID.
  const echoed=norm(row[1]).replace(/,\s*/g,',');
  requireThat(echoed===norm([q.address.street,q.address.city,q.address.state,q.address.zip].join(',')).replace(/,\s*/g,','),'census_response_input_changed');
  if(['No_Match','Tie'].includes(row[2])){requireThat(row.slice(3).every(x=>x===''),'census_nonmatch_shape_invalid');matches.set(q.id,{status:'unresolved',reason:row[2]==='Tie'?'census_tie_requires_review':'census_no_match',proposed:null});continue;}
  requireThat(row[2]==='Match'&&row.length===8&&['Exact','Non_Exact'].includes(row[3])&&/^\d{1,30}$/.test(row[6])&&['L','R'].includes(row[7]),'census_match_shape_invalid');
  if(row[3]!=='Exact'||!matchAddress(row[4],q)){matches.set(q.id,{status:'needs_address_review',reason:'census_address_match_requires_review',proposed:null});continue;}
  requireThat(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+),[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(row[5]),'census_coordinates_invalid');
  const [longitude,latitude]=row[5].split(',').map(Number);
  requireThat(Number.isFinite(latitude)&&Number.isFinite(longitude)&&latitude>=17&&latitude<=72&&(longitude>=-180&&longitude<=-60||longitude>=170&&longitude<=180),'census_coordinates_invalid');
  matches.set(q.id,{status:'needs_coordinate_review',reason:'census_street_range_estimate_requires_independent_venue_review',proposed:{evidence_kind:'census_address_range_candidate',latitude,longitude,precision:'street_interpolated',venue_verified:false,official_source_confirmed:false,writer_eligible:false,address_authority:'canonical_unverified',address:q.address,matched_address:row[4],tiger_line_id:row[6],tiger_line_side:row[7]}});
 }
 return {schema:'zoi.geography.census-candidate-result.v1',batch_sha256:batch.batch_sha256,request_sha256:batch.request_sha256,response_sha256:responseHash,observed_at:observedAt,benchmark:batch.benchmark,results:batch.bindings.map(binding=>{const match=matches.get(binding.query_id);return {...binding,...match,proposed:match.proposed?{...match.proposed,address:{...binding.address}}:null,precision:match.proposed?'street_interpolated':'unknown',authority:'none',writer_eligible:false,independent_review_required:true,source:{provider:'census',endpoint:CENSUS_ENDPOINT,benchmark:batch.benchmark,query_id:binding.query_id,request_sha256:batch.request_sha256,response_sha256:responseHash,raw_response_bytes:bytes.byteLength}};}),excluded:batch.excluded,counts:batch.counts,authority:'none',writer_eligible:false,coordinate_writes:0,provider_calls:0,complete:false};
}

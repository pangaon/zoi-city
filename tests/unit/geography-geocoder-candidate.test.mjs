import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareCensusBatch,parseCensusCandidates,validateCensusBatch,candidateHash,CENSUS_ENDPOINT,CENSUS_LIMITS} from '../../scripts/geography/census-address-candidate.mjs';
import {runGeocoderCandidateBatch} from '../../scripts/geography/geocoder-candidate-adapter.mjs';
import {prepareCoordinateRequest} from '../../scripts/geography/reviewed-coordinate-request.mjs';
import {snapshotSQL} from '../../scripts/delivery/sync.mjs';

const stamp=new Date().toISOString(),clock=Date.parse(stamp),md5='a'.repeat(32);
function fixture(n=1,changes={}){
 const tail=String(n).padStart(12,'0'),listing='30000000-0000-4000-8000-'+tail;
 const snapshot={id:listing,name:'Public practice '+n,entity_type:'professional',address:'102 Russell Street',city:'Worcester',country:'United States',region_code:'MA',postal_code:'01609',website:null,owner_user_id:null,owner_workspace_id:null,claim_status:'unclaimed',publish_status:'published',moderation_status:'clean',marketplace_status:'active',duplicate_status:null,public_eligible:true,public_address:true,input_fingerprint:md5,database_snapshot:md5,source_generation:2,captured_at:stamp,...changes};
 const job={id:'40000000-0000-4000-8000-'+tail,listing_id:listing,status:'needs_source',input_fingerprint:md5,database_snapshot:md5,source_generation:2,original:{name:snapshot.name,address:snapshot.address,city:snapshot.city,country:snapshot.country}};
 return {job,snapshot};
}
function prepare(fixtures=[fixture()],options={}){return prepareCensusBatch({jobs:fixtures.map(f=>f.job),snapshots:fixtures.map(f=>f.snapshot),observedAt:stamp,...options});}
const csv=row=>row.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',');
function resultRow(q,{indicator='Match',match='Exact',address=[q.address.street.toUpperCase().replace('STREET','ST'),q.address.city.toUpperCase(),q.address.state,q.address.zip||'01609'].join(', '),coordinates='-71.811,42.267',id=q.id,input=[q.address.street,q.address.city,q.address.state,q.address.zip].join(','),tiger='123456',side='L'}={}){return csv([id,input,indicator,...(indicator==='Match'?[match,address,coordinates,tiger,side]:[])]);}
const response=(batch,options={})=>Buffer.from(batch.queries.map(q=>resultRow(q,options)).join('\r\n')+'\r\n');
const isolated=(batch,transport,options={})=>runGeocoderCandidateBatch(batch,{contractMode:'isolated-geocoder-candidate-test',transport,now:()=>clock,...options});
const provenance=batch=>({url:CENSUS_ENDPOINT,redirected:false,redirect_count:0,request_sha256:batch.request_sha256});
const mock=(batch,body=response(batch))=>async()=>({status:200,...provenance(batch),content_type:'text/csv; charset=utf-8',body});

test('complete public US address without website prepares candidate-only input with no IO or source approval',()=>{
 const input=fixture(),before=structuredClone(input),b=prepare([input]);assert.deepEqual(input,before);assert.equal(b.counts.eligible_listings,1);assert.equal(b.counts.unique_address_queries,1);assert.equal(b.authority,'none');assert.equal(b.writer_eligible,false);assert.equal(b.provider_calls,0);assert.equal(b.coordinate_writes,0);assert.equal(b.bindings[0].address_authority,'canonical_unverified');assert.equal(b.bindings[0].source_generation,2);assert.equal(b.queries[0].address.zip,'01609');assert.equal(b.request_sha256,candidateHash(b.request_csv));assert.equal(validateCensusBatch(b),b);
});
test('same public address deduplicates queries while preserving every distinct listing binding',()=>{
 const b=prepare([fixture(1),fixture(2),fixture(3),fixture(4)]);assert.deepEqual(b.counts,{input_jobs:4,eligible_listings:4,excluded_listings:0,unique_address_queries:1,deduplicated_queries:3});const r=parseCensusCandidates(b,response(b),{observedAt:stamp});assert.equal(r.results.length,4);assert.equal(new Set(r.results.map(x=>x.listing_id)).size,4);assert.equal(new Set(r.results.map(x=>x.query_id)).size,1);
});
test('state,ZIP and unit differences do not silently merge different input addresses',()=>{
 const b=prepare([fixture(1),fixture(2,{postal_code:'01610'}),fixture(3,{region_code:'CT'}),fixture(4,{address:'102 Russell Street Apt 4'})]);assert.equal(b.queries.length,4);
});
test('direction words and road-name words are not deduplicated or silently corrected',()=>{
 const b=prepare([fixture(1,{address:'102 North Street'}),fixture(2,{address:'102 N Street'}),fixture(3,{address:'102 Court Drive'}),fixture(4,{address:'102 Ct Drive'})]);assert.equal(b.queries.length,4);
 const first=prepare([fixture(1,{address:'102 North Street'})]);assert.equal(parseCensusCandidates(first,response(first,{address:'102 N ST, WORCESTER, MA, 01609'})).results[0].proposed,null);
});
test('CSV serialization preserves UTF8,comma,quotes and leading-zero ZIP without a header',()=>{
 const b=prepare([fixture(1,{address:'102 Rue "École", Suite 2',city:'Worcester'})]);assert.ok(b.request_csv.includes('"102 Rue ""École"", Suite 2"'));assert.ok(b.request_csv.endsWith('"01609"\r\n'));assert.equal(b.request_csv.split('\r\n').length,2);
});
test('every supplied job remains in explicit eligibility denominator',()=>{
 const b=prepare([fixture(1),fixture(2,{country:'Canada'}),fixture(3,{owner_user_id:'private-owner'}),fixture(4,{address:''})]);assert.equal(b.counts.input_jobs,4);assert.equal(b.counts.eligible_listings+b.counts.excluded_listings,4);assert.deepEqual(b.excluded.map(x=>x.reason),['outside_initial_us_scope','owner_action','complete_us_address_parts_required']);assert.ok(!JSON.stringify(b).includes('private-owner'));
});
test('eligibility spans public listing families and keeps sparse addresses held without a showcase allowlist',()=>{
 for(const entity_type of ['business','restaurant','organization','church','artist','creator','professional','event','travel_place','society']){const full=fixture(1,{entity_type}),sparse=fixture(2,{entity_type,address:''}),b=prepare([full,sparse]);assert.equal(b.counts.eligible_listings,1,entity_type);assert.equal(b.excluded[0].reason,'complete_us_address_parts_required',entity_type);assert.equal(b.bindings[0].listing_id,full.snapshot.id);}
});
for(const [name,changes,reason] of [
 ['unknown ownership',{owner_user_id:undefined},'owner_action'],['claimed',{claim_status:'claimed'},'owner_action'],['private address',{public_address:false},'not_public_address_eligible'],['draft',{publish_status:'draft'},'not_public_address_eligible'],['hidden',{marketplace_status:'hidden'},'not_public_address_eligible'],['duplicate',{duplicate_status:'confirmed_duplicate'},'not_public_address_eligible'],['territory',{country:'Puerto Rico',region_code:'PR'},'outside_initial_us_scope'],['missing state',{region_code:undefined},'complete_us_address_parts_required'],['missing city',{city:''},'complete_us_address_parts_required'],['missing house number',{address:'Russell Street'},'complete_us_address_parts_required'],['numeric ZIP loses zero',{postal_code:1609},'complete_us_address_parts_required'],['reviewed destination',{reviewed_destination:{request_id:'receipt'}},'existing_reviewed_destination_requires_reconciliation']
])test(name+' is held without fetching',()=>assert.equal(prepare([fixture(1,changes)]).excluded[0].reason,reason));
test('optional ZIP can be absent when house street city and state are complete',()=>assert.equal(prepare([fixture(1,{postal_code:null})]).queries[0].address.zip,''));
test('ownership/profile/source hold malformed values and held classifications fail closed',()=>{
 for(const changes of [{profile:[]},{profile:{_enrich:null}},{source_context:{blocked:[]}},{source_context:{last_error:{malformed:true}}},{source_context:{source_identity:{verification:4}}},{source_context:{scope_review_required:true}},{source_context:{member:false}},{source_context:{blocked_reason:'scope conflict'}},{source_context:{source_identity:{verification:'unverified'}}}])assert.equal(prepare([fixture(1,changes)]).excluded[0].reason,'source_identity_or_scope_hold');
});
test('job state,current fingerprints,generation,address and observed freshness bind preparation',()=>{
 for(const [modify,reason] of [[f=>f.job.status='applied','existing_job_state_requires_reconciliation'],[f=>f.snapshot.input_fingerprint='b'.repeat(32),'current_snapshot_binding_changed'],[f=>f.snapshot.database_snapshot='b'.repeat(32),'current_snapshot_binding_changed'],[f=>f.snapshot.source_generation++,'current_snapshot_binding_changed'],[f=>f.snapshot.address='104 Russell Street','job_address_changed'],[f=>f.snapshot.captured_at=new Date(clock-300001).toISOString(),'current_snapshot_stale']]){const f=fixture();modify(f);assert.equal(prepare([f]).excluded[0].reason,reason);}
});
test('bounded snapshot identities and explicit benchmark reject ambiguity before request preparation',()=>{
 const f=fixture();for(const input of [{jobs:[f.job,f.job],snapshots:[f.snapshot]},{jobs:[f.job],snapshots:[f.snapshot,f.snapshot]},{jobs:Array.from({length:5},()=>f.job),snapshots:[f.snapshot]},{jobs:[],snapshots:[]}])assert.throws(()=>prepareCensusBatch({...input,observedAt:stamp}),/census|bounded/);for(const benchmark of [{id:'4',name:'unknown'},{id:'3',name:'Public_AR_Current'},{id:'4',name:'Public_AR_ACS2025'}])assert.throws(()=>prepare(undefined,{benchmark}),/benchmark/);
});
test('Census exact address match creates only a street-range estimate, never writer/venue authority',()=>{
 const b=prepare(),r=parseCensusCandidates(b,response(b),{observedAt:stamp}),x=r.results[0];assert.equal(x.status,'needs_coordinate_review');assert.equal(x.proposed.precision,'street_interpolated');assert.equal(x.proposed.evidence_kind,'census_address_range_candidate');assert.equal(x.proposed.venue_verified,false);assert.equal(x.proposed.official_source_confirmed,false);assert.equal(x.proposed.writer_eligible,false);assert.equal(x.independent_review_required,true);assert.equal(x.proposed.longitude,-71.811);assert.equal(x.proposed.latitude,42.267);assert.equal(r.complete,false);assert.equal(r.provider_calls,0);assert.equal(x.source.response_sha256,candidateHash(response(b)));assert.throws(()=>prepareCoordinateRequest({requestId:fixture().job.id,reportText:JSON.stringify(r),review:{},snapshot:fixture().snapshot}),/coordinate|report/);
});
test('nonexistent numbered structure fixture remains interpolated despite Exact and cannot verify venue existence',()=>{
 const b=prepare([fixture(1,{address:'99999 Imaginary Road'})]),r=parseCensusCandidates(b,response(b));assert.equal(r.results[0].proposed.venue_verified,false);assert.equal(r.results[0].proposed.precision,'street_interpolated');
});
test('No_Match and Tie remain unresolved without proposed positions',()=>{
 const b=prepare();for(const indicator of ['No_Match','Tie']){const x=parseCensusCandidates(b,response(b,{indicator})).results[0];assert.equal(x.status,'unresolved');assert.equal(x.proposed,null);assert.equal(x.writer_eligible,false);}
});
test('Non_Exact,wrong street/city/state/ZIP or dropped unit require address review without selecting coordinates',()=>{
 const b=prepare();for(const options of [{match:'Non_Exact'},{address:'104 RUSSELL ST, WORCESTER, MA, 01609'},{address:'102 RUSSELL ST, BOSTON, MA, 01609'},{address:'102 RUSSELL ST, WORCESTER, CT, 01609'},{address:'102 RUSSELL ST, WORCESTER, MA, 01610'}])assert.equal(parseCensusCandidates(b,response(b,options)).results[0].proposed,null);
 const unit=prepare([fixture(1,{address:'102 Russell Street Apt 4'})]);assert.equal(parseCensusCandidates(unit,response(unit,{address:'102 RUSSELL ST, WORCESTER, MA, 01609'})).results[0].proposed,null);
});
test('response ordering joins immutable row IDs rather than array positions',()=>{
 const b=prepare([fixture(1),fixture(2,{address:'104 Russell Street'})]);const bytes=Buffer.from(b.queries.toReversed().map(q=>resultRow(q)).join('\r\n'));const r=parseCensusCandidates(b,bytes);assert.equal(r.results[0].proposed.address.street,'102 Russell Street');assert.equal(r.results[1].proposed.address.street,'104 Russell Street');
});
test('missing duplicate unknown extra or edited echoed input rows reject the entire response',()=>{
 const b=prepare(),row=resultRow(b.queries[0]);for(const body of ['',row+'\n'+row,resultRow(b.queries[0],{id:'f'.repeat(64)}),resultRow(b.queries[0],{input:'Different request'})])assert.throws(()=>parseCensusCandidates(b,Buffer.from(body)),/census/);
});
test('malformed CSV,invalid UTF8,nonfinite/swapped/zero/outsideUS points and oversized bodies refuse',()=>{
 const b=prepare();for(const bytes of [Buffer.from('"unterminated'),Buffer.from([0xff]),Buffer.alloc(CENSUS_LIMITS.responseBytes+1)])assert.throws(()=>parseCensusCandidates(b,bytes));for(const coordinates of ['NaN,42','Infinity,42','42,-71','0,0','-71,91','20,40','-71.8,42.2,1'])assert.throws(()=>parseCensusCandidates(b,response(b,{coordinates})),/coordinates/);
});
test('prepared bytes and metadata cannot change unnoticed or redirect transport',async()=>{
 const b=prepare();for(const mutate of [x=>x.request_csv+='extra',x=>x.endpoint='https://other.example/',x=>x.queries[0].address.city='Other',x=>x.bindings[0].source_generation++,x=>x.authority='approved']){const x=structuredClone(b);mutate(x);let calls=0;await assert.rejects(isolated(x,async()=>calls++),/census/);assert.equal(calls,0);}
});
test('production default refuses before network even with an enabled flag or arbitrary request',async()=>{
 let calls=0;const transport=async()=>{calls++;throw Error('must not execute');};await assert.rejects(runGeocoderCandidateBatch(null,{transport,enabled:true}),/production_geocoder_adapter_disabled/);await assert.rejects(runGeocoderCandidateBatch(prepare(),{transport,enabled:true}),/production_geocoder_adapter_disabled/);assert.equal(calls,0);
});
test('Mapbox and OpenCage transports stay unadmitted including named isolated mode',async()=>{
 for(const provider of ['mapbox','opencage']){let calls=0;await assert.rejects(isolated({provider},async()=>calls++),/provider_not_admitted/);assert.equal(calls,0);}
});
test('isolated mock dispatch counts query attempts separately from HTTP calls and retains exact evidence bytes',async()=>{
 const b=prepare([fixture(1),fixture(2,{address:'104 Russell Street'})]);let calls=0;const bytes=response(b);const r=await isolated(b,async request=>{calls++;assert.equal(request.url,CENSUS_ENDPOINT);assert.equal(request.method,'POST');assert.equal(request.fields.benchmark,'4');assert.equal(request.fields.addressFile.bytes.toString(),b.request_csv);assert.equal(request.max_response_bytes,CENSUS_LIMITS.responseBytes);return {status:200,...provenance(b),content_type:'text/csv',body:bytes};});assert.equal(calls,1);assert.equal(r.simulated_http_calls,1);assert.equal(r.simulated_query_attempts,2);assert.equal(r.reserved_query_slots,2);assert.equal(r.unknown_query_slots,0);assert.equal(r.provider_calls,0);assert.equal(r.production_authority,false);assert.equal(r.retained_response.sha256,candidateHash(bytes));assert.deepEqual(r.retained_response.bytes,bytes);assert.equal(r.candidates.results.length,2);
});
test('fully excluded batch performs zero simulated HTTP calls',async()=>{const b=prepare([fixture(1,{country:'Canada'})]);let calls=0;const r=await isolated(b,async()=>calls++);assert.equal(calls,0);assert.equal(r.state,'no_eligible_candidates');assert.equal(r.reserved_query_slots,0);});
test('stale preparation and invalid timeout refuse before transport',async()=>{const b=prepare();let calls=0;for(const options of [{now:()=>clock+300001},{timeoutMs:0},{timeoutMs:30001}])await assert.rejects(isolated(b,async()=>calls++,options),/stale|bounded/);assert.equal(calls,0);});
test('status failures,malformed200 and lost response preserve allowance and never retry or echo error secrets',async()=>{
 const b=prepare();for(const transport of [async()=>{throw Error('private-provider-token');},async()=>({status:429}),async()=>({status:200,...provenance(b),content_type:'text/csv',body:Buffer.from('invalid')})]){let calls=0;const r=await isolated(b,request=>{calls++;return transport(request);});assert.equal(calls,1);assert.equal(r.unknown_query_slots,1);assert.equal(r.candidates,null);assert.equal(r.automatic_retry,false);assert.ok(!JSON.stringify(r).includes('private-provider-token'));if(r.retained_response)assert.equal(r.retained_response.sha256,candidateHash(Buffer.from('invalid')));}
});
test('stream byte cap aborts transport and a single deadline bounds both response and streamed body waits',async()=>{
 const b=prepare();let signal;const oversized=await isolated(b,async request=>{signal=request.signal;return {status:200,...provenance(b),content_type:'text/csv',body:(async function*(){yield Buffer.alloc(CENSUS_LIMITS.responseBytes);yield Buffer.alloc(1);})()};});assert.equal(oversized.state,'unknown_provider_outcome');assert.equal(signal.aborted,true);for(const stream of [false,true]){let signal;const r=await isolated(b,async request=>{signal=request.signal;if(!stream)return new Promise(()=>{});return {status:200,...provenance(b),content_type:'text/csv',body:{async *[Symbol.asyncIterator](){await new Promise(()=>{});}}};},{timeoutMs:20});assert.equal(r.state,'unknown_provider_outcome');assert.equal(r.unknown_query_slots,1);assert.equal(signal.aborted,true);}
});
test('chunked UTF8 response yields the same candidate with bounded retained bytes',async()=>{const b=prepare(),bytes=response(b);const r=await isolated(b,async()=>({status:200,...provenance(b),content_type:'text/plain',body:(async function*(){for(let i=0;i<bytes.length;i+=7)yield bytes.subarray(i,i+7);})()}));assert.equal(r.state,'candidate_review_required');assert.equal(r.retained_response.sha256,candidateHash(bytes));});
test('owner action explains actual provider/storage/map rights,cost gates and candidate precision',()=>{
 const sql=snapshotSQL({scope_version:1,execution_queue:[],groups:[]}),match=sql.match(/'owner_actions_sync', '((?:[^']|'')*)'::jsonb/);assert.ok(match);const a=JSON.parse(match[1].replaceAll("''","'")).actions.find(a=>a.id==='geocoding');assert.match(a.action,/street-range estimates/);assert.match(a.action,/MapLibre and public API distribution/);assert.match(a.action,/card, token and permanent flag alone/);assert.match(a.action,/disabled/);assert.match(a.fee_review,/No signup, paid spend or live batch is enabled by this setup step/);assert.doesNotMatch(a.blocks,/exact address/);
});
test('new adapter has no credential lookup,built-in fetch,database writer or hidden environment activation',async()=>{
 const source=await readFile(new URL('../../scripts/geography/geocoder-candidate-adapter.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/\bfetch\s*\(|process\.env|Deno\.env|geography_review_apply\s*\(|geography_repair_lease\s*\(/);
});
for(const [left,right,matched]of [['102 Avenue Ⅳ','102 Avenue IV','102 Avenue IV'],['102 Straße Road','102 STRASSE Road','102 STRASSE RD'],['102 A.B Road','102 AB Road','102 AB RD']])test('independent lexical counterexample stays distinct: '+left,()=>{
 const b=prepare([fixture(1,{address:left}),fixture(2,{address:right})]);assert.equal(b.queries.length,2);assert.notEqual(b.bindings[0].query_id,b.bindings[1].query_id);assert.equal(b.bindings[0].address.street,left);assert.equal(b.bindings[1].address.street,right);
 const r=parseCensusCandidates(b,response(b,{address:matched+', WORCESTER, MA, 01609'}));assert.equal(r.results[0].proposed,null);assert.equal(r.results[1].proposed.address.street,right);assert.equal(r.results[0].address.street,left);
});
test('query dedup is exact-byte only while each listing retains its own ASCII case/space spelling',()=>{
 const addresses=['102 Test Road','102 TEST ROAD','102  Test Road','102 Test Road'];const b=prepare(addresses.map((address,i)=>fixture(i+1,{address})));assert.equal(b.queries.length,3);const r=parseCensusCandidates(b,response(b,{address:'102 TEST RD, WORCESTER, MA, 01609'}));assert.deepEqual(r.results.map(x=>x.proposed.address.street),addresses);
 for(const [left,right]of [['102 Café Road','102 Cafe Road'],['102 Ａ Road','102 A Road'],['102 A-B Road','102 AB Road']]){const b=prepare([fixture(1,{address:left}),fixture(2,{address:right})]);assert.equal(b.queries.length,2);}
});
test('response provenance rejects foreign,redirected,missing or changed endpoint metadata before reading body',async()=>{
 const b=prepare();const variations=[{url:'https://untrusted.example/redirect',redirected:true},{url:'https://untrusted.example/redirect'},{url:CENSUS_ENDPOINT+'/'},{url:CENSUS_ENDPOINT+'?other=true'},{url:'http://geocoding.geo.census.gov/geocoder/locations/addressbatch'},{url:undefined},{redirected:undefined},{redirected:'false'},{redirect_count:1},{redirect_count:undefined},{request_sha256:'0'.repeat(64)}];
 for(const variation of variations){let calls=0,reads=0;const r=await isolated(b,async request=>{calls++;assert.equal(request.redirect,'error');assert.equal(request.request_sha256,b.request_sha256);return {status:200,...provenance(b),...variation,content_type:'text/csv',body:{async *[Symbol.asyncIterator](){reads++;yield response(b);}}};});assert.equal(calls,1);assert.equal(reads,0);assert.equal(r.state,'unknown_provider_outcome');assert.equal(r.candidates,null);assert.equal(r.unknown_query_slots,1);}
 const accepted=await isolated(b,mock(b));assert.equal(accepted.state,'candidate_review_required');
});
test('established identity,scope,last_error and review holds refuse both context locations and nested identity state',()=>{
 const established=[{last_error:'source_scope_mismatch'},{last_error:'scope_review_required'},{last_error:'source_identity_mismatch'},{identity_match:false},{identity_match:'false'},{identity_conflict:true},{identity_conflict:'true'},{status:'blocked'},{crawl_status:'review_required'},{crawl_status:'identity_review_required'},{branch_conflict:true},{source_challenged:true},{identity_scope:'foreign_branch'},{source_identity:{verification:'rejected_mismatch'}},{source_identity:{verification:'unknown'}},{source_identity:{identity_match:false}},{source_identity:{identity_conflict:true}},{source_identity:{status:'blocked'}}];
 for(const value of established)for(const container of ['source_context','profile']){const changes=container==='profile'?{profile:{_enrich:value}}:{source_context:value},b=prepare([fixture(1,changes)]);assert.equal(b.bindings.length,0,JSON.stringify(changes));assert.equal(b.excluded[0].reason,'source_identity_or_scope_hold');}
});
test('malformed typed identity values and unknown review states cannot become source-clear',()=>{
 for(const value of [{identity_match:null},{identity_match:1},{identity_conflict:[]},{identity_conflict:null},{last_error:' '},{blocked_reason:' '},{status:{}},{crawl_status:'new_unknown_state'},{source_identity:{verification:null}},{source_identity:{identity_match:[]}},{source_identity:{name:4}},{source_kind:[]}])assert.equal(prepare([fixture(1,{source_context:value})]).bindings.length,0,JSON.stringify(value));
 const valid=fixture(1,{website:'https://official.example/',profile:{_enrich:{source_identity:{verification:'exact_name_typed_jsonld',name:'Public practice 1',expected_entity_type:'professional',source_url:'https://official.example/'},identity_match:true,status:'verified'}}});assert.equal(prepare([valid]).bindings.length,1);assert.equal(prepare([fixture()]).bindings.length,1);
});
test('retained rejected Census download is HTML failure evidence and does not prove the API/benchmark contract',async()=>{
 const dir=new URL('../../docs/audits/evidence/geocoder-candidate-preparation-owner-v2-2026-10-15/',import.meta.url),facts=JSON.parse(await readFile(new URL('documentation-provenance.json',dir),'utf8')),bytes=await readFile(new URL('held-v1-census-api-rejected-response.html',dir));assert.equal(bytes.byteLength,247);assert.equal(candidateHash(bytes),facts.rejected_api_download.sha256);assert.equal(bytes.subarray(0,5).toString()==='%PDF-',false);assert.match(bytes.toString(),/Request Rejected/);assert.equal(facts.rejected_api_download.is_api_specification_proof,false);assert.equal(facts.mock_contract.live_api_contract_verified,false);assert.equal(facts.mock_contract.live_benchmark_id_name_binding_verified,false);const source=await readFile(new URL('../../scripts/geography/census-address-candidate.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/documented by the retained Census API specification/);
});
test('owner action and root metadata proof explicitly keep real Census access blocked',async()=>{
 const dir=new URL('../../docs/audits/evidence/geocoder-candidate-preparation-owner-v2-2026-10-15/',import.meta.url),proof=JSON.parse(await readFile(new URL('root-census-benchmark-metadata-result.json',dir),'utf8')),body=await readFile(new URL('root-census-benchmarks-rejected.body',dir)),sql=snapshotSQL({scope_version:1,execution_queue:[],groups:[]});assert.equal(body.byteLength,247);assert.equal(candidateHash(body),'9129c7ea629b86868a8439d4e009d6874290c45c1a1d89c7329d92bb61806698');assert.match(body.toString(),/Request Rejected/);assert.ok(proof);assert.match(sql,/Current Census API and benchmark access remains blocked/);
});

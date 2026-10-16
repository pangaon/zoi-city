import {CENSUS_ENDPOINT,CENSUS_LIMITS,candidateHash,validateCensusBatch,parseCensusCandidates} from './census-address-candidate.mjs';
import {prepareNominatimBatch,parseNominatimAddressResponse,NOMINATIM_ENDPOINT,NOMINATIM_LIMITS} from './nominatim-address-candidate.mjs';
import {requestPage} from '../quality/source-fetch.mjs';
import {randomUUID} from 'node:crypto';

// No built-in fetch, environment lookup, credentials, leases, writer or archive.
// A real adapter needs separately reviewed canonical finite-ticket admission.
// The named isolated mode only exercises an injected mock transport contract.
export async function runGeocoderCandidateBatch(batch,{contractMode,transport,timeoutMs=CENSUS_LIMITS.deadlineMs,now=Date.now}={}){
 if(contractMode!=='isolated-geocoder-candidate-test')throw Error('production_geocoder_adapter_disabled');
 if(batch?.provider!=='census')throw Error('geocoder_provider_not_admitted');
 validateCensusBatch(batch);
 if(typeof transport!=='function'||typeof now!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>CENSUS_LIMITS.deadlineMs)throw Error('bounded_mock_transport_required');
 if(!Number.isFinite(now())||Math.abs(now()-Date.parse(batch.observed_at))>300000)throw Error('census_preparation_stale');
 const simulatedQueries=batch.queries.length,base={schema:'zoi.geography.geocoder-candidate-run.v1',contract_mode:contractMode,production_authority:false,batch_sha256:batch.batch_sha256,request_sha256:batch.request_sha256,simulated_http_calls:0,simulated_query_attempts:0,reserved_query_slots:simulatedQueries,unknown_query_slots:0,provider_calls:0,coordinate_writes:0,complete:false,automatic_retry:false};
 if(!simulatedQueries)return {...base,state:'no_eligible_candidates',candidates:null};
 const controller=new AbortController();let timer,retainedResponse=null;
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('mock_provider_deadline'));},timeoutMs);});
 const race=operation=>Promise.race([operation,deadline]);
 try{
  base.simulated_http_calls=1;base.simulated_query_attempts=simulatedQueries;
  const response=await race(Promise.resolve().then(()=>transport({url:CENSUS_ENDPOINT,method:'POST',redirect:'error',request_sha256:batch.request_sha256,fields:{benchmark:batch.benchmark.id,addressFile:{filename:'addresses.csv',content_type:'text/csv; charset=utf-8',bytes:Buffer.from(batch.request_csv,'utf8')}},signal:controller.signal,max_response_bytes:CENSUS_LIMITS.responseBytes})));
  if(response?.status!==200)return {...base,state:'provider_response_held',reason:'provider_http_status_unconfirmed',unknown_query_slots:simulatedQueries,candidates:null};
  if(response.url!==CENSUS_ENDPOINT||response.redirected!==false||response.redirect_count!==0||response.request_sha256!==batch.request_sha256)throw Error('mock_provider_provenance_unconfirmed');
  if(!['text/csv','text/plain','application/octet-stream'].includes(response.content_type?.split(';')[0]?.trim().toLowerCase()))throw Error('mock_provider_content_type');
  const chunks=[];let length=0;
  const append=chunk=>{if(!(chunk instanceof Uint8Array)||!chunk.byteLength)throw Error('mock_provider_body_invalid');length+=chunk.byteLength;if(length>CENSUS_LIMITS.responseBytes)throw Error('mock_provider_byte_cap');chunks.push(Buffer.from(chunk));};
  if(response.body instanceof Uint8Array)append(response.body);
  else if(response.body?.[Symbol.asyncIterator]){const iterator=response.body[Symbol.asyncIterator]();try{for(;;){const next=await race(iterator.next());if(next.done)break;append(next.value);}}catch(error){controller.abort();if(iterator.return)Promise.resolve(iterator.return()).catch(()=>{});throw error;}}
  else throw Error('mock_provider_body_invalid');
  const bytes=Buffer.concat(chunks,length),observedAt=new Date(now()).toISOString();
  retainedResponse={content_type:response.content_type,bytes,sha256:candidateHash(bytes)};
  const candidates=parseCensusCandidates(batch,bytes,{observedAt});
  return {...base,state:'candidate_review_required',candidates,retained_response:retainedResponse};
 }catch{
  controller.abort();return {...base,state:'unknown_provider_outcome',reason:'preserve_request_and_reconcile_no_automatic_retry',unknown_query_slots:simulatedQueries,candidates:null,...(retainedResponse?{retained_response:retainedResponse}:{})};
 }finally{clearTimeout(timer);}
}

/** Real fixed-endpoint transport, never used by scheduled source collection.
 * No redirects, provider fallback or retry. The identifying existing transport
 * User-Agent is preserved. Provider admission happens before this function. */
export async function requestNominatimAddress(query,{request=requestPage}={}){
 if(query.endpoint!==NOMINATIM_ENDPOINT||query.provider!=='nominatim')throw Error('nominatim_endpoint_not_admitted');
 const url=NOMINATIM_ENDPOINT+'?'+new URLSearchParams(query.params);
 const r=await request(url,{maxBytes:NOMINATIM_LIMITS.responseBytes,timeout:8000});
 if(r.url!==url||r.status!==200||!/^application\/json(?:;|$)/i.test(r.headers?.['content-type']||'')||Buffer.byteLength(r.text||'')>NOMINATIM_LIMITS.responseBytes)throw Error('nominatim_provider_response_held');
 return{endpoint:NOMINATIM_ENDPOINT,status:200,redirected:false,response_text:r.text,response_sha256:candidateHash(r.text),response_bytes:Buffer.byteLength(r.text)};
}

/** One finite run through the EXISTING source singleton/admission/private
 * archive. All canonical callbacks are mandatory. No environment credential
 * reads, queue, scheduler, implicit activation or coordinate writer lives here.
 * reserveQuery must persist before dispatch, enforce the shared cap/15s spacing
 * and refuse a previous unknown outcome. Retain/reconcile before any reuse. */
/** @param {Array<any>} entries @param {{mode?:string,admission?:any,transport?:any,observedAt?:string,now?:()=>number,wait?:(ms:number)=>Promise<void>}} options */
export async function runQualifiedNominatimBatch(entries,{mode,admission,transport=requestNominatimAddress,observedAt,now=Date.now,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 if(mode!=='finite-reviewed-public-addresses-v1')throw Error('production_geocoder_adapter_disabled');
 for(const key of ['acquireExistingAdmission','currentSnapshot','readCachedQuery','reserveQuery','archiveResponse','finishQuery','releaseExistingAdmission'])if(typeof admission?.[key]!=='function')throw Error('canonical_geocoder_admission_required');
 const started=now(),batch=prepareNominatimBatch(entries,{now:started,observedAt:observedAt||new Date(started).toISOString()}),binding=new Map(batch.bindings.map(b=>[b.listing_id,b])),results=[];
 const permit=await admission.acquireExistingAdmission({batch_sha256:batch.batch_sha256,provider:'nominatim',max_queries:3,minimum_spacing_ms:15000});
 if(permit?.admitted!==true||permit.singleton_held!==true||permit.provider!=='nominatim'||permit.max_queries!==3||permit.minimum_spacing_ms!==15000||!permit.receipt_id||Date.parse(permit.expires_at)<=now())throw Error('canonical_geocoder_admission_refused');
 let calls=0,lastStart=-Infinity;
 try{
  for(const query of batch.queries){
   const members=entries.filter(e=>binding.get(e.snapshot.id).request_sha256===query.request_sha256);
   const checkCurrent=async()=>{for(const e of members){const current=await admission.currentSnapshot(e.snapshot.id,e.addressProof);if(current?.database_snapshot!==e.snapshot.database_snapshot||current?.source_fingerprint!==e.snapshot.source_fingerprint)throw Error('geocoder_snapshot_changed');prepareNominatimBatch([{snapshot:current,addressProof:e.addressProof}],{now:now(),observedAt:new Date(now()).toISOString()});}};
   await checkCurrent();let captured=await admission.readCachedQuery(query.request_sha256),cached=!!captured;
   if(!captured){
    const delay=NOMINATIM_LIMITS.spacingMs-(now()-lastStart);if(delay>0)await wait(delay);
    if(now()-started>NOMINATIM_LIMITS.deadlineMs-8000||Date.parse(permit.expires_at)<=now())throw Error('geocoder_finite_deadline');
    await checkCurrent();
    const reservation=await admission.reserveQuery({receipt_id:permit.receipt_id,request:query,dispatch_at:new Date(now()).toISOString()});
    if(reservation?.reserved!==true||reservation.request_sha256!==query.request_sha256)throw Error('geocoder_query_reservation_refused');
    // Unknown HTTP or archival outcome stays reserved; never request it again.
    calls++;lastStart=now();
    try{
     const response=await transport(query);if(response.endpoint!==NOMINATIM_ENDPOINT||response.status!==200||response.redirected!==false||response.response_sha256!==candidateHash(response.response_text)||response.response_bytes!==Buffer.byteLength(response.response_text)||response.response_bytes>NOMINATIM_LIMITS.responseBytes)throw Error('nominatim_provider_provenance');
     captured={endpoint:NOMINATIM_ENDPOINT,status:200,redirected:false,response_text:response.response_text,response_sha256:response.response_sha256,response_bytes:response.response_bytes,request_sha256:query.request_sha256,captured_at:new Date(now()).toISOString(),admission:{receipt_id:permit.receipt_id,singleton_held:true,max_queries:3,minimum_spacing_ms:15000}};
     const archive=await admission.archiveResponse({request:query,capture:captured});if(archive?.private!==true||archive.response_sha256!==captured.response_sha256||archive.request_sha256!==query.request_sha256||archive.readback_verified!==true||!archive.private_archive)throw Error('geocoder_private_archive_unconfirmed');
     captured.private_archive=archive.private_archive;await admission.finishQuery({receipt_id:permit.receipt_id,request_sha256:query.request_sha256,capture:captured,state:'retained'});lastStart=now();
    }catch{await admission.finishQuery({receipt_id:permit.receipt_id,request_sha256:query.request_sha256,state:'unknown_no_retry'});return{state:'unknown_provider_outcome',batch_sha256:batch.batch_sha256,provider_calls:calls,coordinate_writes:0,results,automatic_retry:false};}
   }
   if(captured.request_sha256!==query.request_sha256||captured.response_sha256!==candidateHash(captured.response_text)||captured.status!==200||captured.endpoint!==NOMINATIM_ENDPOINT||captured.redirected!==false||captured.private_archive!==members[0].addressProof.capture.private_archive)throw Error('geocoder_cached_response_unconfirmed');
   await checkCurrent();
   for(const e of members){let selected=null,reason=null;try{selected=parseNominatimAddressResponse(query,captured.response_text,e.addressProof);}catch(error){reason=error.message;}results.push({listing_id:e.snapshot.id,request:query,capture:captured,cached,selected,reason,state:selected?'independent_mapped_address_review_required':'unresolved',writer_eligible:false});}
  }
  return{state:'finite_candidates_prepared',batch_sha256:batch.batch_sha256,provider_calls:calls,coordinate_writes:0,results,automatic_retry:false};
 }finally{await admission.releaseExistingAdmission({receipt_id:permit.receipt_id});}
}

/** Connect the finite adapter to the existing RPC singleton and private archive.
 * The allowance is DISABLED after migration; only root can set an expiring exact
 * manifest approval. archive.create is exclusive and must verify private
 * readback. Existing source cron cannot activate or replenish this allowance. */
/** @param {{rpc?:any,currentSnapshot?:any,archive?:any,now?:()=>number}} options */
export function createCanonicalNominatimAdmission({rpc,currentSnapshot,archive,now=Date.now}={}){
 if(typeof rpc!=='function'||typeof currentSnapshot!=='function'||typeof archive?.read!=='function'||typeof archive?.create!=='function'||typeof archive.bucket!=='string')throw Error('canonical_geocoder_transport_required');
 let lease=null,permit=null,manifest=null;
 const cacheKey=sha=>'geocoder/nominatim/queries/'+sha+'.json';
 const read=async key=>{const result=await archive.read(key);if(result==null)return null;if(result.private!==true||typeof result.text!=='string'||result.sha256!==candidateHash(result.text))throw Error('geocoder_private_archive_unconfirmed');return JSON.parse(result.text);};
 const create=async(key,value)=>{const text=JSON.stringify(value),sha=candidateHash(text),r=await archive.create(key,text,{contentType:'application/json',upsert:false});if(r?.private!==true||r.sha256!==sha||r.readback_verified!==true)throw Error('geocoder_private_archive_unconfirmed');return r;};
 return{
  async acquireExistingAdmission(input){manifest=input.batch_sha256;lease=randomUUID();const lock=await rpc('geography_source_capture_acquire',{p_lease:lease});if(lock?.acquired!==true||lock.lease_id!==lease)throw Error('source_capture_busy');try{const budget=await rpc('geography_source_archive_budget',{});if(budget?.can_archive!==true)throw Error('source_archive_budget_blocked');permit=await rpc('geography_geocoder_admit',{p_lease:lease,p_manifest:manifest});if(permit?.admitted!==true)throw Error('geocoder_finite_allowance_disabled');return permit;}catch(error){await rpc('geography_source_capture_release',{p_lease:lease});lease=null;throw error;}},
  currentSnapshot,
  async readCachedQuery(sha){const reservation=await read(cacheKey(sha));if(!reservation)return null;const result=await read('geocoder/nominatim/receipts/'+sha+'.json');if(!result)throw Error('geocoder_prior_unknown_outcome');if(result.request_sha256!==sha||result.capture?.request_sha256!==sha)throw Error('geocoder_cache_request_mismatch');return result.capture;},
  async reserveQuery(input){if(input.receipt_id!==permit?.receipt_id)throw Error('geocoder_admission_changed');await create(cacheKey(input.request.request_sha256),{request:input.request,receipt_id:permit.receipt_id,manifest_sha256:manifest,state:'reserved_no_automatic_retry',reserved_at:new Date(now()).toISOString()});return rpc('geography_geocoder_reserve',{p_lease:lease,p_manifest:manifest,p_request:input.request.request_sha256});},
  async archiveResponse({request,capture}){const r=await archive.create('geocoder/nominatim/responses/'+capture.response_sha256+'.json',capture.response_text,{contentType:'application/json',upsert:false});if(r?.private!==true||r.sha256!==capture.response_sha256||r.readback_verified!==true)throw Error('geocoder_private_archive_unconfirmed');return{private:true,response_sha256:capture.response_sha256,request_sha256:request.request_sha256,readback_verified:true,private_archive:archive.bucket};},
  async finishQuery({request_sha256,capture,state}){await rpc('geography_geocoder_finish',{p_lease:lease,p_manifest:manifest});if(state==='retained')await create('geocoder/nominatim/receipts/'+request_sha256+'.json',{request_sha256,capture,state});/* unknown reservations intentionally stay immutable */},
  async releaseExistingAdmission(){if(lease){const value=lease;lease=null;await rpc('geography_source_capture_release',{p_lease:value});}}
 };
}

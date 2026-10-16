import {CENSUS_ENDPOINT,CENSUS_LIMITS,candidateHash,validateCensusBatch,parseCensusCandidates} from './census-address-candidate.mjs';

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

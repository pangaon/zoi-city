import{researchPublisherProfile}from'./publisher-profile-research.mjs';import{geographyResearchSession}from'./guarded-research-session.mjs';import{sha256}from'../quality/evidence.mjs';
const fixedErrors=new Set(['invalid_source_url','unsafe_source_url','unsafe_source_dns','source_dns_timeout','source_timeout','source_too_large','source_redirect_limit','source_cross_host_redirect','robots_disallow','robots_unavailable','source_request_budget','source_time_budget','source_byte_budget']);
/** Execute already-leased canonical jobs. Caller must archive exact decoded bytes
 * privately before finish, and supply service-only CAS callbacks. No factual writes. */
export async function runPublisherResearchJobs(jobs,{sourceFetch,archiveSource,finishJob,cooldownHost,deadline=Date.now()+70000}={}){
 if(!Array.isArray(jobs)||jobs.length>8||typeof archiveSource!=='function'||typeof finishJob!=='function'||typeof cooldownHost!=='function')throw Error('bounded_publisher_archive_and_service_callbacks_required');
 const ids=new Set(),hosts=new Set();for(const j of jobs){const host=new URL(j.original?.source_url||'').hostname.replace(/^www\./,'');if(j.strategy!=='publisher_profiles_v1'||j.status!=='leased'||!/^[a-f0-9-]{36}$/.test(j.id||'')||!/^[a-f0-9-]{36}$/.test(j.lease_id||'')||!/^[a-f0-9]{32}$/.test(j.input_fingerprint||'')||j.original?.source_kind!=='supporting_publisher_profile'||ids.has(j.id)||hosts.has(host))throw Error('distinct_current_publisher_jobs_required');ids.add(j.id);hosts.add(host);}
 const session=sourceFetch?null:geographyResearchSession({maxRequests:30,maxBytes:12000000,deadline:Math.min(deadline,Date.now()+70000)}),fetchSource=sourceFetch||session.sourceFetch,results=[];
 for(const job of jobs){const row={...job.original,id:job.listing_id};let result;try{
  const page=await fetchSource(row.source_url);const body=page.text;if(typeof body!=='string'||Buffer.byteLength(body)>1500000)throw Error('source_too_large');
  result=researchPublisherProfile(body,row,{url:page.url,httpStatus:page.status});
  // Archive acknowledgement is bound to exact bytes; failure never finishes this lease.
  let archive;try{archive=await archiveSource({job_id:job.id,sha256:sha256(body),bytes:Buffer.byteLength(body),body});}catch{throw Object.assign(Error('publisher_private_archive_unconfirmed'),{archiveFailure:true});}
  if(archive?.private!==true||archive.sha256!==sha256(body)||archive.bytes!==Buffer.byteLength(body))throw Object.assign(Error('publisher_private_archive_unconfirmed'),{archiveFailure:true});
  result.source={...result.source,private_archive:archive.reference,archive_format:'decoded_utf8_sha256'};
 }catch(error){if(error.archiveFailure)throw error;const reason=fixedErrors.has(error?.message)?error.message:'publisher_capture_unconfirmed';result={status:'source_blocked',reason,source:null,proposed:null,precision:'unknown',confidence:'supporting_source_unverified',coordinate_writes:0,website_writes:0};}
 await finishJob(job.id,job.lease_id,result);
 if(result.reason==='source_challenge'&&result.source?.sha256)await cooldownHost(job.id,result.source.sha256);
 results.push({job_id:job.id,listing_id:job.listing_id,status:result.status,reason:result.reason,proposal:!!result.proposed});
 }
 return{results,source_requests:session?.stats.requests??null,complete:false,provider_calls:0,coordinate_writes:0,website_writes:0,database_results_persisted:true};
}

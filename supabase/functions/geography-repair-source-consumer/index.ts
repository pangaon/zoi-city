/** Service-triggered bounded source research. Never applies coordinates. */
import {runGeographyResearchJobs} from './_runner.js';
import {sha256} from './_hash.js';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {timingSafeEqual,randomUUID} from 'node:crypto';
const url=Deno.env.get('SUPABASE_URL')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const token=Deno.env.get('GEOGRAPHY_REPAIR_TOKEN')||'';
const bucket=Deno.env.get('GEOGRAPHY_REPAIR_PRIVATE_BUCKET')||'';
const enabled=Deno.env.get('GEOGRAPHY_REPAIR_SOURCE_ENABLED')==='on';
const headers={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
function authorized(req:Request){const value=req.headers.get('x-geography-repair-token')||'';const a=new TextEncoder().encode(value),b=new TextEncoder().encode(token);return b.length>=32&&a.length===b.length&&timingSafeEqual(a,b);}
const diagnosticStages=new Set(['private_bucket','archive_verify','capture_acquire','archive_budget','job_lease','temporary_directory','source_research','archive_read','archive_upload','job_finish','capture_release','runner_directory','source_document_write','job_result_write']);
const sqlstates=new Set(['P0001','P0002','42501','42883','42703','22P02','22023','23505','23514','23502','55000','57014']);
const handlerErrors=new Set(['invocation_deadline','private_evidence_bucket_required','archive_response_byte_cap','archive_readback_hash_mismatch','capture_lease_invalid','lease_response_invalid','source_hash_invalid','source_archive_byte_cap','source_archive_hash_mismatch','body_deadline','body_byte_cap','geography_lease_unavailable','invalid_geography_capture_result','bounded_leased_geography_jobs_required','runner_operation_failed']);
export function safeConsumerFailure(error:any,stage:string){return{error:handlerErrors.has(error?.message)?error.message:/not (implemented|supported)/i.test(String(error?.message||''))||['ENOSYS','ENOTSUP'].includes(error?.code)?'runtime_operation_unsupported':'bounded_source_batch_failed',stage:diagnosticStages.has(error?.stage)?error.stage:diagnosticStages.has(stage)?stage:'unknown',...(Number.isInteger(error?.http_status)&&error.http_status>=400&&error.http_status<=599?{service_http_status:error.http_status}:{}),...(sqlstates.has(error?.sqlstate)?{sqlstate:error.sqlstate}:{})};}
async function io(path:string,init:RequestInit,deadline=Date.now()+12000,stage='unknown'){const timeout=Math.min(12000,deadline-Date.now());if(timeout<=0)throw Error('invocation_deadline');const r=await fetch(url+path,{...init,signal:AbortSignal.timeout(timeout)});if(!r.ok){let code:any,reason:any;try{const parsed=JSON.parse(new TextDecoder().decode(await cappedBytes(r.body,4096,Math.max(1,Math.min(12000,deadline-Date.now())))));code=parsed.code;reason=parsed.message;}catch{}throw Object.assign(Error(handlerErrors.has(reason)?reason:'service_http_failed'),{stage,http_status:r.status,...(sqlstates.has(code)?{sqlstate:code}:{})});}return r;}
async function rpc(name:string,args:Record<string,unknown>={},deadline=Date.now()+12000){const stages:Record<string,string>={geography_source_capture_acquire:'capture_acquire',geography_source_capture_release:'capture_release',geography_source_archive_budget:'archive_budget',geography_repair_lease:'job_lease',geography_repair_finish:'job_finish'};return(await io('/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(args)},deadline,stages[name]||'unknown')).json();}
async function cappedBytes(body:ReadableStream<Uint8Array>|null,maximum:number,timeout=12000){
 if(!body)return new Uint8Array();const reader=body.getReader();let timer:ReturnType<typeof setTimeout>,timedOut=false;
 const expiry=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{timedOut=true;void reader.cancel();reject(Error('body_deadline'));},timeout)});
 try{return await Promise.race([(async()=>{const chunks:Uint8Array[]=[];let total=0;while(true){const{done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maximum){await reader.cancel();throw Error('body_byte_cap');}chunks.push(value);}if(timedOut)throw Error('body_deadline');const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;})(),expiry]);}finally{clearTimeout(timer!);}
}
export function createHandler({runJobs=runGeographyResearchJobs}={}){return async(req:Request)=>{
 const invocationDeadline=Date.now()+110000,workDeadline=invocationDeadline-5000;
 const serviceIO=(path:string,init:RequestInit,stage:string)=>io(path,init,workDeadline,stage);const serviceRPC=(name:string,args:Record<string,unknown>={})=>rpc(name,args,workDeadline);
 const respond=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method!=='POST')return respond(405,{error:'method_not_allowed'});
 if(!authorized(req))return respond(401,{error:'unauthorized'});
 if(!enabled)return respond(503,{error:'source_consumer_disabled'});
 if(url!=='https://csebihpaychdkanjjsmz.supabase.co'||!service||!/^[a-z0-9-]{3,80}$/.test(bucket))return respond(503,{error:'private_service_configuration_required'});
 let input:any;try{const bytes=await cappedBytes(req.body,1024);input=bytes.byteLength?JSON.parse(new TextDecoder().decode(bytes)):{};if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>key!=='verify_archive')||(Object.hasOwn(input,'verify_archive')&&(typeof input.verify_archive!=='string'||!/^[a-f0-9]{64}$/.test(input.verify_archive))))throw Error('invalid_action');}catch{return respond(400,{error:'invalid_bounded_action_body'});}
 let directory='',archivedBytes=0,captureLease:string|null=null,stage='private_bucket';
 try{
  // Refuse public archives before taking any lease or making source requests.
  const configuration=await(await serviceIO('/storage/v1/bucket/'+bucket,{headers},'private_bucket')).json();
  if(configuration.public!==false)throw Error('private_evidence_bucket_required');
  if(Object.hasOwn(input,'verify_archive')){const sha=input.verify_archive;const archived=await serviceIO('/storage/v1/object/authenticated/'+bucket+'/'+sha+'.html',{method:'GET',headers},'archive_verify');if(Number(archived.headers.get('content-length'))>2*1024*1024){await archived.body?.cancel();throw Error('archive_response_byte_cap');}const bytes=await cappedBytes(archived.body,2*1024*1024);if(sha256(bytes)!==sha)throw Error('archive_readback_hash_mismatch');return respond(200,{ok:true,sha256:sha,bytes:bytes.byteLength,private_archive:true,provider_calls:0,coordinate_writes:0});}
  const leaseId=randomUUID(),capture=await serviceRPC('geography_source_capture_acquire',{p_lease:leaseId});if(capture?.acquired!==true)return respond(503,{error:'source_capture_busy',complete:false});if(capture.lease_id!==leaseId)throw Error('capture_lease_invalid');captureLease=leaseId;
  const budget=await serviceRPC('geography_source_archive_budget');
  const stored=Number(budget?.stored_bytes),limit=Number(budget?.limit_bytes);
  if(budget?.can_archive!==true||typeof budget.stored_bytes!=='number'||typeof budget.limit_bytes!=='number'||!Number.isFinite(stored)||!Number.isFinite(limit)||stored<0||limit<=0||limit>512*1024*1024||stored+15_000_000>limit)return respond(503,{error:'source_archive_budget_blocked',complete:false,stored_bytes:budget?.stored_bytes??null,limit_bytes:budget?.limit_bytes??null});
  // Verify ephemeral directory capability before consuming canonical job leases.
  stage='temporary_directory';directory=await mkdtemp('/tmp/zoi-geography-');
  const jobs=await serviceRPC('geography_repair_lease',{p_limit:4,p_strategy:'official_sources_v1'});
  if(!Array.isArray(jobs))throw Error('lease_response_invalid');
  if(!jobs.length)return respond(200,{processed_jobs:0,state:'no_jobs_in_this_batch',complete:false,provider_calls:0,coordinate_writes:0});
  stage='source_research';const result=await runJobs(jobs,{directory,deadline:workDeadline,finishJob:async(id:string,lease:string,result:any)=>{
   // Content hashes refer to durable PRIVATE decoded source bytes before finish.
   for(const page of result.source?.pages||[]){if(!/^[a-f0-9]{64}$/.test(page.sha256))throw Error('source_hash_invalid');let bytes:Uint8Array;try{bytes=await readFile(directory+'/'+page.sha256+'.source.html');}catch(error){throw Object.assign(error instanceof Error?error:Error('runner_operation_failed'),{stage:'archive_read'});}if(bytes.byteLength>2*1024*1024||archivedBytes+bytes.byteLength>15_000_000)throw Error('source_archive_byte_cap');archivedBytes+=bytes.byteLength;if(sha256(bytes)!==page.sha256)throw Error('source_archive_hash_mismatch');await serviceIO('/storage/v1/object/'+bucket+'/'+page.sha256+'.html',{method:'POST',headers:{...headers,'Content-Type':'text/html; charset=utf-8','x-upsert':'true'},body:new Uint8Array(bytes).buffer},'archive_upload');}
   result.source={...result.source,private_archive:bucket,archive_format:'decoded_utf8_sha256'};
   return serviceRPC('geography_repair_finish',{p_job:id,p_lease:lease,p_result:result});
  }});
  return respond(200,{processed_jobs:result.results.length,source_requests:result.source_requests,provider_calls:0,coordinate_writes:0,complete:false,database_results_persisted:true});
 }catch(error){return respond(503,{...safeConsumerFailure(error,stage),complete:false});}
 finally{if(captureLease){try{await rpc('geography_source_capture_release',{p_lease:captureLease},invocationDeadline);}catch{/* Lease expires fail-closed; do not retry ambiguous release. */}}if(directory)await rm(directory,{recursive:true,force:true});}
};}
Deno.serve(createHandler());

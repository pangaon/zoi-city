#!/usr/bin/env node
// Trusted main CI only. Read the existing Vault token once, keep it in memory,
// invoke one bounded hosted batch, and never enqueue credentials or retry IO.
import{fileURLToPath}from'node:url';
const REPOSITORY='pangaon/zoi-city',PROJECT='csebihpaychdkanjjsmz';
export const VAULT_QUERY="SELECT decrypted_secret AS private_token FROM vault.decrypted_secrets WHERE name='geography_repair_source_token'";
const ERRORS=new Set(['method_not_allowed','unauthorized','source_consumer_disabled','private_service_configuration_required','invalid_bounded_action_body','source_capture_busy','source_archive_budget_blocked','bounded_source_batch_failed','runtime_operation_unsupported','invocation_deadline','private_evidence_bucket_required','archive_response_byte_cap','archive_readback_hash_mismatch','capture_lease_invalid','lease_response_invalid','source_hash_invalid','source_archive_byte_cap','source_archive_hash_mismatch','body_deadline','body_byte_cap','geography_lease_unavailable','invalid_geography_capture_result','bounded_leased_geography_jobs_required','runner_operation_failed','source_archive_read_bytes_required']);
const STAGES=new Set(['private_bucket','archive_verify','capture_acquire','archive_budget','job_lease','temporary_directory','source_research','archive_read','archive_upload','job_finish','capture_release','runner_directory','source_document_write','job_result_write']);
const STATES=new Set(['P0001','P0002','42501','42883','42703','22P02','22023','23505','23514','23502','55000','57014']);
const CODES=new Set(['trusted_main_capture_required','capture_replay_refused','capture_credentials_unavailable','public_repository_unconfirmed','public_repository_required','vault_read_unconfirmed','vault_read_rejected','vault_response_invalid','capture_token_invalid','capture_result_unconfirmed','capture_worker_rejected','capture_result_invalid']);
function fail(code,diagnostic){throw Object.assign(Error(code),{safeCode:code,...(diagnostic?{diagnostic}:{})});}
function safeDiagnostic(body,status){return{http_status:Number.isInteger(status)&&status>=100&&status<=599?status:0,error:ERRORS.has(body?.error)?body.error:'unknown',stage:STAGES.has(body?.stage)?body.stage:'unknown',...(STATES.has(body?.sqlstate)?{sqlstate:body.sqlstate}:{})};}
export function safeScheduledCaptureFailure(error){return{status:'failed',error:CODES.has(error?.safeCode)?error.safeCode:'capture_result_unconfirmed',...(error?.diagnostic?{diagnostic:safeDiagnostic(error.diagnostic,error.diagnostic.http_status)}:{})};}
async function boundedJSON(response,max){let size=0,text='',reader=response.body?.getReader();if(!reader)throw Error('invalid_json');const decoder=new TextDecoder();try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>max){await reader.cancel();throw Error('response_too_large');}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();return JSON.parse(text);}finally{reader.releaseLock();}}
export async function runScheduledCapture({env=process.env,fetcher=fetch,mask=secret=>process.stdout.write('::add-mask::'+secret.replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A')+'\n'),log=console.log}={}){
 if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REPOSITORY!==REPOSITORY||env.GITHUB_REF!=='refs/heads/main'||!['schedule','workflow_dispatch'].includes(env.GITHUB_EVENT_NAME))fail('trusted_main_capture_required');
 if(env.GITHUB_RUN_ATTEMPT!=='1')fail('capture_replay_refused');
 const access=env.SUPABASE_ACCESS_TOKEN,github=env.GITHUB_TOKEN;
 if(typeof access!=='string'||typeof github!=='string'||access.length<20||github.length<20||access.length>4096||github.length>4096||/[\r\n]/.test(access+github))fail('capture_credentials_unavailable');
 mask(access);mask(github);
 // Verify the real repository remains public before touching the Vault token.
 let repo;try{const response=await fetcher('https://api.github.com/repos/'+REPOSITORY,{headers:{Authorization:'Bearer '+github,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(15000),redirect:'error'});if(!response.ok)fail('public_repository_unconfirmed');repo=await boundedJSON(response,65536);}catch{fail('public_repository_unconfirmed');}
 if(repo?.full_name!==REPOSITORY||repo.private!==false||repo.visibility!=='public'||repo.default_branch!=='main'||repo.archived!==false||repo.disabled!==false)fail('public_repository_required');
 let response;try{response=await fetcher('https://api.supabase.com/v1/projects/'+PROJECT+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},body:JSON.stringify({query:VAULT_QUERY,read_only:true}),signal:AbortSignal.timeout(15000),redirect:'error'});}catch{fail('vault_read_unconfirmed');}
 if(!response.ok){await response.body?.cancel();fail('vault_read_rejected');}
 let rows;try{rows=await boundedJSON(response,4096);}catch{fail('vault_response_invalid');}
 if(!Array.isArray(rows)||rows.length!==1||Object.keys(rows[0]||{}).length!==1||typeof rows[0]?.private_token!=='string'||!/^[a-f0-9]{64}$/.test(rows[0].private_token))fail('capture_token_invalid');
 const token=rows[0].private_token;mask(token);
 try{response=await fetcher('https://'+PROJECT+'.supabase.co/functions/v1/geography-repair-source-consumer',{method:'POST',headers:{'Content-Type':'application/json','x-geography-repair-token':token},body:'{}',signal:AbortSignal.timeout(120000),redirect:'error'});}catch{fail('capture_result_unconfirmed');}
 let result;try{result=await boundedJSON(response,4096);}catch{fail(response.ok?'capture_result_invalid':'capture_worker_rejected');}
 if(!response.ok){const diagnostic=safeDiagnostic(result,response.status);if(response.status===503&&result?.error==='source_capture_busy'){const value={status:'busy',processed_jobs:0,complete:false};log(JSON.stringify(value));return value;}fail('capture_worker_rejected',diagnostic);}
 if(!Number.isInteger(result?.processed_jobs)||result.processed_jobs<0||result.processed_jobs>4||result.provider_calls!==0||result.coordinate_writes!==0||result.complete!==false||(result.processed_jobs===0?result.state!=='no_jobs_in_this_batch':result.database_results_persisted!==true||!Number.isInteger(result.source_requests)||result.source_requests<0||result.source_requests>50))fail('capture_result_invalid');
 const safe={status:result.processed_jobs?'captured':'no_jobs',processed_jobs:result.processed_jobs,source_requests:result.processed_jobs?result.source_requests:0,provider_calls:0,coordinate_writes:0,complete:false};log(JSON.stringify(safe));return safe;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){try{await runScheduledCapture();}catch(error){console.error(JSON.stringify(safeScheduledCaptureFailure(error)));process.exitCode=1;}}

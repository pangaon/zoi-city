#!/usr/bin/env node
// Trusted main CI fallback. Use the same durable admission as database Cron.
// Queued is admission only: canonical outcomes must be observed separately.
import{fileURLToPath}from'node:url';
const REPOSITORY='pangaon/zoi-city',PROJECT='csebihpaychdkanjjsmz';
export const CAPTURE_TICK_QUERY="DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.geography_source_capture_tick()'::regprocedure AND md5(pg_get_functiondef(oid))='5b80199a53795d335da09b94577e9115' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=\"\"']) THEN RAISE EXCEPTION 'capture_tick_contract_changed'; END IF; END $guard$; SELECT zoi.geography_source_capture_tick() AS admission";
const CODES=new Set(['trusted_main_capture_required','capture_replay_refused','capture_credentials_unavailable','public_repository_unconfirmed','public_repository_required','capture_admission_unconfirmed','capture_admission_rejected','capture_admission_invalid']);
function fail(code,diagnostic){throw Object.assign(Error(code),{safeCode:code,...(diagnostic?{diagnostic}:{})});}
export function safeScheduledCaptureFailure(error){return{status:'failed',error:CODES.has(error?.safeCode)?error.safeCode:'capture_admission_unconfirmed'};}
async function boundedJSON(response,max){let size=0,text='',reader=response.body?.getReader();if(!reader)throw Error('invalid_json');const decoder=new TextDecoder();try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>max){await reader.cancel();throw Error('response_too_large');}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();return JSON.parse(text);}finally{reader.releaseLock();}}
export async function runScheduledCapture({env=process.env,fetcher=fetch,mask=secret=>process.stdout.write('::add-mask::'+secret.replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A')+'\n'),log=console.log}={}){
 if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REPOSITORY!==REPOSITORY||env.GITHUB_REF!=='refs/heads/main'||!['schedule','workflow_dispatch'].includes(env.GITHUB_EVENT_NAME))fail('trusted_main_capture_required');
 if(env.GITHUB_RUN_ATTEMPT!=='1')fail('capture_replay_refused');
 const access=env.SUPABASE_ACCESS_TOKEN,github=env.GITHUB_TOKEN;
 if(typeof access!=='string'||typeof github!=='string'||access.length<20||github.length<20||access.length>4096||github.length>4096||/[\r\n]/.test(access+github))fail('capture_credentials_unavailable');
 mask(access);mask(github);
 // Verify the real repository remains public before asking for one durable admission.
 let repo;try{const response=await fetcher('https://api.github.com/repos/'+REPOSITORY,{headers:{Authorization:'Bearer '+github,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(15000),redirect:'error'});if(!response.ok)fail('public_repository_unconfirmed');repo=await boundedJSON(response,65536);}catch{fail('public_repository_unconfirmed');}
 if(repo?.full_name!==REPOSITORY||repo.private!==false||repo.visibility!=='public'||repo.default_branch!=='main'||repo.archived!==false||repo.disabled!==false)fail('public_repository_required');
 // Privileged execution is required for the private postgres-only admission.
 // No Vault read, direct worker invocation, reusable source token or retries.
 let response;try{response=await fetcher('https://api.supabase.com/v1/projects/'+PROJECT+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},body:JSON.stringify({query:CAPTURE_TICK_QUERY,read_only:false}),signal:AbortSignal.timeout(15000),redirect:'error'});}catch{fail('capture_admission_unconfirmed');}
 if(!response.ok){await response.body?.cancel();fail('capture_admission_rejected');}
 let rows;try{rows=await boundedJSON(response,4096);}catch{fail('capture_admission_invalid');}
 if(!Array.isArray(rows)||rows.length!==1||Object.keys(rows[0]||{}).length!==1)fail('capture_admission_invalid');
 const result=rows[0].admission;let safe;
 if(result?.admitted===false&&['disabled_or_expired','interval','daily_limit','archive_budget'].includes(result.reason))safe={status:'not_admitted',reason:result.reason,complete:false};
 else if(result?.admitted===true&&['official_sources_v1','publisher_profiles_v1'].includes(result.strategy)&&result.job_cap===4&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(result.ticket_id||'')&&Number.isSafeInteger(result.net_request_id)&&result.net_request_id>0&&Number.isInteger(result.daily_reserved_admissions)&&result.daily_reserved_admissions>=1&&result.daily_reserved_admissions<=288&&Number.isFinite(Date.parse(result.expires_at)))safe={status:'queued',strategy:result.strategy,job_cap:4,daily_reserved_admissions:result.daily_reserved_admissions,complete:false};
 else fail('capture_admission_invalid');
 log(JSON.stringify(safe));return safe;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){try{await runScheduledCapture();}catch(error){console.error(JSON.stringify(safeScheduledCaptureFailure(error)));process.exitCode=1;}}

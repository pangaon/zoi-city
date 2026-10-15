#!/usr/bin/env node
// One reviewed request-only main push, one finite process, no restart or IO retry.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const REPOSITORY='pangaon/zoi-city',PROJECT='csebihpaychdkanjjsmz';
export const REQUEST_PATH='ops/enrichment-finite-trial-request.json',WORKFLOW_PATH='.github/workflows/enrichment-finite-trial.yml';
export const VAULT_QUERY="SELECT decrypted_secret AS private_token FROM vault.decrypted_secrets WHERE name='enrich_token'";
export const PREFLIGHT_QUERY=`SELECT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.enrich_queue_lease(integer,integer,integer)'::regprocedure AND md5(prosrc)='eec0542367704b3460ed603a27de8c35' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""']) AS queue_exact,
 EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.enrich_sample_lease(uuid[])'::regprocedure AND md5(prosrc)='707a4cc5ed2629919b05a249413aefef' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,service_role=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""']) AS sample_exact,
 EXISTS(SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_am a ON a.oid=c.relam WHERE i.indexrelid=to_regclass('zoi.listings_enrichment_candidate_order_idx') AND i.indrelid='zoi.listings'::regclass AND i.indisvalid AND i.indisready AND NOT i.indisunique AND a.amname='btree' AND pg_get_userbyid(c.relowner)='postgres' AND md5(regexp_replace(pg_get_indexdef(i.indexrelid),'[[:space:]]+','','g'))='fc8505a8f97a7b5fbf8d66390e60e6c9') AS index_ready,
 EXISTS(SELECT 1 FROM cron.job WHERE jobid=30 AND NOT active) AND EXISTS(SELECT 1 FROM cron.job WHERE jobid=10 AND NOT active) AS overlap_suppressed`;
const hash=v=>createHash('sha256').update(v).digest('hex');
const SAFE=new Set(['trusted_main_required','replay_refused','request_invalid','request_expired','code_changed','credentials_unavailable','github_unconfirmed','request_not_unique','request_cancelled','schema_unconfirmed','worker_changed','vault_unconfirmed','dedicated_token_unavailable','worker_outcome_unknown','worker_rejected','worker_receipt_invalid','worker_incomplete','window_expired']);
const STATS=new Set(['ok','robots-disallow','source-challenge','javascript-render-required','source-scope-mismatch','member-identity-matched','member-review-required','supplement-refused','supplement-unavailable','nothing-usable','stopped-time-budget','lease-rejected','brief:ready','brief:partial','brief:blocked','brief:needs_review']);
const fail=code=>{throw Object.assign(Error(code),{safeCode:code});};
export const safeTrialFailure=e=>({ok:false,error:SAFE.has(e?.safeCode)?e.safeCode:'worker_outcome_unknown',automatic_retry:false,reconciliation_required:true,finished_homes_measured:false});
const parse=(raw,limit)=>{try{if(Buffer.byteLength(raw)>limit)fail('request_invalid');return JSON.parse(raw);}catch{fail('request_invalid');}};
async function json(response,limit){const reader=response.body?.getReader();if(!reader)throw Error();let bytes=0;const parts=[];try{for(;;){const x=await reader.read();if(x.done)break;bytes+=x.value.length;if(bytes>limit)throw Error();parts.push(x.value);}return JSON.parse(Buffer.concat(parts).toString());}finally{try{void reader.cancel().catch(()=>{});}catch{}}}
function admission(r,now,initial){const start=Date.parse(r.issued_at),expiry=Date.parse(r.start_before),end=Date.parse(r.end_at);if(![start,expiry,end].every(Number.isFinite)||![r.issued_at,r.start_before,r.end_at].every(s=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(s))||expiry<=start||expiry-start>600000||end<=expiry||end-start>3600000||now<start||now>=(initial?expiry:end))fail(initial?'request_expired':'window_expired');}
export async function runFiniteTrial({env=process.env,read=p=>readFileSync(p,'utf8'),fetcher=fetch,now=()=>Date.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms)),mask=s=>process.stdout.write('::add-mask::'+s.replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A')+'\n'),log=console.log}={}){
 if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REPOSITORY!==REPOSITORY||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_EVENT_NAME!=='push'||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')||!/^\d+$/.test(env.GITHUB_RUN_ID||''))fail('trusted_main_required');
 if(env.GITHUB_RUN_ATTEMPT!=='1')fail('replay_refused');
 const event=parse(read(env.GITHUB_EVENT_PATH),262144),raw=read(REQUEST_PATH),r=parse(raw,4096);
 const keys='budget_review,budgets_metered,end_at,estimated_max_http_requests_per_run,estimated_max_response_bytes_per_run,estimated_trial_http_requests,estimated_trial_response_bytes,issued_at,max_invocations,parent_sha,request_id,schema_version,script_sha256,start_before,worker_version,workflow_sha256';
 if(Object.keys(r).sort().join(',')!==keys||r.schema_version!==1||r.max_invocations!==12||r.budgets_metered!==false||r.estimated_max_http_requests_per_run!==42||r.estimated_max_response_bytes_per_run!==63000000||r.estimated_trial_http_requests!==504||r.estimated_trial_response_bytes!==756000000||r.worker_version!==62||r.budget_review!=='conservative_42_requests_63MB_per_run_not_metered_accepted'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(r.request_id||'')||event.ref!=='refs/heads/main'||event.forced||event.deleted||event.after!==env.GITHUB_SHA||!/^[a-f0-9]{40}$/.test(event.before||'')||event.before==='0'.repeat(40)||r.parent_sha!==event.before)fail('request_invalid');
 admission(r,now(),true);
 if(r.script_sha256!==hash(read(fileURLToPath(import.meta.url)))||r.workflow_sha256!==hash(read(WORKFLOW_PATH)))fail('code_changed');
 const access=env.SUPABASE_ACCESS_TOKEN,github=env.GITHUB_TOKEN;
 if([access,github].some(s=>typeof s!=='string'||s.length<20||s.length>4096||/[\r\n%]/.test(s)))fail('credentials_unavailable');mask(access);mask(github);
 const ghHeaders={Authorization:'Bearer '+github,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
 async function gh(path){try{const x=await fetcher('https://api.github.com/repos/'+REPOSITORY+path,{headers:ghHeaders,redirect:'error',signal:AbortSignal.timeout(15000)});if(!x.ok)throw Error();return await json(x,262144);}catch{fail('github_unconfirmed');}}
 const repo=await gh('');if(repo.full_name!==REPOSITORY||repo.private!==false||repo.visibility!=='public'||repo.default_branch!=='main'||repo.archived!==false||repo.disabled!==false)fail('github_unconfirmed');
 const diff=await gh('/compare/'+event.before+'...'+event.after);
 if(diff.status!=='ahead'||diff.ahead_by!==1||diff.behind_by!==0||diff.total_commits!==1||diff.base_commit?.sha!==event.before||diff.commits?.length!==1||diff.commits[0].sha!==event.after||diff.commits[0].parents?.length!==1||diff.commits[0].parents[0].sha!==event.before||diff.files?.length!==1||diff.files[0].filename!==REQUEST_PATH||!['added','modified'].includes(diff.files[0].status)||diff.files[0].previous_filename)fail('github_unconfirmed');
 if(diff.files[0].status==='modified'){const prior=await gh('/contents/'+REQUEST_PATH+'?ref='+event.before);if(prior.encoding!=='base64'||typeof prior.content!=='string'||parse(Buffer.from(prior.content,'base64').toString(),4096).request_id===r.request_id)fail('replay_refused');}
 const runs=await gh('/actions/workflows/enrichment-finite-trial.yml/runs?event=push&head_sha='+env.GITHUB_SHA+'&per_page=2');
 if(runs.total_count!==1||runs.workflow_runs?.length!==1||String(runs.workflow_runs[0].id)!==env.GITHUB_RUN_ID||runs.workflow_runs[0].run_attempt!==1||runs.workflow_runs[0].head_sha!==env.GITHUB_SHA)fail('request_not_unique');
 async function query(sql,cap=8192){try{const x=await fetcher('https://api.supabase.com/v1/projects/'+PROJECT+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:sql===VAULT_QUERY}),redirect:'error',signal:AbortSignal.timeout(15000)});if(!x.ok)throw Error();return await json(x,cap);}catch{fail(sql===VAULT_QUERY?'vault_unconfirmed':'schema_unconfirmed');}}
 async function gate(){
  const current=await gh('/contents/'+REQUEST_PATH+'?ref=main');if(current.encoding!=='base64'||typeof current.content!=='string'||hash(Buffer.from(current.content,'base64'))!==hash(raw))fail('request_cancelled');
  const rows=await query(PREFLIGHT_QUERY);if(!Array.isArray(rows)||rows.length!==1||Object.keys(rows[0]).sort().join(',')!=='index_ready,overlap_suppressed,queue_exact,sample_exact'||Object.values(rows[0]).some(x=>x!==true))fail('schema_unconfirmed');
  let worker;try{const x=await fetcher('https://api.supabase.com/v1/projects/'+PROJECT+'/functions/zoi-enrich',{headers:{Authorization:'Bearer '+access},redirect:'error',signal:AbortSignal.timeout(15000)});if(!x.ok)throw Error();worker=await json(x,16384);}catch{fail('worker_changed');}if(worker.slug!=='zoi-enrich'||worker.status!=='ACTIVE'||worker.version!==r.worker_version)fail('worker_changed');
 }
 admission(r,now(),true);let attempts=0,lastStart=null,totalQueued=0,totalApplied=0;
 for(let i=0;i<r.max_invocations;i++){
  if(lastStart!==null){const wait=lastStart+300000-now();if(wait>0){admission(r,now()+wait,false);await sleep(wait);}}
  admission(r,now(),i===0);await gate();
  // Fetch only the dedicated secret; never use the worker's service-key fallback.
  const rows=await query(VAULT_QUERY,8192);if(!Array.isArray(rows)||rows.length!==1||Object.keys(rows[0]||{}).join(',')!=='private_token'||typeof rows[0].private_token!=='string'||rows[0].private_token.length<32||rows[0].private_token.length>4096||/[\r\n%]/.test(rows[0].private_token))fail('dedicated_token_unavailable');
  const token=rows[0].private_token;mask(token);admission(r,now(),i===0);
  attempts++;lastStart=now();log(JSON.stringify({event:'dispatch_admitted',request_id:r.request_id,attempt:attempts,at:new Date(lastStart).toISOString(),outcome:'pending',automatic_retry:false}));
  let response;try{response=await fetcher('https://'+PROJECT+'.supabase.co/functions/v1/zoi-enrich',{method:'POST',headers:{'Content-Type':'application/json','x-enrich-token':token},body:'{"limit":3}',redirect:'error',signal:AbortSignal.timeout(125000)});}catch{fail('worker_outcome_unknown');}
  let result;try{result=await json(response,65536);}catch{fail('worker_outcome_unknown');}
  if(!response.ok)fail('worker_rejected');
  if(result?.ok!==true||result.reconciliation_required===true||result.sample_requested!==null||!Number.isInteger(result.queued)||result.queued<0||result.queued>3||!Number.isInteger(result.applied)||result.applied<0||result.applied>result.queued||!Number.isInteger(result.unprocessed)||result.unprocessed<0||result.unprocessed>result.queued||!Number.isFinite(result.ms)||result.ms<0||result.ms>125000||!result.stats||typeof result.stats!=='object'||Array.isArray(result.stats)||!['enforced','unused'].includes(result.dns_guard))fail('worker_receipt_invalid');
  if((result.stats.ok||0)>result.applied)fail('worker_receipt_invalid');
  const stats={};for(const[k,v]of Object.entries(result.stats)){if(!Number.isInteger(v)||v<0||v>1000)fail('worker_receipt_invalid');if(STATS.has(k))stats[k]=v;}
  totalQueued+=result.queued;totalApplied+=result.applied;
  log(JSON.stringify({event:'canonical_batch_receipt',request_id:r.request_id,attempt:attempts,queued:result.queued,applied:result.applied,unprocessed:result.unprocessed,ms:result.ms,stats,source_fetch_ok:result.stats.ok||0,other_applied_results:result.applied-(result.stats.ok||0),failed_record_results:Object.entries(result.stats).filter(([k])=>k.startsWith('error:')).reduce((n,[,v])=>n+v,0),finished_homes_measured:false}));
  if(result.unprocessed!==0||result.applied!==result.queued||result.stats['lease-rejected']||result.stats['stopped-time-budget'])fail('worker_incomplete');
  if(result.queued===0)break;
 }
 const out={ok:true,request_id:r.request_id,attempts,queued:totalQueued,applied:totalApplied,automatic_retry:false,finished_homes_measured:false};log(JSON.stringify(out));return out;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){try{await runFiniteTrial();}catch(e){console.error(JSON.stringify(safeTrialFailure(e)));process.exitCode=1;}}

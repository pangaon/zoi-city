import {readFile,readdir,mkdir,writeFile,appendFile} from 'node:fs/promises';
import path from 'node:path';
import {options,runCollector,validReceipt} from '../quality-collector.mjs';
export async function serviceCredential(env,fetchImpl=fetch,mask=()=>{}){
 let key=env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY;
 if(!key){if(!env.SUPABASE_ACCESS_TOKEN)throw Error('service_credential_unavailable');const response=await fetchImpl('https://api.supabase.com/v1/projects/csebihpaychdkanjjsmz/api-keys?reveal=true',{headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN},signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('management_keys_'+response.status);const rows=await response.json();if(!Array.isArray(rows))throw Error('management_keys_unconfirmed');key=rows.find(r=>r.type==='secret'&&r.api_key?.startsWith('sb_secret_'))?.api_key||rows.find(r=>r.name==='service_role'&&r.api_key?.startsWith('eyJ'))?.api_key;}
 if(!key||/[\r\n]/.test(key))throw Error('service_credential_unavailable');mask(key);return key;
}
export async function ciMain(env=process.env,{fetchImpl=fetch,collector=runCollector,read=readFile,now=Date.now(),summarize=qualitySummary}={}){
 const plan=await auditPlan(env,{read,now});
 if(!plan.enabled){console.log(JSON.stringify({status:'disabled_or_expired',network_requests:0,queue_mutations:0}));return;}
 const task=env.QUALITY_TASK||plan.matrix.task[0];if(!plan.matrix.task.includes(task))throw Error('invalid_automatic_task');
 const config=options(['--task',task,'--limit',String(plan.limit),'--report-dir',env.QUALITY_REPORT_DIR||'quality-evidence',...(plan.execute?['--execute']:[]),...(plan.resume?['--resume']:[])]);
 if(!config.execute)return collector(config);
 const key=await serviceCredential(env,fetchImpl,key=>console.log('::add-mask::'+key));
 try{return await collector(config,{env:{SUPABASE_SECRET_KEY:key}});}finally{const summary=await summarize(config.reportDir,config);console.log(JSON.stringify({quality_summary:summary}));if(env.GITHUB_STEP_SUMMARY)await appendFile(env.GITHUB_STEP_SUMMARY,'### Listing quality: '+task+'\n\n'+summary.observed+' observed; '+summary.confirmed+' confirmed receipts; '+summary.pending+' pending receipts.\n\n'+summary.scope+'\n');}
}
if(process.argv[1]?.endsWith('/quality/ci.mjs'))ciMain().catch(()=>{console.error('Quality audit failed. Preserve the evidence artifact before an exact receipt retry.');process.exitCode=1});

// Automatic execution is authorized only by a short-lived, fixed-cap repository request.
export function automaticAuditRequest(request,now=Date.now()){
 const start=Date.parse(request?.starts_at),end=Date.parse(request?.expires_at);
 if(request?.max_listings_per_run!==20||JSON.stringify(request?.tasks)!==JSON.stringify(['classification','verification'])||!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>86400000)throw Error('invalid_quality_audit_request');
 return{enabled:request.enabled===true&&now>=start&&now<end,tasks:request.tasks,limit:10,total_limit:20,expires_at:request.expires_at};
}
export async function auditPlan(env=process.env,{read=readFile,now=Date.now()}={}){
 if(env.QUALITY_AUTOMATIC==='true'){
  const approved=automaticAuditRequest(JSON.parse(await read(new URL('../../ops/quality-audit-request.json',import.meta.url),'utf8')),now);
  return{enabled:approved.enabled,matrix:{task:approved.tasks},limit:approved.limit,execute:approved.enabled,resume:false};
 }
 const config=options(['--task',env.QUALITY_TASK||'classification','--limit',env.QUALITY_LIMIT||'3']);
 if(env.RESUME_RUN&&!/^[1-9][0-9]*$/.test(env.RESUME_RUN))throw Error('invalid_resume_run');
 if(env.RESUME_ATTEMPT&&!/^[1-9][0-9]*$/.test(env.RESUME_ATTEMPT))throw Error('invalid_resume_attempt');
 return{enabled:true,matrix:{task:[config.task]},limit:config.limit,execute:env.QUALITY_EXECUTE==='true',resume:env.QUALITY_RESUME==='true'};
}
export async function qualitySummary(directory,config){
 const files=await readdir(directory).catch(()=>[]),result={task:config.task,limit:config.limit,observed:0,confirmed:0,pending:0,statuses:{},repairs:[],scope:'Eligible published website-bearing queue only. Verification covers selected rendered controls, not every journey. Design acceptance remains separate.'};
 for(const file of files.filter(x=>/^[a-f0-9]{64}\.json$/.test(x))){const r=JSON.parse(await readFile(path.join(directory,file),'utf8'));if(r.task!==config.task)continue;result.observed++;const stem=file.slice(0,-5);let receipt;try{receipt=JSON.parse(await readFile(path.join(directory,stem+'.receipt.json'),'utf8'))}catch{}if(receipt&&!validReceipt(receipt,{task:r.task,payload:{p_listing:r.listing?.id,p_status:r.decision?.status}}))receipt=null;if(receipt)result.confirmed++;else result.pending++;const status=receipt?.status||'unconfirmed';result.statuses[status]=(result.statuses[status]||0)+1;if(r.decision?.status!=='verified')result.repairs.push({listing_id:r.listing?.id,reason:r.decision?.evidence?.reason||'review_required',specialist:r.decision?.evidence?.repair?.specialist||(config.task==='classification'?'enrichment':'experience'),evidence_ref:'sha256:'+stem});}
 await mkdir(directory,{recursive:true});await writeFile(path.join(directory,'run-summary.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});return result;
}

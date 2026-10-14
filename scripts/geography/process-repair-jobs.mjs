/** Service-only executable consumer of the durable research lease queue.
 * Never applies a coordinate. Provider geocoding is deliberately not connected. */
import {readFile,writeFile} from'node:fs/promises';import{runGeographyResearchJobs}from'./repair-job-runner.mjs';
const input=process.argv[2],directory=process.argv[3];
if(!directory)throw Error('usage_input_json_or_rpc_and_evidence_directory');
const rpcMode=input==='rpc';
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(rpcMode&&(!key||url!=='https://csebihpaychdkanjjsmz.supabase.co'))throw Error('authorized_geography_service_configuration_required');
async function rpc(name,args){const response=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('geography_rpc_http_'+response.status);return response.json();}
const jobs=rpcMode?await rpc('geography_repair_lease',{p_limit:10,p_strategy:'official_sources_v1'}):JSON.parse(await readFile(input,'utf8'));
const result=await runGeographyResearchJobs(jobs,{directory,finishJob:rpcMode?(p_job,p_lease,p_result)=>rpc('geography_repair_finish',{p_job,p_lease,p_result}):null});
await writeFile(directory+'/run-summary.json',JSON.stringify(result,null,2));
if(!rpcMode){const quote=v=>"'"+String(v).replaceAll("'","''")+"'";await writeFile(directory+'/finish-research-results.sql','BEGIN;\n'+result.results.map(r=>'SELECT public.geography_repair_finish('+quote(r.job_id)+'::uuid,'+quote(r.lease_id)+'::uuid,'+quote(JSON.stringify(r.result))+'::jsonb);').join('\n')+'\nCOMMIT;\n',{mode:0o600});}
const queue=rpcMode&&!jobs.length?await rpc('geography_repair_summary',{}):null;
console.log(JSON.stringify({empty_batch_state:jobs.length?null:rpcMode&&queue.pending_jobs>0?'pending_work_remains':'no_jobs_in_this_batch',pending_jobs:queue?.pending_jobs??null,processed_jobs:result.results.length,guarded_source_requests:result.source_requests,provider_calls:0,coordinate_writes:0,database_results_persisted:rpcMode}));

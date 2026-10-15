/** Offline capture only. Canonical completion uses the existing finite-ticket Edge consumer. */
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {runGeographyResearchJobs} from './repair-job-runner.mjs';
import {geographyResearchSession} from './guarded-research-session.mjs';
export async function runGeographyCapture({input,directory,runJobs=runGeographyResearchJobs}={}){
 // A service key plus capture_acquire is concurrency control, not finite admission.
 if(input==='rpc')throw Error('finite_ticket_edge_capture_required');
 if(!input||!directory)throw Error('usage_input_json_and_evidence_directory');
 await mkdir(directory,{recursive:true,mode:0o700});
 if((await readdir(directory)).length)throw Error('fresh_private_evidence_directory_required');
 const jobs=JSON.parse(await readFile(input,'utf8'));
 if(!Array.isArray(jobs)||jobs.length>30)throw Error('bounded_leased_geography_jobs_required');
 const session=geographyResearchSession({maxRequests:50,maxBytes:15000000,deadline:Date.now()+105000,spacingMs:1200});
 const result=await runJobs(jobs,{directory,sourceFetch:session.sourceFetch,finishJob:null});
 result.source_requests=session.stats.requests;
 await writeFile(directory+'/run-summary.json',JSON.stringify({...result,database_results_persisted:false,non_authoritative:true},null,2),{mode:0o600,flag:'wx'});
 // Keep the historical filename fail-closed for operators who used to execute it.
 await writeFile(directory+'/finish-research-results.sql',"-- Capture-only evidence. No finite admission, canonical private archive or current server lease was verified.\nDO $unarchived$ BEGIN RAISE EXCEPTION 'canonical_private_archive_completion_required'; END $unarchived$;\n",{mode:0o600,flag:'wx'});
 return{processed_jobs:result.results.length,guarded_source_requests:session.stats.requests,provider_calls:0,coordinate_writes:0,database_results_persisted:false,non_authoritative:true,next_action:'use_existing_finite_ticket_edge_consumer_for_canonical_capture'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{console.log(JSON.stringify(await runGeographyCapture({input:process.argv[2],directory:process.argv[3]})));}
 catch(error){console.error(JSON.stringify({ok:false,error:error?.message==='finite_ticket_edge_capture_required'?'finite_ticket_edge_capture_required':'geography_capture_unconfirmed',next_action:'use_existing_finite_ticket_edge_consumer_for_canonical_capture',automatic_retry:false,reconciliation_required:true,coordinate_writes:0}));process.exitCode=1;}
}

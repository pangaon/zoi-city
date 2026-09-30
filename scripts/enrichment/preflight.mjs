#!/usr/bin/env node
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifySourceBrowser} from './render-source.mjs';
import {sourceFailureReason} from './source-errors.mjs';
export async function sourceRuntimeProbe({verify=verifySourceBrowser,runner=process.env.SOURCE_PROBE_RUNNER||'local',now=()=>new Date().toISOString()}={}){
 const report={schema:1,kind:'sandboxed_browser_preflight',runner:['ubuntu-22.04','ubuntu-24.04','local'].includes(runner)?runner:'other',recorded_at:now(),playwright_version:'1.63.0',node_version:process.versions.node,chromium_sandbox_requested:true,source_page_requests:0,credential_requests:0,listing_leases:0,listing_writes:0};
 try{const result=await verify();return {...report,status:'passed',browser_version:result?.browser_version||'unknown',executable_override:!!process.env.CHROMIUM_EXECUTABLE_PATH};}catch(error){return {...report,status:'failed',reason:sourceFailureReason(error)};}
}
export async function writeRuntimeProbe({directory='source-runtime-probe',...options}={}){const report=await sourceRuntimeProbe(options);await mkdir(directory,{recursive:true,mode:0o700});await writeFile(path.join(directory,'probe.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});return report;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){writeRuntimeProbe().then(report=>{console.log(JSON.stringify(report));if(report.status!=='passed')process.exitCode=1;}).catch(()=>{console.error(JSON.stringify({status:'failed',reason:'probe_artifact_failed',listing_leases:0,listing_writes:0}));process.exitCode=1;});}

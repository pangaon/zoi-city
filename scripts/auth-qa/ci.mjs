import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {serviceCredential} from '../quality/ci.mjs';
import {withQaSession,QA} from './session.mjs';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute=promisify(execFile);
import {browserRead} from './browser.mjs';
export const QA_CODE_FILES=['scripts/auth-qa/session.mjs','scripts/auth-qa/browser.mjs','scripts/auth-qa/ci.mjs'];
export function validateQaRun(env,request,now=Date.now(),evidence={}){
 if(env.GITHUB_REPOSITORY!=='pangaon/zoi-city'||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_RUN_ATTEMPT!=='1')throw Error('qa_ci_scope_guard');
 if(env.GITHUB_EVENT_NAME==='workflow_dispatch')return;
 const issued=Date.parse(request?.issued_at),expiry=Date.parse(request?.expires_at),event=evidence.event;
 if(env.GITHUB_EVENT_NAME!=='push'||!/^([0-9a-f]{8}-){1}[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request?.id||'')||request?.purpose!=='dedicated-qa-readonly'||!Number.isFinite(issued)||!Number.isFinite(expiry)||issued>now+60000||expiry<=now||expiry<=issued||expiry-issued>1800000)throw Error('qa_request_guard');
 if(request.user_id!==QA.user||request.profile_id!==QA.profile||request.workspace_id!==QA.workspace)throw Error('qa_request_identity');
 if(!/^[a-f0-9]{40}$/.test(request.base_sha||'')||event?.before!==request.base_sha||event.after!==env.GITHUB_SHA||event.ref!=='refs/heads/main'||event.repository?.full_name!=='pangaon/zoi-city'||event.forced!==false||event.deleted!==false||event.created!==false||evidence.parent!==request.base_sha||evidence.head!==env.GITHUB_SHA||!['A\tops/authenticated-qa-request.json','M\tops/authenticated-qa-request.json'].includes(evidence.diff))throw Error('qa_push_guard');
 if(QA_CODE_FILES.some(path=>!/^([a-f0-9]{64})$/.test(request.code_sha256?.[path]||'')||request.code_sha256[path]!==evidence.hashes?.[path]))throw Error('qa_code_guard');
}
export async function checkRequest(env=process.env){
 if(env.GITHUB_EVENT_NAME==='workflow_dispatch'){validateQaRun(env,null);return null;}
 const request=JSON.parse(await readFile('ops/authenticated-qa-request.json','utf8'));
 const event=JSON.parse(await readFile(env.GITHUB_EVENT_PATH,'utf8'));
 const git=async args=>(await execute('git',args,{timeout:10000,maxBuffer:100000})).stdout.trim();
 const head=await git(['rev-parse','HEAD']),parent=await git(['rev-parse','HEAD^']);
 const diff=await git(['diff','--name-status',parent,head,'--','ops/authenticated-qa-request.json']);
 const hashes={};for(const path of QA_CODE_FILES)hashes[path]=createHash('sha256').update(await readFile(path)).digest('hex');
 validateQaRun(env,request,Date.now(),{event,parent,head,diff,hashes});return request;
}
export async function main(env=process.env){
 await checkRequest(env);
 const key=await serviceCredential(env,fetch,value=>console.log('::add-mask::'+value));
 const result=await withQaSession(key,browserRead); // finally revokes only this session before an artifact is written.
 await mkdir('qa-readonly-evidence',{recursive:true});
 await writeFile('qa-readonly-evidence/result.json',JSON.stringify({schema:1,commit:env.GITHUB_SHA,checked_at:new Date().toISOString(),result,session_logout:'local_completed',scope:'Dedicated QA identity, read-only business data; no save, booking, email or payment acceptance'},null,2)+'\n',{mode:0o600});
 console.log('Dedicated QA authenticated read-only checks passed. Sanitized evidence saved.');
}
if(process.argv[1]?.endsWith('/auth-qa/ci.mjs'))(process.argv.includes('--check-request')?checkRequest():main()).catch(()=>{console.error('Dedicated QA read-only check failed; no private response, session or network logs were published.');process.exitCode=1;});

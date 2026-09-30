import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {QA,withQaSession} from './session.mjs';import {OWNER_QA} from './private-owner-flow.mjs';import {browserPrivateOwner} from './private-owner-browser.mjs';import {serviceCredential} from '../quality/ci.mjs';
const exec=promisify(execFile),requestPath='ops/private-owner-qa-request.json';
export const OWNER_CODE_FILES=['.github/workflows/private-owner-qa.yml','scripts/auth-qa/private-owner-ci.mjs','scripts/auth-qa/private-owner-browser.mjs','scripts/auth-qa/private-owner-policy.mjs','scripts/auth-qa/private-owner-flow.mjs','scripts/auth-qa/session.mjs','scripts/quality/ci.mjs','scripts/quality-collector.mjs','scripts/quality/evidence.mjs','scripts/quality/source-fetch.mjs','scripts/quality/browser.mjs','assets/enrichment/member-source.mjs','assets/enrichment/association-cards.mjs','assets/suite/bizpage.js','assets/suite/owner-entity.mjs','social/index.html','ops/private-owner-qa/provision.sql','ops/private-owner-qa/cleanup.sql'];
export function validateOwnerRequest(env,r,e,now=Date.now(),cleanup=false){
 if(env.GITHUB_REPOSITORY!=='pangaon/zoi-city'||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_RUN_ATTEMPT!=='1'||env.GITHUB_EVENT_NAME!=='push')throw Error('qa_ci_scope_guard');
 const issued=Date.parse(r?.issued_at),expiry=Date.parse(r?.expires_at);
 if(r?.purpose!=='private-owner-edit-read-preview'||r.fixture_id!==OWNER_QA.listing||r.request_id!==OWNER_QA.request||r.user_id!==QA.user||r.profile_id!==QA.profile||r.workspace_id!==QA.workspace||!Number.isFinite(issued)||!Number.isFinite(expiry)||issued>now+60000||expiry<=issued||expiry-issued>1800000||now>expiry+(cleanup?3600000:0))throw Error('qa_request_guard');
 if(!/^[a-f0-9]{40}$/.test(r.base_sha||'')||e.parent!==r.base_sha||e.head!==env.GITHUB_SHA||e.event?.before!==r.base_sha||e.event.after!==env.GITHUB_SHA||e.event.ref!=='refs/heads/main'||e.event.repository?.full_name!=='pangaon/zoi-city'||e.event.forced!==false||e.event.created!==false||e.event.deleted!==false||!['A\t'+requestPath,'M\t'+requestPath].includes(e.diff))throw Error('qa_push_guard');
 if(OWNER_CODE_FILES.some(p=>!/^[a-f0-9]{64}$/.test(r.code_sha256?.[p]||'')||r.code_sha256[p]!==e.hashes[p]))throw Error('qa_code_guard');
}
export async function checkOwnerRequest(env=process.env,cleanup=false){
 const r=JSON.parse(await readFile(requestPath,'utf8')),event=JSON.parse(await readFile(env.GITHUB_EVENT_PATH,'utf8'));
 const git=async args=>(await exec('git',args,{timeout:10000,maxBuffer:100000})).stdout.trim();
 const head=await git(['rev-parse','HEAD']),parent=await git(['rev-parse','HEAD^']),diff=await git(['diff','--name-status',parent,head]);
 const hashes={};for(const p of OWNER_CODE_FILES)hashes[p]=createHash('sha256').update(await readFile(p)).digest('hex');validateOwnerRequest(env,r,{event,parent,head,diff,hashes},Date.now(),cleanup);return r;
}
async function sql(stage,env){
 if(!env.SUPABASE_ACCESS_TOKEN)throw Error('qa_management_credential_missing');
 const query=await readFile('ops/private-owner-qa/'+stage+'.sql','utf8');
 const res=await fetch('https://api.supabase.com/v1/projects/csebihpaychdkanjjsmz/database/query',{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(30000)});
 if(!res.ok)throw Error('qa_sql_unconfirmed');const data=await res.json();const receipt=Array.isArray(data)?data[0]?.qa_result:null;
 if(receipt?.ok!==true||(stage==='provision'&&receipt.private_fixture_provisioned!==true)||(stage==='cleanup'&&(receipt.archived_hidden!==true||receipt.audit_preserved!==true)))throw Error('qa_sql_receipt_unconfirmed');return receipt;
}
export async function main(stage,env=process.env){
 if(!['check','provision','browser','cleanup'].includes(stage))throw Error('qa_stage');await checkOwnerRequest(env,stage==='cleanup');if(stage==='check')return;
 await mkdir('qa-private-owner-evidence',{recursive:true,mode:0o700});
 if(stage==='provision'){
  // Set before request: cleanup runs even if the HTTP receipt is lost.
  await writeFile('qa-private-owner-evidence/provision-attempt.json',JSON.stringify({commit:env.GITHUB_SHA,run:env.GITHUB_RUN_ID}),{mode:0o600,flag:'wx'});
  await sql('provision',env);return;
 }
 const attempted=JSON.parse(await readFile('qa-private-owner-evidence/provision-attempt.json','utf8'));if(attempted.commit!==env.GITHUB_SHA||attempted.run!==env.GITHUB_RUN_ID)throw Error('qa_attempt_guard');
 if(stage==='cleanup'){const result=await sql('cleanup',env);await writeFile('qa-private-owner-evidence/cleanup.json',JSON.stringify(result),{mode:0o600});return;}
 const key=await serviceCredential(env,fetch,k=>console.log('::add-mask::'+k));
 const result=await withQaSession(key,browserPrivateOwner);
 await writeFile('qa-private-owner-evidence/result.json',JSON.stringify({commit:env.GITHUB_SHA,checked_at:new Date().toISOString(),result,session_logout:'local_completed',scope:'Private fixture edit/read/preview only; no normal creation/claim/publication proof'}),{mode:0o600});
}
const SAFE_QA_ERRORS=new Set(['qa_ci_scope_guard','qa_request_guard','qa_push_guard','qa_code_guard','qa_management_credential_missing','qa_sql_unconfirmed','qa_sql_receipt_unconfirmed','qa_stage','qa_attempt_guard']);
export function ownerQaErrorClass(error){try{return error instanceof Error&&SAFE_QA_ERRORS.has(error.message)?error.message:'qa_unclassified_error';}catch{return 'qa_unclassified_error';}}
if(process.argv[1]?.endsWith('/auth-qa/private-owner-ci.mjs'))main(process.argv[2]).catch(error=>{console.error('Private owner QA stage unconfirmed ['+ownerQaErrorClass(error)+']; no raw SQL/auth/browser response logged. Cleanup requires its separate guarded step.');process.exitCode=1;});

import {mkdir,writeFile} from 'node:fs/promises';
import {serviceCredential} from '../quality/ci.mjs';
import {withQaSession} from './session.mjs';
import {browserRead} from './browser.mjs';
export async function main(env=process.env){
 if(env.GITHUB_REPOSITORY!=='pangaon/zoi-city'||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_EVENT_NAME!=='workflow_dispatch')throw Error('qa_ci_scope_guard');
 const key=await serviceCredential(env,fetch,value=>console.log('::add-mask::'+value));
 const result=await withQaSession(key,browserRead); // finally revokes only this session before an artifact is written.
 await mkdir('qa-readonly-evidence',{recursive:true});
 await writeFile('qa-readonly-evidence/result.json',JSON.stringify({schema:1,commit:env.GITHUB_SHA,checked_at:new Date().toISOString(),result,session_logout:'local_completed',scope:'Dedicated QA identity, read-only business data; no save, booking, email or payment acceptance'},null,2)+'\n',{mode:0o600});
 console.log('Dedicated QA authenticated read-only checks passed. Sanitized evidence saved.');
}
if(process.argv[1]?.endsWith('/auth-qa/ci.mjs'))main().catch(()=>{console.error('Dedicated QA read-only check failed; no private response, session or network logs were published.');process.exitCode=1;});

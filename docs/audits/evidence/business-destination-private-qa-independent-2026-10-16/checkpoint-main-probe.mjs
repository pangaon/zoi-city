import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root='/workspaces/zoi-business-destination-private-harness';
const {CODE_FILES,WEB_FILES,REQUEST,sha}=await import(root+'/scripts/auth-qa/business-destination-private-policy.mjs');
const {main}=await import(root+'/scripts/auth-qa/business-destination-private-ci.mjs');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'private-qa-checkpoint-independent-'));
const initial=process.cwd();let network=0;const originalFetch=globalThis.fetch;
try{
 for(const relative of CODE_FILES){const target=path.join(temp,relative);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(path.join(root,relative),target);}
 await fs.mkdir(path.join(temp,'ops'),{recursive:true});await fs.writeFile(path.join(temp,REQUEST),'{"enabled":false}\n');
 const git=(...args)=>execFileSync('git',args,{cwd:temp,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git('init','-q');git('config','user.email','qa@example.invalid');git('config','user.name','Controlled fixture');git('add','.');git('commit','-qm','Controlled source baseline');const parent=git('rev-parse','HEAD');
 const hashes=Object.fromEntries(await Promise.all(CODE_FILES.map(async p=>[p,sha(await fs.readFile(path.join(temp,p)))])));
 const r={enabled:true,purpose:'dedicated-business-private-destination-copy-only-v1',request_id:'33333333-3333-4333-8333-333333333333',parent_sha:parent,issued_at:new Date(Date.now()-1000).toISOString(),expires_at:new Date(Date.now()+600000).toISOString(),fixture_content_version:'b'.repeat(32),fixture_baseline:'c'.repeat(32),code_sha256:hashes,web_sha256:Object.fromEntries(WEB_FILES.map(p=>[p,hashes[p]]))};
 await fs.writeFile(path.join(temp,REQUEST),JSON.stringify(r)+'\n');git('add',REQUEST);git('commit','-qm','Controlled request only');const head=git('rev-parse','HEAD');
 const event={before:parent,after:head,ref:'refs/heads/main',forced:false,created:false,deleted:false,repository:{full_name:'pangaon/zoi-city',private:false,visibility:'public'}};
 const eventFile=path.join(temp,'event.json');await fs.writeFile(eventFile,JSON.stringify(event));
 const env={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'pangaon/zoi-city',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'push',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:head,GITHUB_EVENT_PATH:eventFile,GITHUB_RUN_ID:'123456'};
 const output=path.join(temp,'qa-business-destination-private-evidence');await fs.mkdir(output,{mode:0o700});
 globalThis.fetch=async()=>{network++;throw Error('No hosted network permitted');};process.chdir(temp);
 const findings=[];
 for(const [name,value] of [
  ['wrong-run',{request_id:r.request_id,run_id:'123457',post_id:'44444444-4444-4444-8444-444444444444'}],
  ['wrong-request',{request_id:'33333333-3333-4333-8333-333333333334',run_id:env.GITHUB_RUN_ID,post_id:'44444444-4444-4444-8444-444444444444'}],
  ['extra-secret-field',{request_id:r.request_id,run_id:env.GITHUB_RUN_ID,post_id:'44444444-4444-4444-8444-444444444444',token:'synthetic-sensitive-sentinel'}]
 ]){
  await fs.writeFile(path.join(output,r.request_id+'-post.json'),JSON.stringify(value),{mode:0o600});await assert.rejects(main('cleanup',env),/private_qa_unconfirmed/);assert.equal(network,0);
  const failure=JSON.parse(await fs.readFile(path.join(output,'failure.json')));assert.deepEqual(failure,{business_destination_private_unconfirmed:true,stage:'request',manual_reconciliation_required:true,automatic_retry:false});assert(!JSON.stringify(failure).includes('sentinel'));findings.push({case:name,enabled_request_only_admission:true,rejected_before_network:true,fixed_sanitized_failure:true});
 }
 await fs.rm(path.join(output,r.request_id+'-post.json'));await assert.rejects(main('browser',{...env,GITHUB_RUN_ID:''}),/private_qa_unconfirmed/);assert.equal(network,0);findings.push({case:'missing-run-ID',rejected_before_network:true});
 await fs.writeFile('/home/codespace/.cache/zoi/business-private-harness-independent-20261016/checkpoint-main-result.json',JSON.stringify({findings,network_requests:network,limits:'Actual exported main with temporary Git request-only admission and mismatched local checkpoints; no hosted Auth or transport.'},null,2)+'\n');console.log(JSON.stringify({pass:findings.length,network_requests:network}));
}finally{process.chdir(initial);globalThis.fetch=originalFetch;await fs.rm(temp,{recursive:true,force:true});}

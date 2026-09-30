import test from 'node:test';import assert from 'node:assert/strict';import{createHash}from'node:crypto';
import{validateRelease,runRelease}from'../../scripts/release-backend.mjs';
const now=Date.now(),path='supabase/functions/ops-documents/index.ts',sqlPath='supabase/migrations/20260930011955_public_home_workflow_actions.sql';
const content='reviewed source',hash=createHash('sha256').update(content).digest('hex');
const base=()=>({project:'csebihpaychdkanjjsmz',id:'release-20260930-test',expires_at:new Date(now+600000).toISOString(),migrations:[],workers:[{name:'ops-documents',files:[{path,sha256:hash}]}]});
const options={read:()=>content,now};
test('release validates pinned worker and migration content',()=>{const m=base();m.migrations=[{path:sqlPath,sha256:hash}];const r=validateRelease(m,options);assert.equal(r.migrations[0].name,'public_home_workflow_actions');assert.equal(r.workers[0].verifyJwt,false)});
test('expired releases, wrong projects and replay attempts are rejected',()=>{
 for(const change of [{expires_at:new Date(now-1).toISOString()},{expires_at:new Date(now+7200000).toISOString()},{project:'another-project'}])assert.throws(()=>validateRelease({...base(),...change},options));
 assert.throws(()=>validateRelease(base(),{...options,attempt:'2'}),/replay/);
});
test('modified files, path traversal, missing entrypoint and unknown workers fail before network',()=>{
 assert.throws(()=>validateRelease(base(),{...options,read:()=>content+'changed'}),/changed/);
 for(const worker of [{name:'ops-documents',files:[{path:'../secret',sha256:hash}]},{name:'unknown',files:[{path,sha256:hash}]},{name:'ops-documents',files:[]}])assert.throws(()=>validateRelease({...base(),workers:[worker]},options));
});
const env={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'pangaon/zoi-city',GITHUB_REF:'refs/heads/main',GITHUB_RUN_ATTEMPT:'1',SUPABASE_ACCESS_TOKEN:'test-token'};
test('PRs cannot obtain a production release through this script',async()=>{
 let called=false;await assert.rejects(runRelease(base(),{env:{...env,GITHUB_REF:'refs/pull/4/merge'},read:()=>content,fetcher:async()=>{called=true},log:()=>{}}),/authorized main/);assert.equal(called,false);
});
test('ambiguous mutation never retries or proceeds to worker deployment',async()=>{
 let calls=0,deploys=0;const m=base();m.migrations=[{path:sqlPath,sha256:hash}];
 await assert.rejects(runRelease(m,{env,read:()=>content,log:()=>{},fetcher:async()=>{calls++;if(calls===1)return new Response('[]');throw Error('timeout')},deploy:()=>deploys++}),/unconfirmed/);
 assert.equal(calls,2);assert.equal(deploys,0);
});
test('existing migration name requires reconciliation instead of replay',async()=>{
 const m=base();m.migrations=[{path:sqlPath,sha256:hash}];let calls=0;
 await assert.rejects(runRelease(m,{env,read:()=>content,log:()=>{},fetcher:async()=>{calls++;return new Response('[{"name":"public_home_workflow_actions"}]')}}),/already exists/);assert.equal(calls,1);
});
test('worker deployment uses argument arrays, fixed project and reviewed JWT mode',async()=>{
 let invocation;await runRelease(base(),{env,read:()=>content,log:()=>{},deploy:(file,args)=>invocation={file,args}});
 assert.equal(invocation.file,'npx');assert.ok(invocation.args.includes('--no-verify-jwt'));assert.ok(invocation.args.includes('csebihpaychdkanjjsmz'));
});
test('only unique reviewed, hash-bound private fixtures are allowed',()=>{
 const f={path:'ops/qa-booking-planner-setup.sql',sha256:hash};
 assert.equal(validateRelease({...base(),fixtures:[f]},options).fixtures[0].query,content);
 assert.throws(()=>validateRelease({...base(),fixtures:[f,f]},options),/fixture/);
 assert.throws(()=>validateRelease({...base(),fixtures:[{...f,path:'ops/arbitrary.sql'}]},options),/Unreviewed/);
 assert.throws(()=>validateRelease({...base(),fixtures:[f]},{...options,read:()=>content+'changed'}),/changed/);
});
test('private fixture runs once after workers and ambiguous response is not retried',async()=>{
 const sequence=[];const m={...base(),fixtures:[{path:'ops/qa-booking-planner-setup.sql',sha256:hash}]};
 await assert.rejects(runRelease(m,{env,read:()=>content,log:()=>{},deploy:()=>sequence.push('worker'),fetcher:async(url,args)=>{sequence.push('fixture');assert.ok(url.endsWith('/database/query'));assert.deepEqual(JSON.parse(args.body),{query:content,read_only:false});throw Error('timeout');}}),/unconfirmed/);
 assert.deepEqual(sequence,['worker','fixture']);
});

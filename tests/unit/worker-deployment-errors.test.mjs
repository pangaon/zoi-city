import test from 'node:test';
import assert from 'node:assert/strict';
import {safeWorkerError,runRelease} from '../../scripts/release-backend.mjs';
import {createHash} from 'node:crypto';
test('worker errors expose only bounded diagnostic labels, never child output',()=>{
 for(const [error,category]of [[{code:'ETIMEDOUT',stderr:'secret'},'timeout'],[{stderr:'npm error code EAI_AGAIN registry.npmjs.org secret'},'npm_fetch'],[{stderr:'Module not found: private-path secret'},'module_not_found'],[{stderr:'401 Unauthorized Bearer secret'},'permission'],[{stderr:'Failed to bundle worker: source secret'},'build_error'],[{stderr:'unrecognized secret',status:2},'details_withheld']]){
  const result=safeWorkerError({...error,status:2});assert.equal(result.category,category);assert.equal(result.exit_status,2);assert.equal(JSON.stringify(result).includes('secret'),false);assert.deepEqual(Object.keys(result),['category','exit_status']);
 }
 assert.equal(safeWorkerError({stderr:Buffer.from('x'.repeat(4096)+'Module not found secret')}).category,'details_withheld');
 assert.equal(safeWorkerError({status:'secret'}).exit_status,null);
});
test('deployment failure logs safe classification and never retries the mutation',async()=>{
 const text='export {};',path='supabase/functions/zoi-enrich/index.ts';
 const content={id:'release-safe-worker-error-test',project:'csebihpaychdkanjjsmz',expires_at:new Date(Date.now()+600000).toISOString(),migrations:[],workers:[{name:'zoi-enrich',files:[{path,sha256:createHash('sha256').update(text).digest('hex')}]}]};
 const logs=[];let calls=0;
 await assert.rejects(runRelease(content,{read:()=>text,env:{GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'pangaon/zoi-city',GITHUB_REF:'refs/heads/main',SUPABASE_ACCESS_TOKEN:'fixture-ci-token'},log:v=>logs.push(v),deploy:()=>{calls++;throw {stderr:'Module not found: Bearer NEVER_PRINT',status:1};}}),/module_not_found/);
 assert.equal(calls,1);assert.ok(logs.some(v=>v.includes('module_not_found')));assert.equal(logs.some(v=>v.includes('NEVER_PRINT')),false);
});

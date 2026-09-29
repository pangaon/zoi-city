import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../scripts/database-recovery.mjs',import.meta.url),'utf8').replace(/^#!.*\n/,'');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
async function run(mode,failedRestart=false){
 const calls=[],logs=[];
 const process={argv:['node','script',mode],env:{SUPABASE_ACCESS_TOKEN:'test-token'}};
 await new AsyncFunction('process','fetch','console',source)(process,async(url,opts)=>{
  calls.push({url,opts});
  if(url.endsWith('/restart')&&failedRestart) throw new Error('ambiguous connection timeout');
  return {ok:true,status:200,text:async()=>url.includes('/health?')?'[{"name":"db","status":"UNHEALTHY"}]':url.endsWith('/database/query')?'[{"diagnostics":{}}]':''};
 },{log:s=>logs.push(s),error:s=>logs.push(s)});
 return {calls,logs,process};
}
test('inspect and recover never mutate and request read-only SQL',async()=>{
 for(const mode of ['inspect','recover']){
  const result=await run(mode);
  assert.equal(result.calls.length,3);
  assert.ok(!result.calls.some(c=>c.url.endsWith('/restart')));
  assert.equal(JSON.parse(result.calls[2].opts.body).read_only,true);
  assert.ok(!result.logs.join('').includes('test-token'));
 }
});
test('restart records diagnostics then makes exactly one restart request',async()=>{
 const {calls}=await run('restart');
 assert.equal(calls.length,3);
 assert.ok(calls[0].url.includes('/health?'));
 assert.ok(calls[1].url.endsWith('/metrics'));
 assert.ok(calls[2].url.endsWith('/restart'));
 assert.equal(calls[2].opts.method,'POST');
});
test('ambiguous restart failure is not retried',async()=>{
 const {calls,process}=await run('restart',true);
 assert.equal(calls.filter(c=>c.url.endsWith('/restart')).length,1);
 assert.equal(process.exitCode,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import{mkdtempSync,writeFileSync,rmSync}from'node:fs';
import{tmpdir}from'node:os';
import{join}from'node:path';
import{spawnSync}from'node:child_process';
import{fileURLToPath}from'node:url';
import{runChecks,skip}from'../contract/result-kit.mjs';

test('contract telemetry separates executed success, missing feature skip and failure',async()=>{
 const lines=[],counts=await runChecks([{name:'real check',fn:async()=>{}},{name:'not deployed',fn:async()=>skip('unavailable')},{name:'failure',fn:async()=>{throw Error('bad receipt')}}],{log:line=>lines.push(line)});
 assert.deepEqual(counts,{planned:3,executed:2,passed:1,failed:1,skipped:1});
 assert(lines.includes('ok 2 - not deployed # SKIP unavailable'));
 assert(lines.includes('# 1/2 executed checks passed; 1 skipped; 1 failed; 3 planned'));
});

test('actual Event OS contracts skip missing endpoints ordinarily and fail them in strict mode',t=>{
 const dir=mkdtempSync(join(tmpdir(),'zoi-contract-results-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const mock=join(dir,'fetch.mjs');writeFileSync(mock,"globalThis.fetch=async()=>new Response(JSON.stringify({code:'PGRST202',message:'Fixture unavailable'}),{status:404,headers:{'Content-Type':'application/json'}});");
 const runner=fileURLToPath(new URL('../contract/run.mjs',import.meta.url));
 const run=strict=>spawnSync(process.execPath,['--import',mock,runner],{encoding:'utf8',timeout:10000,env:{...process.env,STRICT_EVENT_OS:strict?'1':'0'}});
 const optional=run(false),strict=run(true);assert.equal(optional.status,1);assert.equal(strict.status,1); // Other deliberately unavailable checks fail too.
 assert.match(optional.stdout,/event_create without auth is cleanly rejected # SKIP/);
 assert.match(optional.stdout,/15 skipped; \d+ failed; 53 planned/);
 assert.match(strict.stdout,/not ok \d+ - SECURITY: event_create without auth/);
 assert.match(strict.stdout,/# event_create: required Event OS RPC unavailable/);
 assert.match(strict.stdout,/0 skipped; \d+ failed; 53 planned/);
});

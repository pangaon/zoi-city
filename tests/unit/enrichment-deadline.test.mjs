import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{stripTypeScriptTypes}from'node:module';
const source=readFileSync(new URL('../../supabase/functions/zoi-enrich/index.ts',import.meta.url),'utf8');
const helper=source.slice(source.indexOf('const INVOCATION_MS'),source.indexOf('/* ── SSRF guard'));
function rpc(fetch){return new Function('fetch','SUPABASE_URL','SERVICE',stripTypeScriptTypes(helper)+';return {sbRpc,boundedIO};')(fetch,'https://database.test','test-only');}
test('RPC deadline covers both stalled headers and stalled response body, aborts and never retries',async()=>{
 for(const phase of ['headers','body']){let calls=0,signal;const {sbRpc}=rpc(async(_url,options)=>{calls++;signal=options.signal;return phase==='headers'?new Promise(()=>{}):{ok:true,text:()=>new Promise(()=>{})};});await assert.rejects(sbRpc('enrich_apply',{},Date.now()+20),/operation_deadline_exceeded/);assert.equal(calls,1);assert.equal(signal.aborted,true);}
});
test('expired invocation starts no RPC and independent invocation budgets do not cancel one another',async()=>{
 let calls=0;const{sbRpc}=rpc(async()=>{calls++;return{ok:true,text:async()=>'[]'}});
 await assert.rejects(sbRpc('enrich_queue_lease',{},Date.now()-1),/invocation_deadline_exceeded/);assert.equal(calls,0);
 const results=await Promise.allSettled([sbRpc('old',{},Date.now()-1),sbRpc('current',{},Date.now()+1000)]);assert.equal(results[0].status,'rejected');assert.equal(results[1].status,'fulfilled');assert.equal(calls,1);
});
test('source deadline is rechecked after politeness wait before opening fetch',async()=>{
 let calls=0;const{boundedIO}=rpc(()=>{});const fn=source.slice(source.indexOf('async function getCapped('),source.indexOf('/** Follow up'));
 const get=new Function('boundedIO','TIMEOUT_MS','globalGap','assertDeadline','fetch',stripTypeScriptTypes(fn)+';return getCapped;')(boundedIO,20,()=>new Promise(r=>setTimeout(r,35)),d=>{if(Date.now()>=d)throw Error('expired')},()=>{calls++});
 await assert.rejects(get(new URL('https://source.test'),'text/html',Date.now()+20),/operation_deadline_exceeded/);await new Promise(r=>setTimeout(r,45));assert.equal(calls,0);
});
test('DNS default remains compatible but a late first lookup cannot initiate a second lookup',async()=>{
 const guard=readFileSync(new URL('../../supabase/functions/zoi-enrich/_ssrf.ts',import.meta.url),'utf8');
 const fragment=guard.slice(guard.indexOf('export async function hostAddressesSafe'),guard.indexOf('/** Full pre-flight')).replace('export async','async');
 for(const expired of [false,true]){const calls=[];const Deno={resolveDns:async(_host,type)=>{calls.push(type);if(expired)await new Promise(r=>setTimeout(r,20));return['8.8.8.8'];}};
 const fn=new Function('Deno','REQUIRE_DNS','blockedV4','blockedV6',stripTypeScriptTypes('let dnsUsable=null;'+fragment)+';return hostAddressesSafe;')(Deno,true,()=>false,()=>false);
 const result=await fn('source.test',expired?Date.now()+5:undefined);assert.equal(result.ok,!expired);assert.deepEqual(calls,expired?['A']:['A','AAAA']);}
});
test('actual handler reports ambiguous apply outcome with original lease, without retry or false failed-write receipt',async()=>{
 let handler,applyCalls=0;const row={slug:'sample',website:'https://source.test',lease_id:'original-lease'};
 const {boundedIO}=rpc(()=>{});const deps={Deno:{serve:fn=>handler=fn},Date,INVOCATION_MS:110000,RPC_MS:15000,TIMEOUT_MS:8000,boundedIO,authorised:()=>true,ENABLED:true,BATCH:3,Response,URL,enrichmentSample:x=>x,memberLeaseGuard:()=>({handled:false}),vet:async()=>({why:'refused'}),sbRpc:async fn=>{if(fn.endsWith('_lease'))return[row];applyCalls++;throw Error('operation_deadline_exceeded');}};
 new Function(...Object.keys(deps),stripTypeScriptTypes(source.slice(source.indexOf('Deno.serve('))))(...Object.values(deps));
 const response=await handler(new Request('https://worker.test',{method:'POST',body:'{}'})),result=await response.json();
 assert.equal(response.status,503);assert.equal(applyCalls,1);assert.equal(result.outcome,'unknown');assert.equal(result.reconciliation_required,true);assert.deepEqual(result.leases,[{slug:'sample',lease_id:'original-lease'}]);assert.equal(Object.hasOwn(result,'applied'),false);
});
test('expired host queue wait never runs its source callback after the preceding request finishes',async()=>{
 const {boundedIO}=rpc(()=>{});let release;const prior=new Promise(r=>{release=r}),busy=new Map([['source.test',prior]]);
 const fragment=source.slice(source.indexOf('async function perHost<'),source.indexOf('/* ── fetching'));
 const perHost=new Function('hostBusy','boundedIO','INVOCATION_MS','assertDeadline',stripTypeScriptTypes(fragment)+';return perHost;')(busy,boundedIO,110000,d=>{if(Date.now()>=d)throw Error('expired')});let called=0;
 await assert.rejects(perHost('source.test',async()=>{called++},Date.now()+10),/operation_deadline_exceeded/);release();await new Promise(r=>setTimeout(r,5));assert.equal(called,0);
});
test('timed-out host waiter preserves serialization for a third caller and drains retained host state',async()=>{
 const {boundedIO}=rpc(()=>{}),busy=new Map();
 const fragment=source.slice(source.indexOf('async function perHost<'),source.indexOf('/* ── fetching'));
 const perHost=new Function('hostBusy','boundedIO','INVOCATION_MS','assertDeadline',stripTypeScriptTypes(fragment)+';return perHost;')(busy,boundedIO,110000,d=>{if(Date.now()>=d)throw Error('expired')});
 let release,started;const entered=new Promise(r=>{started=r});const predecessor=perHost('source.test',()=>new Promise(r=>{release=r;started()}),Date.now()+1000);await entered;
 await assert.rejects(perHost('source.test',async()=>assert.fail('expired waiter executed'),Date.now()+10),/operation_deadline_exceeded/);
 let thirdCalled=false;const third=perHost('source.test',async()=>{thirdCalled=true},Date.now()+1000);await new Promise(r=>setTimeout(r,5));assert.equal(thirdCalled,false);assert.equal(busy.size,1);
 release();await Promise.all([predecessor,third]);await new Promise(r=>setTimeout(r,0));assert.equal(thirdCalled,true);assert.equal(busy.size,0);
});

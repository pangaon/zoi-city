import test from 'node:test';import assert from 'node:assert/strict';
import{resolveCapabilities,loadProviderConfig}from'../../assets/suite/capabilities.mjs';
test('feature flags alone never enable unconfigured delivery or AI',()=>{
 const r=resolveCapabilities({ai:true,email:true,payments:true,publish:true},null);
 assert.equal(r.ai,false);assert.equal(r.email,false);assert.equal(r.payments,false);assert.equal(r.publish,true);assert.equal(r.providerUnavailable,true);
});
test('readiness does not override a disabled feature and Stripe credentials alone do not enable payments',()=>{
 const p={services:{ai:true,email:true,stripe:true}};
 assert.equal(resolveCapabilities({ai:false,email:true,payments:true},p).ai,false);
 assert.equal(resolveCapabilities({ai:true,email:true,payments:true},p).email,true);
 assert.equal(resolveCapabilities({payments:true},p).payments,false);
 assert.equal(resolveCapabilities({payments:true},{services:{payments:true}}).payments,true);
});
test('provider config rejects outages and malformed payloads',async()=>{
 for(const response of [new Response('{}',{status:503}),new Response('{"services":{}}')])await assert.rejects(loadProviderConfig('https://example.invalid','public',{fetcher:async()=>response}));
});
test('provider readiness request has bounded response-body deadline and no retries',async()=>{
 let calls=0;await assert.rejects(loadProviderConfig('https://example.invalid','public',{timeout:10,fetcher:async(url,{signal})=>{calls++;return{ok:true,json:()=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('timeout'))))}}}),/timeout/);assert.equal(calls,1);
});

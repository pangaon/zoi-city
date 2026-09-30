import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/entity.js';

const entity={slug:'greek-home',name:'Greek Home',entity_type:'business',city:'Athens',profile:{}};
async function run(fetcher,query={slug:entity.slug}){
 const original=globalThis.fetch;const calls=[];const headers={};let body='';
 globalThis.fetch=(url,options)=>{const fn=String(url).split('/').pop();calls.push(fn);return fetcher(fn,options)};
 const res={statusCode:0,setHeader:(k,v)=>headers[k]=v,end:v=>body=v};
 try{await handler({query},res);return{status:res.statusCode,headers,body,calls}}finally{globalThis.fetch=original}
}
const response=value=>new Response(JSON.stringify(value));
test('public home has bounded shared caching and optional failures preserve its real content',async()=>{
 const r=await run(async fn=>{if(fn==='seo_entity')return response(entity);throw new Error('optional unavailable')});
 assert.equal(r.status,200);assert.match(r.body,/Greek Home/);assert.equal(r.headers['Cache-Control'],'public, max-age=0, s-maxage=60');
});
test('optional queries start concurrently and settle independently',async()=>{
 let release;const waiting=new Promise(resolve=>release=resolve);const started=[];
 const r=await run(async fn=>{if(fn==='seo_entity')return response(entity);started.push(fn);if(started.length===2)release();await waiting;return response(fn==='seo_related'?[]:null)});
 assert.equal(r.status,200);assert.deepEqual(started,['seo_related','listing_completeness']);
});
test('primary failure is uncached retryable503 with no request amplification or publication promise',async()=>{
 const r=await run(async()=>new Response('unavailable',{status:503}));
 assert.equal(r.status,503);assert.deepEqual(r.calls,['seo_entity']);assert.equal(r.headers['Cache-Control'],'no-store');assert.equal(r.headers['X-Robots-Tag'],'noindex');assert.doesNotMatch(r.body,/still safe|still published/);
});
test('unknown and missing homes are never cached or followed by optional queries',async()=>{
 const r=await run(async()=>response(null));assert.equal(r.status,404);assert.equal(r.headers['Cache-Control'],'no-store');assert.deepEqual(r.calls,['seo_entity']);
 const missing=await run(async()=>{throw new Error('must not fetch')},{});assert.equal(missing.status,404);assert.equal(missing.calls.length,0);
});
test('deadline remains active while reading a stalled response body',async()=>{
 const original=globalThis.setTimeout;globalThis.setTimeout=(fn,ms,...args)=>original(fn,Math.min(ms,15),...args);
 try{const r=await run(async(fn,{signal})=>({ok:true,json:()=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(new Error('body timeout')),{once:true})})}));assert.equal(r.status,503);assert.equal(r.calls.length,1)}finally{globalThis.setTimeout=original}
});
test('legacy canonical redirect skips optional work and has a short cache',async()=>{
 const r=await run(async()=>response(entity),{slug:entity.slug,canon:'1'});assert.equal(r.status,301);assert.equal(r.headers.Location,'/business/greek-home');assert.deepEqual(r.calls,['seo_entity']);assert.equal(r.headers['Cache-Control'],'public, max-age=0, s-maxage=300');
});
test('verified workflow links reach real booking and volunteer entry points',async()=>{
 const id='00000000-0000-0000-0000-000000000001';
 const r=await run(async fn=>response(fn==='seo_entity'?{...entity,booking_url:'/book/?listing='+id,volunteer_url:'/volunteer/?workspace='+id}:null));
 assert.match(r.body,/Book on Zoi/);assert.match(r.body,/Volunteer opportunities/);assert.ok(r.body.includes('/book/?listing='+id));
 const unsafe=await run(async fn=>response(fn==='seo_entity'?{...entity,booking_url:'javascript:alert(1)',volunteer_url:'https://evil.invalid'}:null));
 assert.doesNotMatch(unsafe.body,/Book on Zoi|Volunteer opportunities|evil.invalid/);
});
test('directions prefer street address and never route to unverified centroid coordinates',async()=>{
 const render=e=>run(async fn=>response(fn==='seo_entity'?{...entity,...e}:null));
 const address=await render({address:'12 Main St',latitude:1,longitude:2,geo_precision:'city'});
 assert.match(address.body,/destination=12%20Main%20St%2C%20Athens/);
 const city=await render({latitude:1,longitude:2,geo_precision:'city'});
 assert.match(city.body,/destination=Greek%20Home%2C%20Athens/);assert.doesNotMatch(city.body,/destination=1%2C2/);
 const exact=await render({latitude:1,longitude:2,geo_precision:'rooftop'});assert.match(exact.body,/destination=1%2C2/);
});
test('public business data cannot inject executable actions or close the structured-data script',async()=>{
 const r=await run(async fn=>response(fn==='seo_entity'?{...entity,name:'Greek </script><script>alert(1)</script>',website:'javascript:alert(2)',description:'</script><img src=x onerror=alert(3)>'}:null));
 assert.equal(r.status,200);assert.doesNotMatch(r.body,/<script>alert\(1\)|href="javascript:/);
 const json=r.body.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];assert.ok(json);assert.equal(JSON.parse(json).name,'Greek </script><script>alert(1)</script>');
});

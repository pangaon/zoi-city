import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const handlers={},network=[];
vm.runInNewContext(readFileSync(new URL('./sw.js',import.meta.url),'utf8'),{self:{addEventListener:(name,handler)=>handlers[name]=handler},location:{origin:'https://www.zoi.city'},URL,Response,Promise,caches:{open:async()=>({put:async()=>{}}),match:async()=>new Response('offline')},fetch:async r=>{network.push(r.url);return new Response('public');}});
let checked=0;
async function exercise(path,{method='GET',origin='https://www.zoi.city',expect='deny'}={}){let response;const before=network.length;handlers.fetch({request:{url:origin+path,method},respondWith:p=>response=p});if(expect==='pass-through'){assert.equal(response,undefined);assert.equal(network.length,before);}else if(expect==='network'){assert.equal(await(await response).text(),'public');assert.equal(network.length,before+1);}else{const r=await response;assert.equal(r.status,404);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow');assert.equal(await r.text(),'Not found');assert.equal(network.length,before);}checked++;}
for(const p of ['/docs','/docs/?x=1','/docs/audits/raw.html','/%64%6f%63%73/audits/raw.json','/%2564%256f%2563%2573/audits/raw.source','/%252564%25256f%252563%252573/audits/raw.html','/docs%2Faudits%2Fraw.html'])await exercise(p);
for(const p of ['/','/documents/','/assets/zoi-core.js'])await exercise(p,{expect:'network'});
for(const p of ['/api/entity','/business/example','/event/example'])await exercise(p,{expect:'pass-through'});
await exercise('/docs/audits/raw.html',{method:'POST',expect:'pass-through'});await exercise('/docs/audits/raw.html',{origin:'https://other.example',expect:'pass-through'});
console.log(JSON.stringify({checks:checked,passed:checked,no_denied_network_or_cache_lookup:true,public_branches_preserved:true}));

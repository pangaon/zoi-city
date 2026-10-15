import test from 'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import handler from'../../api/entity.js';
const fixture=JSON.parse(readFileSync(new URL('../database/fixtures/hellenic-reviewed-duplicate-live.json',import.meta.url),'utf8')),business='373f6d89-03b6-4c58-b293-93a805885f5b',vendor='ebe7b1d3-a4af-4826-8de5-6dea8e38ab5c',businessSlug='hellenic-bakery-grocery-livonia',vendorSlug='hellenic-bakery-and-grocery-livonia',current=fixture.usage.records.find(x=>x.id===business).public;
async function run(slug,record,query={}){const saved=global.fetch,calls=[];global.fetch=async(url,options)=>{calls.push({url:String(url),body:JSON.parse(options.body||'{}')});return Response.json(String(url).endsWith('/home_entity')?record:null);};const headers={};let html='';const res={setHeader:(k,v)=>headers[k.toLowerCase()]=v,end:value=>html=value||''};try{await handler({query:{slug,...query}},res);return{status:res.statusCode,headers,html,calls};}finally{global.fetch=saved;}}

test('actual public handler redirects reviewed old vendor slug and literal ID to canonical business without rendering a second home',async()=>{
 for(const input of [vendorSlug,vendor,business]){const r=await run(input,current);assert.equal(r.status,301);assert.equal(r.headers.location,'/business/'+businessSlug);assert.equal(r.html,'');assert.equal(r.calls.length,1);assert.equal(r.calls[0].body.p_slug,input);assert.equal(r.headers['cache-control'],'no-store');}
});
test('canonical business route renders its exact151menu and three Horio price variants without a self redirect',async()=>{
 const r=await run(businessSlug,current);assert.equal(r.status,200);assert.equal(r.headers.location,undefined);assert.match(r.html,/Horio Olive Oil/);assert.match(r.html,/\$18\.00\/500 ml \| \$25\.00\/750 ml \| \$70\.00\/3 lt/);assert.match(r.html,/151/);assert.match(r.html,/rel="canonical" href="https:\/\/www\.zoi\.city\/business\/hellenic-bakery-grocery-livonia"/);
});
test('stale or refused duplicate reader result returns404 instead of reviving old vendor facts or redirecting to a hidden target',async()=>{
 const r=await run(vendorSlug,null);assert.equal(r.status,404);assert.equal(r.headers.location,undefined);assert.equal(r.headers['x-robots-tag'],'noindex');assert.ok(!r.html.includes('Hellenic'));
});
test('ordinary non-reviewed cross-family record is not automatically classified or redirected by its name or domain',async()=>{
 const record=fixture.usage.records.find(x=>x.id===vendor).public,r=await run(vendorSlug,record);assert.equal(r.status,200);assert.equal(r.headers.location,undefined);assert.match(r.html,/\/vendor\/hellenic-bakery-and-grocery-livonia/);
});
test('all ten existing legacy confirmed duplicate direct routes remain renderable without inventing canonical aliases',async()=>{
 for(const item of fixture.legacy_confirmed_direct_reads){
  const record={...item.listing,canonical_slug:item.existing_canonical_slug},r=await run(record.slug,record);
  assert.equal(r.status,200,record.slug);assert.equal(r.headers.location,undefined,record.slug);
  assert.equal(r.calls[0].body.p_slug,record.slug);assert.ok(r.html.includes(record.slug));
 }
});
test('existing legacy canonical redirect behavior stays intact',async()=>{
 const r=await run(businessSlug,current,{canon:'1'});assert.equal(r.status,301);assert.equal(r.headers.location,'/business/'+businessSlug);assert.match(r.headers['cache-control'],/s-maxage=300/);
});
test('redirect target is always an encoded local canonical path',async()=>{
 const r=await run(vendorSlug,{...current,slug:'https://outside.example/path',canonical_slug:'https://outside.example/path'});assert.equal(r.status,301);assert.equal(r.headers.location,'/business/https%3A%2F%2Foutside.example%2Fpath');assert.ok(!r.headers.location.startsWith('http'));
});

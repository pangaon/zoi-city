import test from 'node:test';
import assert from 'node:assert/strict';
import {publicCountryRead} from '../../api/_public-country-read.js';
import place from '../../api/place.js';
import sitemap from '../../api/sitemap.js';
const endpoint='https://countries.test/rest/v1/rpc/explore_countries';
const rows=[{country:'Greece',listings:1,regions:1,cities:1}];

test('coalesces exact public scope, clones results, expires and evicts rejected or malformed loads',async()=>{
 const originalNow=Date.now;let now=1000;Date.now=()=>now;
 try {
  let reads=0;const opts={endpoint,timeoutMs:4500,load:async()=>{reads++;await new Promise(r=>setTimeout(r,5));return rows;}};
  const values=await Promise.all(Array.from({length:12},()=>publicCountryRead(opts)));
  assert.equal(reads,1);values[0][0].country='changed';assert.equal(values[1][0].country,'Greece');
  assert.equal((await publicCountryRead(opts))[0].country,'Greece');assert.equal(reads,1);
  await publicCountryRead({...opts,timeoutMs:1200});assert.equal(reads,2,'short optional deadline isolated');
  await publicCountryRead({...opts,endpoint:endpoint.replace('countries.test','other.test')});assert.equal(reads,3);
  now+=60001;await publicCountryRead(opts);assert.equal(reads,4);
  now+=60001;await assert.rejects(publicCountryRead({...opts,load:async()=>{throw Error('unavailable')}}),/unavailable/);
  await publicCountryRead(opts);assert.equal(reads,5,'failure does not poison retries or serve expired data');
  const malformed={...opts,timeoutMs:99,load:async()=>({error:'unavailable'})};await assert.rejects(publicCountryRead(malformed),/invalid public/);
  assert.deepEqual(await publicCountryRead({...malformed,load:async()=>[]}),[]);
  for(const url of ['https://countries.test/rest/v1/rpc/private','https://countries.test/rest/v1/rpc/explore_countries?actor=x','http://countries.test/rest/v1/rpc/explore_countries'])await assert.rejects(publicCountryRead({...opts,endpoint:url}),/invalid public/);
 } finally {Date.now=originalNow;}
});

test('actual place and sitemap handlers collapse country bursts while preserving scoped listing requests and rendered links',async()=>{
 const originalFetch=globalThis.fetch,originalNow=Date.now;let now=5000;Date.now=()=>now;
 const calls={},scopes=[];let fail=false;
 globalThis.fetch=async(url,init)=>{
  const fn=new URL(url).pathname.split('/').pop();calls[fn]=(calls[fn]||0)+1;
  if(fn==='explore_countries'){await new Promise(r=>setTimeout(r,5));return new Response(JSON.stringify(rows),{status:fail?503:200});}
  if(fn==='explore_place_listings'){scopes.push(JSON.parse(init.body));return Response.json({total:1,rows:[{slug:'retained-greek-place',name:'Retained Greek Place',entity_type:'business',country:'Greece',city:'Athens'}]});}
  return Response.json([]);
 };
 const run=async(handler,url)=>{const response={headers:{},setHeader(k,v){this.headers[k]=v},end(body){this.body=body}};await handler({url},response);return response;};
 try {
  const pages=await Promise.all(Array.from({length:12},()=>run(place,'/api/place?country=greece')));
  assert.equal(calls.explore_countries,1);assert.equal(scopes.length,12);assert.ok(scopes.every(s=>s.p_country==='Greece'));
  for(const p of pages){assert.equal(p.statusCode,200);assert.match(p.body,/\/business\/retained-greek-place/);assert.match(p.body,/Greek life in Greece/);}
  await run(place,'/api/place?country=greece');assert.equal(calls.explore_countries,1);
  const maps=await Promise.all(Array.from({length:6},()=>run(sitemap,'/api/sitemap?part=places')));
  assert.equal(calls.explore_countries,2,'sitemap uses separate 8-second deadline');
  for(const p of maps)assert.match(p.body,/https:\/\/www.zoi.city\/in\/greece/);
  now+=60001;fail=true;const denied=await run(place,'/api/place?country=greece');assert.equal(denied.statusCode,503);assert.equal(denied.headers['Cache-Control'],'no-store');
  fail=false;assert.equal((await run(place,'/api/place?country=greece')).statusCode,200);assert.equal(calls.explore_countries,4);
 } finally {globalThis.fetch=originalFetch;Date.now=originalNow;}
});

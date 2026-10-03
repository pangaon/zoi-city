import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/entity.js';
import previewHandler from '../../api/home-preview.js';
import {quickLookDetails} from '../../assets/discovery/profile-preview.mjs';
import {personData} from '../../assets/homes/person-data.mjs';
import {selectedOfficialWebsite,officialSourceEntity} from '../../assets/enrichment/official-source-policy.mjs';
const base={id:'81000000-0000-4000-8000-000000000099',name:'Actual client',slug:'source-policy-test',entity_type:'business',website:'https://old.example/',profile:{_enrich:{source_url:'https://imported.example/',blocked_reason:'source_scope_mismatch'}}};
test('known source holds suppress default Official website in canonical, Quick look and person projections',()=>{
 assert.equal(selectedOfficialWebsite(base),'');
 assert.ok(!quickLookDetails(base).links.some(x=>x.label==='Official website'));
 assert.equal(personData({...base,entity_type:'professional'}).website,'');
 const before=structuredClone(base),safe=officialSourceEntity(base);
 assert.equal(safe.website,'');assert.equal(safe.profile.website,'');
 assert.deepEqual(base,before);assert.equal(officialSourceEntity(safe),safe);
 assert.equal(selectedOfficialWebsite(safe),'');
});
test('owner edit and explicit null/empty clears never resurrect imported/base websites',()=>{
 for(const value of [null,'','javascript:alert(1)']){
  for(const change of [{owner_content:{website:value}},{owner_content:{profile:{website:value}}},{profile:{...base.profile,website:value}}]){
   const e={...base,...change};assert.equal(selectedOfficialWebsite(e),'');
   assert.ok(!quickLookDetails(e).links.some(x=>x.label==='Official website'));
  }
 }
 for(const change of [{owner_content:{website:'https://owner.example/'}},{owner_content:{profile:{website:'https://owner.example/'}}},{profile:{...base.profile,website:'https://owner.example/'}}]){
  const e={...base,...change};assert.equal(selectedOfficialWebsite(e),'https://owner.example/');
  const safe=officialSourceEntity(e);assert.equal(selectedOfficialWebsite(safe),'https://owner.example/');
  assert.ok(quickLookDetails(safe).links.some(x=>x.href==='https://owner.example/'));
 }
 assert.equal(selectedOfficialWebsite({...base,owner_content:{website:'https://old.example/#new'}}),'https://old.example/#new');
 assert.equal(selectedOfficialWebsite({...base,owner_content:{website:'https://old.example/actual-parish'}}),'https://old.example/actual-parish');
});
test('stale domain takeover receipts never veto published same-domain owner edits',()=>{
 const e={...base,profile:{_enrich:{...base.profile._enrich,last_error:'source_identity_gambling:'+('a'.repeat(64))}},owner_content:{website:'https://old.example/new-path'}};
 assert.equal(selectedOfficialWebsite(e),'https://old.example/new-path');
 assert.equal(selectedOfficialWebsite({...e,owner_content:{website:'https://old.example/'}}),'https://old.example/');
 assert.equal(selectedOfficialWebsite({...e,owner_content:{website:'https://owner.example/new-path'}}),'https://owner.example/new-path');
});
test('challenge/robots/fetch errors and unflagged redirect mismatches do not imply an unsafe official site',()=>{
 for(const last_error of ['source_challenge','javascript_render_required','robots','network']){
  const e={...base,profile:{_enrich:{source_url:'https://elsewhere.example/',last_error,blocked:'true',blocked_reason:'robots'}}};
  assert.equal(selectedOfficialWebsite(e),'https://old.example/');
 }
 for(const flags of [{scope_review_required:false},{scope_review_required:'false'},{organization_identity_quarantine:'false'}])assert.equal(selectedOfficialWebsite({...base,profile:{_enrich:flags}}),'https://old.example/');
 const legacy={...base,website:'https://accepted.example',profile:{social_links:null}};
 assert.equal(officialSourceEntity(legacy).website,legacy.website,'accepted schema identity retains exact URL spelling');
});
test('compact search context retains source policy without a per-card request',()=>{
 const e={id:base.id,name:base.name,media_input:{website:base.website,profile:base.profile}};
 assert.equal(selectedOfficialWebsite(e),'');
 assert.equal(selectedOfficialWebsite({...e,media_input:{...e.media_input,owner_content:{website:'https://owner.example/'}}}),'https://owner.example/');
});
test('actual canonical handler applies the shared policy across sparse families and schema, preserving owner navigation',async()=>{
 const saved=global.fetch;
 try{
  for(const type of ['business','vendor','church','professional','school','association','creator','artist','venue','event','travel_place']){
   for(const owned of [false,true]){
    const row={...base,entity_type:type,...(owned?{owner_content:{website:'https://owner.example/'}}:{})};
    global.fetch=async url=>new Response(JSON.stringify(String(url).endsWith('/home_entity')?row:null));
    let html='';const res={setHeader(){},end(value){html=value||'';}};
    await handler({query:{slug:row.slug}},res);assert.equal(res.statusCode,200,type);
    assert.ok(!/href=["']https:\/\/old\.example(?:\/|["'])/.test(html),type+' old navigation');
    const schemas=[...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m=>JSON.parse(m[1]));
    assert.ok(!JSON.stringify(schemas).includes('https://old.example'),type+' old schema');
    if(owned)assert.ok(html.includes('href="https://owner.example/"'),type+' owner link');
   }
  }
 }finally{global.fetch=saved;}
});
test('authenticated preview keeps the canonical policy after existing authority checks, including owner clear and same-domain edits',async()=>{
 const saved=global.fetch,workspace='81000000-0000-4000-8000-000000000001';
 const design={schema_version:1,template:'concierge',section_order:[],hidden_sections:[],copy:{},item_order:{offerings:[]}};
 const request={method:'POST',headers:{authorization:'Bearer controlled-fixture'},body:{workspace,listing:base.id,design}};
 async function run(req){let body='';const res={setHeader(){},end(v){body=v;}};await previewHandler(req,res);return{status:res.statusCode,body:JSON.parse(body)};}
 try{
  for(const website of [undefined,null,'','https://old.example/new-parish']){
   const entity={...base,entity_type:'venue',...(website!==undefined?{owner_content:{website}}:{})};
   global.fetch=async()=>new Response(JSON.stringify({ok:true,listing:base.id,workspace,entity,design}));
   const result=await run(request);assert.equal(result.status,200);
   assert.ok(!result.body.html.includes('data-preview-href="https://old.example/"'));
   if(website)assert.ok(result.body.html.includes('data-preview-href="'+website+'"'));
   assert.ok(!/<script\b/i.test(result.body.html));
  }
  let calls=0;global.fetch=async()=>{calls++;return new Response('',{status:403});};
  assert.equal((await run({...request,headers:{}})).status,401);assert.equal(calls,0);
  assert.equal((await run(request)).status,403);
  global.fetch=async()=>new Response(JSON.stringify({ok:true,listing:base.id,workspace:'different',entity:base}));
  assert.equal((await run(request)).status,409);
 }finally{global.fetch=saved;}
});

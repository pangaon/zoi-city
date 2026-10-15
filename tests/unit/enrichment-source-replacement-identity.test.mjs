import {sourceCopyPlaceholder} from '../../assets/enrichment/client-brief.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';
import {assessMachineSourceIdentity as assess} from '../../supabase/functions/zoi-enrich/_source-identity.js';
import {captureSourceHTML} from '../../scripts/enrichment/source-html.mjs';
import {extractRenderedSource as extract} from '../../scripts/enrichment/extractor.mjs';
import {reviewedEnrichmentBatch} from '../../scripts/enrichment/reviewed-batch.mjs';
import {automaticRenderedPayload} from '../../scripts/enrichment/render-queue.mjs';
import {canonical,sha256} from '../../scripts/quality/evidence.mjs';
import {sourceClientIdentity,prepareClientBrief} from '../../supabase/functions/zoi-enrich/_brief.js';
import {inspectSourceDocument} from '../../supabase/functions/zoi-enrich/_document-quality.js';
import {memberLeaseGuard} from '../../supabase/functions/zoi-enrich/_member.js';
import {confirmedEnrichmentReceipts,enrichmentSample} from '../../supabase/functions/zoi-enrich/_receipts.js';
import {restaurantHomeContent} from '../../api/_restaurant-home.js';

// Exact title/description metadata observed in the 20-record capture, not a
// fabricated full source document. Original decoded-UTF8 hashes bind the audit.
const observed=[{
 name:'Yiamas Greek Taverna',website:'https://www.yiamas-greek-taverna.co.uk/',
 title:'Tower Rush - Play for Real Money Online in the UK',
 description:'Play Tower Rush by Galaxsys at UKGC-licensed UK casinos. Explore the 98.50% RTP, Frozen Floor bonuses, and try the free demo right now - no registration needed.',
 source_sha256:'4f06a47d94f808a7fcf1ad123cd8c53d47498c47d2085a9cd9afb2bf55c0f8c7',
 reason:'conflicting_wagering_identity'
},{
 name:'Kostas Greek Bakery',website:'https://www.kostasgreekbakery.com/',title:'kostasgreekbakery.com',
 description:'Find information, resources and relevant links for kostasgreekbakery.com. This domain may be for sale.',
 source_sha256:'cfa58bf146006594b8f1e7ff63562e0c8973701899ab615859f7a472d9f427ff',
 reason:'parked_or_for_sale_source'
}];
const escape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const document=data=>`<html><head><title>${data.title}</title><meta name="description" content="${escape(data.description)}"></head><body><h1>${data.title}</h1><p>${data.description}</p><p>${data.description}</p></body></html>`;
const listing=data=>({listing_id:'10000000-0000-4000-8000-000000000020',slug:'controlled-source-review',lease_id:'controlled-test-lease',name:data.name,entity_type:'business',website:data.website,source_fingerprint:'controlled-test-fingerprint',owner_managed:false,existing_enrich:{source_url:data.website,scope_review_required:'unknown-prior-review',menu:[{section:'Prior',items:[{name:'Prior reviewed dish',price:'£10',note:''}]}],provenance:{menu:'prior-reviewed-source'},_lease_source_context:{city:'London',country:'United Kingdom',address:'1 Test Street'}}});

test('actual captured replacement and parked-domain metadata select review without inventing source identity',()=>{
 for(const data of observed){const input={...data,finalUrl:data.website,owner_profile:{description:'Owner text'}};const before=structuredClone(input);assert.deepEqual(assess(input),{outcome:'review',reason:data.reason,original_host:new URL(data.website).hostname.replace(/^www\./,''),final_host:new URL(data.website).hostname.replace(/^www\./,'')});assert.deepEqual(input,before);}
});

test('parking with a stale matching brand title still cannot become business facts',()=>{
 for(const description of ['This domain may be for sale.','Buy this domain name.','This domain is parked.','Parked domain name.','This domain name has expired.'])assert.equal(assess({name:'Mythos Taverna',website:'https://mythos.test/',finalUrl:'https://mythos.test/',title:'Mythos Taverna',description}).reason,'parked_or_for_sale_source');
});

test('restaurant promotions, casino events and Greek words do not create replacement evidence',()=>{
 const row={name:'Mythos Taverna',website:'https://mythos.test/',finalUrl:'https://mythos.test/'};
 for(const data of [
  {title:'Greek restaurant',description:'Bonus dessert with dinner; parking available. The restaurant business is for sale.'},
  {title:'Casino night fundraiser',description:'Book tables for our charity event; deposits required.'},
  {title:'Casino night fundraiser',description:'No real money is used; bonus dessert for guests.'},
  {title:'Greek dinner',description:'Jackpot dessert promotion. Reserve a table with a deposit.'},
  {title:'Ελληνική κουζίνα',description:'Μπόνους γλυκό με το δείπνο, στάθμευση δίπλα στο εστιατόριο.'},
  {title:'Mythos Taverna',description:'Real money casino night with RTP and bonus spins.'},
  {name:'Casino Greek Taverna',title:'Casino Greek Taverna',description:'Restaurant reservations and Greek cuisine.'},
  {name:'Example Casino',title:'Online casino',description:'Real money games, RTP and welcome bonus.'},
  {name:'Καζίνο Πάρνηθας',title:'Online casino',description:'Real money casino games and RTP.'},
  {name:'Καζινο Ελληνικό',title:'Casino',description:'Betting jackpot bonus.'},
  {title:'Greek restaurant',description:'Our agency can help buy a domain for a new website.'}
 ])assert.equal(assess({...row,...data}).outcome,'continue',JSON.stringify(data));
});

test('same-host monetary gambling alternatives are held while unrelated words alone remain unknown',()=>{
 const row={name:'Mythos Taverna',website:'https://mythos.test/',finalUrl:'https://mythos.test/'};
 for(const description of ['Online casinos with a welcome bonus.','Slots with free spins.','Casino real money games.','Casino RTP 98 percent.','Sports betting deposit bonus.'])assert.equal(assess({...row,title:'New site',description}).outcome,'review',description);
 for(const description of ['Casino.','Real money.','RTP.','Bonuses.'])assert.equal(assess({...row,title:'Unknown',description}).outcome,'continue');
 assert.equal(assess({...row,finalUrl:'https://other.test/'}).reason,'document_host_changed');
});

test('explicit play-money charity and probability lessons remain unknown without commercial money claims',()=>{
 const row={name:'Hellenic Community Centre',website:'https://community.example/',finalUrl:'https://community.example/',title:'Casino night fundraiser'};
 for(const description of ['No real money. Free spins on play-money slots support our charity.','No real money is used. RTP statistics are demonstrated for our probability lesson.','Play-money slots and free spins support our charity.','A probability lesson demonstrates casino RTP without money.'])assert.deepEqual(assess({...row,description}),{outcome:'continue'},description);
});

test('play-money wording never neutralizes positive real-money titles or cash/deposit offers',()=>{
 const row={name:'Hellenic Community Centre',website:'https://community.example/',finalUrl:'https://community.example/'};
 for(const data of [
  {title:'Casino real money games',description:'No real money in the free demo; charity fundraiser.'},
  {title:'Casino night fundraiser',description:'No real money in the demo. Play real money casino games with free spins.'},
  {title:'Casino night fundraiser',description:'No real money. Free spins on play-money slots. Claim a deposit bonus.'},
  {title:'Casino night fundraiser',description:'Play-money slots support charity. Welcome bonus and cash payouts.'},
  {title:'Casino',description:'No real money in demo. Free spins and RTP statistics.'}
 ])assert.equal(assess({...row,...data}).reason,'conflicting_wagering_identity',JSON.stringify(data));
 assert.equal(assess({...observed[0],finalUrl:observed[0].website}).reason,observed[0].reason);
});

test('source HTML capture refuses observed metadata before photos, food or brief proposals',async()=>{
 const directory=await mkdtemp(tmpdir()+'/zoi-source-replacement-test-');
 try{for(const data of observed){let requests=0,decoders=0;const session={stats:{},sourceFetch:async()=>{requests++;return{url:data.website,status:200,text:document(data)};}};await assert.rejects(captureSourceHTML(listing(data),{directory,session,decoderFactory:()=>{decoders++;throw Error('must_not_decode');}}),/source_identity_scope_review/);assert.equal(requests,1);assert.equal(decoders,0);}}finally{await rm(directory,{recursive:true,force:true});}
});

function priorCapture(data,kind='source_html'){
 const lease=listing(data),source={url:data.website,title:data.title,http_status:200,sha256:data.source_sha256,source_state:'html_available',requires_rendering:false,visible_text_length:1000};
 const report={schema:kind==='source_html'?2:1,capture_kind:kind,source_scope:'official_site',review_required:true,render:kind==='source_html'?null:{url:data.website,title:data.title,sha256:'c'.repeat(64)},listing_id:lease.listing_id,website:lease.website,source_fingerprint:lease.source_fingerprint,source,extractor_sha256:'a'.repeat(64),profile:{description:data.description,site_lang:'en'},images:[]};
 const review={listing_id:lease.listing_id,source_fingerprint:lease.source_fingerprint,report_sha256:sha256(canonical(report)),identity_confirmed:true,images_confirmed:true,reviewer:'controlled-independent-reviewer',reviewed_at:'2026-10-15T13:00:00Z',approved_image_hashes:[],prior_machine_sha256:sha256(canonical(lease.existing_enrich)),approved_fields:{description:'A rewritten description cannot sanitize wrong-source evidence.'}};
 return{report,review,lease};
}

test('both reviewed merge lanes refuse pre-guard retained reports despite approval and copy overrides',()=>{
 for(const data of observed)for(const kind of ['source_html','rendered']){const x=priorCapture(data,kind),before=structuredClone(x);assert.throws(()=>reviewedEnrichmentBatch(x.report,x.review,x.lease),/source_identity_review_required/);assert.deepEqual(x,before);}
});

test('automatic rendered path retains its existing refusal contract for the same replacement metadata',()=>{
 for(const data of observed){const x=priorCapture(data,'rendered'),result=automaticRenderedPayload(x.lease,x.report,sha256(canonical(x.report)));assert.equal(result.profile.crawl_status,'error');assert.equal(result.profile.last_error,'rendered_source_identity_review');assert.equal(result.profile.description,undefined);}
});

const workerSource=readFileSync(new URL('../../supabase/functions/zoi-enrich/index.ts',import.meta.url),'utf8');
async function runWorker(data,html=document(data)){
 let handler,batch,identityCalls=0,supplementCalls=0;const row=listing(data),before=structuredClone(row);
 const deps={sourceCopyPlaceholder,assessMachineSourceIdentity:assess,prepareClientBrief,sourceClientIdentity:(...args)=>{identityCalls++;return sourceClientIdentity(...args);},extractStructuredServices:()=>{throw Error('must_not_extract_services');},structuredSourceContextMatches:()=>{throw Error('must_not_check_food');},hospitalitySupplements:()=>{supplementCalls++;throw Error('must_not_crawl_supplements');},hospitalitySourceMatches:()=>true,validHospitalityFields:()=>true,crypto:webcrypto,TextEncoder,INVOCATION_MS:110000,RPC_MS:15000,TIMEOUT_MS:8000,boundedIO:async(_d,_m,fn)=>fn(new AbortController().signal),Deno:{serve:fn=>handler=fn},authorised:()=>true,ENABLED:true,BATCH:1,enrichmentSample,memberLeaseGuard,confirmedEnrichmentReceipts,inspectSourceDocument,Response,Date,URL,dnsState:()=>true,vet:async url=>({url:new URL(url)}),robotsAllows:async()=>true,fetchDoc:async()=>({doc:html,finalUrl:row.website}),sbRpc:async(fn,args)=>{if(fn.endsWith('_lease'))return[row];batch=args.p_batch;return batch.map(x=>({slug:x.slug,applied:true}));},extract,supplementaryPages:()=>{supplementCalls++;throw Error('must_not_crawl_supplements');},imageIdentity:x=>x};
 new Function(...Object.keys(deps),stripTypeScriptTypes(workerSource.slice(workerSource.indexOf('Deno.serve('))))(...Object.values(deps));
 const response=await handler(new Request('https://controlled-worker.test/',{method:'POST',body:'{}'}));assert.equal(response.status,200);assert.deepEqual(row,before);return{row,batch,identityCalls,supplementCalls};
}

test('actual worker handler emits only source-review failure metadata before identity, supplements and brief',async()=>{
 for(const data of observed){const result=await runWorker(data),item=result.batch[0];assert.equal(result.batch.length,1);assert.equal(item.website,data.website);assert.equal(item.lease_id,result.row.lease_id);assert.equal(item.profile.blocked,'true');assert.equal(item.profile.blocked_reason,'source_scope_mismatch');assert.equal(item.profile.crawl_status,'error');assert.equal(item.profile.last_error,'source_identity_review:'+data.reason);assert.deepEqual(Object.keys(item.profile).sort(),['blocked','blocked_reason','crawl_status','last_error']);assert.deepEqual(item.provenance,{});assert.equal(result.identityCalls,0);assert.equal(result.supplementCalls,0);
  const entity={id:result.row.listing_id,slug:result.row.slug,name:data.name,entity_type:'business',website:data.website,category_slug:'restaurants',profile:{_enrich:{...result.row.existing_enrich,...item.profile}}};assert.equal(restaurantHomeContent(entity).menuSections.length,0);assert.equal(restaurantHomeContent({...entity,owner_content:{profile:{menu:result.row.existing_enrich.menu}}}).menuSections.length,1);
 }
});

if(process.env.ZOI_SOURCE_REPLACEMENT_CAPTURE_DIR)test('actual retained capture hashes and sanitized source HTML replay through capture, worker and reviewed refusal',async()=>{
 const root=process.env.ZOI_SOURCE_REPLACEMENT_CAPTURE_DIR,snapshot=JSON.parse(readFileSync(root+'/snapshot.json','utf8')),receipts=JSON.parse(readFileSync(root+'/receipts.json','utf8'));
 const directory=await mkdtemp(tmpdir()+'/zoi-source-replacement-retained-');
 try{for(const expected of observed){
  const row=snapshot.rows.find(r=>r.name===expected.name),receipt=receipts.find(r=>r.listing_id===row.listing_id),bytes=readFileSync(root+'/captures/'+receipt.hash+'.json');assert.equal(sha256(bytes),receipt.hash);
  const report=JSON.parse(bytes);assert.equal(report.source.sha256,expected.source_sha256);assert.equal(report.source.title,expected.title);assert.equal(report.profile.description,expected.description);assert.equal(extract(report.html,report.source.url).profile.description,expected.description);
  let fetches=0;await assert.rejects(captureSourceHTML(row,{directory,session:{stats:{},sourceFetch:async()=>{fetches++;return{url:report.source.url,status:200,text:report.html};}},decoderFactory:()=>{throw Error('must_not_decode');}}),/source_identity_scope_review/);assert.equal(fetches,1);
  const result=await runWorker(expected,report.html);assert.equal(result.batch[0].profile.last_error,'source_identity_review:'+expected.reason);assert.equal(result.batch[0].profile.client_brief,undefined);assert.equal(result.batch[0].profile.description,undefined);assert.equal(result.identityCalls,0);assert.equal(result.supplementCalls,0);
  const lease={...row,lease_id:'controlled-retained-test-lease'},review={listing_id:row.listing_id,source_fingerprint:row.source_fingerprint,report_sha256:receipt.hash,identity_confirmed:true,images_confirmed:true,reviewer:'controlled-test-only',reviewed_at:'2026-10-15T13:00:00Z',approved_image_hashes:[],prior_machine_sha256:sha256(canonical(row.existing_enrich))};
  assert.throws(()=>reviewedEnrichmentBatch(report,review,lease),/source_identity_review_required/);
 }}finally{await rm(directory,{recursive:true,force:true});}
});

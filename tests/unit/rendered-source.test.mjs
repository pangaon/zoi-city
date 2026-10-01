import{test}from'node:test';import assert from'node:assert/strict';import{mkdtemp,rm,readFile,writeFile}from'node:fs/promises';import{tmpdir}from'node:os';import path from'node:path';
import{allowedRenderRequest}from'../../scripts/enrichment/render-source.mjs';import{captureRows}from'../../scripts/enrichment/render-capture.mjs';import{extractRenderedSource}from'../../scripts/enrichment/extractor.mjs';
test('renderer refuses mutations and active media while allowing publicly guarded page resources',()=>{for(const type of ['document','script','stylesheet','xhr','fetch','image'])assert(allowedRenderRequest({method:()=> 'GET',resourceType:()=>type}));for(const type of ['media','font','websocket','other'])assert.equal(allowedRenderRequest({method:()=> 'GET',resourceType:()=>type}),false);assert.equal(allowedRenderRequest({method:()=> 'POST',resourceType:()=> 'xhr'}),false)});
test('rendered page uses exact worker extractor and never promotes a video to image',()=>{const x=extractRenderedSource('<video><source src="/hero.mp4"></video><img src="/dining.jpg"><a href="tel:+254742432358">Call</a>','https://restaurant.org/');assert.equal(x.profile.hero_url,'https://restaurant.org/dining.jpg');assert.equal(x.profile.phone,'+254742432358')});
test('batch captures each record and resumes immutable source evidence without recrawling',async()=>{const directory=await mkdtemp(path.join(tmpdir(),'zoi-render-'));try{let calls=0;const rows=[{id:'84bdafb9-966b-489a-a4d3-0dc3dc92acf9',website:'https://restaurant.org/',source_fingerprint:'one'}],render=async row=>{calls++;return{listing_id:row.id,profile:{phone:'1234567'},review_required:true}};const first=await captureRows(rows,{directory,render});const second=await captureRows(rows,{directory,render});assert.equal(calls,1);assert.equal(second[0].resumed,true);assert.equal(first[0].status,'captured_pending_review');await writeFile(path.join(directory,first[0].hash+'.json'),'changed');await assert.rejects(captureRows(rows,{directory,render}),/capture_hash_mismatch/);}finally{await rm(directory,{recursive:true,force:true})}});
test('a blocked source becomes a specialist repair report, never synthetic content',async()=>{const directory=await mkdtemp(path.join(tmpdir(),'zoi-render-'));try{const r=await captureRows([{id:'84bdafb9-966b-489a-a4d3-0dc3dc92acf9',website:'https://restaurant.org/'}],{directory,render:async()=>{throw Error('robots_disallow')}});const report=JSON.parse(await readFile(path.join(directory,r[0].hash+'.json'),'utf8'));assert.equal(report.reason,'robots_disallow');assert.equal(report.specialist,'enrichment');assert.equal(report.profile,undefined);}finally{await rm(directory,{recursive:true,force:true})}});

test('reviewed enrichment cannot bypass source identity or existing lease binding',async()=>{const{reviewedEnrichmentBatch}=await import('../../scripts/enrichment/reviewed-batch.mjs');const{canonical,sha256}=await import('../../scripts/quality/evidence.mjs');const report={listing_id:'id',website:'https://restaurant.org/',source_fingerprint:'fp',profile:{phone:'1234567'},source:{http_status:200,sha256:'source'},render:{url:'https://restaurant.org/',sha256:'render'}};const review={listing_id:'id',source_fingerprint:'fp',report_sha256:sha256(canonical(report)),identity_confirmed:true,images_confirmed:true,reviewer:'specialist',reviewed_at:'2026-09-30T00:00:00Z'};const lease={listing_id:'id',website:report.website,lease_id:'existing',slug:'restaurant',source_fingerprint:'fp'};assert.equal(reviewedEnrichmentBatch(report,review,lease)[0].profile.phone,'1234567');for(const source_fingerprint of [undefined,null,'','changed'])assert.throws(()=>reviewedEnrichmentBatch(report,review,{...lease,source_fingerprint}),/review_lease_fingerprint_mismatch/);assert.throws(()=>reviewedEnrichmentBatch(report,{...review,identity_confirmed:false},lease),/source_review_required/);assert.throws(()=>reviewedEnrichmentBatch(report,review,{...lease,listing_id:'other'}),/review_lease_mismatch/);assert.throws(()=>reviewedEnrichmentBatch(report,{...review,approved_fields:{rating:5}},lease),/unapproved_review_field/);});


test('unattended source repair requires exact identity and preserves previous nonempty fields',async()=>{
 const {automaticRenderedPayload}=await import('../../scripts/enrichment/render-queue.mjs');
 const row={listing_id:'id',slug:'example',website:'https://restaurant.org/',name:'Example Restaurant',lease_id:'lease',source_fingerprint:'fp',existing_enrich:{hero_url:'https://restaurant.org/old.jpg',phone:'111',status:'error'}};
 const report={listing_id:'id',website:row.website,source_fingerprint:'fp',source:{http_status:200,sha256:'s'},render:{title:row.name,url:row.website,sha256:'r'},profile:{hero_url:null,phone:'222'}};
 const result=automaticRenderedPayload(row,report,'hash');assert.equal(result.profile.phone,'222');assert.equal(result.profile.hero_url,row.existing_enrich.hero_url);assert.equal(result.profile.status,undefined);assert.equal(result.profile.rendered_source_evidence.identity_verified,false);
 for(const changed of [{...report,render:{...report.render,title:'Other Restaurant'}},{...report,listing_id:'other'},{...report,source:{http_status:500}},{...report,render:{...report.render,url:'https://other.org/'}}])assert.equal(automaticRenderedPayload(row,changed,'hash').profile.crawl_status,'error');
 assert.equal(automaticRenderedPayload({...row,owner_managed:true},report,'hash').profile.last_error,'owner_managed_render_review');
});

test('runtime preflight keeps sandbox enabled and omits service secrets from browser environment',async()=>{const {verifySourceBrowser}=await import('../../scripts/enrichment/render-source.mjs');let options,closed=false;await verifySourceBrowser({launch:async o=>{options=o;return{newContext:async()=>({newPage:async()=>({goto:async url=>assert.equal(url,'about:blank')}),close:async()=>{}}),close:async()=>{closed=true}}}});assert.equal(options.chromiumSandbox,true);assert(!options.args.includes('--no-sandbox'));assert(!Object.hasOwn(options.env,'SUPABASE_ACCESS_TOKEN'));assert(closed);});
test('browser infrastructure failure happens before any credential request or listing lease',async()=>{const {runRenderQueue}=await import('../../scripts/enrichment/render-queue.mjs');let requests=0;await assert.rejects(runRenderQueue({requestOverride:{enabled:true,expires_at:new Date(Date.now()+60000).toISOString(),max_listings_per_run:3},preflight:async()=>{throw Error('No usable sandbox!')},fetchImpl:async()=>{requests++},env:{},log:()=>{}}),/browser_sandbox_unavailable/);assert.equal(requests,0);});
test('source failure diagnostics retain fixed actionable categories without raw log data',async()=>{const {sourceFailureReason:f}=await import('../../scripts/enrichment/source-errors.mjs');assert.equal(f({message:'No usable sandbox! private log'}),'browser_sandbox_unavailable');assert.equal(f({message:'SSL error with private data',code:'EPROTO'}),'source_tls_failure');assert.equal(f({message:'arbitrary secret URL token=hidden'}),'source_capture_failed');assert.equal(f({message:'SECRET_TOKEN_123'}),'source_capture_failed');assert.equal(f({message:'launch failed detail',source_stage:'browser_launch'}),'browser_launch_failed');});

test('render queue captures original adapter fingerprint before hashing success and refusal evidence',async()=>{
 const {runRenderQueue}=await import('../../scripts/enrichment/render-queue.mjs');
 const {canonical,sha256}=await import('../../scripts/quality/evidence.mjs');
 const {readdir}=await import('node:fs/promises');
 for(const blocked of [false,true]){
  const directory=await mkdtemp(path.join(tmpdir(),'zoi-bound-render-'));
  try{
   const row={listing_id:'id',slug:'example',website:'https://restaurant.org/',name:'Example Restaurant',lease_id:'existing',source_fingerprint:'original-fingerprint'};
   const calls=[];
   await runRenderQueue({directory,env:{SUPABASE_SERVICE_ROLE_KEY:'test-only'},requestOverride:{enabled:true,expires_at:new Date(Date.now()+60000).toISOString(),max_listings_per_run:3},preflight:async()=>{},log:()=>{},
    fetchImpl:async(url,options)=>{const fn=url.split('/').pop(),args=JSON.parse(options.body);calls.push({fn,args});return{ok:true,json:async()=>fn==='enrich_source_queue_lease'?[row]:[{slug:row.slug,applied:true}]};},
    render:async()=>{if(blocked)throw Error('robots_disallow');return{listing_id:row.listing_id,website:row.website,source_fingerprint:'untrusted-render-value',source:{http_status:200,sha256:'source'},render:{title:row.name,url:row.website,sha256:'render'},profile:{phone:'1234567'}};}
   });
   assert.deepEqual(calls.map(c=>c.fn),['enrich_source_queue_lease','enrich_apply']);
   const files=await readdir(directory),capture=files.find(f=>!f.includes('.pending.')&&!f.includes('.receipt.'));
   const report=JSON.parse(await readFile(path.join(directory,capture),'utf8'));
   assert.equal(report.source_fingerprint,row.source_fingerprint);assert.equal(capture,sha256(canonical(report))+'.json');
   assert.equal(calls[1].args.p_batch[0].profile.crawl_status,blocked?'error':'ok');
   if(!blocked)assert.equal(calls[1].args.p_batch[0].profile.rendered_source_evidence.source_fingerprint,row.source_fingerprint);
  }finally{await rm(directory,{recursive:true,force:true});}
 }
});
test('missing adapter fingerprint refuses entire batch before capture or apply; direct payload mismatch fails closed',async()=>{
 const {runRenderQueue,automaticRenderedPayload}=await import('../../scripts/enrichment/render-queue.mjs');
 const directory=await mkdtemp(path.join(tmpdir(),'zoi-missing-fp-'));let captures=0;const calls=[];
 try{
  await assert.rejects(runRenderQueue({directory,env:{SUPABASE_SERVICE_ROLE_KEY:'test-only'},requestOverride:{enabled:true,expires_at:new Date(Date.now()+60000).toISOString(),max_listings_per_run:3},preflight:async()=>{},log:()=>{},render:async()=>{captures++},fetchImpl:async url=>{calls.push(url.split('/').pop());return{ok:true,json:async()=>[{source_fingerprint:'valid'},{source_fingerprint:null}]};}}),/source_capture_fingerprint_missing/);
  assert.equal(captures,0);assert.deepEqual(calls,['enrich_source_queue_lease']);
  for(const row of [{},{source_fingerprint:'new'}])assert.throws(()=>automaticRenderedPayload(row,{source_fingerprint:'old'},'hash'),/source_capture_fingerprint_mismatch/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('verification challenge stops before browser launch and capture report remains fingerprint-bound repair evidence',async()=>{
 const {renderOfficialSource}=await import('../../scripts/enrichment/render-source.mjs');
 const {canonical,sha256}=await import('../../scripts/quality/evidence.mjs');
 const row={listing_id:'11111111-1111-4111-8111-111111111111',website:'https://www.nostos-kythera.gr/',source_fingerprint:'original-lease-fingerprint'};
 const html='<title>One moment, please...</title><body>Please wait while your request is being verified...</body>';let fetched=0,launched=0;
 const render=r=>renderOfficialSource(r,{session:{stats:{bytes:0},sourceFetch:async()=>{fetched++;return{status:200,text:html,url:r.website}}},launch:async()=>{launched++;throw Error('must_not_launch')}});
 const directory=await mkdtemp(path.join(tmpdir(),'zoi-challenge-'));
 try{const receipts=await captureRows([row],{directory,render});assert.equal(fetched,1);assert.equal(launched,0);assert.equal(receipts[0].status,'repair_required');const report=JSON.parse(await readFile(path.join(directory,receipts[0].hash+'.json'),'utf8'));assert.equal(report.reason,'source_challenge');assert.equal(report.source_fingerprint,row.source_fingerprint);assert.equal(sha256(canonical(report)),receipts[0].hash);assert.equal(report.profile,undefined);}finally{await rm(directory,{recursive:true,force:true});}
});
test('challenge appearing after browser rendering is refused and browser/context are closed',async()=>{
 const {renderOfficialSource}=await import('../../scripts/enrichment/render-source.mjs');let closed=0,contextClosed=0,requests=0;
 const url='https://www.nostos-kythera.gr/',html='<title>One moment, please...</title><body>Please wait while your request is being verified...</body>';
 const page={goto:async()=>{},waitForFunction:async()=>{},waitForTimeout:async()=>{},evaluate:async()=>({html,url,title:'One moment, please...',text:'Please wait while your request is being verified...'})};
 const context={routeWebSocket:async()=>{},route:async()=>{},newPage:async()=>page,close:async()=>{contextClosed++}};
 await assert.rejects(renderOfficialSource({listing_id:'id',website:url},{session:{stats:{bytes:0},sourceFetch:async()=>{requests++;return{status:200,text:'<title>Nostos</title><body>Loading</body>',url}}},launch:async()=>({newContext:async()=>context,close:async()=>{closed++}})}),/source_challenge/);
 assert.equal(requests,1);assert.equal(contextClosed,1);assert.equal(closed,1);
});

test('substantive hydrated business page with contact CAPTCHA remains available source content',async()=>{
 const {renderOfficialSource}=await import('../../scripts/enrichment/render-source.mjs');
 const url='https://restaurant.org/',html='<html><head><title>Actual Restaurant</title></head><body><h1>Actual Restaurant</h1><p>Greek dining and our seasonal menu.</p><a href="tel:+442012345678">Call our restaurant</a><form><p>Verify you are human before sending this contact form.</p></form></body></html>';
 const page={goto:async()=>{},waitForFunction:async()=>{},waitForTimeout:async()=>{},evaluate:async()=>({html,url,title:'Actual Restaurant',text:'Actual Restaurant Greek dining and our seasonal menu. Verify you are human before sending this contact form.'})};
 const context={routeWebSocket:async()=>{},route:async()=>{},newPage:async()=>page,close:async()=>{}};
 const report=await renderOfficialSource({listing_id:'id',website:url},{session:{stats:{bytes:0},sourceFetch:async()=>({status:200,text:'<title>Actual Restaurant</title><body>Loading restaurant</body>',url})},launch:async()=>({newContext:async()=>context,close:async()=>{}})});
 assert.equal(report.profile.phone,'+442012345678');assert.equal(report.render.title,'Actual Restaurant');assert.equal(report.source.source_state,'html_available');assert.equal(report.review_required,true);
});

test('partial rendered refresh preserves prior photos and networks while replacing a changed network',async()=>{
 const {automaticRenderedPayload}=await import('../../scripts/enrichment/render-queue.mjs');
 const row={listing_id:'id',slug:'example',website:'https://restaurant.org/',name:'Example Restaurant',lease_id:'lease',source_fingerprint:'fp',existing_enrich:{photo_urls:['https://restaurant.org/old.jpg','https://restaurant.org/shared.jpg'],social:{facebook:'https://facebook.com/old',instagram:'https://instagram.com/retained'},phone:'111',provenance:{phone:'prior-source'}}};
 const report={listing_id:'id',website:row.website,source_fingerprint:'fp',source:{http_status:200,sha256:'s'},render:{title:row.name,url:row.website,sha256:'r'},profile:{photo_urls:['https://restaurant.org/new.jpg','https://restaurant.org/shared.jpg'],social:{facebook:'https://facebook.com/current',instagram:null},phone:'222'}};
 const before=JSON.stringify(row),result=automaticRenderedPayload(row,report,'hash');
 assert.deepEqual(result.profile.photo_urls,['https://restaurant.org/new.jpg','https://restaurant.org/shared.jpg','https://restaurant.org/old.jpg']);
 assert.deepEqual(result.profile.social,{facebook:'https://facebook.com/current',instagram:'https://instagram.com/retained'});assert.equal(JSON.stringify(row),before);
 for(const empty of[{},null,undefined]){const p=automaticRenderedPayload(row,{...report,profile:{phone:'222',social:empty,photo_urls:[]}},'hash').profile;assert.deepEqual(p.social,row.existing_enrich.social);assert.deepEqual(p.photo_urls,row.existing_enrich.photo_urls);}
 assert.equal(automaticRenderedPayload({...row,owner_managed:true},report,'hash').profile.last_error,'owner_managed_render_review');
 assert.throws(()=>automaticRenderedPayload(row,{...report,source_fingerprint:'changed'},'hash'),/fingerprint_mismatch/);
});
test('rendered contact conflict enters preservation review; resolved contact clears only its stale conflict marker',async()=>{
 const {automaticRenderedPayload}=await import('../../scripts/enrichment/render-queue.mjs');
 const row={listing_id:'id',slug:'example',website:'https://restaurant.org/',name:'Example Restaurant',lease_id:'lease',source_fingerprint:'fp',existing_enrich:{email:'old@restaurant.org',email_conflict:{structured:'old@restaurant.org',linked:['other@restaurant.org']},phone:'111'}};
 const report={listing_id:'id',website:row.website,source_fingerprint:'fp',source:{http_status:200,sha256:'s'},render:{title:row.name,url:row.website,sha256:'r'},profile:{phone:'222',email:null,email_conflict:{structured:'a@restaurant.org',linked:['b@restaurant.org'],source_url:row.website}}};
 const p=automaticRenderedPayload(row,report,'hash').profile;assert.equal(p.last_error,'rendered_source_email_review');assert.equal(p.crawl_status,'error');assert(!Object.hasOwn(p,'email'));
 const absent=automaticRenderedPayload(row,{...report,profile:{phone:'222',email:null,email_conflict:null}},'hash').profile;assert.equal(absent.email,row.existing_enrich.email);assert.deepEqual(absent.email_conflict,row.existing_enrich.email_conflict);
 const resolved=automaticRenderedPayload(row,{...report,profile:{phone:'222',email:'resolved@restaurant.org',email_conflict:null}},'hash').profile;assert.equal(resolved.email,'resolved@restaurant.org');assert.equal(resolved.email_conflict,null);
});

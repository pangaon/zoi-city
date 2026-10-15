import {captureSourceHTML} from '../../scripts/enrichment/source-html.mjs';
import {mkdtemp,rm,readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {prepareClientBrief} from '../../supabase/functions/zoi-enrich/_brief.js';
import {confirmedEnrichmentReceipts,enrichmentSample} from '../../supabase/functions/zoi-enrich/_receipts.js';
import {automaticRenderedPayload,runRenderQueue} from '../../scripts/enrichment/render-queue.mjs';
import {sourceIdentityContentHeld} from '../../assets/enrichment/official-source-policy.mjs';
import {createReviewedVisibleFoodCandidate,validateReviewedVisibleFoodCandidate} from '../../scripts/enrichment/reviewed-visible-food.mjs';
import {reviewedEnrichmentBatch} from '../../scripts/enrichment/reviewed-batch.mjs';
import {canonical,sha256} from '../../scripts/quality/evidence.mjs';
import {sourceClientIdentity} from '../../supabase/functions/zoi-enrich/_brief.js';
import {restaurantHomeContent,renderRestaurantHome} from '../../api/_restaurant-home.js';
import {briefHomeDesign,reviewedFoodReceiptCurrent,reviewedFoodDeferralProfile} from '../../assets/enrichment/client-brief.mjs';
import {reviewedFoodMenuLabel} from '../../assets/homes/food-offering.mjs';
const website='https://bakery.org/',context={address:'151 Frederick Street, Kitchener, ON N2H 2M2',city:'Kitchener',country:'Canada'},row={listing_id:'11111111-1111-4111-8111-111111111111',name:'Three Kretans',slug:'reviewed-source-restaurant',entity_type:'business',category_slug:'restaurants',primary_category_id:21,claim_status:'unclaimed',website,lease_id:'20000000-0000-4000-8000-000000000001',source_fingerprint:'current-canonical-fingerprint',owner_managed:false,owner_user_id:null,owner_workspace_id:null,existing_enrich:{source_url:website,_lease_source_context:context,description:'Prior reviewed copy',provenance:{description:'prior-source-proof'}}};
const c=r=>({listing_id:r.listing_id,name:r.name,entity_type:r.entity_type,website:r.website,...r.existing_enrich._lease_source_context,category_slug:r.category_slug,primary_category_id:r.primary_category_id,owner_user_id:r.owner_user_id,owner_workspace_id:r.owner_workspace_id,claim_status:r.claim_status});
const body='<h1>Three Kretans</h1><p>151 Frederick Street, Kitchener, Ontario N2H 2M2, Canada</p><a href="/lunch-menu">Lunch Menu</a><p>Contact us directly about ingredients, availability and arrangements. Dinner and catering menus are published separately.</p>';
const expected=[{section:'MAINS',items:[{name:'Lunch Pikilia',price:'18.50',note:'Chicken & pork.'}]}];
const dish=(i,name='Lunch Pikilia',price='18.50',note='Chicken &amp; pork.')=>`<div><h4 data-aid="MENU_SECTION0_ITEM${i}_TITLE">${name}</h4><div data-aid="MENU_SECTION0_ITEM${i}_PRICE">${price}</div><p data-aid="MENU_SECTION0_ITEM${i}_DESC">${note}</p></div>`;
function setup(){const document=(html,url)=>({html:'<html><head><title>Three Kretans</title></head><body>'+html+'</body></html>',url,raw:true,hash_basis:'decoded_utf8',http_status:200,retrieved_at:'2026-10-15T14:13:13Z'}),branchDocument=document(body,website),menuDocument=document('<h1>Lunch Menu</h1><h3 data-aid="MENU_SECTION_TITLE_0">MAINS</h3>'+dish(0),website+'lunch-menu');for(const doc of [branchDocument,menuDocument])doc.sha256=sha256(doc.html);
 const parentReport={schema:2,capture_kind:'source_html',listing_id:row.listing_id,website,source:{url:website,sha256:branchDocument.sha256},food_offering:{state:'unresolved',reason:'source_identity_or_branch_unconfirmed'}};
 const identityReview={schema:1,verification:'reviewed_official_visible_branch',reviewer:'source-specialist',reviewed_at:'2026-10-15T14:14:00Z',source_fingerprint:row.source_fingerprint,prior_machine_sha256:sha256(canonical(row.existing_enrich)),canonical_context:c(row),category_slug:row.category_slug,branch_document_url:branchDocument.url,branch_document_sha256:branchDocument.sha256,menu_document_url:menuDocument.url,menu_document_sha256:menuDocument.sha256,branch_scope:'single_branch',scope_gaps:[],canonical_street:'151 Frederick Street',quotes:{name:'Three Kretans',street:'151 Frederick Street, Kitchener, Ontario N2H 2M2, Canada',city:'Kitchener',country:'Canada'},menu_scope:{kind:'lunch',label:'Lunch menu',entire_business_offering:false},offering_format:'data-aid-menu-v1',observed_items:1,menu_sha256:sha256(canonical(expected))};
 return{row:structuredClone(row),branchDocument,menuDocument,identityReview,parentReport,parentReportSha256:sha256(canonical(parentReport))};}
const approval=report=>({listing_id:row.listing_id,source_fingerprint:row.source_fingerprint,report_sha256:sha256(canonical(report)),identity_confirmed:true,images_confirmed:true,reviewer:'independent-source-reviewer',reviewed_at:'2026-10-15T14:15:00Z',approved_image_hashes:[],prior_machine_sha256:sha256(canonical(row.existing_enrich)),food_offering_confirmed:true,visible_branch_confirmed:true,visible_branch_review_sha256:sha256(canonical(report.visible_food_review))});
const entity=payload=>({id:row.listing_id,...row,...context,profile:{_enrich:{...payload.profile,source_url:website,provenance:payload.provenance,checked_at:'2026-10-15T14:15:00Z'}}});

test('new offline candidate retains distinct reviewed identity; original unresolved capture is unchanged',()=>{
 const input=setup(),before=structuredClone(input.parentReport),report=createReviewedVisibleFoodCandidate(input);assert.deepEqual(input.parentReport,before);assert.equal(report.capture_kind,'reviewed_visible_food');assert.equal(report.food_offering.primary_identity.verification,'reviewed_official_visible_branch');assert.equal(sourceClientIdentity(row,input.branchDocument.html,website),null);assert.deepEqual(report.profile.menu,expected);assert.equal(report.food_offering.original_total,1);assert.equal(report.food_offering.truncated,false);assert.equal(report.food_offering.offering_scope.entire_business_offering,false);
});

test('independent explicit review plus existing canonical lease gates produce a pending Food brief',()=>{
 const report=createReviewedVisibleFoodCandidate(setup()),result=reviewedEnrichmentBatch(report,approval(report),row)[0];assert.equal(result.website,website);assert.equal(result.lease_id,row.lease_id);assert.equal(result.profile.client_brief.source.identity_match,true);assert.equal(result.profile.client_brief.source.scope,'reviewed_official_visible_branch');assert.equal(result.profile.client_brief.description,null);assert.equal(result.profile.description,'Prior reviewed copy');assert.equal(result.provenance.description,'prior-source-proof');assert.equal(result.profile.client_brief.progress.acceptance,'not_reviewed');assert.ok(!Object.hasOwn(result.profile,'_lease_source_context'));assert.ok(briefHomeDesign(entity(result)));
});

test('author self-confirmation and missing explicit visible-branch confirmation cannot apply',()=>{
 const report=createReviewedVisibleFoodCandidate(setup());for(const change of [x=>x.visible_branch_confirmed=false,x=>x.reviewer='source-specialist',x=>x.visible_branch_review_sha256='f'.repeat(64)]){const review=approval(report);change(review);assert.throws(()=>reviewedEnrichmentBatch(report,review,row),/independent_branch_review_required/);}
});

test('raw bytes, literal numbered branch, exact link and bounded complete field scan are required',()=>{
 for(const change of [x=>x.branchDocument.raw=false,x=>x.branchDocument.hash_basis='sanitized_html',x=>x.branchDocument.html+='changed',x=>x.identityReview.quotes.street='151 Different Street',x=>x.identityReview.canonical_street='Kitchener',x=>x.identityReview.branch_scope='brand_multiple_locations',x=>x.identityReview.scope_gaps=['branch_unconfirmed'],x=>x.identityReview.observed_items=2,x=>x.identityReview.menu_sha256='f'.repeat(64),x=>x.parentReportSha256='f'.repeat(64),x=>x.identityReview.menu_scope.entire_business_offering=true]){const input=setup();change(input);assert.throws(()=>createReviewedVisibleFoodCandidate(input),/visible_food_/);}
});

test('hidden/script evidence and duplicate field markers cannot establish source facts',()=>{
 for(const fragment of ['<div hidden>'+body+'</div>','<script>'+body+'</script>']){const input=setup();input.branchDocument.html='<html><body><p>Visible business information. Contact the publisher directly for the current published details and customer arrangements.</p>'+fragment+'</body></html>';input.branchDocument.sha256=sha256(input.branchDocument.html);input.identityReview.branch_document_sha256=input.branchDocument.sha256;assert.throws(()=>createReviewedVisibleFoodCandidate(input),/literal_branch_quote_required/);}
 const input=setup();input.menuDocument.html=input.menuDocument.html.replace('</body>',dish(0)+'</body>');input.menuDocument.sha256=sha256(input.menuDocument.html);input.identityReview.menu_document_sha256=input.menuDocument.sha256;assert.throws(()=>createReviewedVisibleFoodCandidate(input),/ambiguous_field/);
});

test('canonical context, owner transfer, source holds and changed prior-machine facts refuse',()=>{
 for(const change of [x=>x.row.owner_managed=true,x=>x.row.owner_workspace_id='owner',x=>x.row.existing_enrich.blocked=true,x=>x.row.existing_enrich.source_url='https://other.org/',x=>x.row.existing_enrich._lease_source_context.city='Perth',x=>x.row.existing_enrich.description='Changed source facts']){const input=setup();change(input);assert.throws(()=>createReviewedVisibleFoodCandidate(input),/visible_food_/);}
 const report=createReviewedVisibleFoodCandidate(setup()),lease=structuredClone(row);lease.existing_enrich.description='Concurrent edit';assert.throws(()=>reviewedEnrichmentBatch(report,approval(report),lease),/review_context_changed|prior_machine/);
});

test('regular source captures cannot opt into a manual identity or approved format',()=>{
 const report=createReviewedVisibleFoodCandidate(setup());report.capture_kind='source_html';assert.throws(()=>reviewedEnrichmentBatch(report,approval(report),row),/food_source_identity_changed/);
});

test('partial populated and sparse labels retain source scope; owner links and full menu states remain unchanged',()=>{
 const report=createReviewedVisibleFoodCandidate(setup()),result=reviewedEnrichmentBatch(report,approval(report),row)[0],e=entity(result),model=restaurantHomeContent(e);assert.equal(model.menuLinks[0].label,'Lunch menu · 1 item');assert.match(renderRestaurantHome(e),/Lunch menu · 1 item/);assert.equal(model.menuCoverage.total,1);assert.equal(model.sourceMenu,website+'lunch-menu');
 const sparse=structuredClone(e);sparse.profile._enrich.menu=[];sparse.profile._enrich.food_source_coverage.retained_items=0;assert.equal(reviewedFoodMenuLabel(sparse,sparse.profile._enrich).label,'Lunch menu');
 for(const owned of [{profile:{menu:[]}},{profile:{menu_url:null}},{profile:{menu_url:'https://owner.org/menu'}}]){const own={...e,owner_content:owned};assert.equal(reviewedFoodMenuLabel(own,own.profile._enrich),null);}
 const full=structuredClone(e);delete full.profile._enrich.food_source_coverage;assert.equal(restaurantHomeContent(full).menuLinks[0].label,'Full menu');
});

if(process.env.ZOI_VISIBLE_FOOD_PRIVATE)test('actual retained Three Kretans branch/menu candidate stays exact through controlled review payload and public restaurant model',()=>{
 const root=process.env.ZOI_VISIBLE_FOOD_PRIVATE,report=JSON.parse(readFileSync(root+'/three-kretans-candidate.json','utf8')),lease={...JSON.parse(readFileSync(root+'/three-kretans-candidate-row.json','utf8')),lease_id:'isolated-proof-not-a-production-lease'},review={...approval(report),listing_id:lease.listing_id,source_fingerprint:lease.source_fingerprint,prior_machine_sha256:sha256(canonical(lease.existing_enrich))};validateReviewedVisibleFoodCandidate(report,review,lease);const result=reviewedEnrichmentBatch(report,review,lease)[0],home=restaurantHomeContent({id:lease.listing_id,...lease,...report.visible_food_review.canonical_context,profile:{_enrich:{...result.profile,source_url:lease.website,provenance:result.provenance}}});assert.equal(home.menuSections.flatMap(s=>s.items).length,17);assert.equal(home.menuLinks[0].label,'Lunch menu · 17 items');assert.equal(home.menuSections[0].items[0].price,'18.50');assert.equal(result.profile.client_brief.source.scope,'reviewed_official_visible_branch');assert.equal(result.profile.food_source_coverage.entire_business_offering,false);
});


test('ordinary source capture cannot opt into the offline reviewed proof',async()=>{
 const input=setup(),directory=await mkdtemp(join(tmpdir(),'visible-food-ordinary-')),calls=[];
 try{await assert.rejects(()=>captureSourceHTML(input.row,{directory,identityReview:input.identityReview,session:{stats:{},sourceFetch:async url=>{calls.push(url);return{status:200,url,text:url===website?input.branchDocument.html:input.menuDocument.html};}}}),/source_html_no_useful_fields/);assert.deepEqual(calls,[website]);}
 finally{await rm(directory,{recursive:true,force:true});}
});

test('manual review refuses owner-user changes and incomplete actual sample projection until guarded canonical context is attached',()=>{
 const report=createReviewedVisibleFoodCandidate(setup());for(const key of ['owner_user_id','owner_workspace_id','primary_category_id','claim_status','category_slug']){const lease=structuredClone(row);delete lease[key];assert.throws(()=>reviewedEnrichmentBatch(report,approval(report),lease),/review_context_changed/);}
 const owned=setup();owned.row.owner_user_id='22222222-2222-4222-8222-222222222222';assert.throws(()=>createReviewedVisibleFoodCandidate(owned),/eligible_canonical_record_required/);
});

const manualResult=()=>{const report=createReviewedVisibleFoodCandidate(setup());return reviewedEnrichmentBatch(report,approval(report),row)[0];};
test('current receipt validates complete canonical context and rejects unknown or forged server validity',()=>{
 const e=entity(manualResult());assert.equal(reviewedFoodReceiptCurrent(e),true);const projected={...e,reviewed_food_receipt_current:true};for(const key of ['primary_category_id','owner_user_id','owner_workspace_id','claim_status'])delete projected[key];assert.equal(reviewedFoodReceiptCurrent(projected),true);delete projected.reviewed_food_receipt_current;assert.equal(reviewedFoodReceiptCurrent(projected),false);
 for(const patch of [{address:'9 Other Street'},{city:'Perth'},{country:'Australia'},{name:'Other business'},{owner_user_id:'owner'},{claim_status:'claimed'},{primary_category_id:20},{reviewed_food_receipt_current:false}]){const bad={...e,...patch};if(!Object.hasOwn(patch,'reviewed_food_receipt_current'))bad.reviewed_food_receipt_current=true;assert.equal(reviewedFoodReceiptCurrent(bad),false);assert.equal(sourceIdentityContentHeld(bad),true);assert.equal(restaurantHomeContent(bad)?.menuSections.length||0,0);}
 const bare=structuredClone(e);bare.website=bare.website.replace(/\/$/,'');bare.profile._enrich.source_identity.canonical_context.website=bare.website;assert.equal(reviewedFoodReceiptCurrent(bare),true);assert.equal(sourceIdentityContentHeld(bare),false);
 const rawOverride={...e,reviewed_food_receipt_current:false,profile:{...e.profile,reviewed_food_receipt_current:true}};assert.equal(reviewedFoodReceiptCurrent(rawOverride),false);
});

test('automatic worker executes no source access for a manual receipt and emits only canonical error-preservation metadata',async()=>{
 const result=manualResult(),source=readFileSync(new URL('../../supabase/functions/zoi-enrich/index.ts',import.meta.url),'utf8');
 for(const patch of [{},{crawl_status:'error',last_error:'source_http_403'}]){const lease={...row,existing_enrich:{...result.profile,source_url:website,provenance:result.provenance,...patch}},before=structuredClone(lease.existing_enrich);let handler,batch;let sourceCalls=0;
  const deps={dnsState:()=>({status:'controlled-no-dns'}),boundedIO:async(_deadline,_timeout,fn)=>fn(new AbortController().signal),reviewedFoodDeferralProfile,prepareClientBrief,TextEncoder,INVOCATION_MS:110000,RPC_MS:15000,Deno:{serve:fn=>handler=fn},authorised:()=>true,ENABLED:true,BATCH:1,enrichmentSample,confirmedEnrichmentReceipts,Response,Date,URL,vet:async()=>{sourceCalls++;throw Error('must_not_fetch');},sbRpc:async(fn,args)=>{if(fn==='enrich_admission_release'){assert.ok(Array.isArray(batch),'release follows known apply');assert.equal(args.p_lease,batch[0].lease_id);return{ok:true,released:true};}if(fn.endsWith('_lease'))return[lease];batch=args.p_batch;return batch.map(x=>({slug:x.slug,applied:true}));}};
  new Function(...Object.keys(deps),stripTypeScriptTypes(source.slice(source.indexOf('Deno.serve('))))(...Object.values(deps));const response=await handler(new Request('https://worker.test',{method:'POST',body:'{}'}));assert.equal(response.status,200);assert.equal(sourceCalls,0);assert.deepEqual(batch,[{slug:row.slug,website,lease_id:row.lease_id,profile:{crawl_status:'error',last_error:patch.last_error||'reviewed_visible_food_requires_review'},provenance:{}}]);assert.deepEqual(lease.existing_enrich,before);
 }
});

test('automatic rendered lane defers before browser source work and never promotes manual receipts',async()=>{
 const result=manualResult(),lease={...row,existing_enrich:{...result.profile,source_url:website,provenance:result.provenance}};
 const payload=automaticRenderedPayload(lease,{source_fingerprint:row.source_fingerprint},'a'.repeat(64));assert.deepEqual(payload.profile,{crawl_status:'error',last_error:'reviewed_visible_food_requires_review'});assert.deepEqual(payload.provenance,{});
 const directory=await mkdtemp(join(tmpdir(),'manual-render-deferral-'));let rendered=0;let applied;const calls=[];
 try{await runRenderQueue({directory,env:{SUPABASE_SECRET_KEY:'sb_secret_controlled_fixture'},preflight:async()=>{},requestOverride:{enabled:true,expires_at:new Date(Date.now()+60000).toISOString(),max_listings_per_run:3},render:async()=>{rendered++;throw Error('must_not_fetch');},fetchImpl:async(url,options)=>{calls.push(url);if(url.endsWith('enrich_source_queue_lease'))return Response.json([lease]);applied=JSON.parse(options.body).p_batch;return Response.json(applied.map(x=>({slug:x.slug,applied:true})));},log:()=>{}});assert.equal(rendered,0);assert.equal(calls.length,2);assert.deepEqual(applied[0].profile,payload.profile);}
 finally{await rm(directory,{recursive:true,force:true});}
});

test('review-needed lifecycle retains public facts without retimestamp and real errors/holds remain withheld',()=>{
 const e=entity(manualResult()),oldProof=e.profile._enrich.provenance,oldChecked=e.profile._enrich.checked_at;
 Object.assign(e.profile._enrich,{...reviewedFoodDeferralProfile(e.profile._enrich),last_attempt_at:'2026-10-15T15:00:00Z'});assert.equal(sourceIdentityContentHeld(e),false);assert.equal(restaurantHomeContent(e).menuSections[0].items[0].name,'Lunch Pikilia');assert.ok(briefHomeDesign(e));assert.deepEqual(e.profile._enrich.provenance,oldProof);assert.equal(e.profile._enrich.checked_at,oldChecked);
 for(const patch of [{last_error:'network_failed'},{blocked:true},{scope_review_required:true},{source_challenge:true}]){const bad=structuredClone(e);Object.assign(bad.profile._enrich,patch);assert.equal(sourceIdentityContentHeld(bad),true);assert.equal(restaurantHomeContent(bad).menuSections.length,0);}
});

test('fresh explicit independent review may replace only its own still-current manual review deferral',()=>{
 const input=setup(),prior=manualResult();input.row.existing_enrich={...prior.profile,provenance:prior.provenance,source_url:website,...reviewedFoodDeferralProfile(prior.profile),_lease_source_context:context};input.identityReview.prior_machine_sha256=sha256(canonical(input.row.existing_enrich));const report=createReviewedVisibleFoodCandidate(input),review={...approval(report),prior_machine_sha256:sha256(canonical(input.row.existing_enrich))};const refreshed=reviewedEnrichmentBatch(report,review,input.row)[0];assert.equal(refreshed.profile.crawl_status,'ok');assert.equal(refreshed.profile.description,'Prior reviewed copy');assert.equal(refreshed.provenance.description,'prior-source-proof');assert.equal(refreshed.profile.client_brief.description,null);
 for(const patch of [{last_error:'network_failed'},{source_challenge:true},{blocked_reason:'source_scope_mismatch'}]){const bad=structuredClone(input);Object.assign(bad.row.existing_enrich,patch);bad.identityReview.prior_machine_sha256=sha256(canonical(bad.row.existing_enrich));assert.throws(()=>createReviewedVisibleFoodCandidate(bad),/source_hold_review_required/);}
});

if(process.env.ZOI_VISIBLE_FOOD_BROWSER_OUTPUT&&process.env.ZOI_VISIBLE_FOOD_PRIVATE)test('retained Three Kretans lunch candidate exercises desktop/mobile menu search reveal source handoff and question draft offline',async()=>{
 const privateRoot=process.env.ZOI_VISIBLE_FOOD_PRIVATE,report=JSON.parse(await readFile(privateRoot+'/three-kretans-candidate.json','utf8')),lease={...JSON.parse(await readFile(privateRoot+'/three-kretans-candidate-row.json','utf8')),lease_id:'isolated-browser-proof-only'},review={...approval(report),listing_id:lease.listing_id,source_fingerprint:lease.source_fingerprint,prior_machine_sha256:sha256(canonical(lease.existing_enrich))},result=reviewedEnrichmentBatch(report,review,lease)[0],e={id:lease.listing_id,...lease,...report.visible_food_review.canonical_context,profile:{_enrich:{...result.profile,source_url:lease.website,provenance:result.provenance,checked_at:'2026-10-15'}}},html=renderRestaurantHome(e),repo=resolve(fileURLToPath(new URL('../..',import.meta.url)));
 const output=process.env.ZOI_VISIBLE_FOOD_BROWSER_OUTPUT;await mkdir(output,{recursive:true,mode:0o700});const server=createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end(html);}const file=resolve(repo,'.'+decodeURIComponent(new URL(req.url,'http://fixture.test').pathname));if(!file.startsWith(repo+sep)||!(file.includes(sep+'assets'+sep)||file.startsWith(repo+sep+'supabase'+sep+'functions'+sep+'zoi-enrich'+sep)&&extname(file)==='.js')){res.statusCode=404;return res.end();}res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.css':'text/css'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const {chromium}=await import(process.env.ZOI_PLAYWRIGHT_MODULE||'/workspaces/zoi-food-home-work/node_modules/.deno/playwright-core@1.63.0/node_modules/playwright-core/index.mjs'),browser=await chromium.launch({executablePath:process.env.ZOI_CHROMIUM||'/home/codespace/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',headless:true,chromiumSandbox:true});const origin='http://127.0.0.1:'+server.address().port,outcomes=[];
 try{for(const width of [1440,390]){const page=await browser.newPage({viewport:{width,height:920},reducedMotion:'reduce'}),errors=[],external=[];page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():(external.push(route.request().url()),route.abort()));await page.goto(origin,{waitUntil:'networkidle'});assert.equal(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth),true);await page.locator('#offerings').scrollIntoViewIfNeeded();assert.equal(await page.locator('[data-food-item]:visible').count(),12);await page.locator('[data-food-all]').click();assert.deepEqual(errors,[]);assert.equal(await page.locator('[data-food-item]:visible').count(),17);const tail=report.profile.menu[0].items.at(-1).name;await page.locator('[name="food-query"]').fill(tail);assert.ok(await page.locator('[data-food-item]:visible').count()>=1);assert.ok((await page.locator('[data-food-item]:visible').allTextContents()).some(text=>text.includes(tail)));await page.locator('[data-food-menu] button[type="reset"]').click();await page.locator('[data-menu="0"]').click();assert.equal(await page.locator('dialog.restaurant-dialog h2').textContent(),'Lunch menu · 17 items');assert.equal(await page.locator('dialog.restaurant-dialog a[href="https://threekretans.com/lunch-menu"]').count(),1);await page.keyboard.press('Escape');assert.equal(await page.locator('dialog.restaurant-dialog').evaluate(node=>node.open),false);await page.locator('[data-food-question="0:0"]').click();assert.match(await page.locator('dialog.restaurant-dialog').textContent(),/Nothing has been sent, ordered or reserved/);await page.keyboard.press('Escape');await page.locator('#offerings').evaluate(node=>node.scrollIntoView({block:'start'}));await page.screenshot({path:output+'/three-kretans-'+width+'-lunch.png'});assert.deepEqual(errors,[]);outcomes.push({width,source_items:17,initial_visible:12,revealed:17,exact_tail_search:true,scoped_source_label:true,original_menu_href:true,question_draft_no_send:true,escape_closes:true,horizontal_overflow:false,page_errors:errors,external_source_requests:0,blocked_external_resource_urls:[...new Set(external)],scope:'Controlled reviewed candidate through actual renderer/client; media network blocked and not a production/owner/provider acceptance'});await page.close();}
 await writeFile(output+'/outcomes.json',JSON.stringify(outcomes,null,2)+'\n',{flag:'wx',mode:0o400});
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});

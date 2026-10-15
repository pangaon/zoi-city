import {normalizeProfile} from '../../mobile/src/profile.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';
import {sourceCopyPlaceholder,sourceCopyProfile,retainedSourceCopy,buildClientBrief} from '../../assets/enrichment/client-brief.mjs';
import {extractRenderedSource as extract,extractorHash} from '../../scripts/enrichment/extractor.mjs';
import {captureSourceHTML,sourceHTMLRecipeHash} from '../../scripts/enrichment/source-html.mjs';
import {reviewedEnrichmentBatch} from '../../scripts/enrichment/reviewed-batch.mjs';
import {automaticRenderedPayload} from '../../scripts/enrichment/render-queue.mjs';
import {canonical,sha256} from '../../scripts/quality/evidence.mjs';
import {sourceClientIdentity,prepareClientBrief} from '../../supabase/functions/zoi-enrich/_brief.js';
import {assessMachineSourceIdentity} from '../../supabase/functions/zoi-enrich/_source-identity.js';
import {extractStructuredServices,structuredSourceContextMatches} from '../../supabase/functions/zoi-enrich/_services.js';
import {hospitalitySupplements,hospitalitySourceMatches,validHospitalityFields} from '../../supabase/functions/zoi-enrich/_hospitality.js';
import {memberLeaseGuard} from '../../supabase/functions/zoi-enrich/_member.js';
import {confirmedEnrichmentReceipts,enrichmentSample} from '../../supabase/functions/zoi-enrich/_receipts.js';
import {inspectSourceDocument} from '../../supabase/functions/zoi-enrich/_document-quality.js';
import {safeProfile} from '../../api/_verticals.js';
import {restaurantHomeContent} from '../../api/_restaurant-home.js';
import {bakeryHomeContent} from '../../api/_bakery-home.js';

const website='https://bakery.org/',context={city:'London',country:'United Kingdom',address:'1 Main Street'},row={listing_id:'11111111-1111-4111-8111-111111111111',slug:'source-bakery',name:'Source Bakery',entity_type:'business',website,lease_id:'controlled-lease',source_fingerprint:'canonical-context-fingerprint',owner_managed:false,owner_workspace_id:null,existing_enrich:{source_url:website,_lease_source_context:context,description:'Useful previous source copy',tagline:'Previous short copy',provenance:{description:'prior-source-proof',tagline:'prior-tagline-proof'}}};
const home=(description='...',tagline='null',standard='')=>'<html><head><title>Source Bakery</title><meta property="og:description" content="'+description+'"><meta property="og:site_name" content="'+tagline+'"><meta name="description" content="'+standard+'"></head><body><script type="application/ld+json">'+JSON.stringify({'@type':'Bakery',name:row.name,url:website,address:{streetAddress:context.address,addressLocality:context.city,addressCountry:'GB'}})+'</script><h1>Source Bakery</h1><p>Source Bakery publishes its food and contact details. Please contact the bakery about current ingredients, food availability and arrangements.</p><a href="tel:+442012341234">Call</a></body></html>';
async function capture(fn,record=row,html=home()){const directory=await mkdtemp(join(tmpdir(),'source-copy-'));try{return await fn(await captureSourceHTML(record,{directory,session:{stats:{},sourceFetch:async url=>({status:200,url,text:html})}}));}finally{await rm(directory,{recursive:true,force:true});}}
const review=(report,lease=row)=>({listing_id:lease.listing_id,source_fingerprint:lease.source_fingerprint,report_sha256:sha256(canonical(report)),identity_confirmed:true,images_confirmed:true,reviewer:'controlled-independent-review',reviewed_at:'2026-10-15T14:00:00Z',approved_image_hashes:[],prior_machine_sha256:sha256(canonical(lease.existing_enrich)),food_offering_confirmed:true});
const rendered=(profile={description:'...',tagline:'null',phone:'+442012341234'})=>({schema:1,capture_kind:'rendered',listing_id:row.listing_id,website,source_fingerprint:row.source_fingerprint,source:{url:website,http_status:200,sha256:'a'.repeat(64)},render:{url:website,title:row.name,sha256:'b'.repeat(64)},profile,aggregator:false});

test('only entire literal source sentinels are placeholders; substantive short copy and names survive',()=>{
 for(const value of ['...','…',' null ','NULL','undefined','[object Object]'])assert.equal(sourceCopyPlaceholder(value),true);
 for(const value of ['Null Studio','Undefined Records','Fresh daily','No fuss.','null values explained','...and more','None','TBD','Coming soon','0','N/A',null,''])assert.equal(sourceCopyPlaceholder(value),false);
 assert.deepEqual(sourceCopyProfile({description:'...',tagline:'null',name:'Null',phone:'undefined'}),{name:'Null',phone:'undefined'});
});

test('actual extractor filters placeholders and falls through to valid lower-priority metadata',()=>{
 const empty=extract(home(),website);assert.equal(empty.profile.description,undefined);assert.equal(empty.profile.tagline,undefined);assert.equal(empty.provenance.description,undefined);
 const valid=extract(home('...','Fresh daily','Useful standard description'),website);assert.equal(valid.profile.description,'Useful standard description');assert.equal(valid.provenance.description,'meta');assert.equal(valid.profile.tagline,'Fresh daily');
 const jsonld=home('Useful OG description').replace('"@type":"Bakery"','"description":"undefined","slogan":"...","@type":"Bakery"');assert.equal(extract(jsonld,website).profile.description,'Useful OG description');
});

test('capture and both reviewed lanes cannot revive pre-filter placeholder reports',()=>capture(report=>{
 assert.equal(report.profile.description,undefined);assert.equal(report.profile.tagline,undefined);assert.equal(report.capture_recipe_sha256,sourceHTMLRecipeHash);assert.equal(report.extractor_sha256,extractorHash);
 for(const candidate of [{...report,profile:{...report.profile,description:'...',tagline:'null'}},rendered()]){
  const result=reviewedEnrichmentBatch(candidate,review(candidate),row)[0];assert.equal(result.profile.description,row.existing_enrich.description);assert.equal(result.profile.tagline,row.existing_enrich.tagline);assert.equal(result.provenance.description,'prior-source-proof');assert.equal(result.provenance.tagline,'prior-tagline-proof');
  const approval=review(candidate);approval.approved_fields={description:'undefined'};assert.throws(()=>reviewedEnrichmentBatch(candidate,approval,row),/unapproved_review_field/);
 }
}));

test('automatic rendered imports retain eligible old copy with its old provenance',()=>{
 const result=automaticRenderedPayload(row,rendered(),'c'.repeat(64));assert.equal(result.profile.description,'Useful previous source copy');assert.equal(result.provenance.description,'prior-source-proof');assert.equal(result.profile.tagline,'Previous short copy');
});

test('stale held unknown and owner-managed sources cannot lend prior copy in any merge helper',()=>{
 const patches=[{source_url:'https://other.org/'},{source_url:'https://bakery.org:444/'},{source_identity:{verification:'exact_name_typed_jsonld',name:'Other bakery'}},{source_identity:{verification:'exact_name_typed_jsonld',expected_entity_type:'artist'}},{source_url:null},{source_url:undefined},{blocked:true},{crawl_status:'error'},{source_challenge:true},{scope_review_required:'true'},{identity_scope:'organization'},{member:{}},{source_kind:'association_member'},{source_identity:{verification:'entity_family_review_required'}}];
 for(const patch of patches){const lease=structuredClone(row);Object.assign(lease.existing_enrich,patch);assert.deepEqual(retainedSourceCopy(lease,{},website),{fields:{},provenance:{}});const report=rendered(),result=reviewedEnrichmentBatch(report,review(report,lease),lease)[0];assert.equal(result.profile.description,undefined);assert.equal(result.provenance.description,undefined);const automatic=automaticRenderedPayload(lease,report,'c'.repeat(64));assert.equal(automatic.profile.description,undefined);assert.equal(automatic.provenance.description,undefined);}
 for(const patch of [{owner_managed:true},{owner_workspace_id:'owner'}])assert.deepEqual(retainedSourceCopy({...row,...patch},{},website),{fields:{},provenance:{}});
 assert.deepEqual(retainedSourceCopy(row,{},website+'other-branch'),{fields:{},provenance:{}});
 assert.deepEqual(retainedSourceCopy(row,{scope_review_required:true},website),{fields:{},provenance:{}});
});

test('explicit clears and fresh good copy remain distinct from placeholder source values',()=>{
 assert.deepEqual(retainedSourceCopy(row,{description:null,tagline:''},website),{fields:{},provenance:{}});
 const report=rendered({description:'Fresh short copy',tagline:'Fresh daily',phone:'+442012341234'}),result=reviewedEnrichmentBatch(report,review(report),row)[0];assert.equal(result.profile.description,'Fresh short copy');assert.match(result.provenance.description,/rendered-official-source/);
 const clear=review(report);clear.approved_fields={description:null};assert.equal(reviewedEnrichmentBatch(report,clear,row)[0].profile.description,null);
});

test('a fresh brief never labels retained copy as freshly researched',()=>{
 const result={slug:row.slug,website,lease_id:row.lease_id,profile:{description:'...',tagline:'null',phone:'+442012341234',source_identity:sourceClientIdentity(row,home(),website)},provenance:{description:'bad-new-placeholder',tagline:'bad-new-placeholder',source_identity:'exact_name_typed_jsonld',phone:'new-source-phone'}};
 prepareClientBrief([result],[row],'2026-10-15T14:00:00Z');assert.equal(result.profile.description,'Useful previous source copy');assert.equal(result.provenance.description,'prior-source-proof');assert.equal(result.profile.client_brief.description,null);assert.equal(result.profile.client_brief.source.identity_match,true);
 const direct=buildClientBrief({listing:row,profile:{description:'...'},provenance:{description:'old-bad-import'},sourceURL:website});assert.equal(direct.description,null);
});

test('public fallback filters machine placeholders across families and preserves owner/raw values and clears',()=>{
 for(const category_slug of ['restaurants','bakeries','orthodox-churches','lawyers']){
  const e={id:row.listing_id,slug:row.slug,name:'Null Studio',website,entity_type:'business',category_slug,profile:{_enrich:{source_url:website,description:'...',tagline:'undefined',provenance:{description:'bad-import'}}}};
  assert.equal(safeProfile(e).description,undefined);assert.equal(safeProfile(e).tagline,undefined);assert.equal(safeProfile(e)._from.description,undefined);
  assert.equal(safeProfile({...e,profile:{...e.profile,description:'...',tagline:null}}).description,'...');assert.equal(safeProfile({...e,profile:{...e.profile,description:null}}).description,null);
  if(['restaurants','bakeries'].includes(category_slug)){const model=category_slug==='restaurants'?restaurantHomeContent:bakeryHomeContent;assert.notEqual(model(e).description,'...');for(const ownerValue of [null,'','Owner short copy','...'])assert.equal(model({...e,owner_content:{description:ownerValue}}).description,ownerValue||'');}
 }
});

test('actual worker payload preserves prior copy and provenance without new brief evidence',async()=>{
 const source=readFileSync(new URL('../../supabase/functions/zoi-enrich/index.ts',import.meta.url),'utf8');let handler,batch;
 const deps={sourceCopyPlaceholder,assessMachineSourceIdentity,sourceClientIdentity,prepareClientBrief,extractStructuredServices,structuredSourceContextMatches,hospitalitySupplements,hospitalitySourceMatches,validHospitalityFields,crypto:webcrypto,TextEncoder,INVOCATION_MS:110000,RPC_MS:15000,TIMEOUT_MS:8000,boundedIO:async(_d,_m,fn)=>fn(new AbortController().signal),Deno:{serve:fn=>handler=fn},authorised:()=>true,ENABLED:true,BATCH:1,enrichmentSample,memberLeaseGuard,confirmedEnrichmentReceipts,inspectSourceDocument,Response,Date,URL,dnsState:()=>true,vet:async url=>({url:new URL(url)}),robotsAllows:async()=>true,fetchDoc:async()=>({doc:home(),finalUrl:website}),sbRpc:async(fn,args)=>{if(fn.endsWith('_lease'))return[row];batch=args.p_batch;return batch.map(x=>({slug:x.slug,applied:true}));},extract,supplementaryPages:()=>[],imageIdentity:x=>x};
 new Function(...Object.keys(deps),stripTypeScriptTypes(source.slice(source.indexOf('Deno.serve('))))(...Object.values(deps));const response=await handler(new Request('https://worker.test',{method:'POST',body:'{}'}));assert.equal(response.status,200);assert.equal(batch[0].profile.description,'Useful previous source copy');assert.equal(batch[0].profile.tagline,'Previous short copy');assert.equal(batch[0].provenance.description,'prior-source-proof');assert.equal(batch[0].profile.client_brief.description,null);assert.equal(batch[0].profile.client_brief.progress.acceptance,'not_reviewed');assert.ok(!Object.hasOwn(batch[0].profile,'_lease_source_context'));
});

if(process.env.ZOI_SOURCE_COPY_ACTUAL_HTML)test('actual Hellenic placeholder metadata is excluded without changing menu names',()=>{
 const bytes=readFileSync(process.env.ZOI_SOURCE_COPY_ACTUAL_HTML);assert.equal(sha256(bytes),'a3f6a5b1c4c78f4a66283fdea52e3eca11b5dc2b9d151e94ebf07896792b7267');assert.match(bytes.toString(),/content="null" property="og:site_name"/);assert.match(bytes.toString(),/content="\.\.\." property="og:description"/);
 const result=extract(bytes.toString(),'https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu');assert.equal(result.profile.description,undefined);assert.equal(result.profile.tagline,undefined);assert.equal(result.profile.menu.flatMap(s=>s.items).length,151);
});


test('retaining prior copy near the shared payload budget uses canonical error preservation',()=>{
 const result={slug:row.slug,website,lease_id:row.lease_id,profile:{description:'...',phone:'+442012341234',padding:'x'.repeat(1949800)},provenance:{phone:'new-source'}};
 prepareClientBrief([result],[row]);assert.deepEqual(result.profile,{crawl_status:'error',last_error:'source_copy_retention_payload_limit'});assert.deepEqual(result.provenance,{});
});


test('source HTML reviewed lane excludes held or unknown prior copy without relabeling it fresh',()=>capture(report=>{
 for(const patch of [{source_url:null},{source_url:'https://other.org/'},{blocked:true},{scope_review_required:true},{source_identity:{verification:'exact_name_typed_jsonld',name:'Different venue'}}]){
  const lease=structuredClone(row);Object.assign(lease.existing_enrich,patch);const candidate={...report,profile:{...report.profile,description:'...',tagline:'undefined'}},result=reviewedEnrichmentBatch(candidate,review(candidate,lease),lease)[0];assert.equal(result.profile.description,undefined);assert.equal(result.profile.tagline,undefined);assert.equal(result.provenance.description,undefined);assert.equal(result.provenance.tagline,undefined);
 }
}));


test('eligible prior copy is preserved exactly without a new historical length truncation',()=>{
 const lease=structuredClone(row);lease.existing_enrich.description='Useful prior copy '.repeat(90);lease.existing_enrich.tagline='Historical source wording '.repeat(12);const result=retainedSourceCopy(lease,{},website);assert.equal(result.fields.description,lease.existing_enrich.description);assert.equal(result.fields.tagline,lease.existing_enrich.tagline);assert.equal(result.provenance.description,'prior-source-proof');
});


test('actual native normalizer filters legacy machine placeholders and preserves owner/raw values',()=>{
 const entity={id:row.listing_id,name:'Null Studio',slug:row.slug,entity_type:'business',website,profile:{_enrich:{source_url:website,description:'...',tagline:'undefined'}}},clean=normalizeProfile(entity);assert.equal(clean.name,'Null Studio');assert.equal(clean.description,'');assert.equal(clean.profile.description,undefined);assert.equal(clean.profile.tagline,undefined);
 for(const value of [null,'','Owner short copy','...']){
  assert.equal(normalizeProfile({...entity,profile:{...entity.profile,description:value,tagline:value}}).profile.description,value);
  assert.equal(normalizeProfile({...entity,owner_content:{profile:{description:value,tagline:value}}}).profile.description,value);
 }
 assert.equal(normalizeProfile({...entity,profile:{_enrich:{source_url:website,description:'Fresh daily',tagline:'Null Studio'}}}).description,'Fresh daily');
});

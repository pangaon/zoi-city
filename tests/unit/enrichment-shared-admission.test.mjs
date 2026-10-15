import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {confirmedEnrichmentReceipts,enrichmentSample} from '../../supabase/functions/zoi-enrich/_receipts.js';
import {prepareClientBrief} from '../../supabase/functions/zoi-enrich/_brief.js';
import {reviewedFoodDeferralProfile} from '../../assets/enrichment/client-brief.mjs';
const source=readFileSync(new URL('../../supabase/functions/zoi-enrich/index.ts',import.meta.url),'utf8');
const lease='20000000-0000-4000-8000-000000000001';
const rows=Array.from({length:3},(_,i)=>({slug:'source-'+i,website:'https://source.example/'+i,lease_id:lease,existing_enrich:{phone:'OLD'}}));
function harness(options={}) {
 let handler;const events=[];
 const deps={Deno:{serve:fn=>handler=fn},INVOCATION_MS:110000,RPC_MS:15000,TIMEOUT_MS:8000,BATCH:3,ENABLED:options.enabled!==false,authorised:()=>options.authorized!==false,enrichmentSample,confirmedEnrichmentReceipts,prepareClientBrief,reviewedFoodDeferralProfile,Date,Response,URL,
 boundedIO:async(_deadline,_ms,work)=>work(new AbortController().signal),
 memberLeaseGuard:()=>({handled:false}),vet:async()=>{events.push('vet');return{why:'test-refusal'};},dnsState:()=>true,
 sbRpc:async(fn,args)=>{events.push({fn,args});if(fn.endsWith('_lease')){if(options.leaseError)throw Error('lease timeout');return options.rows??rows;}if(fn==='enrich_apply'){if(options.applyError)throw Error('unknown apply');return options.receipts??(options.rows??rows).map(r=>({slug:r.slug,applied:true}));}if(fn==='enrich_admission_release'){if(options.releaseError)throw Error('release timeout');return options.releaseResult??{ok:true,released:true};}assert.fail('unexpected RPC '+fn);},
 fetch:()=>assert.fail('source/provider fetch on refused fixture')};
 new Function(...Object.keys(deps),stripTypeScriptTypes(source.slice(source.indexOf('Deno.serve('))))(...Object.values(deps));
 return{events,run:async(body={})=>{const r=await handler(new Request('https://worker.example/',{method:'POST',body:JSON.stringify(body)}));return{status:r.status,body:await r.json()};}};
}
test('actual handler clamps scheduled limit40/200 to3 before canonical lease and releases only after exact known apply',async()=>{
 for(const limit of[40,200,999]){const h=harness(),r=await h.run({limit});assert.equal(r.status,200);assert.equal(r.body.applied,3);assert.equal(h.events[0].args.p_limit,3);assert.deepEqual(h.events.filter(x=>x.fn).map(x=>x.fn),['enrich_queue_lease','enrich_apply','enrich_admission_release']);assert.deepEqual(h.events.at(-1).args,{p_lease:lease});}
});
test('sample and ordinary worker lanes use the same server reservation release contract',async()=>{
 const h=harness(),r=await h.run({sample_ids:['10000000-0000-4000-8000-000000000001']});assert.equal(r.status,200);assert.equal(h.events[0].fn,'enrich_sample_lease');assert.equal(h.events.at(-1).fn,'enrich_admission_release');
});
test('refused shared admission/no candidates performs no source work, write or release',async()=>{
 const h=harness({rows:[]}),r=await h.run();assert.equal(r.status,200);assert.equal(r.body.queued,0);assert.equal(r.body.applied,0);assert.equal(h.events.length,1);assert.equal(h.events[0].fn,'enrich_queue_lease');
});
test('unknown lease outcome never starts source work or tries to release/refund',async()=>{
 const h=harness({leaseError:true}),r=await h.run();assert.equal(r.status,500);assert.equal(r.body.reconciliation_required,true);assert.equal(h.events.length,1);
});
test('unknown apply outcome retains server flight; no automatic apply or release retry',async()=>{
 const h=harness({applyError:true}),r=await h.run();assert.equal(r.status,503);assert.equal(r.body.outcome,'unknown');assert.equal(r.body.reconciliation_required,true);assert.deepEqual(h.events.filter(x=>x.fn).map(x=>x.fn),['enrich_queue_lease','enrich_apply']);
});
test('missing/duplicate/malformed canonical receipts retain flight rather than claiming known completion',async()=>{
 for(const receipts of[[],[{slug:rows[0].slug,applied:true}],rows.map(r=>({slug:r.slug,applied:'true'})),rows.map(()=>({slug:rows[0].slug,applied:true}))]){const h=harness({receipts}),r=await h.run();assert.equal(r.status,503);assert.equal(h.events.some(x=>x.fn==='enrich_admission_release'),false);}
});
test('explicit canonical rejections are known outcomes and release once, while reporting okfalse',async()=>{
 const h=harness({receipts:rows.map(r=>({slug:r.slug,applied:false}))}),r=await h.run();assert.equal(r.status,200);assert.equal(r.body.ok,false);assert.equal(r.body.applied,0);assert.equal(r.body.stats['lease-rejected'],3);assert.equal(h.events.at(-1).fn,'enrich_admission_release');
});
test('release timeout/refusal/unconfirmed body never retries or invents completion',async()=>{
 for(const options of[{releaseError:true},{releaseResult:{}},{releaseResult:{ok:false,released:true}},{releaseResult:{ok:true,released:'true'}}]){const h=harness(options),r=await h.run();assert.equal(r.status,503);assert.equal(r.body.applied,3);assert.equal(r.body.reconciliation_required,true);assert.equal(r.body.error,'enrichment_release_reconciliation_required');assert.equal(h.events.filter(x=>x.fn==='enrich_apply').length,1);assert.equal(h.events.filter(x=>x.fn==='enrich_admission_release').length,1);}
});
test('idempotent matching release result is a known outcome without another source fetch or write',async()=>{
 const h=harness({releaseResult:{ok:true,released:false}}),r=await h.run();assert.equal(r.status,200);assert.equal(r.body.applied,3);assert.equal(h.events.filter(x=>x.fn==='enrich_apply').length,1);
});
test('inconsistent canonical lease IDs cannot release another shared flight',async()=>{
 const h=harness({rows:[rows[0],{...rows[1],lease_id:'30000000-0000-4000-8000-000000000001'}]}),r=await h.run();assert.equal(r.status,503);assert.equal(h.events.some(x=>x.fn==='enrich_admission_release'),false);
});
test('manual reviewed visible Food still defers automatic authority and uses unchanged review-required facts',async()=>{
 const prior={phone:'OLD',source_identity:{verification:'reviewed_official_visible_branch'},client_brief:{status:'approved'},checked_at:'2026-10-14'},h=harness({rows:[{...rows[0],existing_enrich:prior}]}),r=await h.run();assert.equal(r.status,200);assert.equal(h.events.includes('vet'),false);const payload=h.events.find(x=>x.fn==='enrich_apply').args.p_batch[0].profile;assert.deepEqual(payload,reviewedFoodDeferralProfile(prior));assert.equal(h.events.at(-1).fn,'enrich_admission_release');
});
test('unauthorized and disabled callers cannot lease, read source or release',async()=>{
 for(const options of[{authorized:false},{enabled:false}]){const h=harness(options),r=await h.run();assert.ok([401,503].includes(r.status));assert.equal(h.events.length,0);}
});

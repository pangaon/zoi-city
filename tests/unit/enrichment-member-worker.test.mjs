import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {stripTypeScriptTypes} from 'node:module';
import {inspectSourceDocument} from '../../supabase/functions/zoi-enrich/_document-quality.js';
import {memberLeaseGuard} from '../../supabase/functions/zoi-enrich/_member.js';
import {confirmedEnrichmentReceipts,enrichmentSample} from '../../supabase/functions/zoi-enrich/_receipts.js';
const source=fs.readFileSync(new URL('../../supabase/functions/zoi-enrich/index.ts',import.meta.url),'utf8');
const memberURL='https://www.hellenicmedical.ca/profile/atzakis/';
const row={slug:'ageliki-tzakis',website:memberURL,lease_id:'lease',name:'Ageliki Tzakis',entity_type:'professional',existing_enrich:{member:{name:'Ageliki Tzakis',profession:'Registered Nurse'}}};
const doc='<h1>Ageliki (Angie) Tzakis, RN</h1><p>Associate</p><p>Profession: Registered Nurse</p><p>City: East York / Scarborough</p><footer>Practice Phone:9055812440</footer>';
async function run(item,got,overrides={}){let handler,batch,generic=0,supplements=0;const deps={INVOCATION_MS:110000,RPC_MS:15000,TIMEOUT_MS:8000,boundedIO:async(_deadline,_maximum,work)=>work(new AbortController().signal),Deno:{serve:fn=>handler=fn},authorised:()=>true,ENABLED:true,BATCH:1,enrichmentSample,memberLeaseGuard,confirmedEnrichmentReceipts,inspectSourceDocument,Response,Date,URL,dnsState:()=>true,vet:async url=>({url:new URL(url)}),robotsAllows:async()=>true,fetchDoc:async()=>got,sbRpc:async(fn,args)=>{if(fn.endsWith('_lease'))return[item];batch=args.p_batch;return batch.map(x=>({slug:x.slug,applied:true}))},extract:()=>{generic++;return{profile:{menu:[{section:'Actual generic extraction delegated'}]},provenance:{},aggregator:false}},supplementaryPages:()=>{supplements++;return[]},imageIdentity:x=>x,...overrides};new Function(...Object.keys(deps),stripTypeScriptTypes(source.slice(source.indexOf('Deno.serve('))))(...Object.values(deps));const response=await handler(new Request('https://worker.test',{method:'POST',body:'{}'}));assert.equal(response.status,200);return{batch,generic,supplements,result:await response.json()}}
test('actual worker handler takes member branch before generic metadata and supplementary fetches',async()=>{const r=await run(row,{doc,finalUrl:memberURL});assert.equal(r.generic,0);assert.equal(r.supplements,0);assert.equal(r.batch[0].profile.member.profession,'Registered Nurse');assert.equal(r.batch[0].profile.phone,null);assert.deepEqual(r.batch[0].profile.social,{});assert.equal(r.result.stats['member-identity-matched'],1)});
test('challenge and HTTP refusal select database preservation branch',async()=>{for(const got of [{doc:'One moment, please. Request being verified.',finalUrl:memberURL},{error:'http403'}]){const r=await run(row,got);assert.equal(r.generic,0);assert.equal(r.supplements,0);assert.equal(r.batch[0].profile.crawl_status,'error');assert(!('member' in r.batch[0].profile));assert(!('photo_url' in r.batch[0].profile));assert.equal({...row.existing_enrich,...r.batch[0].profile}.member.profession,'Registered Nurse')}});
test('missing lease identity and redirect to unrelated organization fail closed',async()=>{for(const item of [{slug:'old-lease',website:memberURL,lease_id:'lease'},row]){const r=await run(item,{doc:'<h1>Association</h1><img src="banner.jpg">',finalUrl:'https://other-association.example/'});assert.equal(r.generic,0);assert.equal(r.supplements,0);assert.equal(r.batch[0].profile.crawl_status,'error')}});
test('known legal association roots protected but actual organization and ordinary practice proceed',async()=>{const protectedRow={...row,website:'https://hellenicbar.org/',name:'Real Person'};assert.equal((await run(protectedRow,{doc:'Association header',finalUrl:protectedRow.website})).generic,0);for(const item of [{...row,entity_type:'organization'}, {...row,website:'https://real-practice.example/'}]){const r=await run(item,{doc:'Real business',finalUrl:item.website});assert.equal(r.generic,1);assert.equal(r.supplements,1)}});
test('association subdomains and legacy HTTP sources cannot leak organization branding',()=>{for(const website of ['https://members.hellenicbar.org/','http://hcla.ca/']){const g=memberLeaseGuard({...row,website},'<h1>Organization</h1>',website);assert.equal(g.handled,true);assert.equal(g.skipSupplementary,true);assert.equal(g.profile.crawl_status,'error')}});

test('ordinary restaurant refusal, robots and unsafe-host paths preserve prior machine data and stop retries',async()=>{const item={...row,slug:'ordinary-bakery',entity_type:'business',website:'https://bakery.example/',existing_enrich:{photo_urls:['https://bakery.example/room.jpg'],hours:[{day:'mon',open:'09:00',close:'17:00'}]}};for(const [got,overrides,reason]of [[{error:'http403'},{},'http403'],[{}, {robotsAllows:async()=>false},'robots'],[{}, {vet:async()=>({why:'private-ip'})},'private-ip']]){const r=await run(item,got,overrides),p=r.batch[0].profile;assert.equal(p.crawl_status,'error');assert.equal(p.blocked,'true');assert.equal(p.blocked_reason,reason);assert.ok(p.last_error);assert.equal(r.generic,0);assert.equal(r.supplements,0);assert(!Object.hasOwn(p,'photo_urls'));assert(!Object.hasOwn(p,'hours'));}});

test('actual worker prevents institution homepage media and contacts becoming a parish',async()=>{const parish={...row,name:'Parrocchia della Protezione della Madre di Dio',entity_type:'church',website:'https://ortodossia.it',existing_enrich:{phone:'old imported contact'}};const r=await run(parish,{doc:'<head><meta property="og:description" content="Sacra Arcidiocesi Ortodossa Italia"></head><h1>Ortodossia</h1><img src="institution.jpg"><a href="tel:12345">Call diocese</a>',finalUrl:parish.website});assert.equal(r.generic,0);assert.equal(r.supplements,0);assert.equal(r.batch[0].profile.blocked_reason,'source_scope_mismatch');assert.equal(r.batch[0].profile.scope_review_required,true);assert.equal(r.result.stats['source-scope-mismatch'],1);assert.equal(r.result.stats.ok,undefined);assert.equal(Object.hasOwn(r.batch[0].profile,'phone'),false);});

test('ordinary business challenge enters preservation branch with original lease and no useful extraction',async()=>{
 const item={...row,slug:'nostos',entity_type:'business',website:'https://www.nostos-kythera.gr/',name:'Nostos',existing_enrich:{phone:'reviewed contact',photo_urls:['https://www.nostos-kythera.gr/reviewed-room.jpg']}};
 const challenge='<html><head><title>One moment, please...</title></head><body>Please wait while your request is being verified...</body></html>';
 const result=await run(item,{doc:challenge,finalUrl:item.website});
 assert.equal(result.generic,0);assert.equal(result.supplements,0);assert.equal(result.batch.length,1);
 const payload=result.batch[0];assert.equal(payload.lease_id,item.lease_id);assert.equal(payload.website,item.website);assert.equal(payload.slug,item.slug);
 assert.deepEqual(payload.profile,{crawl_status:'error',last_error:'source_challenge'});assert.deepEqual(payload.provenance,{});
 assert.equal(result.result.stats['source-challenge'],1);assert.equal(result.result.stats.ok,undefined);
 assert.equal({...item.existing_enrich,...payload.profile}.phone,'reviewed contact');
});

test('supplementary contact extraction cannot refill a source email conflict',async()=>{
 const item={...row,entity_type:'business',website:'https://bistro.test/',name:'Bistro'};
 for(const conflictOnHome of [true,false]){
 let count=0;
 const conflict={structured:'old@bistro.test',linked:['new@bistro.test'],source_url:item.website};
 const r=await run(item,{doc:'Bistro source',finalUrl:item.website},{
   supplementaryPages:()=>[{purpose:'contact',url:'https://bistro.test/contact'}],
   extract:()=>{const home=++count===1;return {profile:home===conflictOnHome?{email:null,email_conflict:conflict}:{email:'other@bistro.test'},provenance:{email:home===conflictOnHome?'conflicting-source-emails':'mailto-link',email_conflict:'jsonld-and-anchor-review:'+item.website},aggregator:false};}
 });
 assert.equal(r.batch[0].profile.email,null);assert.deepEqual(r.batch[0].profile.email_conflict,conflict);assert.equal(r.batch[0].provenance.email,'conflicting-source-emails');
 }
});

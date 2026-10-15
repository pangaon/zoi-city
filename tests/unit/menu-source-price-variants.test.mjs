import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {extractStructuredMenu,MENU_SOURCE_LIMITS} from '../../supabase/functions/zoi-enrich/_menus.js';
import {captureSourceHTML} from '../../scripts/enrichment/source-html.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sourceFailureReason} from '../../scripts/enrichment/source-errors.mjs';
import {extractRenderedSource} from '../../scripts/enrichment/extractor.mjs';
import {stripTypeScriptTypes} from 'node:module';
import {prepareClientBrief} from '../../supabase/functions/zoi-enrich/_brief.js';
import {memberLeaseGuard} from '../../supabase/functions/zoi-enrich/_member.js';
import {confirmedEnrichmentReceipts,enrichmentSample} from '../../supabase/functions/zoi-enrich/_receipts.js';
import {inspectSourceDocument} from '../../supabase/functions/zoi-enrich/_document-quality.js';
const url='https://menu-source.example/menu';
const item=(name,prices,note='')=>`<div class="food-item-holder"><h3>${name}</h3>${prices.map((p,i)=>`<div class="food-price${i?' multiple-price':''}">${p}</div>`).join('')}<div class="food-item-description">${note}</div></div>`;
const section=items=>`<div class="food-menu-grid-item-content"><h2>Published items</h2>${items.join('')}</div>`;
const extract=items=>extractStructuredMenu(section(items),url);
const flat=result=>result.menu.flatMap(s=>s.items);

test('three source size/price siblings remain one item in literal order',()=>{
 const result=extract([item('Horio Olive Oil',['$18.00/500 ml','$25.00/750 ml','$70.00/3 lt'])]);
 assert.deepEqual(flat(result),[{name:'Horio Olive Oil',price:'$18.00/500 ml | $25.00/750 ml | $70.00/3 lt',note:''}]);
 assert.equal(result.menu_total_items,1);assert.equal(result.menu_truncated,false);
});

test('ordinary single price and absent price retain prior behavior and description',()=>{
 const result=extract([item('Plate',['€ 12.50'],'Published short copy'),item('Ask us',[],'Description')]);
 assert.deepEqual(flat(result),[{name:'Plate',price:'€ 12.50',note:'Published short copy'},{name:'Ask us',price:'',note:'Description'}]);
 assert.equal(result.menu_total_items,2);assert.equal(result.menu_truncated,false);
});

test('generic currencies and HTML entities preserve each complete publisher alternative',()=>{
 const result=extract([item('Tray',['&pound;12.00/Small tray','&pound;24.00/Large tray'],'Serves a group')]);
 assert.deepEqual(flat(result),[{name:'Tray',price:'£12.00/Small tray | £24.00/Large tray',note:'Serves a group'}]);
});

test('long combined prices move intact into note, preserving original description',()=>{
 const prices=['$18.00/'+('a'.repeat(50)),'$25.00/'+('b'.repeat(50))],description='Original publisher description',result=extract([item('Sizes',prices,description)]);
 assert.deepEqual(flat(result),[{name:'Sizes',price:'',note:prices.join(' | ')+' — '+description}]);
 assert.equal(result.menu_total_items,1);assert.equal(result.menu_truncated,false);
});

test('price100 and combined note600 boundaries retain exact content',()=>{
 const p100=['$1/'+('a'.repeat(44)),'$2/'+('b'.repeat(47))];assert.equal(p100.join(' | ').length,100);
 const p=['$1/'+('a'.repeat(60)),'$2/'+('b'.repeat(60))],description='d'.repeat(600-p.join(' | ').length-3),result=extract([item('Price boundary',p100),item('Note boundary',p,description)]);
 assert.equal(flat(result)[0].price,p100.join(' | '));assert.equal(flat(result)[1].note.length,600);assert.equal(result.menu_truncated,false);
});

for(const [label,prices,note] of [
 ['malformed sibling',['$18.00/500 ml','Call for options'],''],
 ['empty sibling',['$18.00/500 ml',''],''],
 ['short prices with oversized description',['$18.00/500 ml','$25.00/750 ml'],'d'.repeat(601)],
 ['oversized sibling',['$18.00/500 ml','$25.00/'+('x'.repeat(600))],''],
 ['combined overflow',['$18.00/'+('a'.repeat(300)),'$25.00/'+('b'.repeat(300))],''],
 ['description overflow',['$18.00/'+('a'.repeat(50)),'$25.00/'+('b'.repeat(50))],'d'.repeat(500)]
]){
 test(`${label} omits the whole item and reports truthful observed total`,()=>{
  const bad=item('Unresolved',prices,note),result=extract([item('Verified',['$9.00']),bad,bad]);
  assert.deepEqual(flat(result),[{name:'Verified',price:'$9.00',note:''}]);assert.equal(result.menu_total_items,2);assert.equal(result.menu_truncated,true);
 });
 test(`${label} with no valid menu uses the held/error category`,()=>{
  assert.throws(()=>extract([item('Unresolved',prices,note)]),{message:'source_menu_price_variants_unresolved'});
  assert.equal(sourceFailureReason(new Error('source_menu_price_variants_unresolved')),'source_menu_price_variants_unresolved');
 });
}

test('nested unrelated price fields are excluded from direct sibling alternatives',()=>{
 const original=item('Dish',['$10.00/Small','$15.00/Large'],'A note<div><div class="food-price">$999.00/Unrelated</div></div>'),result=extract([original]);
 assert.equal(flat(result)[0].price,'$10.00/Small | $15.00/Large');
});

test('canonical menu limits remain unchanged',()=>{
 assert.deepEqual(MENU_SOURCE_LIMITS,{items:300,perSection:300,sections:20,bytes:120000});
});

if(process.env.ZOI_MENU_PRICE_SOURCE)test('exact current Hellenic source retains151 items including all Horio prices',()=>{
 const bytes=readFileSync(process.env.ZOI_MENU_PRICE_SOURCE);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'a3f6a5b1c4c78f4a66283fdea52e3eca11b5dc2b9d151e94ebf07896792b7267');
 const result=extractStructuredMenu(bytes.toString('utf8'),'https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu');
 assert.equal(flat(result).length,151);assert.equal(result.menu_total_items,151);assert.equal(result.menu_truncated,false);assert.equal(result.menu.length,4);
 assert.deepEqual(flat(result).find(x=>x.name==='Horio Olive Oil'),{name:'Horio Olive Oil',price:'$18.00/500 ml | $25.00/750 ml | $70.00/3 lt',note:''});
});


test('actual guarded source capture refuses an unresolved linked menu without producing a reviewable success',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'menu-price-unresolved-')),website='https://bakery.org/',context={city:'London',country:'United Kingdom',address:'1 Main Street'},row={listing_id:'11111111-1111-4111-8111-111111111111',slug:'source-bakery',name:'Source Bakery',entity_type:'business',website,source_fingerprint:'controlled-source-fingerprint',owner_managed:false,owner_workspace_id:null,existing_enrich:{source_url:website,_lease_source_context:context,description:'Useful prior description',menu:[{section:'Old',items:[{name:'Prior verified dish',price:'£8',note:''}]}],provenance:{menu:'prior-reviewed-source'}}};
 const prior=structuredClone(row),home='<title>Source Bakery</title><script type="application/ld+json">'+JSON.stringify({'@type':'Bakery',name:row.name,url:website,address:{streetAddress:context.address,addressLocality:context.city,addressCountry:'GB'}})+'</script><p>Source Bakery publishes its current food menu. Please contact the bakery directly about current ingredients, availability and arrangements.</p><a href="/menu">Menu</a>',child=section([item('Unresolved',['£10/Small','Call for options'])]);
 const session={stats:{},sourceFetch:async url=>({status:200,url,text:url===website?home:child})};
 try{await assert.rejects(()=>captureSourceHTML(row,{directory,session,decoderFactory:async()=>{throw Error('unexpected_decoder');}}),{message:'source_menu_price_variants_unresolved'});assert.deepEqual(row,prior);}
 finally{await rm(directory,{recursive:true,force:true});}
});

test('actual canonical worker emits only error metadata for a wholly unresolved price menu',async()=>{
 const source=readFileSync(new URL('../../supabase/functions/zoi-enrich/index.ts',import.meta.url),'utf8'),website='https://bakery.org/',row={listing_id:'11111111-1111-4111-8111-111111111111',slug:'source-bakery',name:'Source Bakery',entity_type:'business',website,lease_id:'20000000-0000-4000-8000-000000000001',existing_enrich:{description:'Useful prior description',menu:[{section:'Old',items:[{name:'Prior dish',price:'£8',note:''}]}]}},before=structuredClone(row),html='<title>Source Bakery</title><p>Source Bakery publishes its food and current prices here. Contact the bakery for further details and availability.</p>'+section([item('Unresolved',['£10/Small','Call for options'])]);
 let handler,batch;
 const dependencies={prepareClientBrief,memberLeaseGuard,confirmedEnrichmentReceipts,enrichmentSample,inspectSourceDocument,extract:extractRenderedSource,INVOCATION_MS:110000,RPC_MS:15000,TIMEOUT_MS:8000,boundedIO:async(_d,_m,fn)=>fn(new AbortController().signal),Deno:{serve:fn=>handler=fn},authorised:()=>true,ENABLED:true,BATCH:1,Response,Date,URL,dnsState:()=>true,vet:async url=>({url:new URL(url)}),robotsAllows:async()=>true,fetchDoc:async url=>({doc:html,finalUrl:String(url)}),sbRpc:async(fn,args)=>{if(fn==='enrich_admission_release'){assert.ok(Array.isArray(batch),'release follows known apply');assert.equal(args.p_lease,batch[0].lease_id);return{ok:true,released:true};}if(fn.endsWith('_lease'))return[row];batch=args.p_batch;return batch.map(x=>({slug:x.slug,applied:true}));}};
 new Function(...Object.keys(dependencies),stripTypeScriptTypes(source.slice(source.indexOf('Deno.serve('))))(...Object.values(dependencies));
 assert.equal((await handler(new Request('https://worker.test',{method:'POST',body:'{}'}))).status,200);
 assert.equal(batch.length,1);assert.deepEqual(batch[0].profile,{crawl_status:'error',last_error:'Error: source_menu_price_variants_unresolved'});assert.deepEqual(batch[0].provenance,{});assert.equal(batch[0].website,website);assert.equal(batch[0].lease_id,row.lease_id);assert.deepEqual(row,before);
});

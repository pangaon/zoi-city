import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {extractStructuredMenu,MENU_SOURCE_LIMITS} from '../../supabase/functions/zoi-enrich/_menus.js';
const url='https://menu-source.example/menu';
const item=description=>({'@type':'MenuItem',name:'Imiglykos',description,offers:{'@type':'Offer',price:950,priceCurrency:'HUF'}});
const section=(name,items)=>({'@type':'MenuSection',name,hasMenuItem:items});
const html=node=>'<script type="application/ld+json">'+JSON.stringify(node)+'</script>';
const flat=result=>result.menu.flatMap(s=>s.items);

test('same name and price preserve distinct source descriptions without invented variant names',()=>{
 const result=extractStructuredMenu(html(section('Görög borok',[item('félédes vörös'),item('félédes fehér')])),url);
 assert.deepEqual(flat(result),[{name:'Imiglykos',price:'950 HUF',note:'félédes vörös'},{name:'Imiglykos',price:'950 HUF',note:'félédes fehér'}]);assert.equal(result.menu_total_items,2);assert.equal(result.menu_truncated,false);assert.equal(result.menu_source,url);
});

test('exact duplicates and whitespace-equivalent descriptions still collapse; source sections stay distinct',()=>{
 const result=extractStructuredMenu(html({'@type':'Menu',hasMenuSection:[section('Wines',[item('red'),item('red'),item(' red  ')]),section('By the glass',[item('red')])]}),url);
 assert.deepEqual(result.menu.map(s=>({name:s.section,items:s.items.length})),[{name:'Wines',items:1},{name:'By the glass',items:1}]);assert.equal(result.menu_total_items,2);assert.equal(result.menu_truncated,false);
});

test('missing description and empty description are equivalent without erasing a named source variant',()=>{
 const first=item(undefined),result=extractStructuredMenu(html(section('Wines',[first,item(''),item('white')])),url);
 assert.deepEqual(flat(result).map(x=>x.note),['','white']);assert.equal(result.menu_total_items,2);
});

test('variant preservation retains current total and section bounds with truthful truncation',()=>{
 assert.deepEqual(MENU_SOURCE_LIMITS,{items:300,perSection:300,sections:20,bytes:120000});
 const many=extractStructuredMenu(html({'@type':'Menu',hasMenuSection:[section('Published variants1',Array.from({length:160},(_,i)=>item('Published variant '+i))),section('Published variants2',Array.from({length:160},(_,i)=>item('Published variant '+(160+i))))]}),url);
 assert.equal(flat(many).length,300);assert.equal(many.menu_total_items,320);assert.equal(many.menu_truncated,true);
 const sections=extractStructuredMenu(html({'@type':'Menu',hasMenuSection:Array.from({length:21},(_,i)=>section('Section '+i,[item('red'),item('white')]))}),url);
 assert.equal(sections.menu.length,20);assert.equal(flat(sections).length,40);assert.equal(sections.menu_total_items,42);assert.equal(sections.menu_truncated,true);
});

test('oversized traversal arrays keep existing unknown-coverage disposition',()=>{
 const result=extractStructuredMenu(html(section('Published variants',Array.from({length:320},(_,i)=>item('Published variant '+i)))),url);
 assert.equal(flat(result).length,300);assert.equal(result.menu_total_items,undefined);assert.equal(result.menu_truncated,undefined);
});

if(process.env.ZOI_FOOD_VARIANT_SOURCE_DIR)test('actual retained Pyrgos source counts187 while preserving distinct red/white wine nodes',()=>{
 const root=process.env.ZOI_FOOD_VARIANT_SOURCE_DIR,outcomes=JSON.parse(readFileSync(root+'/targeted-menu-outcomes.json','utf8')),source=outcomes.find(x=>x.listing_id==='73212245-381a-4c95-ba90-3a1ef38fcb38'),bytes=readFileSync(root+'/targeted-menus/'+source.decoded_utf8_sha256+'.source.html');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),source.decoded_utf8_sha256);const original=bytes.toString('utf8'),result=extractStructuredMenu(original,source.final_url);
 assert.equal(result.menu_total_items,187);assert.equal(flat(result).length,130);assert.equal(result.menu.length,20);assert.equal(result.menu_truncated,true);
 // The real wine category lies beyond the unchanged20section import bound.
 // Isolate its exact publisher JSON-LD node to exercise equivalence independently
 // of that known limit; no category/price/name/description is generated here.
 const queue=[];for(const match of original.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{queue.push(JSON.parse(match[1]));}catch{}}
 let wine=null,scanned=0;while(queue.length&&scanned++<1000){const n=queue.shift();if(Array.isArray(n)){queue.push(...n);continue;}if(!n||typeof n!=='object')continue;if(n['@type']==='MenuSection'&&n.name==='Görög borok')wine=n;for(const key of ['@graph','mainEntity','hasMenu','menu','hasMenuSection','hasMenuItem'])if(n[key]&&typeof n[key]==='object')queue.push(n[key]);}
 assert(wine);const observed=extractStructuredMenu(html(wine),source.final_url),variants=flat(observed).filter(x=>x.name==='Imiglykos');assert.deepEqual(variants,[{name:'Imiglykos',price:'950 HUF',note:'félédes vörös'},{name:'Imiglykos',price:'950 HUF',note:'félédes fehér'}]);assert.equal(observed.menu_total_items,wine.hasMenuItem.length);assert.equal(observed.menu_truncated,false);
});

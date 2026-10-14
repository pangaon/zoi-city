import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {suggestionHref} from '../../assets/discovery/autocomplete.mjs';
const html=readFileSync(new URL('../../explore/map/index.html',import.meta.url),'utf8');
const start=html.indexOf('search:async function(term,filters,signal)'),end=html.indexOf(',mountAfter:',start);
assert(start>=0&&end>start);
const body=html.slice(start+7,end);
const points=[{s:'athens',n:'Greek Shop',addr:'Οδός Αθηνάς 12',city:'Athens',country:'Greece',t:'business'},{s:'toronto',n:'Actual A',addr:'1 Actual Street',city:'Toronto',country:'Canada',t:'business'},{s:'other',n:'Other',addr:'1 Actual Street',city:'Toronto',country:'Canada',t:'church'}];
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ς/g,'σ');
function search(remote,address=async()=>({rows:[],outside:false})){return vm.runInNewContext('('+body+')',{ALL:points,fold,Set,addressModule:{searchMapAddresses:address},module:{suggestionHref,searchSuggestions:remote}});}
const signal=new AbortController().signal;
test('published address suggestions preserve city/category scope and actual name/address fields',async()=>{const result=await search(async()=>({rows:[],outside:false}))('1 Actual Street',{city:'toronto',country:'CANADA',types:['business']},signal);assert.equal(result.rows.length,1);assert.equal(result.rows[0].slug,'toronto');assert.equal(result.rows[0].name,'Actual A');assert.equal(result.rows[0].address,'1 Actual Street');assert.equal(result.rows[0].href,'/business/toronto');});
test('Greek address queries fold tonos and retain canonical identity',async()=>{const result=await search(async()=>({rows:[],outside:false}))('οδος αθηνας',{},signal);assert.equal(result.rows.length,1);assert.equal(result.rows[0].slug,'athens');});
test('remote unlocated records remain available and duplicate local slugs are suppressed',async()=>{const result=await search(async()=>({rows:[{slug:'toronto',name:'remote duplicate'},{slug:'unlocated',name:'Unlocated place'}],outside:false}))('Actual',{types:['business']},signal);assert.deepEqual(Array.from(result.rows,r=>r.slug),['toronto','unlocated']);});
test('local matches recover remote failure but aborts and absent matches propagate uncertainty',async()=>{const run=search(async()=>{throw Error('unavailable');});assert.equal((await run('Actual',{types:['business']},signal)).rows.length,1);await assert.rejects(()=>run('Not on feed',{},signal),/unavailable/);const aborted=new AbortController();aborted.abort();await assert.rejects(()=>run('Actual',{},aborted.signal),/search_aborted/);});

test('catalogue address source adds unlocated profiles and deduplicates all three sources',async()=>{const address={slug:'unlocated',name:'Unlocated professional',address:'50 Published Lane',href:'/p/unlocated'};const result=await search(async()=>({rows:[{slug:'unlocated',name:'Unlocated professional'}]}),async()=>({rows:[address]}))('50 Published Lane',{},signal);assert.equal(result.rows.length,1);assert.equal(result.rows[0].slug,'unlocated');assert.equal(result.rows[0].address,'50 Published Lane');});
test('failed catalogue address source cannot turn an empty name result into false no-results',async()=>{await assert.rejects(()=>search(async()=>({rows:[]}),async()=>{throw Error('address unavailable');})('50 Published Lane',{},signal),/address unavailable/);});

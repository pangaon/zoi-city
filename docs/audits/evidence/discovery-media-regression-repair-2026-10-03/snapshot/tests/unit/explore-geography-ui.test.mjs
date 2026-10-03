import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as publicListingModel from '../../assets/discovery/public-listing-media.mjs';

const html = readFileSync(new URL('../../explore/index.html', import.meta.url), 'utf8');
const start = html.indexOf('const COUNTRY_ALIAS=');
const end = html.indexOf('/* Build listing links', start);
const context = vm.createContext({});
vm.runInContext(html.slice(start, end), context);
const options = rows => JSON.parse(JSON.stringify(context.cityOptions(rows)));
const normalizer = html.slice(html.indexOf('function normalizeListing('),html.indexOf('let exploreLocality='));
function installSearch(ctx){
  ctx.publicListingModel=publicListingModel;
  vm.runInContext(normalizer,ctx);
  vm.runInContext(html.slice(html.indexOf('let searchVersion=0'),html.indexOf('/* Sorting re-orders')),ctx);
}

test('city selector combines aliases without altering source data', () => {
  const rows = [{ city:'New York', country:'USA', n:7 }, { city:'New York', country:'United States', n:4 }];
  const before = structuredClone(rows);
  assert.deepEqual(options(rows), [{city:'New York', country:'United States', label:'New York · United States'}]);
  assert.deepEqual(rows, before);
});
test('unknown-country duplicate stays searchable without invented geography', () => {
  assert.deepEqual(options([{city:'Athens',country:'Greece'}, {city:'Athens',country:null}]),
    [{city:'Athens', country:'', label:'Athens · All countries'}]);
});
test('cities shared across countries remain one unambiguous broad search', () => {
  assert.deepEqual(options([{city:'London',country:'United Kingdom'}, {city:'London',country:'Canada'}]),
    [{city:'London', country:'', label:'London · All countries'}]);
  assert.deepEqual(options([null,{city:'  '}] ), []);
});
test('browse index contains no broken geography paths or stale counts', () => {
  const index=html.slice(html.indexOf('<section class="ph-index">'));
  assert.doesNotMatch(index, /href="\/in\/\//);
  assert.doesNotMatch(index, /href="\/in\/(?:us|usa|cyprus\/)"/);
  assert.doesNotMatch(index, /<b>[\d,]+<\/b>/);
  assert.match(index, /href="\/in\/united-states\/texas"/);
});

test('latest search wins when older network responses arrive afterward', async () => {
  const nodes=new Map();
  const node=id=>{if(!nodes.has(id)) nodes.set(id,{innerHTML:'',textContent:'',style:{}});return nodes.get(id);};
  const pending=[];
  const state={busy:false,q:'first',rows:[],offset:0};
  const ctx=vm.createContext({
    AbortController,exploreLocality:null,effectiveExploreLocation:()=>({city:'',country:''}),listingImageReady:Promise.resolve(),exploreAutocomplete:{close(){},refresh(){}}, ST:state, LANG:'en', document:{getElementById:node},
    rpc:(fn,params,anon,signal)=>new Promise((resolve,reject)=>pending.push({resolve,reject,signal})),
    writeUrl:()=>{},harvestCountries:()=>{},renderRows:()=>{},toast:()=>{},console,
  });
  installSearch(ctx);
  const old=ctx.runSearch(true);
  state.q='second';
  const current=ctx.runSearch(true);
  assert.equal(pending[0].signal.aborted,true);
  assert.equal(pending[1].signal.aborted,false);
  pending[1].resolve([{name:'Current'}]);
  await current;
  pending[0].resolve([{name:'Stale'}]);
  await old;
  assert.equal(state.rows[0].name,'Current');
  assert.equal(state.busy,false);
  assert.equal(node('res-count').textContent,'Showing 1 result');
});

test('search failures leave an actionable retry and clear busy state', async () => {
  const nodes=new Map();
  const node=id=>{if(!nodes.has(id)) nodes.set(id,{innerHTML:'',textContent:'',style:{}});return nodes.get(id);};
  const state={busy:false,q:'taverna',rows:[],offset:0};
  const ctx=vm.createContext({AbortController,exploreLocality:null,effectiveExploreLocation:()=>({city:'',country:''}),listingImageReady:Promise.resolve(),exploreAutocomplete:{close(){},refresh(){}},ST:state,LANG:'en',document:{getElementById:node},
    rpc:async()=>{throw new Error('timeout');},writeUrl:()=>{},toast:()=>{},console:{error:()=>{}}});
  installSearch(ctx);
  await ctx.runSearch(true);
  assert.equal(state.busy,false);
  assert.match(node('results').innerHTML,/Try again/);
  assert.equal(state.q,'taverna');
});


test('failed category counts preserve selected filter and a successful explicit retry restores facets',async()=>{
 const node={innerHTML:''};let calls=0;
 const ctx=vm.createContext({ST:{type:'travel_place',counts:{}},TYPES:[['','All']],LANG:'en',
 document:{getElementById:()=>node},esc:x=>String(x),typeLabel:x=>x,
 rpc:async()=>{if(++calls===1)throw Error('timeout');return [{entity_type:'travel_place',n:787},{entity_type:'business',n:6233}];}});
 vm.runInContext(html.slice(html.indexOf('let typeFiltersLoading='),html.indexOf('async function boot()')),ctx);
 await ctx.loadTypeFilters();
 assert.equal(calls,1);assert.match(node.innerHTML,/Retry loading categories/);assert.match(node.innerHTML,/aria-pressed="true"[^>]*>travel_place/);
 await ctx.loadTypeFilters();
 assert.equal(calls,2);assert.doesNotMatch(node.innerHTML,/Retry loading categories/);assert.match(node.innerHTML,/business/);assert.match(node.innerHTML,/787/);
});

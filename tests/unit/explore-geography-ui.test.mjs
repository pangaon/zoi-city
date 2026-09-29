import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../../explore/index.html', import.meta.url), 'utf8');
const start = html.indexOf('const COUNTRY_ALIAS=');
const end = html.indexOf('/* Build listing links', start);
const context = vm.createContext({});
vm.runInContext(html.slice(start, end), context);
const options = rows => JSON.parse(JSON.stringify(context.cityOptions(rows)));

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
    ST:state, LANG:'en', document:{getElementById:node},
    rpc:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),
    writeUrl:()=>{},harvestCountries:()=>{},renderRows:()=>{},toast:()=>{},console,
  });
  const code=html.slice(html.indexOf('let searchVersion=0;'),html.indexOf('/* Sorting re-orders'));
  vm.runInContext(code,ctx);
  const old=ctx.runSearch(true);
  state.q='second';
  const current=ctx.runSearch(true);
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
  const ctx=vm.createContext({ST:state,LANG:'en',document:{getElementById:node},
    rpc:async()=>{throw new Error('timeout');},writeUrl:()=>{},toast:()=>{},console:{error:()=>{}}});
  vm.runInContext(html.slice(html.indexOf('let searchVersion=0;'),html.indexOf('/* Sorting re-orders')),ctx);
  await ctx.runSearch(true);
  assert.equal(state.busy,false);
  assert.match(node('results').innerHTML,/Try again/);
  assert.equal(state.q,'taverna');
});

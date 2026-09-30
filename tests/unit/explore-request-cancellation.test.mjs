import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../../explore/index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('async function rpc('),html.indexOf('let typeFiltersLoading'));
test('directory requests forward cancellation and clean up timeout after abort',async()=>{
 let actual,cleared=0;
 const ctx={AbortController,BASE:'https://example.test',PUB:'public',setTimeout(){return 1},clearTimeout(){cleared++},fetch:async(url,options)=>{actual=options.signal;return new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});});}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 const controller=new AbortController();const request=ctx.rpc('explore_search',{},true,controller.signal);controller.abort();
 await assert.rejects(request,/aborted/);assert.equal(actual.aborted,true);assert.equal(cleared,1);
});
test('directory timeout still aborts a current hung request without caller signal',async()=>{
 let expire,cleared=0;
 const ctx={AbortController,BASE:'https://example.test',PUB:'public',setTimeout(fn,ms){assert.equal(ms,15000);expire=fn;return 1},clearTimeout(){cleared++},fetch:async(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('timed out')),{once:true}))};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 const request=ctx.rpc('explore_search',{},true);expire();await assert.rejects(request,/timed out/);assert.equal(cleared,1);
});

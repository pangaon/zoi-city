import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../../explore/index.html',import.meta.url),'utf8');
test('listing links use current identity rather than stale paths and reject unsafe fallback destinations',()=>{
  const ctx={};vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('function hrefFor('),html.indexOf('/* A listing card.')),ctx);
  assert.equal(ctx.hrefFor({entity_type:'business',slug:'ke-nairobi-yamas-greek-restaurant',path:'/business/old'}),'/business/ke-nairobi-yamas-greek-restaurant');
  assert.equal(ctx.hrefFor({entity_type:'travel_place',slug:'a b'}),'/travel-place/a%20b');
  for(const path of ['javascript:alert(1)','//outside.example','/\\outside.example'])assert.equal(ctx.hrefFor({path}),'/explore');
  assert.equal(ctx.hrefFor({path:'/p/existing'}),'/p/existing');
});
test('quick look keyboard wraps both directions and does not trap when closed',()=>{
  const first={focus(){doc.activeElement=this;}},last={focus(){doc.activeElement=this;}};
  const modal={hidden:false,querySelectorAll(){return[first,last];}};
  const doc={activeElement:first,getElementById(){return modal;}};
  const ctx={document:doc,closeQV(){modal.hidden=true;}};vm.createContext(ctx);
  vm.runInContext(html.slice(html.indexOf('function quickViewKeyboard('),html.indexOf('function loadMore(')),ctx);
  let prevented=0;ctx.quickViewKeyboard({key:'Tab',shiftKey:true,preventDefault(){prevented++;}});assert.equal(doc.activeElement,last);
  ctx.quickViewKeyboard({key:'Tab',shiftKey:false,preventDefault(){prevented++;}});assert.equal(doc.activeElement,first);
  ctx.quickViewKeyboard({key:'Escape',preventDefault(){prevented++;}});assert.equal(modal.hidden,true);
  ctx.quickViewKeyboard({key:'Tab',shiftKey:true,preventDefault(){prevented++;}});assert.equal(prevented,3);
});

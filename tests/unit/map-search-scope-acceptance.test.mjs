import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {resolveLocality} from '../../assets/personalization/locality.mjs';

// Exercise the actual map input-to-intent integration rather than duplicating it.
// Explicit user geography survives query changes; a private saved home is never
// serialized into the browse URL. Existing explicit-query/global semantics remain.
const html=readFileSync(new URL('../../explore/map/index.html',import.meta.url),'utf8');
const source=html.match(/function mapSearchIntent\(\)\{[^\n]+\}/)?.[0];
assert.ok(source,'map input intent handler exists');
function typing(url,query){
 let refreshed=0;
 const context={URL,mapIntentURL:new URL(url,'https://www.zoi.city').href,query,mapLocality:{refresh(){refreshed++;}}};
 vm.createContext(context);vm.runInContext(source+';mapSearchIntent();',context);
 assert.equal(refreshed,1);return context.mapIntentURL;
}
const toronto={city:'Toronto',country:'Canada'},athens={city:'Athens',country:'Greece'};

test('typing and clearing preserve deliberately selected temporary city/country',()=>{
 for(const query of ['Amar','']){
  const result=new URL(typing('/explore/map/?city=Limassol&country=Cyprus',query));
  assert.equal(result.searchParams.get('city'),'Limassol');
  assert.equal(result.searchParams.get('country'),'Cyprus');
  assert.equal(resolveLocality(result.href,toronto).city,'Limassol');
 }
});

test('saved home remains private default; an unscoped explicit query is not silently home-filtered',()=>{
 assert.equal(resolveLocality('/explore/map/',toronto).source,'home');
 const result=typing('/explore/map/','Signature');
 assert.equal(resolveLocality(result,toronto).source,'explicit');
 assert.equal(resolveLocality(result,toronto).city,'');
 assert.ok(!result.includes('Toronto'));assert.ok(!result.includes('Canada'));
});

test('deliberate Everywhere remains global when cleared and never restores private home implicitly',()=>{
 const searched=typing('/explore/map/?scope=global','Signature');
 assert.equal(new URL(searched).searchParams.get('scope'),'global');
 assert.equal(resolveLocality(searched,toronto).city,'');
 const cleared=typing(searched,'');
 assert.equal(resolveLocality(cleared,toronto).source,'global');
});

test('account switch changes implicit home but cannot replace a temporary area while typing',()=>{
 assert.equal(resolveLocality('/explore/map/',toronto).city,'Toronto');
 assert.equal(resolveLocality('/explore/map/',athens).city,'Athens');
 assert.equal(resolveLocality('/explore/map/',null).source,'global');
 const result=typing('/explore/map/?city=Limassol&country=Cyprus','Amar');
 for(const home of [toronto,athens,null]){
  const context=resolveLocality(result,home);
  assert.equal(context.source,'explicit');assert.equal(context.city,'Limassol');
  assert.equal(context.country,'Cyprus');
 }
});

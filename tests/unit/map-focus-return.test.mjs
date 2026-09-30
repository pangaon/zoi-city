import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const html=fs.readFileSync(new URL('../../explore/map/index.html',import.meta.url),'utf8');
test('actual Escape and close handlers return keyboard focus after selected preview is removed',()=>{
 const close=html.match(/function closeSelection\(\) \{[^\n]+\}/)?.[0];assert.ok(close);
 const keyboard=html.match(/document\.addEventListener\('keydown', function \(e\) \{[\s\S]*?\n  \}\);/)?.[0];assert.ok(keyboard);
 let focused='preview',removed=0,writes=0,key;const context={showAll(){removed++;focused='BODY';},writeUrl(){writes++;},$:()=>({focus(){focused='search';}}),hideTip(){},clearSpider(){},listState:{mode:'group'},document:{activeElement:{},addEventListener(_,fn){key=fn;}}};vm.createContext(context);vm.runInContext(close+'\n'+keyboard,context);key({key:'Escape'});assert.equal(focused,'search');assert.equal(removed,1);assert.equal(writes,1);
 vm.runInContext('closeSelection()',context);assert.equal(focused,'search');assert.equal(removed,2);
 context.listState.mode='all';focused='map';key({key:'Escape'});assert.equal(focused,'map');assert.equal(removed,2);
 assert.match(html,/\$\('pclose'\)\.addEventListener\('click', closeSelection\)/);
});

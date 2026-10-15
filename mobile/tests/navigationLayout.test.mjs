import test from'node:test';import assert from'node:assert/strict';
import{clampNavigationOffset,revealNavigationOffset,pageNavigationOffset,navigationContentExtent}from'../src/navigationLayout.ts';
test('measured full selected tab is revealed from either edge after width/font/route changes',()=>{for(const viewport of[180,286,374,828])for(const content of[320,700,1400])for(const initial of[0,100,content])for(const x of[0,100,content-120]){const item={x:Math.max(0,x),width:Math.min(120,viewport-16)},offset=revealNavigationOffset(initial,viewport,content,item);assert.ok(offset>=0&&offset<=Math.max(0,content-viewport));if(item.x+item.width<=content){assert.ok(item.x>=offset-1);assert.ok(item.x+item.width<=offset+viewport+1);}}});
test('page controls stay bounded at content ends and never encode a route change',()=>{let x=0;for(let i=0;i<20;i++)x=pageNavigationOffset(x,1,286,900);assert.equal(x,614);for(let i=0;i<20;i++)x=pageNavigationOffset(x,-1,286,900);assert.equal(x,0);assert.equal(pageNavigationOffset(0,1,828,600),0);});
test('rotation clamps obsolete scroll offsets and zero/unavailable measurements do not jump',()=>{assert.equal(clampNavigationOffset(600,828,700),0);assert.equal(revealNavigationOffset(0,0,0,{x:0,width:0}),0);assert.equal(clampNavigationOffset(Infinity,390,700),0);assert.equal(clampNavigationOffset(123,0,0),0);});

test('complete current tab union replaces stale native width after hot growth and shrink',()=>{
 const ids=['home','grow'],small=new Map([['home',{x:8,width:120}],['grow',{x:128,width:120}]]),large=new Map([['home',{x:8,width:220}],['grow',{x:228,width:220}]]);
 assert.equal(navigationContentExtent(ids,small),256);assert.equal(navigationContentExtent(ids,large),456);assert.equal(navigationContentExtent(ids,small),256);
 assert.equal(navigationContentExtent([...ids].reverse(),large),456);assert.equal(navigationContentExtent(['home'],large),236);assert.equal(navigationContentExtent([],large),0);
 for(const missing of[new Map(),new Map([['home',{x:8,width:120}]])])assert.equal(navigationContentExtent(ids,missing),null);
 for(const invalid of[{x:NaN,width:120},{x:8,width:Infinity},{x:-1,width:120},{x:8,width:0}])assert.equal(navigationContentExtent(['home'],new Map([['home',invalid]])),null);
 assert.equal(navigationContentExtent(['home','home'],small),null);
});

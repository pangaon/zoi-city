import test from'node:test';import assert from'node:assert/strict';import{nativeWebHandoff}from'../src/webHandoffs.ts';
test('music shelf and unscoped personal calendar explicitly reach their actual web capabilities',()=>{for(const path of['/community/#music','zoi://community/#music','https://www.zoi.city/community#music'])assert.equal(nativeWebHandoff(path),'https://www.zoi.city/community/#music');assert.equal(nativeWebHandoff('/organization-calendar/'),'https://www.zoi.city/organization-calendar/')});
test('native parish calendar, member discussion and artist homes stay native',()=>{for(const path of['/organization-calendar/?listing=2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd','/community/?post=abc','/artist/george-dalaras','zoi://artist/george-dalaras'])assert.equal(nativeWebHandoff(path),null)});
test('handoff resolver never opens spoofed hosts or credentials',()=>{for(const path of['https://www.zoi.city.evil.test/community/#music','https://attacker@www.zoi.city/community/#music','javascript:alert(1)','//evil.test/organization-calendar/'])assert.equal(nativeWebHandoff(path),null)});
test('map deep links use the real web map and preserve only public search/place/view context',()=>{
 const value=nativeWebHandoff('zoi://explore/map/?q=Αθήνα&place=λυκαβηττός&t=church&token=do-not-forward#12/37.98/23.72/0/30');
 const u=new URL(value);assert.equal(u.pathname,'/explore/map/');assert.equal(u.searchParams.get('q'),'Αθήνα');assert.equal(u.searchParams.get('place'),'λυκαβηττός');assert.equal(u.searchParams.get('t'),'church');assert.equal(u.searchParams.has('token'),false);assert.equal(u.hash,'#12/37.98/23.72/0/30');
 assert.equal(nativeWebHandoff('zoi://explore/map/#NaN/999/999'),'https://www.zoi.city/explore/map/');
 assert.equal(nativeWebHandoff('https://evil.test/explore/map/'),null);
});

test('explicit guardian links hand off only public listing context, adult groups stay native',()=>{
 const id='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd',expected='https://www.zoi.city/groups/?listing='+id+'&family=1#guardian-programmes';
 for(const path of ['/groups/?listing='+id+'&family=1&child=PRIVATE&token=SECRET','zoi://groups/?listing='+id+'&family=1','https://www.zoi.city/groups/?listing='+id+'#guardian-programmes'])assert.equal(nativeWebHandoff(path),expected);
 for(const path of ['/groups/?listing='+id,'/groups/?listing='+id+'&family=0','/groups/?family=1','/groups/?listing=bad&family=1','/groups/?listing='+id+'&listing='+id+'&family=1','https://evil.test/groups/?listing='+id+'&family=1','https://attacker@www.zoi.city/groups/?listing='+id+'&family=1'])assert.equal(nativeWebHandoff(path),null);
});

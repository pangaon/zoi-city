import test from 'node:test';
import assert from 'node:assert/strict';
import {withHomeNavigation} from '../../api/_home-navigation.js';
import handler from '../../api/entity.js';
test('early incoming policy is idempotent, motion-aware and adds no script or stylesheet',()=>{const source='<html><head><meta charset="utf-8"><link rel="stylesheet" href="/assets/zoi-theme.css"></head><body>Home</body></html>';const result=withHomeNavigation(source);assert.ok(result.indexOf('@view-transition')<result.indexOf('<link'));assert.match(result,/@media\(prefers-reduced-motion:reduce\)\{@view-transition\{navigation:none\}\}/);assert.equal(withHomeNavigation(result),result);assert.equal((result.match(/<link/g)||[]).length,1);assert.doesNotMatch(result,/<script/);assert.equal(withHomeNavigation('<h1>No head</h1>'),'<h1>No head</h1>');});
test('existing inline family policy remains authoritative',()=>{const h='<head><style>@view-transition{navigation:none}</style></head>';assert.equal(withHomeNavigation(h),h);});
test('actual public handler adds policy only to successful content, not errors or redirects',async()=>{
 const saved=global.fetch;
 try{
  for(const mode of ['generic','venue','missing','failure','redirect']){
   const row={id:'81000000-0000-4000-8000-000000000099',name:'Sparse home',slug:'nav-'+mode,entity_type:mode==='venue'?'venue':'business',profile:{}};
   global.fetch=async url=>mode==='failure'?new Response('',{status:503}):new Response(JSON.stringify(String(url).endsWith('/home_entity')?(mode==='missing'?null:row):null));
   let body='';const headers={};const res={setHeader(k,v){headers[k]=v;},end(v){body=v||'';}};
   await handler({query:{slug:row.slug,...(mode==='redirect'?{canon:'1'}:{})}},res);
   const success=['generic','venue'].includes(mode);
   assert.equal(res.statusCode,success?200:mode==='missing'?404:mode==='redirect'?301:503,mode+' status');
   // Family renderers may already supply their early policy. The helper keeps
   // that authoritative policy rather than adding its own marker/duplicate.
   const policies=[...body.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].filter(m=>/@view-transition\s*\{navigation:auto\}/.test(m[1]));
   assert.equal(policies.length,success?1:0,mode+' actual navigation policy');
   if(success){
    assert.match(policies[0][1],/@media\(prefers-reduced-motion:reduce\)\{@view-transition\{navigation:none\}\}/,mode+' reduced motion');
    assert.ok(body.indexOf(policies[0][0])<body.indexOf('<link'),mode+' policy precedes external styles');
   }
   if(mode==='redirect'){assert.equal(body,'');assert.equal(headers.Location,'/business/nav-redirect');}
  }
 }finally{global.fetch=saved;}
});

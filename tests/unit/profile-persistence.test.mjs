import {resolveSocialLinks} from '../../assets/homes/social-links.mjs';
import {test} from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import vm from'node:vm';
function expose(file,names){const src=readFileSync(new URL('../../assets/suite/'+file,import.meta.url),'utf8');const context={URL};vm.runInNewContext(src.replace('  global.ZoiSuite =','  global.exposed={'+names+'};\n  global.ZoiSuite ='),context);return context.exposed;}
const bio=expose('bio.js','channelToLink,isHttpUrl');const biz=expose('bizpage.js','editableListings,normStatus,normContent');
test('connected bio links never manufacture handles from display names',()=>{assert.equal(bio.channelToLink({platform:'instagram',display_name:'Athens Cafe'}),null);assert.equal(bio.channelToLink({platform:'instagram',handle:'@athens'}).url,'https://instagram.com/athens');assert.equal(bio.channelToLink({platform:'linkedin',profile_url:'https://linkedin.com/company/cafe'}).url,'https://linkedin.com/company/cafe');});
test('bio URL validation rejects executable schemes and credential URLs',()=>{for(const s of ['javascript:alert(1)','https://','https://user:pass@site.test'])assert.equal(bio.isHttpUrl(s),false);assert.equal(bio.isHttpUrl('https://example.test/path'),true);});
test('business selection recognizes actual owned and approved claims response',()=>{const choices=biz.editableListings({owned:[{id:'a',name:'Owned'}],claims:[{listing_id:'b',status:'approved'},{listing_id:'c',status:'pending'},{listing_id:'a',status:'approved'}]});assert.deepEqual(Array.from(choices,x=>x.id),['a','b']);assert.equal(biz.normStatus(choices[0]).claimed,true);});
test('business socials retain source suggestions before an authoritative owner edit',()=>{
 const d=biz.normContent({profile:{_enrich:{social:{facebook:'https://facebook.com/real',instagram:'https://instagram.com/source'}}},social_links:{instagram:'https://instagram.com/base'}},resolveSocialLinks);
 assert.equal(d.social.length,2);assert.equal(d.social.find(x=>x.platform==='instagram').url,'https://instagram.com/base');
});
test('business editor reopening preserves owner clear and complete replacement without source resurrection',()=>{
 const raw={profile:{_enrich:{social:{facebook:'https://facebook.com/real'}},social:{instagram:'https://instagram.com/old'}},social_links:{instagram:'https://instagram.com/old'}};
 for(const links of [null,{}, {youtube:'https://www.youtube.com/@owner'}]){
  const d=biz.normContent({...raw,owner_content:{social_links:links}},resolveSocialLinks);
  assert.deepEqual(Array.from(d.social,row=>row.url),Object.values(links||{}));
 }
});
const source=readFileSync(new URL('../../assets/suite/bizpage.js',import.meta.url),'utf8');
test('business save requires exact versioned receipt and retains immutable retry snapshot',async()=>{
 const start=source.indexOf('    function doSave('),end=source.indexOf('    function finishSave',start),version='a'.repeat(32),nextVersion='b'.repeat(32),request='10000000-0000-4000-8000-000000000001';
 for(const response of [false,null,{},true,{ok:true,workspace_id:'other',listing_id:'id',request_id:request,version:nextVersion},{ok:true,workspace_id:'ws',listing_id:'id',request_id:request,version:nextVersion}]){
 const notes={textContent:''},calls=[],sourceUpdates=[];const state={status:{listingId:'id'},entity:{id:'id',website:'https://saved.example/'},contentVersion:version,draft:{website:'',social:[]},vform:{read:()=>({tagline:'snapshot'})}};const btn={setAttribute(){}};
 const save=vm.runInNewContext('('+source.slice(start,end).trim()+')',{state,sourceReviewHandle:{update:entity=>sourceUpdates.push(entity)},global:{crypto:{randomUUID:()=>request}},scopeLive:()=>true,contentDirty:true,ws:'ws',ctx:{ws:'ws'},wrap:{querySelectorAll:()=>[]},firstStr:x=>x||'',assembleSocial:()=>({}),rpcWrite:async(fn,payload)=>{calls.push({fn,payload});return response;},finishSave(){},toast(){}});
 save(btn,notes);await new Promise(r=>setTimeout(r,0));assert.equal(calls.length,1);assert.equal(calls[0].fn,'home_content_save');assert.equal(calls[0].payload.p_profile.tagline,'snapshot');const accepted=response?.ok===true&&response.workspace_id==='ws';assert.match(notes.textContent,accepted?/Saved\./:/uncertain/);
 if(!accepted){assert.equal(sourceUpdates.length,0);assert.equal(state.entity.website,'https://saved.example/');state.vform.read=()=>({tagline:'changed after uncertain save'});save(btn,notes);await new Promise(r=>setTimeout(r,0));assert.equal(calls[1].payload,calls[0].payload);assert.equal(calls[1].payload.p_profile.tagline,'snapshot');assert.equal(state.contentVersion,version);}else{assert.equal(state.pendingContent,null);assert.equal(state.contentVersion,nextVersion);assert.equal(sourceUpdates.length,1);assert.equal(sourceUpdates[0].id,'id');assert.equal(sourceUpdates[0].website,null);assert.equal(sourceUpdates[0].owner_content.website,null);}
 }
});

test('public bio filters unsafe URLs and distinguishes availability failures from missing pages',()=>{const html=readFileSync(new URL('../../b/index.html',import.meta.url),'utf8');const fn=html.slice(html.indexOf('function safeUrl('),html.indexOf('function slugFromPath'));const safe=vm.runInNewContext(fn+';safeUrl',{URL});assert.equal(safe('javascript:alert(1)'),null);assert.equal(safe('https://example.test'),'https://example.test/');assert.match(html,/Profile temporarily unavailable/);assert.match(html,/id=\"retryProfile\"/);assert.match(html,/links.filter\(l=>l&&l.label&&safeUrl\(l.url\)\)/);});

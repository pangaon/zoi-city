import test from 'node:test';
import assert from 'node:assert/strict';
import { chainBranchSourceScope } from '../../supabase/functions/zoi-enrich/_scope.js';
import { memberLeaseGuard } from '../../supabase/functions/zoi-enrich/_member.js';
// Reduced public-source structure, reviewed 2026-09-30. No synthetic customer records.
const card=(id,name,phone)=>`<div id="popmake-${id}" class="pum-container popmake"><div id="pum_popup_title_${id}" class="pum-title popmake-title"> ${name}</div><div class="pum-content popmake-content"><p><strong>Tel:</strong><a href="tel:${phone}">${phone}</a></p></div></div>`;
const html='<title>Fournos Home - Fournos</title>'+card('57194','Fourways The View','+27100277363')+card('6880','Benmore','+27118837194');
const row={name:'Fournos Bakery Benmore',entity_type:'business',website:'https://www.fournos.co.za/'};
test('review: Benmore cannot inherit first Fourways contact or media through generic extraction',()=>{
 const r=chainBranchSourceScope(row,html,row.website);assert.equal(r.handled,true);assert.equal(r.skipSupplementary,true);assert.equal(r.profile.crawl_status,'error');assert.equal(r.profile.blocked_reason,'source_scope_mismatch');
 for(const k of ['phone','email','hours','photo_url','photo_urls','logo_url','social'])assert.equal(Object.hasOwn(r.profile,k),false,k);
 assert.equal(memberLeaseGuard(row,html,row.website).handled,true);
});
test('review: generic chain identity, unrelated businesses and dedicated branch page remain untouched',()=>{
 for(const r of [{...row,name:'Fournos Bakery'},{...row,name:'Fournos'},{...row,name:'New England Meat Market'},{...row,entity_type:'organization'}])assert.equal(chainBranchSourceScope(r,html,r.website).handled,false,r.name);
 assert.equal(chainBranchSourceScope({...row,website:'https://www.fournos.co.za/benmore/'},html,'https://www.fournos.co.za/benmore/').handled,false);
 assert.equal(chainBranchSourceScope({...row,website:'https://fournos.co.za.evil.example/'},html,'https://fournos.co.za.evil.example/').handled,false);
});
test('review: duplicate navigation or same telephone does not prove distinct branch contact scopes',()=>{
 for(const doc of [card(1,'Benmore','+27118837194'),card(1,'Benmore','+27118837194')+card(2,'Benmore','+27100277363'),card(1,'Benmore','+27118837194')+card(2,'Fourways The View','+27118837194')])assert.equal(chainBranchSourceScope(row,doc,row.website).handled,false);
});
test('review: owner data and prior evidence are untouched even when import is quarantined',()=>{
 const scoped={...row,owner_managed:true,owner_workspace_id:'053a5656-b19b-48a4-8721-65c4674f647c',existing_enrich:{phone:'+27100277363',checked_at:'2026-09-02'},profile:{owner_content:{phone:null,photo_url:'https://owner.example/portrait.jpg'}}};const before=structuredClone(scoped);
 const r=chainBranchSourceScope(scoped,html,scoped.website);assert.equal(r.handled,true);assert.deepEqual(scoped,before);assert.equal(Object.hasOwn(r.profile,'owner_content'),false);assert.equal(Object.hasOwn(r.profile,'checked_at'),false);
});

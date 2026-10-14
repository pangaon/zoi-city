import test from'node:test';import assert from'node:assert/strict';import{researchPublisherProfile as research}from'../../scripts/geography/publisher-profile-research.mjs';
const row={id:'listing',name:'Actual Firm Ltd',source_url:'https://www.lgr.co.uk/directory/',website:null,address:'18 Main Street N13 4PN'};
const card=(name='Actual Firm Ltd',address='18 Main Street N13 4PN')=>'<div class="col item"><h4>'+name+'</h4>'+address+'<br/>t: 020 1234 1234<br/>w: <a href="http://actual.example.org/">Visit</a><br/></div>';
test('exact supporting card stages address and linked-site proposals without upgrading website or point',()=>{const p=research(card()+card('Other Firm','44 Elsewhere'),row);assert.equal(p.status,'needs_address_review');assert.equal(p.proposed.address_text,row.address);assert.equal(p.proposed.existing_address_matches,true);assert.equal(p.proposed.country_verified,false);assert.equal(p.proposed.website_links[0].registered_publisher_link,'http://actual.example.org/');assert.equal(p.source.official_website_confirmed,false);assert.equal(p.coordinate_writes,0);assert.equal(p.website_writes,0);});
test('duplicate, malformed, challenge, source hold, owner and sibling-page sources cannot qualify a card',()=>{for(const html of[card()+card(),'<div class="item"><h4>Actual Firm Ltd</h4>'+card('Other Firm'),'<title>One moment, please...</title>'+card(),'<template>'+card()+'</template>'])assert.equal(research(html,row).proposed,null);for(const changes of[{owner_user_id:'owner'},{profile:{_enrich:{scope_review_required:true}}}])assert.equal(research(card(),{...row,...changes}).status,'source_blocked');assert.equal(research(card(),row,{url:'https://www.lgr.co.uk/directory/other'}).proposed,null);});
test('supporting profile name-only evidence preserves unknown address and country',()=>{const r={...row,source_url:'https://publisher.example.org/profile/123'};const p=research('<link rel="canonical" href="'+r.source_url+'"><h1>Actual Firm Ltd</h1><footer><address>Publisher HQ, different place</address></footer>',r);assert.equal(p.status,'needs_identity_review');assert.equal(p.proposed.address_text,null);assert.equal(p.proposed.country_verified,false);});

test('exact canonical profile can propose only its adjacent matching contact block, keeping locality/country unverified',()=>{
 const r={...row,source_url:'https://publisher.example.org/profile/123'};const head='<link rel="canonical" href="'+r.source_url+'"><h1>Actual Firm Ltd</h1>',block='<h4>Actual Firm Ltd</h4><p>581 Washington St.<br>Whitman, MA 02382<br>781-447-3293</p>';
 const p=research(head+block,r);assert.equal(p.status,'needs_address_review');assert.equal(p.proposed.address_text,'581 Washington St., Whitman, MA 02382');assert.equal(p.proposed.locality_verified,false);assert.equal(p.proposed.country_verified,false);
 assert.equal(research(head+block+block,r).proposed,null);assert.equal(research(head+block.replace('Actual Firm Ltd','Other Firm'),r).proposed.address_text,null);
 assert.equal(research(head+'<footer><address>581 Publisher Street<br>Other City 12345</address></footer>',r).proposed.address_text,null);
});

test('document redirect aliases are bounded to www and trailing slash, sibling paths and query changes refuse',()=>{
 assert.equal(research(card(),row,{url:'https://lgr.co.uk/directory'}).status,'needs_address_review');
 for(const url of ['https://other.co.uk/directory/','https://www.lgr.co.uk/directory/other','https://www.lgr.co.uk/directory/?branch=other'])assert.equal(research(card(),row,{url}).proposed,null);
});

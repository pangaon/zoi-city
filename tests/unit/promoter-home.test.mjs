import test from 'node:test';import assert from 'node:assert/strict';
import {eventHomeContent,renderEventCanonicalHome}from'../../api/_event-home.js';
const e={id:'11111111-1111-4111-8111-111111111111',entity_type:'business',slug:'test-promoter',name:'Test promoter',website:'http://official.example/',profile:{business_type:'concert_promoter',events:[{name:'Real show',date:'2027-03-26',url:'/event/real-show',image:'https://official.example/poster.jpg'}]}};
test('promoter family uses source events not venue hire and preserves HTTP official source',()=>{assert.equal(eventHomeContent(e).family,'promoter');const html=renderEventCanonicalHome(e);assert.match(html,/Explore the concerts/);assert.match(html,/href="\/event\/real-show"/);assert.match(html,/href="http:\/\/official.example\/"/);assert.doesNotMatch(html,/Prom \/ semi-formal|Preferred date|Find the right space/);});
test('generic events entertainment category alone never classifies a business as promoter',()=>{assert.equal(eventHomeContent({...e,category_slug:'events-entertainment',profile:{}}),null);assert.equal(eventHomeContent({...e,owner_content:{profile:{business_type:null}}}),null);});
test('owner event clear and sparse promoter cannot invent performances',()=>{const html=renderEventCanonicalHome({...e,owner_content:{profile:{events:[]}}});assert.doesNotMatch(html,/Real show/);assert.match(html,/New concert announcements will appear/);});
test('unsafe event links are omitted; event source notice and original floor plan remain available',()=>{assert.equal(eventHomeContent({...e,profile:{...e.profile,events:[{name:'Bad',url:'javascript:alert(1)'}]}}).shows.length,0);const html=renderEventCanonicalHome({...e,entity_type:'event',profile:{starts:'2027-03-26',source_notice:'Confirm conflicting source year.',floor_plan_url:'https://official.example/plan.jpg',organizer_name:'Promoter',organizer_url:'/business/test-promoter'}});assert.match(html,/Confirm conflicting source year/);assert.match(html,/Open the official floor plan/);assert.match(html,/href="\/business\/test-promoter"/);});

test('owner official website clear and replacement win; sparse null arrays never crash',()=>{const clear=eventHomeContent({...e,owner_content:{website:null},profile:{...e.profile,spaces:[null],lineup:[null]}});assert.equal(clear.source_website,'');assert.equal(clear.website,'');assert.deepEqual(clear.spaces,[]);assert.deepEqual(clear.lineup,[]);assert.equal(eventHomeContent({...e,owner_content:{website:'https://new.example/'}}).source_website,'https://new.example/');assert.doesNotMatch(renderEventCanonicalHome({...e,profile:{...e.profile,events:[{name:'Old show',date:'2025-01-01',url:'/event/old-show'}]}}),/Coming to the stage/);});


test('promoter calendar dates display clearly without timezone shifts or invented dates',()=>{
 const original=process.env.TZ;
 try{for(const zone of ['Pacific/Honolulu','Pacific/Kiritimati']){process.env.TZ=zone;const html=renderEventCanonicalHome(e);assert.match(html,/26 March 2027/);assert.doesNotMatch(html,/2027-03-26 ·/);}
 for(const date of ['2027-02-29','Coming this autumn','2027-03-26T00:30:00+02:00']){const html=renderEventCanonicalHome({...e,profile:{...e.profile,events:[{...e.profile.events[0],date}]}});assert.ok(html.includes(date));}
 const owner=renderEventCanonicalHome({...e,owner_content:{profile:{events:[{...e.profile.events[0],date:'2028-02-29'}]}}});assert.match(owner,/29 February 2028/);assert.doesNotMatch(owner,/26 March 2027/);
 }finally{if(original===undefined)delete process.env.TZ;else process.env.TZ=original;}
});

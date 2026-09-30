import test from 'node:test';
import assert from 'node:assert/strict';
import {publisherSocial} from '../../assets/enrichment/publisher-social.mjs';
import {profileOf} from '../../api/_verticals.js';
import {restaurantHomeContent} from '../../api/_restaurant-home.js';
const source='https://www.agfg.com.au/restaurant/litanis-greek-mediterranean-restaurant-55968';
const publisher={facebook:'https://www.facebook.com/ausgoodfoodguide',instagram:'https://www.instagram.com/ausgoodfood/'};
test('exact stored Litani publisher profiles are scoped out without rejecting the source restaurant evidence',()=>{
 const e={id:'012f38f4-9ba4-40e3-9f8a-739247e383bb',name:"Litani’s Greek Mediterranean Restaurant",slug:'litani-s-greek-mediterranean-restaurant-wollongong',entity_type:'business',category_slug:'restaurants',website:source,profile:{_enrich:{source_url:source,social:publisher,phone:'0419 468 204',photo_url:'https://media1.agfg.com.au/images/listing/55968/hero-300.jpg',order_url:'https://orders.wowapps.com/order/litanisgreekmediterr?ref=agfg'}}};
 const before=JSON.stringify(e),p=profileOf(e),r=restaurantHomeContent(e);
 assert.deepEqual(p.social,{});assert.equal(p.phone,'0419 468 204');assert.deepEqual(r.socials,[]);assert.equal(r.hero,e.profile._enrich.photo_url);assert.equal(r.order[0].url,e.profile._enrich.order_url);assert.equal(JSON.stringify(e),before);
});
test('same publisher can have its own profile; unrelated source and actual restaurant accounts remain',()=>{
 for(const url of Object.values(publisher)){assert.equal(publisherSocial(source,url),true);for(const s of ['https://www.agfg.com.au/','https://www.agfg.com.au/about','https://www.litanis.com.au/','https://www.agfg.com.au.evil.test/restaurant/name-55968'])assert.equal(publisherSocial(s,url),false);}
 for(const url of ['https://www.facebook.com/litanis','https://www.instagram.com/litanis','https://www.facebook.com/ausgoodfoodguide-other'])assert.equal(publisherSocial(source,url),false);
});
test('explicit owner social fields and nulls override machine publisher filter',()=>{
 const e={profile:{_enrich:{source_url:source,social:publisher},social:publisher}};assert.deepEqual(profileOf(e).social,publisher);e.profile.social=null;assert.equal(profileOf(e).social,null);
 const base={id:'012f38f4-9ba4-40e3-9f8a-739247e383bb',name:'Litani',slug:'litani',entity_type:'business',category_slug:'restaurants',website:source,profile:{_enrich:{source_url:source,social:publisher}},owner_content:{social_links:publisher}};
 assert.equal(restaurantHomeContent(base).socials.length,2);base.owner_content.social_links=null;assert.deepEqual(restaurantHomeContent(base).socials,[]);
});

import test from 'node:test';import assert from 'node:assert/strict';
import {phoneHref} from '../../assets/homes/phone.mjs';
import {restaurantHomeContent,renderRestaurantHome} from '../../api/_restaurant-home.js';
test('dial targets retain regional numbers and explicit extensions without guessing country',()=>{
 for(const [source,target]of [['+49 (221) 493331','tel:+49221493331'],['0221 493331','tel:0221493331'],['0419 468 204','tel:0419468204'],['416-669-9865 ext. 123','tel:4166699865;ext=123'],['+1 416 669 9865 x42','tel:+14166699865;ext=42'],['0049 221 493331','tel:0049221493331']])assert.equal(phoneHref(source),target);
 for(const bad of ['+0221 493331','++49 221 493331','49+221493331','Call 4166699865','+000000','000000','123',null,42,'4166699865 ext. abc'])assert.equal(phoneHref(bad),null,String(bad));
});
test('actual Aphrodite malformed source remains readable but never a Call link across all four designs',()=>{
 const e={id:'018a38cb-a800-454b-97ff-ede370ed3492',name:'Aphrodite Restaurant Köln',slug:'aphrodite-restaurant-koln-cologne-de',entity_type:'business',category_slug:'restaurants',website:'https://www.aphroditerestaurant.de/',profile:{_enrich:{phone:'+0221 493331',source_url:'https://www.aphroditerestaurant.de/'}}};
 assert.equal(restaurantHomeContent(e).phone,'+0221 493331');assert.equal(restaurantHomeContent(e).phoneHref,null);
 for(const template of ['atelier','concierge','table','parea']){const html=renderRestaurantHome(e,{template});assert.ok(html.includes('+0221 493331'));assert.ok(!html.includes('tel:+022'));assert.ok(!html.includes('href="null"'));assert.ok(!html.includes('Direct contact details have not been added yet.'));}
 const owner={...e,owner_content:{phone:'+49 221 493331'}};assert.equal(restaurantHomeContent(owner).phoneHref,'tel:+49221493331');owner.owner_content.phone=null;assert.equal(restaurantHomeContent(owner).phoneHref,null);
});

import {usablePhone} from '../../assets/homes/source-contact.mjs';
test('source display validation counts base number separately from extension',()=>{const value='+123456789012345 ext. 12345678';assert.equal(usablePhone(value),value);assert.equal(phoneHref(value),'tel:+123456789012345;ext=12345678');assert.equal(usablePhone('+0221 493331'),'+0221 493331');});
import {genericEventData} from '../../api/_generic-event-data.js';
import {renderGenericEvent} from '../../assets/homes/templates/events/generic.mjs';
test('venue model and all four layouts preserve invalid source display and valid branch number',()=>{
 const entity={id:'9ca606a8-bb17-43c4-bfce-84de3f442d39',name:'Sample venue',slug:'sample-venue',entity_type:'venue',profile:{phone:'+0221 493331'}};
 for(const value of ['+0221 493331','0221 493331','+49 221 493331 ext. 42']){
  entity.profile.phone=value;const model=genericEventData(entity);assert.equal(model.phone,value);assert.equal(model.phone_label,value);
  for(const design of ['atelier','concierge','table','parea']){const html=renderGenericEvent(model,design);assert.ok(html.includes(value));if(phoneHref(value))assert.ok(html.includes('href="'+phoneHref(value)+'"'));else assert.ok(!html.includes('href="tel:'));}
 }
});

import {quickLookDetails} from '../../assets/discovery/profile-preview.mjs';
import {normalizeProfile} from '../../mobile/src/profile.ts';
test('clear placeholders are suppressed across shared contact, map preview, native and restaurant homes',()=>{
 const e={id:'054dd95e-5253-4a86-9630-fe91c3f29c90',name:'Stalactites Restaurant',slug:'stalactites-restaurant-melbourne',entity_type:'business',category_slug:'restaurants',website:'https://www.stalactites.com.au/',phone:null,profile:{_enrich:{phone:'5555555555',source_url:'https://www.stalactites.com.au/'}}};
 for(const bad of ['5555555555','(555) 555-5555','1111111111','0000000000','1234567890']){assert.equal(phoneHref(bad),null);assert.equal(usablePhone(bad),'');}
 assert(!quickLookDetails(e).links.some(x=>x.label==='Call'));assert.equal(normalizeProfile(e).phone,'');assert.equal(normalizeProfile(e).phoneHref,null);
 for(const template of ['atelier','concierge','table','parea'])assert(!renderRestaurantHome(e,{template}).includes('tel:5555555555'));
 const real={...e,profile:{_enrich:{...e.profile._enrich,phone:'+61 3 9663 3316'}}};assert.equal(quickLookDetails(real).links.find(x=>x.label==='Call').href,'tel:+61396633316');assert.equal(normalizeProfile(real).phoneHref,'tel:+61396633316');
 assert(!quickLookDetails({...real,owner_content:{phone:null}}).links.some(x=>x.label==='Call'));assert.equal(normalizeProfile({...real,owner_content:{phone:null}}).phone,'');
 for(const value of ['+1 212 555 2345','+44 20 7555 1234','+61 3 9663 3316','+30 210 555 3344']){assert(usablePhone(value));assert(phoneHref(value));}
});

test('non-authoritative placeholder falls through to valid source but explicit phone clears do not',()=>{const base={id:'054dd95e-5253-4a86-9630-fe91c3f29c90',name:'Stalactites Restaurant',slug:'stalactites-restaurant-melbourne',website:'https://www.stalactites.com.au/',phone:'5555555555',profile:{_enrich:{phone:'+61396633316',source_url:'https://www.stalactites.com.au/'}}};assert.equal(quickLookDetails(base).links.find(x=>x.label==='Call').href,'tel:+61396633316');assert.equal(normalizeProfile(base).phoneHref,'tel:+61396633316');for(const patch of [{owner_content:{phone:null}},{owner_content:{profile:{phone:''}}},{profile:{...base.profile,phone:null}}]){const e={...base,...patch};assert(!quickLookDetails(e).links.some(x=>x.label==='Call'));assert.equal(normalizeProfile(e).phoneHref,null);}});

test('restaurant source fallback respects explicit clears and suppresses placeholder display',()=>{const base={id:'054dd95e-5253-4a86-9630-fe91c3f29c90',name:'Stalactites Restaurant',slug:'stalactites-restaurant-melbourne',entity_type:'business',category_slug:'restaurants',website:'https://www.stalactites.com.au/',phone:'5555555555',profile:{_enrich:{phone:'+61396633316',source_url:'https://www.stalactites.com.au/'}}};assert.equal(restaurantHomeContent(base).phoneHref,'tel:+61396633316');for(const patch of [{owner_content:{phone:null}},{owner_content:{profile:{phone:''}}},{profile:{...base.profile,phone:null}}])assert.equal(restaurantHomeContent({...base,...patch}).phone,'');const fake={...base,profile:{_enrich:{...base.profile._enrich,phone:'5555555555'}}};assert.equal(restaurantHomeContent(fake).phone,'');});
import {hospitalityHomeContent} from '../../api/_hospitality-home.js';
import {churchHomeContent} from '../../api/_church-home.js';
import {personData} from '../../assets/homes/person-data.mjs';
import {ownerHomeContent} from '../../api/_owner-home-content.js';
import {completeHomeMetadata} from '../../api/_home-metadata.js';
test('shared families suppress placeholders, recover valid source and preserve every explicit phone authority',()=>{
 const base={id:'054dd95e-5253-4a86-9630-fe91c3f29c90',name:'Published place',slug:'published-place',entity_type:'business',category_slug:'hotels',website:'https://official.example.org/',phone:'5555555555',profile:{_enrich:{phone:'+61396633316',source_url:'https://official.example.org/'}}};
 for(const model of [hospitalityHomeContent,personData,genericEventData,e=>churchHomeContent({...e,entity_type:'church'})]){assert.equal(model(base).phone,'+61396633316');for(const patch of [{owner_content:{phone:null}},{owner_content:{profile:{phone:''}}},{owner_content:{profile:{phone:'5555555555'}}},{profile:{...base.profile,phone:null}}])assert.equal(model({...base,...patch}).phone,'');assert.equal(model({...base,owner_content:{profile:{phone:'+302101234567'}}}).phone,'+302101234567');assert.equal(model({...base,profile:{_enrich:{...base.profile._enrich,phone:'5555555555'}}}).phone,'');}
 for(const family of ['music','creator','events']){assert.equal(ownerHomeContent({phone:'+61396633316'},{owner_content:{phone:'5555555555'}},family).phone,'');assert.equal(ownerHomeContent({phone:'+61396633316'},{owner_content:{profile:{phone:null}}},family).phone,'');}
 const metadata=completeHomeMetadata('<html><head></head><body></body></html>',{name:'Published place',canonical:'https://www.zoi.city/business/published-place',type:'Restaurant',phone:'5555555555'});assert(!metadata.includes('5555555555'));
});

test('valid schema email survives an unrelated placeholder phone',()=>{const output=completeHomeMetadata('<html><head></head><body></body></html>',{name:'Published place',canonical:'https://www.zoi.city/business/published-place',type:'Restaurant',phone:'5555555555',email:'hello@official.example.org'});assert(output.includes('"email":"hello@official.example.org"'));assert(!output.includes('"telephone"'));});

test('parish contact retains a valid base phone when imported phone is a placeholder',()=>{
 const entity={id:'054dd95e-5253-4a86-9630-fe91c3f29c90',name:'Parish',slug:'parish',entity_type:'church',website:'https://official.example.org/',phone:'+302101234567',profile:{_enrich:{source_url:'https://official.example.org/',phone:'5555555555'}}};
 assert.equal(churchHomeContent(entity).phone,'+302101234567');
 assert.equal(churchHomeContent({...entity,profile:{...entity.profile,phone:null}}).phone,'');
});

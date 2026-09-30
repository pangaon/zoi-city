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

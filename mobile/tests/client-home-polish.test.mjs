import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{normalizeProfile}from'../src/profile.ts';import{foodMenuView,foodQuestionDraft}from'../src/foodMenu.ts';
const raw=JSON.parse(fs.readFileSync(new URL('./food-menu-browser/public-home-entity.json',import.meta.url),'utf8'));
const entity=Array.isArray(raw)?raw[0]:raw;
test('retained real bakery home keeps the full menu and source-priced variants at the new presentation boundary',()=>{
 const p=normalizeProfile(entity);assert.equal(p.food.family,'bakery');assert.equal(p.serviceOfferings.items.length,0);
 const view=foodMenuView(p.food.menuSections,'',null,Infinity);assert.equal(view.total,151);assert.equal(view.shown,151);assert.deepEqual(p.food.menuSections.map(s=>s.items.length),[2,2,2,145]);
 const tail=foodMenuView(p.food.menuSections,'Sardines in Can');assert.equal(tail.matches,2);const item=tail.groups.flatMap(g=>g.items).find(x=>x.item.name==='Sardines in Can').item;assert.equal(item.price,'$3.00');assert.match(foodQuestionDraft(p.food,item).text,/Sardines in Can/);
});
test('combined published clears suppress both offering sources without changing canonical contact or map identity',()=>{
 const p=normalizeProfile({...entity,services:['Never restore this lower service'],owner_content:{services:null,photo_url:null,description:null,profile:{menu:null,menu_url:null}}});
 assert.equal(p.description,'');assert.equal(p.photo,'');assert.equal(p.serviceOfferings.items.length,0);assert.equal(p.food.menuSections.length,0);assert.equal(p.id,entity.id);assert.equal(p.slug,entity.canonical_slug||entity.slug);
});
test('service detail remains read-only: advertised duration/options never create staff, availability or canonical booking authority',()=>{
 const id='10000000-0000-4000-8000-000000000081';const p=normalizeProfile({id,name:'Controlled service contract',entity_type:'business',category_slug:'barbers',services:[{name:'Controlled service',price:'€25–€40 per visit',duration:'45 minutes',options:[{name:'Longer option',price:'€40 per visit'}],booking_url:'https://unconfirmed.example.org/book',practitioner:'Not an authoritative staff record'}],booking_url:'/book/?listing=20000000-0000-4000-8000-000000000081'});
 assert.equal(p.food,null);assert.equal(p.bookingListing,'');assert.equal(p.inquiryListing,'');assert.equal(p.serviceOfferings.items[0].price,'€25–€40 per visit');assert.equal(p.serviceOfferings.items[0].duration,'45 minutes');assert.equal(p.serviceOfferings.items[0].options[0].price,'€40 per visit');assert.equal(p.serviceOfferings.items[0].practitioner,undefined);assert.equal(p.serviceOfferings.items[0].booking_url,undefined);
});

import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{normalizeProfile}from'../src/profile.ts';import{foodMenuView,foodQuestionDraft}from'../src/foodMenu.ts';
import{clientHomeDesign}from'../src/clientHomePresentation.ts';
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
test('native client homes use distinct source-backed restaurant and grooming compositions',()=>{
 const restaurant=normalizeProfile(entity),barber=normalizeProfile({id:'10000000-0000-4000-8000-000000000082',name:'Northline',entity_type:'business',category_slug:'barbers',services:[{name:'Signature cut',price:'$45 CAD',duration:'45 min'}],profile:{logo_url:'https://northline.example/logo.png',brand:{primary:'#1C2735'}}});
 const food=clientHomeDesign(restaurant),grooming=clientHomeDesign(barber);
 assert.equal(food.family,'bakery');assert.equal(food.tabs[0].label,'Menu');assert.equal(food.primary,'View menu');
 assert.equal(grooming.family,'grooming');assert.equal(grooming.tabs[0].label,'Services');assert.notEqual(food.background,grooming.background);
 assert.notEqual(grooming.accent,'#1C2735');assert.notEqual(grooming.primaryColor,'#1C2735');assert.equal(food.primary,'View menu');
});
test('sparse profile stays compact and brand buttons keep readable contrast',()=>{
 const sparse=clientHomeDesign(normalizeProfile({id:'10000000-0000-4000-8000-000000000083',name:'New member',entity_type:'business',profile:{brand:{primary:'#F5C542'}}}));
 assert.equal(sparse.family,'directory');assert.deepEqual(sparse.tabs,[]);assert.equal(sparse.primary,'');assert.equal(sparse.accent,'#1F64CD');
});
test('sector editions keep compact client-specific hierarchy and accessible light/dark actions',()=>{
 const sectors=[['restaurant',{food:{family:'restaurant'}}],['bakery',{food:{family:'bakery'}}],['grooming',{category:'barbers',serviceOfferings:{items:[{}]},inquiryListing:'fixture'}],['hospitality',{category:'hotels',address:'1 Main Street'}],['parish',{category:'orthodox-churches',location:'Toronto'}],['arts',{category:'photographers',gallery:['https://images.example/work.jpg']}],['professional',{category:'architects',serviceOfferings:{items:[{}]},inquiryListing:'fixture'}],['organization',{category:'consulates',location:'Toronto'}]];
 const lum=h=>{const rgb=h.slice(1).match(/.{2}/g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]},ratio=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
 for(const [family,record]of sectors){const light=clientHomeDesign(record),dark=clientHomeDesign(record,true);assert.equal(light.family,family);assert.ok(light.tabs.length<=4);assert.ok(ratio('#FFFFFF',light.primaryColor)>=4.5,`${family} light action`);assert.ok(ratio('#FFFFFF',dark.primaryColor)>=4.5,`${family} dark action`);assert.ok(ratio(dark.accent,dark.background)>=4.5,`${family} dark accent`);}
 assert.equal(clientHomeDesign({category:'barbers',inquiryListing:'fixture'}).primary,'Enquire about a service');
 assert.equal(clientHomeDesign(normalizeProfile({name:'Danforth Barber Shop',entity_type:'business',category_slug:'cleaning'})).family,'grooming');
});

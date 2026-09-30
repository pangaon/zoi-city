import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMachineSourceIdentity as assess} from '../../supabase/functions/zoi-enrich/_source-identity.js';
const row={website:'http://www.billiardsacademy.ca/',finalUrl:'https://billiardsacademy.ca/',name:'VIP Billiards & Lounge'};
test('persisted VIP source metadata warrants review even without a proven redirect',()=>{
 const r=assess({...row,title:'KOMPAS.com',description:'Seperti gunung yang menyimpan kekayaan, MALUKU4D menawarkan jackpot progresif yang nilainya terus bertambah seiring setiap taruhan yang dipasang.'});
 assert.equal(r.reason,'conflicting_wagering_identity');assert.equal(r.outcome,'review');
});
test('unexpected document host change held, www and HTTPS upgrade allowed',()=>{
 assert.equal(assess({...row,finalUrl:'https://zoomacademia.com/'}).reason,'document_host_changed');
 assert.equal(assess({...row,finalUrl:'https://billiardsacademy.ca.attacker.example/'}).outcome,'review');
 assert.equal(assess(row).outcome,'continue');
 assert.equal(assess({...row,finalUrl:'https://cdn.billiardsacademy.ca/'}).outcome,'review');
});
test('ordinary promotions, genuine gaming businesses and explicit matching identity not rejected',()=>{
 for(const data of [{title:'VIP Billiards & Lounge',description:'Pool tables and lounge'}, {title:'Dinner specials',description:'Bonus dessert'}, {title:'Casino night fundraiser',description:'Join our charity evening'}, {name:'Example Casino',title:'Example Casino',description:'Betting jackpot bonus'}, {title:'VIP Billiards & Lounge',description:'Sports betting jackpot event'}])assert.equal(assess({...row,...data}).outcome,'continue');
});
test('images on unrelated CDNs do not by themselves trigger identity review; inputs untouched',()=>{
 const data={...row,title:'VIP Billiards & Lounge',photo_url:'https://images.examplecdn.com/venue.jpg',owner_media:{photos:['https://owner.example/image.jpg']}};
 const before=structuredClone(data);assert.equal(assess(data).outcome,'continue');assert.deepEqual(data,before);
 for(const finalUrl of ['javascript:alert(1)','https://user:pass@example.com/',''])assert.equal(assess({...row,finalUrl}).outcome,'review');
});

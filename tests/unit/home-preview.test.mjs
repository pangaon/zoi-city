import test from 'node:test';
import assert from 'node:assert/strict';
import {renderHospitalityHome} from '../../api/_hospitality-home.js';
import handler,{inertPreview} from '../../api/home-preview.js';
const workspace='10000000-0000-4000-8000-000000000001',listing='20000000-0000-4000-8000-000000000001';
const design={schema_version:1,template:'concierge',section_order:['intro','offerings','gallery','calendar','media','socials','contact'],hidden_sections:[],copy:{},item_order:{offerings:[]}};
async function request(req,reply){const old=globalThis.fetch;let calls=0;globalThis.fetch=async(url,opts)=>{calls++;assert.equal(opts.headers.Authorization,'Bearer test-token');assert.equal(JSON.parse(opts.body).p_workspace,workspace);return {ok:true,json:async()=>reply}};const headers={};let body;const res={setHeader:(k,v)=>headers[k]=v,end:x=>body=JSON.parse(x)};try{await handler(req,res);return {status:res.statusCode,body,headers,calls}}finally{globalThis.fetch=old}}
const valid=()=>({method:'POST',headers:{authorization:'Bearer test-token'},body:{workspace,listing,design}});
test('private home preview rejects anonymous and malformed requests before data access',async()=>{let r=await request({...valid(),headers:{}},null);assert.equal(r.status,401);assert.equal(r.calls,0);r=await request({...valid(),body:{workspace:'bad'}},null);assert.equal(r.status,400);assert.equal(r.calls,0);assert.equal(r.headers['Cache-Control'],'no-store')});
test('private preview requires exact workspace/listing receipt',async()=>{const r=await request(valid(),{ok:true,workspace:'other',listing,entity:{id:listing},design});assert.equal(r.status,409);assert.equal(r.body.error,'home_preview_unconfirmed')});
test('reviewed healthcare owner receives inert HTML with chosen real template',async()=>{const d={...design,template:'parea'};const req=valid();req.body.design=d;const r=await request(req,{ok:true,workspace,listing,design:d,entity:{id:listing,name:'Actual professional',slug:'actual-professional',entity_type:'professional',category_slug:'healthcare',publish_status:'published',profile:{profession:'Registered Nurse'}}});assert.equal(r.status,200);assert.match(r.body.html,/data-template="parea"/);assert.doesNotMatch(r.body.html,/<script\b/i);assert.match(r.body.html,/data-preview-href/);assert.equal(r.headers.Vary,'Authorization')});
test('unsupported categories never return a fake working preview',async()=>{const r=await request(valid(),{ok:true,workspace,listing,design,entity:{id:listing,name:'Unknown',entity_type:'unknown'}});assert.equal(r.status,409);assert.equal(r.body.error,'home_preview_not_supported')});
test('preview keeps styles while removing executable scripts and navigable links',()=>{const html=inertPreview('<head><link href="/assets/styles.css"><script>alert(1)</script></head><a href="https://example.org">Go</a>');assert.match(html,/href="\/assets\/styles.css"/);assert.doesNotMatch(html,/<script/);assert.match(html,/data-preview-href="https:\/\/example.org"/)});

for(const populated of [false,true])test(`hotel private preview matches canonical renderer (${populated?'populated':'sparse'})`,async()=>{
 const d={...design,template:'parea'},entity={id:listing,name:'Independent Hotel',slug:'independent-hotel',entity_type:'business',category_slug:'hotels',publish_status:'published',moderation_status:'clean',profile:populated?{rooms:[{id:'suite',name:'Sea suite',description:'Private terrace'}],amenities:['Breakfast'],booking_url:'https://hotel.example/book'}:{}};
 const req=valid();req.body.design=d;
 const r=await request(req,{ok:true,workspace,listing,design:d,entity});
 assert.equal(r.status,200);assert.equal(r.body.html,inertPreview(renderHospitalityHome(entity,d)));
 assert.match(r.body.html,/data-template="parea"/);assert.doesNotMatch(r.body.html,/<script\b/i);assert.equal(r.headers['Cache-Control'],'no-store');
 if(populated){assert.match(r.body.html,/Sea suite/);assert.match(r.body.html,/Booking through the hotel/);}else assert.doesNotMatch(r.body.html,/Sea suite/);
});
test('hotel preview cannot use a different listing receipt or bypass visibility checks',async()=>{
 const entity={id:listing,name:'Private Hotel',slug:'private-hotel',entity_type:'business',category_slug:'hotels',publish_status:'published',profile:{}};
 let r=await request(valid(),{ok:true,workspace,listing,design,entity:{...entity,id:workspace}});assert.equal(r.status,409);assert.equal(r.body.error,'home_preview_unconfirmed');
 r=await request(valid(),{ok:true,workspace,listing,design,entity:{...entity,marketplace_status:'hidden'}});assert.equal(r.status,409);assert.equal(r.body.error,'home_preview_not_supported');
});

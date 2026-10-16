import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProfile} from '../src/profile.ts';
import {serviceOfferingsForProfile as project,SERVICE_ITEM_LIMIT,SERVICE_INPUT_LIMIT,SERVICE_OPTION_LIMIT} from '../src/serviceOfferings.ts';
const entity={name:'Synthetic service fixture',entity_type:'professional',publish_status:'published',moderation_status:'clean'};
const services=[{name:'Consultation',description:'Published description',price:0,currency:'EUR',duration_minutes:45,options:[{name:'Extended',price:'€90 per visit',duration:'90 minutes'},{name:'Remote',price_cents:1250,currency:'USD'}]}];
test('rich published services preserve descriptions, literal units, explicit currency, zero and options',()=>{
 const result=project({...entity,owner_content:{services}});
 assert.equal(result.origin,'published');assert.equal(result.total,1);assert.deepEqual(result.items[0],{name:'Consultation',description:'Published description',price:'0 EUR',duration:'45 minutes',options:[{name:'Extended',description:'',price:'€90 per visit',duration:'90 minutes'},{name:'Remote',description:'',price:'12.50 USD',duration:''}],omittedOptions:0,optionsBounded:false});
 assert.deepEqual(services[0].options[1],{name:'Remote',price_cents:1250,currency:'USD'});
});
test('prices and durations never infer missing currency or units, permit explicit free and ranges',()=>{
 const result=project({...entity,country:'Greece',services:[{name:'A',price:50,duration:30},{name:'B',price:'Free',duration:'By arrangement'},{name:'C',price_cents:0,currency:'GBP'},{name:'D',price:Infinity,currency:'EUR',duration_minutes:-1},{name:'E',price:'$20–$40 / hour'},{name:'F',price:'$20 per visit',currency:'CAD'}]});
 assert.deepEqual(result.items.map(x=>[x.price,x.duration]),[['',''],['Free','By arrangement'],['0.00 GBP',''],['',''],['$20–$40 / hour',''],['$20 per visit CAD','']]);
});
test('published presence honors each layer, null/empty/invalid clears never revive lower services',()=>{
 const base={...entity,services:['Base'],profile:{services:['Raw'],_enrich:{services:['Unscoped']}},owner_content:{profile:{services:['Nested']},services:['Top']}};
 assert.equal(project(base).items[0].name,'Top');
 for(const cleared of [null,[],{},'',false])for(const layer of ['top','nested','raw','entity']){
  const e={...entity,services:['Base'],profile:{_enrich:{services:['Unscoped']}}};
  if(layer==='top')e.owner_content={services:cleared,profile:{services:['Nested']}};
  if(layer==='nested')e.owner_content={profile:{services:cleared}};
  if(layer==='raw')e.profile.services=cleared;
  if(layer==='entity')e.services=cleared;
  assert.deepEqual(project(e).items,[],layer+' '+JSON.stringify(cleared));
 }
});
test('new public offering projection refuses explicit private or unpublished entity/rows/options',()=>{
 for(const patch of [{visibility:'private'},{marketplace_hidden:true},{publish_status:'draft'},{moderation_status:'pending_review'},{is_public:false},{duplicate_status:'confirmed_duplicate'},{visibility:'draft'}])assert.deepEqual(project({...entity,services,...patch}).items,[]);
 const r=project({...entity,services:[{name:'Private',private:true},{name:'Draft',publish_status:'draft'},{name:'Public',options:[{name:'Hidden',visibility:'private'},'Simple option']}]});
 assert.equal(r.total,1);assert.equal(r.omitted,2);assert.deepEqual(r.items[0].options.map(x=>x.name),['Simple option']);assert.equal(r.items[0].omittedOptions,1);
});
const sourced={...entity,name:'Fixture Professional',website:'https://fixture.example.org/branch?office=one',profile:{_enrich:{source_url:'https://fixture.example.org/branch?office=one',services:[{name:'Source service',description:'Scoped source description',price:999,currency:'EUR',options:['Never admitted'],url:'https://unconfirmed.example.org/booking'}],provenance:{services:'identity_scoped_offer_catalog',source_identity:'exact_name_typed_jsonld'},source_identity:{name:'Fixture Professional',source_url:'https://fixture.example.org/branch?office=one',schema_type:'Person',expected_entity_type:'professional',verification:'exact_name_typed_jsonld'}}}};
test('import uses actual shared provenance/identity/branch guard and never lifts rich machine fields',()=>{
 const r=project(sourced);assert.equal(r.origin,'source');assert.equal(r.bounded,true);assert.equal(r.items[0].description,'Scoped source description');assert.equal(r.items[0].price,'');assert.deepEqual(r.items[0].options,[]);assert.equal(r.items[0].url,undefined);
 for(const patch of [{source_url:'https://fixture.example.org/branch?office=two'},{scope_review_required:true},{organization_identity_quarantine:true},{source_identity:null},{provenance:{}},{crawl_status:'error'},{source_kind:'association_member'}])assert.deepEqual(project({...sourced,profile:{_enrich:{...sourced.profile._enrich,...patch}}}).items,[]);
 const owner=project({...sourced,owner_content:{services},profile:{_enrich:{scope_review_required:true}}});assert.equal(owner.items[0].price,'0 EUR');
});
test('sparse/string-only has no invented description/price/action or booking implication',()=>{
 assert.deepEqual(project(entity).items,[]);const r=project({...entity,services:['Simple',null,{},'<b>Plain name</b>']});
 assert.equal(r.total,2);assert.equal(r.items[0].description,'');assert.equal(r.items[0].price,'');assert.equal(r.items[0].duration,'');assert.equal(r.items[1].name,'Plain name');
 assert.equal(normalizeProfile({...entity,services}).serviceOfferings.items[0].name,'Consultation');assert.equal(normalizeProfile({...entity,services}).bookingListing,'');
});
test('legacy30 strings unchanged while new31st/300 and caps are explicit',()=>{
 const values=Array.from({length:SERVICE_ITEM_LIMIT+1},(_,i)=>({name:'Service '+i,price:'€'+i}));
 const p=normalizeProfile({...entity,services:values});assert.equal(p.services.length,30);assert.equal(p.serviceOfferings.items.length,SERVICE_ITEM_LIMIT);assert.equal(p.serviceOfferings.items[30].name,'Service 30');assert.equal(p.serviceOfferings.total,SERVICE_ITEM_LIMIT+1);assert.equal(p.serviceOfferings.remaining,1);assert.equal(p.serviceOfferings.bounded,true);
 const tooMany=project({...entity,services:Array(SERVICE_INPUT_LIMIT+1).fill('Item')});assert.equal(tooMany.items.length,0);assert.equal(tooMany.omitted,SERVICE_INPUT_LIMIT+1);assert.equal(tooMany.bounded,true);
 const opts=project({...entity,services:[{name:'A',options:Array(SERVICE_OPTION_LIMIT+1).fill('Option')}]}).items[0];assert.equal(opts.options.length,SERVICE_OPTION_LIMIT);assert.equal(opts.omittedOptions,1);assert.equal(opts.optionsBounded,true);
});

test('oversized detail is omitted explicitly as a whole instead of silently truncated',()=>{const r=project({...entity,services:[{name:'Long description',description:'x'.repeat(2001)},{name:'A',price:'x'.repeat(201)},'Visible']});assert.equal(r.omitted,2);assert.equal(r.total,1);assert.equal(r.items[0].name,'Visible');});

test('canonical marketplace hidden refuses entity, service and option without new marketplace enums',()=>{
 assert.deepEqual(project({...entity,marketplace_status:'hidden',services}).items,[]);
 const r=project({...entity,marketplace_status:'active',services:[{name:'Hidden service',marketplace_status:'hidden'},{name:'Visible',options:[{name:'Hidden option',marketplace_status:'hidden'},{name:'Visible option',marketplace_status:'active'}]}]});assert.equal(r.total,1);assert.equal(r.omitted,1);assert.deepEqual(r.items[0].options.map(o=>o.name),['Visible option']);assert.equal(r.items[0].omittedOptions,1);
});
test('integer cent formatting preserves every safe cent at high boundaries',()=>{
 const values=[0,1,90,100,101,9007199254740990,Number.MAX_SAFE_INTEGER];
 const r=project({...entity,services:values.map(price_cents=>({name:String(price_cents),price_cents,currency:'EUR'}))});
 assert.deepEqual(r.items.map(x=>x.price),['0.00 EUR','0.01 EUR','0.90 EUR','1.00 EUR','1.01 EUR','90071992547409.90 EUR','90071992547409.91 EUR']);
 assert.equal(project({...entity,services:[{name:'Unsafe',price_cents:Number.MAX_SAFE_INTEGER+1,currency:'EUR'}]}).items[0].price,'');
});

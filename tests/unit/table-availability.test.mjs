import test from 'node:test';
import assert from 'node:assert/strict';
import {tableCard,tableSponsor,tableMoney,tableHoldState,tableHoldSeconds,readTablePending,writeTablePending,createTableAvailabilityApi} from '../../assets/tickets/table-availability.mjs';
const event='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',actor='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',nonce='cccccccc-cccc-4ccc-8ccc-cccccccccccc',table='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const now=Date.parse('2026-09-30T12:00:00Z'),row={id:table,label:'Table 30',capacity:10,min_party_size:4,per_guest_cents:12500,currency:'CAD',pricing_version:2,fees_included:true,state:'available',buyer_name:'NEVER EXPOSE',buyer_email:'private@example.test'};
function store(){const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),dump:()=>[...m.values()]};}
test('source geometry cannot turn into availability; public projection never contains guests',()=>{
 assert.equal(tableCard(row,{eventId:event}).state,'unconfigured');const card=tableCard(row,{eventId:event,configured:true});assert.equal(card.total_cents,125000);assert.equal(card.min_party_size,4);assert.equal(JSON.stringify(card).includes('NEVER EXPOSE'),false);assert.equal(JSON.stringify(card).includes('private@example'),false);
 assert.equal(tableCard({...row,state:'imaginary'},{configured:true}).state,'unconfigured');
});
test('unknown prices, currencies and fee policies stay unknown',()=>{
 const r=tableCard({id:table,per_guest_cents:10000,capacity:10});assert.equal(r.currency,null);assert.equal(r.fees,'unknown');assert.match(tableMoney(r.total_cents,r.currency),/currency unconfirmed/);assert.equal(tableCard({id:table,per_guest_cents:-1,capacity:NaN}).total_cents,null);
});
test('sold sponsors remain visible only with exact active approved placement',()=>{
 const s={approved:true,event_id:event,table_id:table,name:'QA sponsor',url:'https://example.test/',starts_at:'2026-09-01T00:00:00Z',ends_at:'2026-10-01T00:00:00Z'};
 assert.equal(tableCard({...row,state:'sold',sponsor:s},{eventId:event,configured:true,now}).sponsor.name,'QA sponsor');
 for(const change of [{approved:false},{event_id:actor},{table_id:actor},{ends_at:'2026-09-30T12:00:00Z'},{url:'javascript:alert(1)'},{url:'https://name:secret@example.test'},{starts_at:null}])assert.equal(tableSponsor({...s,...change},event,table,now),null);
});
test('server time drives hold countdown and no expiry fabricates availability',()=>{
 const h=tableHoldState({hold_id:nonce,event_id:event,table_id:table,status:'active',server_time:'2026-09-30T12:00:00Z',expires_at:'2026-09-30T12:05:00Z'},{eventId:event,tableId:table,now:now+90000});assert.equal(tableHoldSeconds(h,now+90000),300);assert.equal(tableHoldSeconds(h,now+390000),0);assert.equal(h.status,'active');
 assert.equal(tableHoldState({...h,event_id:actor},{eventId:event,tableId:table}),null);
});
test('request locator persists before mutation without contact data and stays account/event scoped',()=>{
 const storage=store();writeTablePending(storage,actor,event,table,nonce,6,2,now);assert.equal(readTablePending(storage,actor,event).party_size,6);assert.equal(readTablePending(storage,nonce,event),null);assert.equal(readTablePending(storage,actor,nonce),null);assert.deepEqual(Object.keys(JSON.parse(storage.dump()[0])).sort(),['actor','created_at','event_id','party_size','pricing_version','protocol','request_id','table_id']);
 assert.throws(()=>writeTablePending({setItem(){throw Error('quota');}},actor,event,table,nonce,6,2));
});
test('exact RPC adapter checks event, request and table on recovery, false remains unresolved',async()=>{
 const calls=[];let wrong=false;const api=createTableAvailabilityApi(async(fn,p,anon)=>{calls.push({fn,p,anon});if(fn==='table_inventory_map')return {ok:true,event_id:event,configured:true,tables:[{table_id:table,source_label:'30',capacity:10,min_party_size:4,price_per_guest_cents:12500,currency:'CAD',pricing_version:2,fees_included:true,availability:'held'}]};if(fn==='table_hold_status')return {ok:true,holds:wrong?[{id:nonce,event_id:event,table_id:actor,request_id:nonce}]:[],server_time:new Date(now).toISOString()};return {ok:true};});
 assert.equal((await api.map(event)).tables[0].state,'held');assert.equal(calls[0].anon,true);await api.hold({eventId:event,tableId:table,partySize:6,pricingVersion:2,requestId:nonce});assert.deepEqual(calls[1].p,{p_event:event,p_table:table,p_party_size:6,p_expected_version:2,p_request:nonce});assert.deepEqual(await api.recover({eventId:event,tableId:table,requestId:nonce}),{found:false});wrong=true;await assert.rejects(api.recover({eventId:event,tableId:table,requestId:nonce}),/Wrong hold/);
});
import {mountTableAvailability} from '../../assets/tickets/table-availability.mjs';
function rootStub(){const handlers=new Map();return {hidden:true,innerHTML:'',classList:{add(){}},setAttribute(){},removeAttribute(){},replaceChildren(){this.innerHTML='';},querySelector(){return null;},focus(){},addEventListener:(n,f)=>handlers.set(n,f),removeEventListener:n=>handlers.delete(n),click:action=>handlers.get('click')({target:{closest:()=>({dataset:{ta:action}})}})};}
const tick=()=>new Promise(r=>setTimeout(r,5));
test('controller never holds on sign-in, blocks duplicate after ambiguous outcome, clears private state on actor change',async()=>{
 const root=rootStub(),storage=store();let identity=null,signins=0,writes=0;const api={hold:async()=>{writes++;throw Error('lost response');},recover:async()=>({found:false}),map:async()=>({event_id:event,configured:true,tables:[row]})};
 const card=mountTableAvailability({root,eventId:event,configured:true,tables:[row],api,storage,getActor:()=>identity,onSignIn:()=>signins++,authTarget:null});
 try{card.show(table);root.click('reserve');await tick();assert.equal(signins,1);assert.equal(writes,0);identity=actor;card.show(table);assert.equal(writes,0);root.click('reserve');await tick();assert.equal(writes,1);assert.match(root.innerHTML,/Check my pending request/);root.click('reserve');await tick();assert.equal(writes,1);root.click('recover');await tick();assert.equal(writes,1);assert.ok(readTablePending(storage,actor,event));identity=nonce;card.show(table);assert.doesNotMatch(root.innerHTML,/Check my pending request/);assert.equal(readTablePending(storage,nonce,event),null);}finally{card.destroy();}
});
test('late hold completion cannot recover or expose status in another account',async()=>{
 const root=rootStub(),storage=store();let identity=actor,finish,recoveries=0;const api={hold:()=>new Promise(r=>finish=r),recover:async()=>{recoveries++;return {found:false};}};
 const card=mountTableAvailability({root,eventId:event,configured:true,tables:[row],api,storage,getActor:()=>identity,authTarget:null});
 try{card.show(table);root.click('reserve');await tick();identity=nonce;card.show(table);finish({});await tick();assert.equal(recoveries,0);assert.doesNotMatch(root.innerHTML,/timed hold is confirmed/);assert.ok(readTablePending(storage,actor,event));}finally{card.destroy();}
});
test('unknown-result retry reuses exact persisted request and later refusal cannot discard it',async()=>{
 const root=rootStub(),storage=store(),sent=[];const api={hold:async p=>{sent.push(p);if(sent.length>1){const e=Error('refused');e.definitive=true;throw e;}throw Error('timeout');},recover:async()=>({found:false})};
 const card=mountTableAvailability({root,eventId:event,configured:true,tables:[row],api,storage,getActor:()=>actor,authTarget:null});
 try{card.show(table);root.click('reserve');await tick();root.click('retry');await tick();assert.equal(sent.length,2);assert.deepEqual(sent[0],sent[1]);assert.ok(readTablePending(storage,actor,event));}finally{card.destroy();}
});
test('first authoritative refusal clears only its unsent-result locator and requires refreshed availability',async()=>{
 const root=rootStub(),storage=store();const api=createTableAvailabilityApi(async()=>{const e=Error('table_unavailable');e.code='P0001';throw e;});const card=mountTableAvailability({root,eventId:event,configured:true,tables:[row],api,storage,getActor:()=>actor,authTarget:null});
 try{card.show(table);root.click('reserve');await tick();assert.equal(readTablePending(storage,actor,event),null);assert.match(root.innerHTML,/server refused/);assert.doesNotMatch(root.innerHTML,/data-ta="reserve"/);}finally{card.destroy();}
});

import test from'node:test';import assert from'node:assert/strict';import{GeneralReservationGuard}from'../src/generalReservation.ts';
const attempt={actor:'actor-a',event:'event-a',tier:'1',id:'request-a',created_at:'2026-09-30T12:00:00Z'},receipt={ok:true,code:'real',qty:2,amount_cents:0,paid:false};
const store=()=>{const m=new Map();return{getItem:async k=>m.get(k)||null,setItem:async(k,v)=>{m.set(k,v)},removeItem:async k=>{m.delete(k)}}};
test('interrupted reservation remains blocked after remount and across tier changes, scoped to actor and event',async()=>{const s=store(),g=new GeneralReservationGuard(s);await g.begin(attempt,()=>true);const again=new GeneralReservationGuard(s);assert.deepEqual(await again.read('actor-a','event-a'),attempt);await assert.rejects(again.begin({...attempt,id:'second',tier:'2'},()=>true));assert.equal(await again.read('actor-b','event-a'),null);assert.equal(await again.read('actor-a','event-b'),null);});
test('only exact confirmed free receipt clears original attempt; malformed and stale confirmations preserve warning',async()=>{const g=new GeneralReservationGuard(store());await g.begin(attempt,()=>true);for(const r of[{...receipt,paid:true},{...receipt,qty:3},{...receipt,code:''}])await assert.rejects(g.confirmed(attempt,r,2));await assert.rejects(g.confirmed({...attempt,id:'other'},receipt,2));assert.ok(await g.read('actor-a','event-a'));await g.confirmed(attempt,receipt,2);assert.equal(await g.read('actor-a','event-a'),null);});
test('storage failure and account change stop request preparation before network action',async()=>{const g=new GeneralReservationGuard({getItem:async()=>null,setItem:async()=>{throw Error('storage unavailable')},removeItem:async()=>{}});await assert.rejects(g.begin(attempt,()=>true));await assert.rejects(g.begin(attempt,()=>false));});

test('new request recovery accepts only exact nonce/event/tier/quantity receipt, with no contact storage',async()=>{const {generalReceipt,generalRecovery,generalSubmission}=await import('../src/generalReservation.ts');const a={...attempt,protocol:'once',qty:2},r={...receipt,currency:'EUR',request_id:a.id,event_id:a.event,ticket_type_id:a.tier};const storage=store(),g=new GeneralReservationGuard(storage);await g.begin(a,()=>true);const revived=await new GeneralReservationGuard(storage).read(a.actor,a.event);assert.equal(generalRecovery({ok:true,found:false},revived),null);assert.ok(await g.read(a.actor,a.event));assert.equal(generalRecovery({ok:true,found:true,receipt:r,current_status:'reserved',checked_in:false,event_available:true},revived).receipt.code,'real');for(const patch of[{request_id:'other'},{event_id:'other'},{ticket_type_id:1},{qty:3},{paid:true}])assert.throws(()=>generalReceipt({...r,...patch},a));const args=generalSubmission(revived,' Guest ',' GUEST@example.com ');assert.equal(args.p_request,a.id);assert.equal(args.p_email,'guest@example.com');assert.equal(args.p_qty,2);assert.equal('p_name' in revived,false);assert.equal('p_email' in revived,false);await g.confirmed(a,r,2);assert.equal(await g.read(a.actor,a.event),null);});
test('legacy saved requests cannot be upgraded to once protocol, and malformed recovery never clears warning',async()=>{const {generalRecovery,generalSubmission}=await import('../src/generalReservation.ts');assert.throws(()=>generalSubmission(attempt,'Guest','guest@example.com'));const a={...attempt,protocol:'once',qty:2};for(const response of[null,{ok:false,found:false},{ok:true,found:'false'},{ok:true,found:true,receipt}])assert.throws(()=>generalRecovery(response,a));});

test('recovered creation receipt cannot imply active ticket after cancellation or closed event',async()=>{const {generalRecovery}=await import('../src/generalReservation.ts');const a={...attempt,protocol:'once',qty:2},r={...receipt,currency:'EUR',request_id:a.id,event_id:a.event,ticket_type_id:a.tier};assert.throws(()=>generalRecovery({ok:true,found:true,receipt:r},a));const v=generalRecovery({ok:true,found:true,receipt:r,current_status:'cancelled',checked_in:false,event_available:false},a);assert.equal(v.status,'cancelled');assert.equal(v.eventAvailable,false);assert.equal(v.receipt.code,'real');});

test('signing in cannot bypass an unresolved guest reservation or reuse its nonce as an account request',async()=>{
 const storage=store(),g=new GeneralReservationGuard(storage),guest={...attempt,actor:'guest',protocol:'once',qty:1};
 await g.begin(guest,()=>true);
 assert.equal(await g.hasGuestPending('actor-a',guest.event),true);
 assert.equal(await g.hasGuestPending('guest',guest.event),false);
 assert.equal(await g.hasGuestPending('actor-a','different-event'),false);
 await assert.rejects(g.begin({...guest,actor:'actor-a',id:'fresh-request'},()=>true),/guest request/);
 assert.deepEqual(await g.read('guest',guest.event),guest);
 assert.equal(await g.read('actor-a',guest.event),null);
});

test('confirmed nonce reference survives reopening without contacts and never claims cached ticket status',async()=>{
 const storage=store(),g=new GeneralReservationGuard(storage),a={...attempt,protocol:'once',qty:2,created_at:new Date().toISOString()},r={...receipt,currency:'EUR',request_id:a.id,event_id:a.event,ticket_type_id:a.tier};
 await g.begin(a,()=>true);await g.confirmed(a,r,2);
 assert.equal(await g.read(a.actor,a.event),null);
 assert.deepEqual(await new GeneralReservationGuard(storage).references(a.actor,a.event),[a]);
 assert.deepEqual(await g.references('other-account',a.event),[]);
 assert.deepEqual(await g.references(a.actor,'other-event'),[]);
 assert.equal('code' in (await g.references(a.actor,a.event))[0],false);
});
test('confirmed references cap at five, expire after one year, and storage failure preserves unresolved warning',async()=>{
 const storage=store(),g=new GeneralReservationGuard(storage);
 for(let i=0;i<7;i++){const a={...attempt,id:'ref-'+i,protocol:'once',qty:2,created_at:new Date().toISOString()};await g.begin(a,()=>true);await g.confirmed(a,{...receipt,currency:'EUR',request_id:a.id,event_id:a.event,ticket_type_id:a.tier},2);}
 assert.equal((await g.references(attempt.actor,attempt.event)).length,5);
 const a={...attempt,id:'old',protocol:'once',qty:2,created_at:'2020-01-01T00:00:00Z'};await g.begin(a,()=>true);await g.confirmed(a,{...receipt,currency:'EUR',request_id:a.id,event_id:a.event,ticket_type_id:a.tier},2);assert.equal((await g.references(a.actor,a.event)).some(r=>r.id==='old'),false);
 const fail=new GeneralReservationGuard({...storage,setItem:async(k,v)=>{if(k.includes('.references.'))throw Error('disk full');await storage.setItem(k,v);}}),b={...a,id:'unresolved',created_at:new Date().toISOString()};await fail.begin(b,()=>true);await assert.rejects(fail.confirmed(b,{...receipt,currency:'EUR',request_id:b.id,event_id:b.event,ticket_type_id:b.tier},2));assert.equal((await fail.read(b.actor,b.event)).id,b.id);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createVenueClient} from '../../assets/tickets/venue-api.mjs';
test('workspace mutations require a token before network use',async()=>{
 let called=false;const api=createVenueClient({getToken:()=>null,fetchImpl:async()=>{called=true;}});
 await assert.rejects(api('venue_plan_save',{}),/Sign in/);assert.equal(called,false);
});
test('anonymous seating read sends publishable credentials only',async()=>{
 let observed;const api=createVenueClient({getToken:()=>null,key:'public-test',fetchImpl:async(url,args)=>{observed={url,args};return{ok:true,json:async()=>({available:false})};}});
 assert.deepEqual(await api('tickets_seat_map',{p_event:'id'},true),{available:false});assert.equal(observed.args.headers.Authorization,'Bearer public-test');
});
test('version conflict gives recovery guidance and does not silently retry',async()=>{
 let calls=0;const api=createVenueClient({getToken:()=> 'test-token',fetchImpl:async()=>{calls++;return{ok:false,json:async()=>({message:'revision_conflict'})};}});
 await assert.rejects(api('venue_plan_save',{}),/Another save/);assert.equal(calls,1);
});
test('transport failures do not claim failed writes or auto-retry mutation',async()=>{
 let calls=0;const api=createVenueClient({getToken:()=> 'test-token',fetchImpl:async()=>{calls++;throw new Error('timeout');}});
 await assert.rejects(api('tickets_seat_reserve',{}),/could not be confirmed/);assert.equal(calls,1);
});

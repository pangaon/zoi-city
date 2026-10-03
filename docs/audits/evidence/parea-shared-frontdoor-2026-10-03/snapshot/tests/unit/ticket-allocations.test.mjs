import test from 'node:test';
import assert from 'node:assert/strict';
import {ticketAllocations} from '../../assets/events/ticket-allocations-model.mjs';
const members=[{id:'a',name:'Alex',ticket_quantity:3},{id:'b',name:'Sam',ticket_quantity:1},{id:'c',name:'Chris',ticket_quantity:5}];
test('a guest owes their whole ticket quantity, never an equal fraction of other tickets',()=>{const result=ticketAllocations({guestCount:10,perGuestCents:27500,members});assert.deepEqual(result.rows.map(r=>r.subtotalCents),[82500,27500,137500]);assert.equal(result.assigned,9);assert.equal(result.unassigned,1);assert.equal(result.totalCents,275000);assert.equal(result.complete,false);});
test('excess recipients cannot conceal an over-allocation',()=>{const result=ticketAllocations({guestCount:2,perGuestCents:27500,members});assert.equal(result.valid,false);assert.equal(result.overAssigned,7);assert.equal(result.unassigned,0);});
test('missing price leaves amounts unknown, not zero',()=>{const result=ticketAllocations({guestCount:9,members});assert.equal(result.totalCents,null);assert.equal(result.rows[0].subtotalCents,null);assert.equal(result.complete,true);});
test('fractional, negative, string and unsafe quantities fail instead of rounding',()=>{for(const n of [0,-1,1.5,'3',NaN,Infinity,101])assert.throws(()=>ticketAllocations({guestCount:10,members:[{id:'a',ticket_quantity:n}]}));});
test('duplicate row IDs fail but friends sharing a name are valid',()=>{assert.throws(()=>ticketAllocations({guestCount:10,members:[members[0],members[0]]}));assert.equal(ticketAllocations({guestCount:2,members:[{id:'a',name:'Alex',ticket_quantity:1},{id:'b',name:'Alex',ticket_quantity:1}]}).complete,true);});

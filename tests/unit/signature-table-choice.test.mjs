import test from 'node:test';import assert from 'node:assert/strict';
import{tableChoicePricing}from'../../assets/events/signature/customer-a.mjs';
import{TABLES}from'../../assets/events/signature/venue-experience.mjs';
test('actual numbered choices derive their published perguest tier without a second space selector',()=>{const same=TABLES.filter(t=>t.tier==='magenta').slice(0,2).map(t=>t.id);assert.deepEqual(tableChoicePricing(same),{tableIds:same,tier:'magenta',perGuestCents:27500});});
test('mixed alternatives never invent a single price and empty choices do not imply selection',()=>{const ids=['red','blue'].map(tier=>TABLES.find(t=>t.tier===tier).id);assert.equal(tableChoicePricing(ids).perGuestCents,null);assert.equal(tableChoicePricing(ids).tier,null);assert.deepEqual(tableChoicePricing([]),{tableIds:[],tier:null,perGuestCents:null});for(const ids of[['VIP'],['30','30'],['1','2','3','4']])assert.throws(()=>tableChoicePricing(ids));});

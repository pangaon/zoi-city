import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileInventory,discoverInventory} from '../../scripts/delivery/inventory.mjs';
test('inventory retains earlier scope and evidence without granting completion to new code',()=>{
 const old={modules:[{id:'old',web:'blocked',evidence:['docs/old.json']},{id:'bookings',web:'historical acceptance',evidence:['docs/booking.json']}],requested_capability_areas:[{area:'Old scope',requirements:['Keep this'],web:'unverified'}]};
 const result=reconcileInventory(old,{modules:[{id:'bookings',source:'assets/suite/bookings.js'},{id:'new'}],areas:[{area:'New scope',requirements:['New work']}]});
 assert.equal(result.modules.find(x=>x.id==='old').source_present,false);
 assert.deepEqual(result.modules.find(x=>x.id==='bookings').evidence,['docs/booking.json']);
 assert.equal(result.modules.find(x=>x.id==='new').web,'unverified');
 assert.equal(result.modules.find(x=>x.id==='new').ios,'unverified');
 assert.equal(result.requested_capability_areas.length,2);
 assert.deepEqual(old.modules[0].evidence,['docs/old.json']);
});
test('canonical inventory includes loaded operating suites and real customer surfaces',()=>{
 const root=fileURLToPath(new URL('../../',import.meta.url));
 const inventory=discoverInventory(root),ids=new Set(inventory.modules.map(x=>x.id));
 for(const id of ['creator','properties','festival','organization-calendar','bizpage','bookings'])assert.ok(ids.has(id),id);
 assert.ok(inventory.surfaces.some(x=>x.route==='/community/'));
 assert.ok(inventory.workers.some(x=>x.id==='zoi-enrich'));
 assert.ok(inventory.areas.length>=18);
 assert.ok(!inventory.surfaces.some(x=>/artifacts|fixtures|node_modules|\.recovery/.test(x.source)));
});
import {fileURLToPath} from 'node:url';

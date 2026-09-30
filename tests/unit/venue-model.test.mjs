import test from 'node:test';
import assert from 'node:assert/strict';
import {createLayout,validateLayout,seatRows,updateObjects,selectedSeats,summarize,parseLayout,projectPoint} from '../../assets/tickets/venue-model.mjs';
const rows=()=>seatRows(createLayout());
test('seat rows create unique labels with a real central aisle',()=>{
 const layout=rows();assert.equal(layout.objects.length,24);
 assert.equal(new Set(layout.objects.map(o=>o.label)).size,24);
 assert.ok(layout.objects[4].x-layout.objects[3].x>2);
 assert.deepEqual(summarize(layout),{seats:24,accessible:0,excluded:0});
});
test('editing validates boundaries and prevents physical overlap',()=>{
 const layout=rows(),seat=layout.objects[0];
 assert.throws(()=>updateObjects(layout,[seat.id],{x:20}),/outside/);
 assert.throws(()=>updateObjects(layout,[seat.id],{x:layout.objects[1].x}),/overlaps/);
 assert.equal(layout.objects[0].x,2);
 assert.throws(()=>updateObjects(layout,['missing'],{x:1}),/existing/);
});
test('excluded seats cannot appear in planning selection or capacity',()=>{
 const layout=rows(),id=layout.objects[0].id;
 const changed=updateObjects(layout,[id],{excluded:true,accessible:true});
 assert.deepEqual(selectedSeats(changed,[id]),[]);
 assert.deepEqual(summarize(changed),{seats:23,accessible:0,excluded:1});
});
test('JSON round trip retains stable IDs and complete physical layout',()=>{
 const layout=updateObjects(rows(),['row-0-0'],{accessible:true});
 assert.deepEqual(parseLayout(JSON.stringify(layout)),layout);
 assert.throws(()=>parseLayout('{broken'),/valid venue/);
 assert.throws(()=>parseLayout(' '.repeat(250001)),/too large/);
 assert.throws(()=>validateLayout({...layout,version:999}),/version/);
});
test('import rejects duplicate IDs, duplicate seat labels and unsafe dimensions',()=>{
 const layout=rows();
 assert.throws(()=>validateLayout({...layout,objects:[layout.objects[0],layout.objects[0]]}),/unique ID/);
 assert.throws(()=>updateObjects(layout,['row-0-0'],{label:'A2'}),/labels must be unique/);
 assert.throws(()=>validateLayout({...layout,width:Infinity}),/dimensions/);
 assert.throws(()=>seatRows(createLayout(),{rows:20,prefix:'Z'}),/before Z/);
});
test('3D preview uses geometry and camera state instead of fabricated seats',()=>{
 const layout=rows();
 const point=projectPoint(2,4,0,layout),raised=projectPoint(2,4,1,layout);
 assert.ok(raised.y<point.y);
 assert.notEqual(projectPoint(2,4,0,layout,1.2).x,point.x);
 assert.ok([point.x,point.y,point.depth].every(Number.isFinite));
});

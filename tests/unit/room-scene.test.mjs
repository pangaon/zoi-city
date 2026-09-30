import test from'node:test';import assert from'node:assert/strict';import{roomPositions,roomCamera,roomChairCount}from'../../assets/events/room-scene.mjs';
const plan={room:{x:0,y:0,width:1000,height:600}},tables=[{id:'10A',x:500,y:200,width:28,length:90,rotation:45,category:'red',sourceCapacity:10}];
test('source pixels become relative geometry with exact IDs and no prices',()=>{const [r]=roomPositions(plan,tables);assert.equal(r.id,'10A');assert.equal(r.cx,0);assert.equal(r.cz,-2);assert.equal(r.angle,-Math.PI/4);assert.equal(r.d,1.8);assert.equal('price'in r,false);assert.throws(()=>roomPositions(plan,[...tables,...tables]));assert.throws(()=>roomPositions({...plan,room:{...plan.room,width:0}},tables));});
test('mobile entry faces stage without changing source positions; selected view uses exact table',()=>{const [r]=roomPositions(plan,tables),mobile=roomCamera(plan,390),desktop=roomCamera(plan,1440),seat=roomCamera(plan,390,r,true);assert.equal(mobile.theta,0);assert.equal(desktop.theta,0);assert.ok(mobile.z<desktop.z);assert.equal(seat.x,r.cx);assert.equal(seat.z,r.cz);assert.equal(seat.view,true);});

test('chairs follow declared source capacity without inventing capacity',()=>{assert.equal(roomChairCount({sourceCapacity:10}),10);for(const value of [undefined,0,2.5,80])assert.equal(roomChairCount({sourceCapacity:value}),0);assert.equal(roomChairCount({sourceCapacity:7}),7);});

test('mobile selection frames both source table and stage direction without moving the table',()=>{const [r]=roomPositions(plan,[{...tables[0],x:850}]),v=roomCamera(plan,390,r);assert.equal(r.cx,7);assert.equal(v.x,r.cx/2);assert.ok(v.distance>roomCamera(plan,390).distance);assert.equal(v.theta,0);});

import{roomOverviewCamera}from'../../assets/events/room-scene.mjs';
import{MONTREAL_PLAN_SOURCE,MONTREAL_TABLES}from'../../assets/events/opa/montreal-room-plan.mjs';
import{PerspectiveCamera,Vector3}from'../../assets/vendor/three-0.186.1/three.module.js';
test('whole-room camera keeps all102 exact source table anchors inside usable viewport on phone and desktop',()=>{
 const original=JSON.stringify(MONTREAL_TABLES),rows=roomPositions(MONTREAL_PLAN_SOURCE,MONTREAL_TABLES);assert.equal(rows.length,102);for(const id of ['10A','10B','20A','20B'])assert.ok(rows.some(r=>r.id===id));
 for(const [width,height]of [[390,844],[1440,1000]]){
 const v=roomOverviewCamera(MONTREAL_PLAN_SOURCE,width,height),camera=new PerspectiveCamera(43,width/height,.05,150);
 camera.position.set(v.x+Math.sin(v.theta)*Math.sin(v.phi)*v.distance,Math.cos(v.phi)*v.distance+1,v.z+Math.cos(v.theta)*Math.sin(v.phi)*v.distance);camera.lookAt(new Vector3(v.x,.35,v.z));camera.updateMatrixWorld();
 for(const r of rows){const point=new Vector3(r.cx,.96,r.cz).project(camera),x=(point.x+1)*width/2,y=(1-point.y)*height/2;assert.ok(x>20&&x<width-20&&y>80&&y<height-65,r.id+' remains inside usable '+width+' viewport');}
 }
 assert.equal(JSON.stringify(MONTREAL_TABLES),original);
});

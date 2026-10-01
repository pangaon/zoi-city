import test from 'node:test';
import assert from 'node:assert/strict';
import {furnishedOverviewCamera,tableViewCamera} from '../../assets/events/signature/furnished-concert.mjs';
import {roomTableCamera,roomPositions,roomOverviewCamera} from '../../assets/events/room-scene.mjs';
import {MONTREAL_PLAN_SOURCE,MONTREAL_TABLES} from '../../assets/events/opa/montreal-room-plan.mjs';
import {PerspectiveCamera,Vector3} from '../../assets/vendor/three-0.186.1/three.module.js';
test('Toronto portrait overview fits the unchanged floor with useful vertical coverage',()=>{
 for(const [w,h] of [[390,900],[1440,900]]){const v=furnishedOverviewCamera(w,h),c=new PerspectiveCamera(42,w/h,.05,200);c.position.set(Math.sin(v.theta)*Math.sin(.12)*v.distance,Math.cos(.12)*v.distance,-2.5+Math.cos(v.theta)*Math.sin(.12)*v.distance);c.up.set(v.theta?-1:0,0,v.theta?0:-1);c.lookAt(0,0,-2.5);c.updateMatrixWorld();const points=[];for(const x of [-15,15])for(const z of [-13,8]){const p=new Vector3(x,0,z).project(c);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1);points.push((1-p.y)*h/2);}if(w===390)assert.ok(Math.max(...points)-Math.min(...points)>400,'portrait uses height rather than a shallow strip');}
});
test('paired seated cameras keep illustrative eye height and face stage without moving source tables',()=>{
 const tor={cx:1,cz:-7,depth:2},before=JSON.stringify(tor),seat=tableViewCamera(tor);assert.equal(seat.position.y,1.15);assert.ok(seat.lookAt.y>seat.position.y);assert.equal(JSON.stringify(tor),before);
 const rows=roomPositions(MONTREAL_PLAN_SOURCE,MONTREAL_TABLES);for(const id of ['1','10A','23']){const row=rows.find(r=>r.id===id),original=JSON.stringify(row);for(const aspect of [390/900,1440/900]){const v=roomTableCamera(MONTREAL_PLAN_SOURCE,row,aspect);assert.equal(v.position.y,1.15);assert.equal(v.position.x,row.cx);assert.ok(v.aim.z<v.position.z);assert.ok(v.fov>=55&&v.fov<=100);}assert.equal(JSON.stringify(row),original);}
});

test('Montréal portrait overview puts stage on the right like Toronto',()=>{
 const v=roomOverviewCamera(MONTREAL_PLAN_SOURCE,390,900),camera=new PerspectiveCamera(43,390/900,.05,150);
 camera.position.set(Math.sin(v.theta)*Math.sin(v.phi)*v.distance,Math.cos(v.phi)*v.distance+1,Math.cos(v.theta)*Math.sin(v.phi)*v.distance);camera.lookAt(0,.35,0);camera.updateMatrixWorld();
 assert.ok(new Vector3(0,0,-5).project(camera).x>0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blankLayout, validateLayout, extent, collisions, moveBooth, addBooth,
  boothTemplates, layoutHistory, commitLayout, undoLayout, redoLayout,
  safeBusiness, mapURL, mapError, accessLost,
} from '../assets/festival/map-model.mjs';
import {planSVG} from '../assets/festival/map-view.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const booth=(n,overrides={})=>({id:id(n),label:'M'+n,x_m:5,y_m:5,width_m:3,height_m:3,rotation:0,application_id:null,...overrides});
const site=(booths=[],overrides={})=>({schema:1,width_m:60,height_m:40,booths,...overrides});

test('site validation rejects invalid dimensions, duplicate UUID identities and unsupported assignments',()=>{
 for(const input of [null,site([],{schema:2}),site([],{width_m:NaN}),site([],{height_m:Infinity}),site([],{width_m:0}),site([],{height_m:5001})])assert.throws(()=>validateLayout(input));
 const upper=booth(1,{id:'ABCDEFAB-0000-4000-8000-000000000001'});
 assert.throws(()=>validateLayout(site([upper,{...upper,id:upper.id.toLowerCase()}])),/mesa_invalid_booth/);
 assert.throws(()=>validateLayout(site([booth(1,{application_id:'not-an-application'})])),/mesa_invalid_assignment/);
 assert.throws(()=>validateLayout(site([booth(1,{rotation:45})])),/mesa_invalid_booth/);
 assert.throws(()=>validateLayout(site([booth(1,{width_m:.49})])),/mesa_invalid_booth/);
 assert.throws(()=>validateLayout(site(Array.from({length:201},(_,i)=>booth(i+1)))),/mesa_invalid_layout/);
});

test('bounds use rotated physical extents and allow exactly touching the measured site edge',()=>{
 const rotated=booth(1,{x_m:1,y_m:3,width_m:6,height_m:2,rotation:90});
 assert.deepEqual(extent(rotated),{w:2,h:6});
 assert.equal(validateLayout(site([rotated],{width_m:10,height_m:10})).booths[0].rotation,90);
 assert.throws(()=>validateLayout(site([{...rotated,rotation:0}],{width_m:10,height_m:10})),/outside_site/);
 assert.throws(()=>validateLayout(site([{...rotated,x_m:.99}],{width_m:10,height_m:10})),/outside_site/);
});

test('collision detection distinguishes touching edges from positive-area overlap, including rotation',()=>{
 const a=booth(1,{x_m:2,y_m:2,width_m:4,height_m:4});
 const b=booth(2,{x_m:6,y_m:2,width_m:4,height_m:4});
 assert.deepEqual(collisions(site([a,b])),[]);
 assert.deepEqual(collisions(site([a,{...b,x_m:5.99}])),[[a.id,b.id]]);
 const r=booth(3,{x_m:3,y_m:4,width_m:6,height_m:2,rotation:90});
 const c=booth(4,{x_m:5,y_m:4,width_m:2,height_m:2});
 assert.deepEqual(collisions(site([r,c])),[]);
 assert.equal(collisions(site([r,{...c,x_m:4.9}])).length,1);
});

test('drag movement is immutable, quarter-metre snapped and clamped using rotated dimensions',()=>{
 const original=site([booth(1,{width_m:6,height_m:2,rotation:90})]);
 const before=structuredClone(original);
 const moved=moveBooth(original,id(1),-100,1000);
 assert.deepEqual(original,before);
 assert.equal(moved.booths[0].x_m,1);
 assert.equal(moved.booths[0].y_m,37);
 const snapped=moveBooth(original,id(1),10.38,12.62);
 assert.equal(snapped.booths[0].x_m,10.5);
 assert.equal(snapped.booths[0].y_m,12.5);
 assert.throws(()=>moveBooth(original,id(9),1,1),/missing_booth/);
 assert.throws(()=>moveBooth(original,id(1),NaN,1));
});

test('template insertion finds unoccupied measured space without mutating the existing plan',()=>{
 const empty=blankLayout(),a=addBooth(empty,boothTemplates[0],()=>id(1));
 const b=addBooth(a,boothTemplates[0],()=>id(2));
 assert.equal(empty.booths.length,0);assert.equal(a.booths.length,1);assert.equal(b.booths.length,2);
 assert.equal(b.booths[1].label,'M02');assert.deepEqual(collisions(b),[]);
 assert.throws(()=>addBooth(site([],{width_m:2,height_m:2}),boothTemplates[0],()=>id(3)),/no_room/);
});

test('undo and redo keep bounded independent snapshots and discard an abandoned future',()=>{
 const initial=site([booth(1)]);let h=layoutHistory(initial);
 initial.booths[0].label='Changed outside history';
 assert.equal(h.present.booths[0].label,'M1');
 for(let i=1;i<=35;i++)h=commitLayout(h,moveBooth(h.present,id(1),5+i*.25,5));
 assert.equal(h.past.length,30);assert.equal(h.future.length,0);
 const lastX=h.present.booths[0].x_m,u=undoLayout(h),r=redoLayout(u);
 assert.equal(u.present.booths[0].x_m,lastX-.25);assert.equal(r.present.booths[0].x_m,lastX);
 const branched=commitLayout(u,moveBooth(u.present,id(1),20,5));assert.equal(branched.future.length,0);
 const parsed=validateLayout(branched.present);assert.equal(commitLayout(branched,parsed),branched);
});

test('public layout parsing strips application/private fields and keeps only the safe business projection',()=>{
 const business={slug:'rosies',name:'Rosie’s',href:'/restaurant/rosies',logo:'https://images.example/rosies.webp',profile_id:'private-profile',contact_email:'private@example.test'};
 const source=site([booth(1,{application_id:id(99),business,private_inquiry:'private-thread'})],{workspace_id:id(88)});
 const publicValue=validateLayout(source,{publicView:true});
 assert.equal(publicValue.workspace_id,undefined);assert.equal(publicValue.booths[0].application_id,undefined);assert.equal(publicValue.booths[0].private_inquiry,undefined);
 assert.deepEqual(Object.keys(publicValue.booths[0].business).sort(),['href','logo','name','slug']);
 assert.equal(JSON.stringify(publicValue).includes('private@example.test'),false);
 const privateValue=validateLayout(source);assert.equal(privateValue.booths[0].application_id,id(99));assert.equal(privateValue.booths[0].business,undefined);
});

test('business links remain local and image schemes/credentials cannot become active content',()=>{
 const base={name:'A business',slug:'a-business',href:'/business/a-business',logo:'https://images.example/logo.png'};
 assert.equal(safeBusiness(base).href,base.href);
 for(const href of ['//external.example/path','javascript:alert(1)','/\\external.example','/business/name\nnext'])assert.equal(safeBusiness({...base,href}),null);
 for(const logo of ['javascript:alert(1)','data:image/svg+xml,<svg/>','http://images.example/logo.png','https://user:secret@images.example/logo.png','https://127.0.0.1/logo'])assert.equal(safeBusiness({...base,logo}).logo,null);
});

test('SVG stand rendering escapes labels and business names without introducing markup',()=>{
 const parsed=validateLayout(site([booth(1,{label:'<script>x</script>"',application_id:id(99)})]));
 const svg=planSVG(parsed,{businesses:new Map([[id(99),{name:'"><img src=x onerror=alert(1)>'}]])});
 assert.ok(svg.includes('&lt;script&gt;'));assert.ok(svg.includes('&quot;&gt;&lt;img'));
 assert.equal(svg.includes('<script>'),false);assert.equal(svg.includes('<img'),false);
 assert.ok(svg.includes('tabindex="0"'));assert.ok(svg.includes('role="button"'));
});

test('shareable maps require actual event identities and known conflicts give recoverable guidance',()=>{
 assert.equal(mapURL(id(1)),'/festival/?event='+id(1)+'&view=map');
 assert.throws(()=>mapURL('../../private'));
 assert.match(mapError(Error('mesa_version_conflict')),/unsaved layout is still here/);
 assert.match(mapError(Error('mesa_request_conflict')),/different details/);
 assert.match(mapError(Error('network unavailable')),/same request reference/);
});


test('new templates can use clear space while unrelated draft stands overlap',()=>{
 const original=validateLayout(site([booth(1,{x_m:10,y_m:10}),booth(2,{x_m:10,y_m:10})]));
 assert.equal(collisions(original).length,1);
 const next=addBooth(original,boothTemplates[0],()=>id(3));
 assert.equal(next.booths.length,3);assert.equal(original.booths.length,2);
 assert.deepEqual(collisions(next),[[id(1),id(2)]]);
 assert.equal(collisions(next).some(pair=>pair.includes(id(3))),false);
});

test('authorization failures are distinguished from recoverable geometry, version and network failures',()=>{
 for(const error of [{status:401,message:'Unavailable'},{status:403,message:'Forbidden'},{status:'403',message:'Forbidden'},Error('no_access_to_workspace'),Error('suite_session_unavailable'),Error('mesa_application_not_owned'),Error('JWT expired')])assert.equal(accessLost(error),true,String(error.message));
 for(const error of [Error('mesa_version_conflict'),Error('mesa_booth_collision'),Error('network unavailable'),{status:500,message:'Server unavailable'}])assert.equal(accessLost(error),false,String(error.message));
});

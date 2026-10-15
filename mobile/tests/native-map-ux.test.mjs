import test from 'node:test';import assert from 'node:assert/strict';
import{navigationURL,navigationDestination,TRAVEL_MODES}from'../../assets/map-data/directions.mjs';
import{mountEmbeddedMap,embeddedMapPayload}from'../../assets/map-data/embedded.mjs';
for(const reviewed of[false,true])for(const{value:mode}of TRAVEL_MODES)test(`directions ${reviewed?'reviewed':'published address'} ${mode} preview without start; explicit start preserves navigation`,()=>{
 const destination=navigationDestination({s:'source-place',n:'Source place',lat:42.426359,lng:-83.374051,addr:'33309 Seven Mile Road',city:'Livonia',country:'United States'},{reviewed});assert(destination);
 for(const origin of['','   ','\t\n']){const u=new URL(navigationURL(destination,{mode,origin}));assert.equal(u.searchParams.get('destination'),destination.value);assert.equal(u.searchParams.get('travelmode'),mode);assert.equal(u.searchParams.has('origin'),false);assert.equal(u.searchParams.has('dir_action'),false);}
 const u=new URL(navigationURL(destination,{mode,origin:'  10 Starting Avenue  '}));assert.equal(u.searchParams.get('origin'),'10 Starting Avenue');assert.equal(u.searchParams.get('dir_action'),'navigate');assert.equal(u.searchParams.get('destination'),destination.value);
 assert.equal(new URL(navigationURL(destination,{mode,origin:'10 Starting Avenue',navigate:false})).searchParams.has('dir_action'),false);
});
test('map frame resize preserves the same controller, camera, point source and location privacy',()=>{
 const events={},actions=[],host={maplibregl:{Map:class{constructor(){actions.push('construct')}on(n,layer,handler){events[n+(typeof layer==='string'?':'+layer:'')]=handler||layer}addControl(){}addSource(){}addLayer(){}getSource(){return{setData:()=>actions.push('data')}}setPaintProperty(){}easeTo(){actions.push('camera')}resize(){actions.push('resize')}remove(){actions.push('remove')}},NavigationControl:class{}},ZoiBasemap:{style:()=>({})}},doc={getElementById:()=>({clientWidth:390,clientHeight:400})};
 const c=mountEmbeddedMap(doc,host);events.load();c.update(embeddedMapPayload([{s:'real',n:'Real',lat:42.426359,lng:-83.374051,precision:'street'}],'real'));const before=[...actions];c.resize();host.ZoiEmbeddedMap.resize();assert.deepEqual(actions,[...before,'resize','resize']);assert.equal(actions.filter(a=>a==='construct').length,1);c.destroy();assert.equal(actions.at(-1),'remove');assert.equal(host.ZoiEmbeddedMap,undefined);
});

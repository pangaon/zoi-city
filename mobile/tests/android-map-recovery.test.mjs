import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {selectedDiscoveryPoint,emptyDiscoveryRecovery,initialDiscovery,placeDirections} from '../src/discovery.ts';
import {normalizeProfile} from '../src/profile.ts';
import {embeddedMapPayload,embeddedMapCommand,embeddedMapMessage,mountEmbeddedMap} from '../../assets/map-data/embedded.mjs';
const id='11111111-1111-4111-8111-111111111111';
const entity={id,slug:'reviewed',name:'Actual parish',city:'Toronto',country:'Canada',address:'22 Actual Street',publish_status:'published',geo_precision:'street',latitude:43.7,longitude:-79.4,reviewed_destination:{listing_id:id,request_id:'actual-receipt',precision:'street',latitude:43.7,longitude:-79.4}};
test('fresh selected receipt places and routes before feed arrives; altered or hidden proof is rejected',()=>{
 const p=selectedDiscoveryPoint(entity,null);assert.equal(p.lat,43.7);assert.equal(p.lng,-79.4);assert.equal(p.reviewedSelected,true);
 assert.equal(new URL(placeDirections(entity,p).url).searchParams.get('destination'),'43.7,-79.4');
 for(const e of [{...entity,latitude:44},{...entity,marketplace_status:'hidden'},{...entity,publish_status:'draft'},{...entity,reviewed_destination:{...entity.reviewed_destination,listing_id:'wrong'}},{...entity,geo_precision:'city'}])assert.equal(selectedDiscoveryPoint(e,null),null);
});
test('global empty recovery clears restrictive search; local recovery widens without mutating saved home',()=>{
 const state={...initialDiscovery(),input:'nothing',query:'nothing',type:'church',selected:'old'},home={city:'Toronto',country:'Canada'};
 const global=emptyDiscoveryRecovery(state,{source:'global'});assert.equal(global.label,'Explore all places');assert.equal(global.state.query,'');assert.equal(global.state.input,'');assert.equal(global.state.type,'');assert.equal(global.state.selected,'');
 const local=emptyDiscoveryRecovery(state,{source:'home',...home});assert.equal(local.label,'Search everywhere');assert.equal(local.state.query,'nothing');assert.deepEqual(home,{city:'Toronto',country:'Canada'});
});
test('public embedded payload excludes coarse pins and account fields, bounds selection and escapes executable input',()=>{
 const points=[{s:'valid',n:'</script><script>bad()</script>',lat:43,lng:-79,precision:'street',token:'private',actor:'secret'},{s:'city',lat:43,lng:-79,precision:'city'},{s:'valid',lat:44,lng:-78,precision:'street'}];
 const payload=embeddedMapPayload(points,'city');assert.equal(payload.points.length,1);assert.equal(payload.selected,'');assert(!JSON.stringify(payload).includes('private'));assert(!JSON.stringify(payload).includes('secret'));
 const command=embeddedMapCommand(payload);assert(!command.includes('</script>'));let received;vm.runInNewContext(command,{window:{ZoiEmbeddedMap:{update:v=>{received=v;}}}});assert.equal(received.points[0].n,points[0].n);
 assert.equal(embeddedMapMessage(JSON.stringify({type:'map.select',slug:'city'}),points),null);assert.equal(embeddedMapMessage(JSON.stringify({type:'map.select',slug:'unknown'}),points),null);assert.deepEqual(embeddedMapMessage(JSON.stringify({type:'map.select',slug:'valid'}),points),{type:'map.select',slug:'valid'});
 for(const value of ['invalid',JSON.stringify({type:'map.view',latitude:100,longitude:0,zoom:5}),JSON.stringify({type:'map.view',latitude:0,longitude:0,zoom:30}),'x'.repeat(2049)])assert.equal(embeddedMapMessage(value,points),null);
});
test('embedded controller renders reviewed positions and selection, reports clicks and preserves manually moved camera',()=>{
 const events={},messages=[],moves=[],fits=[],data=[];let removed=false;
 class Map{addControl(){}on(event,layer,handler){events[event+(typeof layer==='string'?':'+layer:'')]=handler||layer;}addSource(){}addLayer(){}getSource(){return {setData:v=>data.push(v),getClusterExpansionZoom:async()=>10};}setPaintProperty(){}easeTo(v){moves.push(v);}fitBounds(bounds,options){fits.push({bounds,options});}getCenter(){return {lat:43,lng:190};}getZoom(){return 12;}remove(){removed=true;}}
 const host={maplibregl:{Map,NavigationControl:class{}},ZoiBasemap:{style:()=>({})},ReactNativeWebView:{postMessage:v=>messages.push(JSON.parse(v))}},doc={getElementById:()=>({clientWidth:390})};
 const control=mountEmbeddedMap(doc,host);events.load();assert.deepEqual(messages[0],{type:'map.ready'});
 const payload=embeddedMapPayload([{s:'actual',lat:43,lng:-79,precision:'street'}],'actual');control.update(payload);assert.deepEqual(data.at(-1).features[0].geometry.coordinates,[-79,43]);assert.equal(moves.length,1);control.update(payload);assert.equal(moves.length,1);
 events['click:zoi-pins']({features:[{properties:{slug:'actual'}}]});assert.deepEqual(messages.at(-1),{type:'map.select',slug:'actual'});events.moveend();assert.equal(messages.at(-1).type,'map.view');assert.equal(messages.at(-1).longitude,-170);assert(embeddedMapMessage(JSON.stringify(messages.at(-1)),payload.points));
 control.update({...payload,focus:true});assert.equal(moves.length,2);control.update({...payload,selected:'',fit:true});assert.equal(fits.length,1);control.destroy();assert.equal(removed,true);assert.equal(host.ZoiEmbeddedMap,undefined);
});
test('native profile address search is labelled lookup and declines locality-only or missing country destinations',()=>{
 const p=normalizeProfile(entity);assert.equal(p.addressLookup.basis,'published-address');assert.equal(new URL(p.addressLookup.href).searchParams.get('query'),'Actual parish, 22 Actual Street, Toronto, Canada');
 assert.equal(normalizeProfile({...entity,address:'Toronto'}).addressLookup,null);assert.equal(normalizeProfile({...entity,country:''}).addressLookup,null);
});

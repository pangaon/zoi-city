import {validatedDeviceFix,deviceLocationRegion,deviceLocationLabel,deviceAccuracyFeature} from './foreground-location.mjs';
import {hasStreetPosition,validCoordinates,matchBounds,focusOptions} from './loader.mjs';
// Only public drawable positions enter this document. Account context is excluded.
export function embeddedMapPayload(points,selected,{fit=false,focus=false,motion=true,selectionFocus=true}={}){
 const seen=new Set(),pins=[];
 for(const p of points||[]){if(pins.length>=50000)break;if(!hasStreetPosition(p)||typeof p.s!=='string'||!p.s||p.s.length>240||seen.has(p.s))continue;seen.add(p.s);pins.push({s:p.s,n:String(p.n||'').slice(0,300),lat:Number(p.lat),lng:Number(p.lng),precision:'street'});}
 return {points:pins,selected:seen.has(selected)?selected:'',fit:!!fit,focus:!!focus,motion:!!motion,selectionFocus:!!selectionFocus};
}
export function embeddedMapCommand(payload){return 'window.ZoiEmbeddedMap&&window.ZoiEmbeddedMap.update('+JSON.stringify(payload).replace(/</g,'\\u003c')+');true;';}
export function embeddedMapMessage(value,points){
 if(typeof value!=='string'||value.length>2048)return null;let v;try{v=JSON.parse(value)}catch{return null;}
 if(v?.type==='map.ready'||v?.type==='map.error'||v?.type==='map.interaction')return {type:v.type};
 if(v?.type==='map.select'&&typeof v.slug==='string'&&points.some(p=>p.s===v.slug&&hasStreetPosition(p)))return {type:v.type,slug:v.slug};
 if(v?.type==='map.view'&&[v.latitude,v.longitude,v.zoom].every(Number.isFinite)&&Math.abs(v.latitude)<=90&&Math.abs(v.longitude)<=180&&v.zoom>=0&&v.zoom<=24)return {type:v.type,latitude:v.latitude,longitude:v.longitude,longitudeDelta:360/(2**v.zoom)};
 return null;
}

export function embeddedLocationCommand(value,{center=false,motion=false}={}){
 const fix=value&&validatedDeviceFix({coords:value,timestamp:value.timestamp},{requestedAt:value.timestamp});
 return 'window.ZoiEmbeddedMap&&window.ZoiEmbeddedMap.location('+JSON.stringify({fix:fix||null,center:!!center,motion:!!motion}).replace(/</g,'\\u003c')+');true;';
}
export function embeddedMapDocument(){return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><link rel="stylesheet" href="https://www.zoi.city/assets/vendor/maplibre-gl.css"><style>html,body,#map{margin:0;width:100%;height:100%;background:#eef4f8}.maplibregl-ctrl-attrib{font-size:10px}</style></head><body><div id="map" role="region" aria-label="Zoi interactive places map"></div><script src="https://www.zoi.city/assets/vendor/maplibre-gl.js"></script><script src="https://www.zoi.city/assets/zoi-basemap.js"></script><script type="module">try{const {mountEmbeddedMap}=await import('https://www.zoi.city/assets/map-data/embedded.mjs?v=20261015-foreground-location');mountEmbeddedMap();}catch{window.ReactNativeWebView?.postMessage(JSON.stringify({type:'map.error'}));}</script></body></html>`;}
export function mountEmbeddedMap(doc=globalThis.document,host=globalThis){
 const post=v=>host.ReactNativeWebView?.postMessage(JSON.stringify(v));let map,loaded=false,latest=null,selection='',locationValue=null,deviceMarker=null;
 const timer=setTimeout(()=>{if(!loaded)post({type:'map.error'});},12000);
 try{
  map=new host.maplibregl.Map({container:doc.getElementById('map'),style:host.ZoiBasemap.style({theme:'light',terrain:false,buildings:true}),center:[15,37],zoom:1.5,attributionControl:true,pitch:0,bearing:0});
  map.addControl(new host.maplibregl.NavigationControl({showCompass:false}),'top-right');
  map.on('load',()=>{
   map.addSource('zoi-places',{type:'geojson',data:{type:'FeatureCollection',features:[]},cluster:true,clusterMaxZoom:16,clusterRadius:36});
   map.addLayer({id:'zoi-clusters',type:'circle',source:'zoi-places',filter:['has','point_count'],paint:{'circle-color':'#075dcc','circle-radius':21,'circle-stroke-color':'#fff','circle-stroke-width':3}});
   map.addLayer({id:'zoi-counts',type:'symbol',source:'zoi-places',filter:['has','point_count'],layout:{'text-field':'{point_count_abbreviated}','text-font':['Noto Sans Bold'],'text-size':13},paint:{'text-color':'#fff'}});
   map.addLayer({id:'zoi-pins',type:'circle',source:'zoi-places',filter:['!',['has','point_count']],paint:{'circle-color':'#075dcc','circle-radius':9,'circle-stroke-color':'#fff','circle-stroke-width':3}});
   map.addSource('zoi-device-accuracy',{type:'geojson',data:deviceAccuracyFeature(null)});
   map.addLayer({id:'zoi-device-accuracy',type:'fill',source:'zoi-device-accuracy',paint:{'fill-color':'#1676df','fill-opacity':0.12}});
   loaded=true;clearTimeout(timer);post({type:'map.ready'});if(latest)update(latest);if(locationValue)location(locationValue);
  });
  map.on('click','zoi-pins',e=>{const slug=e.features?.[0]?.properties?.slug;if(latest?.points.some(p=>p.s===slug))post({type:'map.select',slug});});
  map.on('click','zoi-clusters',async e=>{const f=e.features?.[0];if(!f)return;try{const zoom=await map.getSource('zoi-places').getClusterExpansionZoom(f.properties.cluster_id);map.easeTo({center:f.geometry.coordinates,zoom,duration:latest?.motion?300:0});}catch{}});
  map.on('movestart',event=>{if(event?.originalEvent)post({type:'map.interaction'});});
  map.on('click',()=>post({type:'map.interaction'}));
  map.on('moveend',()=>{const center=map.getCenter();post({type:'map.view',latitude:center.lat,longitude:((center.lng+180)%360+360)%360-180,zoom:map.getZoom()});});
  map.on('error',()=>{if(!loaded)post({type:'map.error'});});
 }catch{clearTimeout(timer);post({type:'map.error'});}
 function update(value){
  if(!value||!Array.isArray(value.points)||value.points.length>50000)return;
  latest={...value,points:value.points.filter(p=>typeof p.s==='string'&&validCoordinates(p))};if(!loaded)return;
  map.getSource('zoi-places').setData({type:'FeatureCollection',features:latest.points.map(p=>({type:'Feature',geometry:{type:'Point',coordinates:[p.lng,p.lat]},properties:{slug:p.s}}))});
  map.setPaintProperty('zoi-pins','circle-color',['case',['==',['get','slug'],latest.selected],'#10294d','#075dcc']);
  const point=latest.points.find(p=>p.s===latest.selected);
  if(point&&latest.selectionFocus!==false&&(latest.selected!==selection||latest.focus))map.easeTo(focusOptions(point,{width:doc.getElementById('map').clientWidth,height:340,reducedMotion:!latest.motion}));
  else if(latest.fit){const bounds=matchBounds(latest.points);if(bounds)map.fitBounds(bounds,{padding:45,maxZoom:13,duration:latest.motion?350:0});}
  selection=latest.selected;
 }
 function location(value){
  locationValue=value;if(!loaded)return;deviceMarker?.remove();deviceMarker=null;
  const fix=value?.fix&&validatedDeviceFix({coords:value.fix,timestamp:value.fix.timestamp},{requestedAt:value.fix.timestamp});
  map.getSource('zoi-device-accuracy').setData(deviceAccuracyFeature(fix));if(!fix)return;
  const node=doc.createElement('div');node.setAttribute('role','img');node.setAttribute('aria-label',deviceLocationLabel(fix));node.title=deviceLocationLabel(fix);Object.assign(node.style,{width:'18px',height:'18px',borderRadius:'50%',background:'#1676df',border:'3px solid white'});
  deviceMarker=new host.maplibregl.Marker({element:node}).setLngLat([fix.longitude,fix.latitude]).addTo(map);
  if(value.center){const r=deviceLocationRegion(fix);map.easeTo({center:[fix.longitude,fix.latitude],zoom:Math.max(1,Math.min(14,Math.log2(360/r.longitudeDelta))),duration:value.motion?300:0});}
 }
 host.ZoiEmbeddedMap={update,location};return {update,location,destroy(){clearTimeout(timer);loaded=false;deviceMarker?.remove();map?.remove();delete host.ZoiEmbeddedMap;}};
}

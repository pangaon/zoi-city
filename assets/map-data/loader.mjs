import { positionPair, diagnosePosition, canonicalPositionPrecision } from './coordinate-integrity.mjs';
// Bounded worker slots; chunk retries stay within their logical page slot.
export function transientMapFailure(error){
 const status=Number(error?.status||error?.statusCode),code=String(error?.code||'');
 if([408,425,429,500,502,503,504].includes(status)||['REQUEST_TIMEOUT','57014'].includes(code))return true;
 if(status>=400&&status<500)return false;
 return /statement timeout|canceling statement|failed to fetch|fetch failed|network(?:error| request failed| error)|service took too long|timed? ?out/i.test(String(error?.message||''));
}
export async function retryMapRead(read,{retries=2,wait=ms=>new Promise(r=>setTimeout(r,ms)),retryable=transientMapFailure}={}){
 if(!Number.isSafeInteger(retries)||retries<0||retries>2)throw Error('Invalid retry limit');
 for(let attempt=0;;attempt++){try{return await read();}catch(error){if(attempt>=retries||!retryable(error))throw error;await wait(350*2**attempt);}}
}
// Combine bounded transport chunks into the original logical page. A timeout
// retries the SAME offset with a smaller limit; only a genuinely short response
// establishes the end. A failed chunk rejects the whole page, never skips rows.
export function createAdaptiveMapRead(fetchPage,{requestSize=250,minRequestSize=125,retries=2,wait}={}){
 if(!Number.isSafeInteger(requestSize)||!Number.isSafeInteger(minRequestSize)||minRequestSize<1||requestSize<minRequestSize)throw Error('Invalid chunk limits');
 let preferred=requestSize;
 const timeout=error=>String(error?.code||'')==='57014'||/statement timeout|canceling statement/i.test(String(error?.message||''));
 return async(offset,limit)=>{
  if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1)throw Error('Invalid page limits');
  const rows=[];
  while(rows.length<limit){
   const size=Math.min(preferred,limit-rows.length);let chunk;
   try{chunk=await retryMapRead(()=>fetchPage(offset+rows.length,size),{retries,wait,retryable:error=>!timeout(error)&&transientMapFailure(error)});}
   catch(error){if(timeout(error)&&size>minRequestSize){preferred=Math.max(minRequestSize,Math.floor(size/2));continue;}throw error;}
   if(!Array.isArray(chunk)||chunk.length>size)throw Error('Invalid page response');
   rows.push(...chunk);if(chunk.length<size)break;
  }
  return rows;
 };
}
// No coordinates are inferred from the address, city or another same-name place.
export function unmappedPlace(entity,slug){
 if(Array.isArray(entity))entity=entity[0];
 if(!entity||typeof slug!=='string'||!slug||slug.length>240||!entity.id||!entity.name||(entity.slug!==slug&&entity.canonical_slug!==slug)||entity.marketplace_status==='hidden'||entity.publish_status&&entity.publish_status!=='published')return null;
 return{s:entity.canonical_slug||entity.slug,n:entity.name,t:entity.entity_type||'business',city:entity.city||'',country:entity.country||'',cat:entity.category_slug||'',addr:entity.address||null,lat:null,lng:null,unmapped:true,entity};
}
export async function loadMapPages(fetchPage,{pageSize=1000,maxRows=40000,concurrency=4,onProgress=()=>{},retries=2,wait}={}){
 if(!Number.isSafeInteger(pageSize)||pageSize<1||!Number.isSafeInteger(maxRows)||maxRows<pageSize||!Number.isSafeInteger(concurrency)||concurrency<1||concurrency>4)throw Error('Invalid pagination limits');
 const maxPages=Math.floor(maxRows/pageSize),pages=[],failedOffsets=[];let requests=0,endDetected=false,stoppedOnFailure=false;
 // Probe the first page before fan-out so an unavailable service receives one retry chain.
 for(let first=0;first<maxPages;){const width=first===0?1:Math.min(concurrency,maxPages-first);const indexes=Array.from({length:width},(_,i)=>first+i);const batch=await Promise.all(indexes.map(async index=>{try{const rows=await retryMapRead(()=>{requests++;return fetchPage(index*pageSize,pageSize);},{retries,wait});if(!Array.isArray(rows)||rows.length>pageSize)throw Error('Invalid page response');return{index,rows};}catch(error){return{index,error};}}));
 let end=Infinity;for(const result of batch)if(!result.error&&result.rows.length<pageSize)end=Math.min(end,result.index);
 for(const result of batch){if(result.index>end)continue;if(result.error)failedOffsets.push(result.index*pageSize);else pages.push(result);}
 endDetected=Number.isFinite(end);onProgress({requests,loaded:pages.reduce((n,p)=>n+p.rows.length,0),failedPages:failedOffsets.length});
 if(endDetected)break;if(batch.every(r=>r.error)){stoppedOnFailure=true;break;}first+=width;
 }
 if(!pages.length)throw Error('Directory unavailable: no page could be loaded');
 pages.sort((a,b)=>a.index-b.index);const rows=pages.flatMap(p=>p.rows);const truncated=!endDetected&&!stoppedOnFailure&&pages.length+failedOffsets.length>=maxPages;
 return{rows,failedOffsets,requests,endDetected,truncated,complete:endDetected&&!failedOffsets.length,stoppedOnFailure};
}
export function focusOptions(point,{width=1200,height=800,left=0,right=0,top=0,bottom=0,reducedMotion=false,currentZoom=null}={}){
 const precision=String(point.precision||'').toLowerCase();const zoom=({rooftop:15.5,address:15.5,street:14,neighborhood:12,neighbourhood:12,suburb:12,locality:10,town:10,city:10,region:6,country:4,approx:8,approximate:8})[precision]??6;
 const horizontal=Math.min(1,Math.max(0,width-100)/Math.max(1,left+right)),vertical=Math.min(1,Math.max(0,height-100)/Math.max(1,top+bottom));
 const preservedZoom=typeof currentZoom==='number'&&Number.isFinite(currentZoom)?Math.min(18.5,Math.max(zoom,currentZoom)):zoom;
 return{center:[point.lng,point.lat],zoom:preservedZoom,pitch:0,bearing:0,padding:{left:Math.round(left*horizontal),right:Math.round(right*horizontal),top:Math.round(top*vertical),bottom:Math.round(bottom*vertical)},retainPadding:false,duration:reducedMotion?0:1400,essential:false};
}

// Reject coercion-only coordinates and the missing-coordinate (0,0) sentinel.
// A real point on the equator or prime meridian remains eligible.
export function validCoordinates(point){
 const numeric=value=>typeof value==='number'?Number.isFinite(value):typeof value==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())&&Number.isFinite(Number(value));
 return !!point&&numeric(point.lat)&&numeric(point.lng)&&Math.abs(Number(point.lat))<=90&&Math.abs(Number(point.lng))<=180&&!(Number(point.lat)===0&&Number(point.lng)===0);
}
export function isMappableRow(row){return !!(row&&typeof row.slug==='string'&&row.slug&&positionPair(row).valid);}
function positionSourceContext(row){const e=row.source_context||row.profile?._enrich||{};return{scope_review_required:e.source_scope_mismatch===true||e.source_scope_mismatch==='true'||row.geo_metadata?.scope_conflict===true||e.scope_review_required===true||e.scope_review_required==='true',organization_identity_quarantine:e.organization_identity_quarantine===true||e.organization_identity_quarantine==='true',blocked_reason:e.blocked_reason==='source_scope_mismatch'?'source_scope_mismatch':null,identity_scope:e.identity_scope==='organization'?'organization':null,source_kind:e.source_kind==='association_member'?'association_member':null};}
export function mapPositionFields(row){const pair=positionPair(row),metadata=row.geo_metadata||row.profile?._geo||row._geo,diagnosis=diagnosePosition({...row,geo_metadata:metadata}),raw=row.geo_precision??row.precision??row._geo?.precision??'';return{id:row.id,lat:pair.latitude,lng:pair.longitude,precision:diagnosis.effective_precision==='street'?(canonicalPositionPrecision(raw)==='street'?raw:'street'):diagnosis.effective_precision,geo_metadata:metadata,source_context:positionSourceContext(row),entity_type:row.entity_type,reviewed_destination:row.reviewed_destination,position_diagnosis:diagnosis};}

// Only address/street evidence may place an individual listing on the map.
export function hasStreetPosition(point){return !!point&&!point.position_conflict&&diagnosePosition(point).drawable&&validCoordinates(point);}

export function positionStatus(point){if(!point)return 'Map position not available';const d=diagnosePosition(point);if(point.position_conflict||d.state==='conflicting_position_evidence')return 'Map position under review · use published address';if(!hasStreetPosition(point))return d.effective_precision==='unknown'?'Map position not verified · no precise pin':'Approximate area · no precise pin';return d.reviewed?'Reviewed map position':'Stored map position · not independently verified';}
export function positionCoverage(points){let reviewed=0,unverified=0;for(const p of points||[]){if(!hasStreetPosition(p))continue;if(diagnosePosition(p).reviewed)reviewed++;else unverified++;}return{reviewed,unverified,total:reviewed+unverified};}



/** Bounds never imply premises from coarse or unverified coordinates. */
export function matchBounds(points){
 const valid=points.filter(hasStreetPosition);if(!valid.length)return null;
 const longitudes=valid.map(p=>({original:Number(p.lng),wrapped:Number(p.lng)<0?Number(p.lng)+360:Number(p.lng)})).sort((a,b)=>a.wrapped-b.wrapped);
 let gap=-1,west=0,east=0,south=90,north=-90;
 for(let i=0;i<longitudes.length;i++){const following=longitudes[(i+1)%longitudes.length],next=following.wrapped+(i===longitudes.length-1?360:0),size=next-longitudes[i].wrapped;if(size>gap){gap=size;west=following.original;east=longitudes[i].original;}}
 if(east<west)east+=360;
 for(const p of valid){south=Math.min(south,Number(p.lat));north=Math.max(north,Number(p.lat));}
 // An eastern value above 180 is intentional: MapLibre fits the short
 // antimeridian arc instead of sending Fiji/Samoa results around the globe.
 return[[west,south],[east,north]];
}

/** Reused geocoder fallback coordinates are not street evidence, even if labelled so. */
export function validatePositionCohorts(points){
 const groups=new Map(),key=p=>Number(p.lat).toFixed(5)+','+Number(p.lng).toFixed(5),fold=v=>String(v||'').normalize('NFKC').toLocaleLowerCase().trim().replace(/\s+/g,' ');
 for(const point of points){const k=key(point);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(point);}
 const conflicts=new Set();for(const [k,group] of groups){const cities=new Set(group.filter(p=>p.city&&p.country).map(p=>fold(p.city)+'|'+fold(p.country))),addresses=new Set(group.map(p=>fold(p.addr||p.address)).filter(Boolean));if(cities.size>1||addresses.size>8)conflicts.add(k);}
 return points.map(point=>({...point,position_conflict:conflicts.has(key(point))&&!diagnosePosition(point).reviewed}));
}

// Public area search supplements the coordinate feed; it never supplies pins.
export function createMapAreaSearch(fetchPage,{changed=()=>{},pageSize=24,allowGlobal=false}={}){
 let generation=0,key='',scope=null,rows=[],offset=0,busy=false,done=false,error=null;
 const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const state=()=>({key,rows:rows.slice(),offset,busy,done,error,active:!!scope});
 async function more(){if(!scope||busy||done)return;const token=generation,snapshot={...scope};busy=true;error=null;changed(state());try{
  const result=await fetchPage({p_q:snapshot.q||null,p_city:snapshot.city||null,p_country:snapshot.country||null,p_type:null,p_limit:pageSize,p_offset:offset});
  if(token!==generation)return;if(!Array.isArray(result)||result.length>pageSize)throw Error('Invalid area results');
  const valid=result.filter(r=>r&&r.id&&r.slug&&r.name&&(!snapshot.city||fold(r.city)===fold(snapshot.city))&&(!snapshot.country||fold(r.country)===fold(snapshot.country))&&r.marketplace_status!=='hidden'&&(!r.publish_status||r.publish_status==='published'));
  const seen=new Set(rows.map(r=>r.slug));for(const row of valid)if(!seen.has(row.slug)){seen.add(row.slug);rows.push(row);}
  offset+=result.length;done=result.length<pageSize;
 }catch(e){if(token===generation)error='Additional places could not be loaded. Retry this area.';}finally{if(token===generation){busy=false;changed(state());}}}
 return{state,more,setScope(next){const clean={q:String(next.q||'').trim(),city:String(next.city||'').trim(),country:String(next.country||'').trim(),actor:String(next.actor||'')},nextKey=JSON.stringify(clean);if(nextKey===key)return;generation++;key=nextKey;scope=clean.q||clean.city||clean.country||allowGlobal?clean:null;rows=[];offset=0;busy=false;done=false;error=null;},clear(){generation++;key='';scope=null;rows=[];offset=0;busy=false;done=false;error=null;}};
}
export function areaResultPlace(row){const place=unmappedPlace(row,row?.slug);return place?{...place,areaResult:true,precision:'',unknown:true,exact:false}:null;}

// This searches a published postal address; it never supplies a Zoi pin,
// inferred distance, provider place ID or numerical routing destination.
export function publishedAddressLookup(place,{address=place?.addr,name=place?.n,city=place?.city,country=place?.country}={}){
 const clean=(value,limit)=>typeof value==='string'&&value.length<=limit?value.replace(/<[^>]*(?:>|$)/g,' ').replace(/\s+/g,' ').trim():'';
 const label=clean(name,300),postal=clean(address,500),locality=clean(city,160),nation=clean(country,160),fold=value=>value.normalize('NFKC').toLocaleLowerCase();
 if(!place?.s||!label||!postal||!nation||[locality,nation,[locality,nation].filter(Boolean).join(', ')].filter(Boolean).some(v=>fold(v)===fold(postal)))return null;
 const query=[label,postal,locality,nation].filter(Boolean).join(', '),url=new URL('https://www.google.com/maps/search/');url.searchParams.set('api','1');url.searchParams.set('query',query);
 return url.href.length<=2048?{href:url.href,label:'Find published address ↗',basis:'published-address',address:postal}:null;
}

// Proof is returned by the receipt-backed public reader, never inferred from
// editable profile metadata. Require the same fresh entity and feed point.
export function hasReviewedPosition(place,entity){
 if(Array.isArray(entity))entity=entity[0];
 if(!place||!entity?.id||entity.marketplace_status==='hidden'||entity.publish_status&&entity.publish_status!=='published'||!place.s||(entity.slug!==place.s&&entity.canonical_slug!==place.s)||place.position_conflict||place.areaResult)return false;
 const proof=entity.reviewed_destination;
 return diagnosePosition(entity).route_to_coordinates&&hasStreetPosition(place)&&proof?.listing_id===entity.id&&typeof proof.request_id==='string'&&proof.precision==='street'&&entity.geo_precision==='street'&&validCoordinates({lat:proof.latitude,lng:proof.longitude})&&Number(proof.latitude)===Number(entity.latitude)&&Number(proof.longitude)===Number(entity.longitude)&&Number(proof.latitude)===Number(place.lat)&&Number(proof.longitude)===Number(place.lng);
}

// A single selected profile can have fresher proof than a still-loading feed.
// This does not approve other catalogue points or infer a pin from an address.
export function reviewedSelectedPlace(place,entity){
 if(Array.isArray(entity))entity=entity[0];
 if(!place||place.areaResult||!entity?.id||!place.s||(entity.slug!==place.s&&entity.canonical_slug!==place.s)||entity.marketplace_status==='hidden'||entity.publish_status!=='published')return null;
 const proof=entity.reviewed_destination;
 if(!diagnosePosition(entity).route_to_coordinates)return null;
 if(proof?.listing_id!==entity.id||typeof proof.request_id!=='string'||!proof.request_id||proof.precision!=='street'||entity.geo_precision!=='street'||!validCoordinates({lat:entity.latitude,lng:entity.longitude})||!validCoordinates({lat:proof.latitude,lng:proof.longitude})||Number(proof.latitude)!==Number(entity.latitude)||Number(proof.longitude)!==Number(entity.longitude))return null;
 return {...place,...mapPositionFields(entity),id:entity.id,lat:Number(entity.latitude),lng:Number(entity.longitude),precision:'street',unmapped:false,areaResult:false,position_conflict:false,unknown:false,exact:true,reviewedPosition:true,reviewedSelected:true,entity};
}

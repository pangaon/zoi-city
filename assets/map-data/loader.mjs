// Four requests maximum in flight; retries stay within each worker slot.
export function transientMapFailure(error){
 const status=Number(error?.status||error?.statusCode),code=String(error?.code||'');
 if([408,425,429,500,502,503,504].includes(status)||['REQUEST_TIMEOUT','57014'].includes(code))return true;
 if(status>=400&&status<500)return false;
 return /statement timeout|canceling statement|failed to fetch|fetch failed|network(?:error| request failed| error)|service took too long|timed? ?out/i.test(String(error?.message||''));
}
export async function retryMapRead(read,{retries=2,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 if(!Number.isSafeInteger(retries)||retries<0||retries>2)throw Error('Invalid retry limit');
 for(let attempt=0;;attempt++){try{return await read();}catch(error){if(attempt>=retries||!transientMapFailure(error))throw error;await wait(350*2**attempt);}}
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
 for(let first=0;first<maxPages;first+=concurrency){const indexes=Array.from({length:Math.min(concurrency,maxPages-first)},(_,i)=>first+i);const batch=await Promise.all(indexes.map(async index=>{try{const rows=await retryMapRead(()=>{requests++;return fetchPage(index*pageSize,pageSize);},{retries,wait});if(!Array.isArray(rows)||rows.length>pageSize)throw Error('Invalid page response');return{index,rows};}catch(error){return{index,error};}}));
 let end=Infinity;for(const result of batch)if(!result.error&&result.rows.length<pageSize)end=Math.min(end,result.index);
 for(const result of batch){if(result.index>end)continue;if(result.error)failedOffsets.push(result.index*pageSize);else pages.push(result);}
 endDetected=Number.isFinite(end);onProgress({requests,loaded:pages.reduce((n,p)=>n+p.rows.length,0),failedPages:failedOffsets.length});
 if(endDetected)break;if(batch.every(r=>r.error)){stoppedOnFailure=true;break;}
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
export function isMappableRow(row){return !!(row&&typeof row.slug==='string'&&row.slug&&validCoordinates(row));}

// Only address/street evidence may place an individual listing on the map.
export function hasStreetPosition(point){return !!point&&!point.position_conflict&&['street','address','rooftop'].includes(String(point.precision||point.geo_precision||'').toLowerCase())&&validCoordinates(point);}


/** Bounds never imply premises from coarse or unverified coordinates. */
export function matchBounds(points){const valid=points.filter(hasStreetPosition);if(!valid.length)return null;let west=180,east=-180,south=90,north=-90;for(const p of valid){west=Math.min(west,+p.lng);east=Math.max(east,+p.lng);south=Math.min(south,+p.lat);north=Math.max(north,+p.lat);}return[[west,south],[east,north]];}

/** Reused geocoder fallback coordinates are not street evidence, even if labelled so. */
export function validatePositionCohorts(points){
 const groups=new Map(),key=p=>Number(p.lat).toFixed(5)+','+Number(p.lng).toFixed(5),fold=v=>String(v||'').normalize('NFKC').toLocaleLowerCase().trim().replace(/\s+/g,' ');
 for(const point of points){const k=key(point);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(point);}
 const conflicts=new Set();for(const [k,group] of groups){const cities=new Set(group.filter(p=>p.city&&p.country).map(p=>fold(p.city)+'|'+fold(p.country))),addresses=new Set(group.map(p=>fold(p.addr||p.address)).filter(Boolean));if(cities.size>1||addresses.size>8)conflicts.add(k);}
 return points.map(point=>({...point,position_conflict:conflicts.has(key(point))}));
}

// Public area search supplements the coordinate feed; it never supplies pins.
export function createMapAreaSearch(fetchPage,{changed=()=>{},pageSize=24}={}){
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
 return{state,more,setScope(next){const clean={q:String(next.q||'').trim(),city:String(next.city||'').trim(),country:String(next.country||'').trim(),actor:String(next.actor||'')},nextKey=JSON.stringify(clean);if(nextKey===key)return;generation++;key=nextKey;scope=clean.q||clean.city||clean.country?clean:null;rows=[];offset=0;busy=false;done=false;error=null;},clear(){generation++;key='';scope=null;rows=[];offset=0;busy=false;done=false;error=null;}};
}
export function areaResultPlace(row){const place=unmappedPlace(row,row?.slug);return place?{...place,areaResult:true,precision:'',unknown:true,exact:false}:null;}

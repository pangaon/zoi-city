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

export function isMappableRow(row){return !!(row&&typeof row.slug==='string'&&row.slug&&row.lat!=null&&row.lng!=null&&Number.isFinite(+row.lat)&&Number.isFinite(+row.lng)&&Math.abs(+row.lat)<=90&&Math.abs(+row.lng)<=180);}

/** Bounds use loaded public coordinates only; they do not improve their accuracy. */
export function matchBounds(points){const valid=points.filter(p=>p.lat!=null&&p.lng!=null&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lng)&&Math.abs(+p.lat)<=90&&Math.abs(+p.lng)<=180);if(!valid.length)return null;let west=180,east=-180,south=90,north=-90;for(const p of valid){west=Math.min(west,+p.lng);east=Math.max(east,+p.lng);south=Math.min(south,+p.lat);north=Math.max(north,+p.lat);}return[[west,south],[east,north]];}

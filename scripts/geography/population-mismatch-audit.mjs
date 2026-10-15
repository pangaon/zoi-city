import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {positionPair,positionCohorts,diagnosePosition} from '../../assets/map-data/coordinate-integrity.mjs';

const text=v=>typeof v==='string'?v.trim():'';
// Exact Unicode/case/whitespace equivalence only. No fuzzy transliteration,
// accent removal, nearest-city assignment or replacement of canonical fields.
const exact=v=>text(v).normalize('NFKC').toLowerCase().replace(/\s+/gu,' ');
const street=v=>exact(v).replace(/[\p{P}\p{S}]+/gu,' ').replace(/\s+/gu,' ').trim();
const hash=v=>createHash('sha256').update(v).digest('hex');
const add=(map,key,value)=>{if(!key)return;if(!map.has(key))map.set(key,new Set());map.get(key).add(value);};
export function readGeoNames(countryText,cityText){
 if(typeof countryText!=='string'||typeof cityText!=='string'||countryText.length>1000000||cityText.length>100000000)throw Error('gazetteer_bounds');
 const countries=new Map(),names=new Map(),places=new Map();
 for(const line of countryText.split('\n')){if(!line||line.startsWith('#'))continue;const f=line.split('\t');if(!/^[A-Z]{2}$/.test(f[0])||!/^[A-Z]{3}$/.test(f[1])||!f[4])throw Error('invalid_country_reference');for(const n of [f[0],f[1],f[4]])add(countries,exact(n),f[0]);}
 for(const line of cityText.split('\n')){if(!line)continue;const f=line.split('\t'),id=Number(f[0]),latitude=Number(f[4]),longitude=Number(f[5]);if(f.length<19||!Number.isSafeInteger(id)||f[6]!=='P'||!positionPair({latitude,longitude}).valid||!countries.has(exact(f[8])))throw Error('invalid_city_reference');
  const p={id,name:f[1],country:f[8],latitude,longitude,feature:f[7]};if(places.has(id))throw Error('duplicate_city_reference');places.set(id,p);
  for(const n of new Set([f[1],f[2],...f[3].split(',')]))add(names,exact(n),id);
 }
 return{countries,names,places,source_sha256:{country_info:hash(countryText),cities:hash(cityText)}};
}
function countryCode(value,g){const values=g.countries.get(exact(value));return values?.size===1?[...values][0]:null;}
export function greatCircleKm(a,b){const rad=Math.PI/180,dlat=(b.latitude-a.latitude)*rad,dlon=(b.longitude-a.longitude)*rad,h=Math.sin(dlat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(dlon/2)**2;return 6371.0088*2*Math.atan2(Math.sqrt(Math.min(1,h)),Math.sqrt(Math.max(0,1-h)));}
/** Bounded readers for the retained Natural Earth Polygon SHP/DBF pair. No
 * downloads/dependencies. Bounding boxes only accelerate geometry checks. */
export function readNaturalEarthMapUnits(shp,dbf,{version,prj}={}){
 if(version!=='5.1.1'||!String(prj).includes('GCS_WGS_1984')||!Buffer.isBuffer(shp)||!Buffer.isBuffer(dbf)||shp.length>12000000||dbf.length>2000000||shp.length<100||dbf.length<33||shp.readInt32BE(0)!==9994||shp.readInt32BE(24)*2!==shp.length||shp.readInt32LE(28)!==1000||shp.readInt32LE(32)!==5)throw Error('invalid_boundary_reference');
 const count=dbf.readUInt32LE(4),head=dbf.readUInt16LE(8),length=dbf.readUInt16LE(10),fields=[];if(count>1000||head<33||head+count*length>dbf.length)throw Error('invalid_boundary_dbf');
 for(let at=32;at<head-1;at+=32){if(dbf[at]===13)break;fields.push({name:dbf.subarray(at,at+11).toString().replace(/\0.*$/s,''),length:dbf[at+16]});}
 if(fields.reduce((n,f)=>n+f.length,1)!==length)throw Error('invalid_boundary_dbf');
 const units=[];let at=100,total=0;
 for(let i=0;i<count;i++){
  if(at+52>shp.length)throw Error('invalid_boundary_shape');const size=shp.readInt32BE(at+4)*2,start=at+8,end=start+size;if(end>shp.length||shp.readInt32LE(start)!==5)throw Error('invalid_boundary_shape');
  const parts=shp.readInt32LE(start+36),points=shp.readInt32LE(start+40),offset=start+44+parts*4;total+=points;if(parts<1||parts>100000||points<4||total>1000000||offset+points*16!==end)throw Error('invalid_boundary_shape');
  const rings=[];let antimeridian=false;
  for(let k=0;k<parts;k++){const first=shp.readInt32LE(start+44+k*4),last=k+1<parts?shp.readInt32LE(start+44+(k+1)*4):points;if(first<0||last<=first||last>points)throw Error('invalid_boundary_ring');const ring=[];for(let j=first;j<last;j++){const longitude=shp.readDoubleLE(offset+j*16),latitude=shp.readDoubleLE(offset+j*16+8);if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)throw Error('invalid_boundary_ring');if(ring.length&&Math.abs(ring.at(-1)[0]-longitude)>180)antimeridian=true;ring.push([longitude,latitude]);}if(ring.length<4||ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])throw Error('invalid_boundary_ring');rings.push(ring);}
  let d=head+i*length+1;const metadata={};if(dbf[d-1]!==32)throw Error('deleted_boundary_record');for(const f of fields){metadata[f.name]=dbf.subarray(d,d+f.length).toString('utf8').replace(/\0/g,'').trim();d+=f.length;}
  units.push({metadata,rings,box:[shp.readDoubleLE(start+4),shp.readDoubleLE(start+12),shp.readDoubleLE(start+20),shp.readDoubleLE(start+28)],antimeridian});at=end;
 }
 if(at!==shp.length)throw Error('boundary_record_count_mismatch');return prepareCoarseBoundaries(units,{shp:hash(shp),dbf:hash(dbf),version});
}
export function prepareCoarseBoundaries(units,reference={}){
 const byCode=new Map(),cache=new Map();for(const u of units){const m=u.metadata;u.eligible=!u.antimeridian&&['Sovereign country','Country'].includes(m.TYPE)&&m.HOMEPART==='1'&&m.BRK_DIFF==='0'&&!m.NOTE_BRK&&!m.NOTE_ADM0&&/^[A-Z]{2}$/.test(m.ISO_A2)&&m.ISO_A2===m.ISO_A2_EH;if(!byCode.has(m.ISO_A2))byCode.set(m.ISO_A2,[]);byCode.get(m.ISO_A2).push(u);}return{units,byCode,cache,reference};
}
function contains(point,u){const x=point.longitude,y=point.latitude,b=u.box;if(x<b[0]||y<b[1]||x>b[2]||y>b[3])return false;let inside=false;for(const r of u.rings)for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[j],b=r[i];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
const bearing=(a,b)=>{const r=Math.PI/180,p=a.latitude*r,q=b.latitude*r,d=(b.longitude-a.longitude)*r;return Math.atan2(Math.sin(d)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(d));};
export function segmentDistanceKm(point,a,b){const radius=6371.0088,ap=greatCircleKm(a,point)/radius,ab=greatCircleKm(a,b)/radius;if(ab<1e-12)return greatCircleKm(a,point);const theta=bearing(a,point)-bearing(a,b),along=Math.atan2(Math.sin(ap)*Math.cos(theta),Math.cos(ap));if(along<0||along>ab)return Math.min(greatCircleKm(point,a),greatCircleKm(point,b));return Math.abs(Math.asin(Math.max(-1,Math.min(1,Math.sin(ap)*Math.sin(theta)))))*radius;}
function boundaryNear(point,units){
 // At |latitude|<=65, these padded segment boxes safely contain a50km
 // spherical neighbourhood. The final decision uses great-circle distances.
 for(const u of units){const box=u.box;if(point.longitude<box[0]-1.5||point.longitude>box[2]+1.5||point.latitude<box[1]-.6||point.latitude>box[3]+.6)continue;for(const r of u.rings)for(let i=1;i<r.length;i++){const a=r[i-1],b=r[i];if(Math.abs(a[0]-b[0])<=2&&Math.abs(a[1]-b[1])<=2&&(point.latitude<Math.min(a[1],b[1])-.6||point.latitude>Math.max(a[1],b[1])+.6||point.longitude<Math.min(a[0],b[0])-1.5||point.longitude>Math.max(a[0],b[0])+1.5))continue;if(segmentDistanceKm(point,{longitude:a[0],latitude:a[1]},{longitude:b[0],latitude:b[1]})<=50)return true;}}
 return false;
}
export function coarseCountrySuspicion(point,code,boundaries){
 if(!boundaries)return{state:'no_retained_coarse_polygons'};if(!point.valid)return{state:'coordinate_pair_unavailable'};if(!code)return{state:'declared_country_unresolved'};if(Math.abs(point.latitude)>65||Math.abs(point.longitude)>178)return{state:'polar_or_antimeridian_uncertainty'};
 const declared=boundaries.byCode.get(code)||[];if(declared.length!==1||!declared[0].eligible)return{state:'declared_map_unit_or_territory_identity_uncertain'};
 const key=point.latitude+','+point.longitude;let p=boundaries.cache.get(key);if(!p){const units=boundaries.units.filter(u=>contains(point,u));p=units.length===1&&units[0].eligible?{country:units[0].metadata.ISO_A2}: {state:'point_ocean_overlap_disputed_or_territory_uncertain'};if(!p.state&&boundaryNear(point,boundaries.units))p={state:'within_50km_of_coast_border_or_map_unit_boundary'};boundaries.cache.set(key,p);}
 if(p.state)return p;return{state:'assessed',point_map_code:p.country,flag:p.country===code?null:'point_in_different_unambiguous_coarse_country_interior'};
}
const bucket=()=>({assessable:0,unassessed:0,flagged:0,unflagged:0,unassessed_reasons:{}});
const present=v=>typeof v==='string'&&v.trim().length>0;
export function auditPopulationMismatches(rows,g,{distanceThresholdKm=100,capturedAt=null,snapshotIntegrity=null,coarseBoundaries=null}={}){
 if(!Array.isArray(rows)||rows.length>100000||new Set(rows.map(r=>r?.id)).size!==rows.length||rows.some(r=>!r?.id)||!g?.places||!Number.isFinite(distanceThresholdKm)||distanceThresholdKm<100||distanceThresholdKm>1000)throw Error('invalid_population_analysis');
 const names=['coordinate_pair','country_reference','city_country_reference','city_reference_distance','stored_source_country','stored_source_city','stored_source_street','source_scope_metadata','coarse_country_polygon','country_boundary','address_location_verification'];
 const buckets=Object.fromEntries(names.map(k=>[k,bucket()])),cohorts=positionCohorts(rows),records=[],countries={},families={};
 const assess=(record,key,state,flag=null)=>{const b=buckets[key];record.assessments[key]=state;if(state==='assessed'){b.assessable++;if(flag){b.flagged++;record.flags.push(flag);}else b.unflagged++;}else{b.unassessed++;b.unassessed_reasons[state]=(b.unassessed_reasons[state]||0)+1;}};
 for(const row of rows){const record={listing_id:row.id,slug:row.slug||null,row_fingerprint:row.row_fingerprint||null,flags:[],assessments:{}},point=positionPair(row),code=countryCode(row.country,g),city=exact(row.city),matches=[...(g.names.get(city)||[])].map(id=>g.places.get(id)),local=matches.filter(p=>p.country===code);
  assess(record,'coordinate_pair',point.valid?'assessed':row.latitude==null||row.longitude==null?'missing_pair':'invalid_pair');
  assess(record,'country_reference',code?'assessed':present(row.country)?'country_not_in_reference':'missing_country');
  if(!city)assess(record,'city_country_reference','missing_city');else if(!code)assess(record,'city_country_reference','country_unresolved');else if(!matches.length)assess(record,'city_country_reference','name_not_in_cities1000');else assess(record,'city_country_reference','assessed',local.length?null:'city_name_only_referenced_in_other_countries');
  if(!point.valid)assess(record,'city_reference_distance','coordinate_pair_unavailable');else if(!code||!city)assess(record,'city_reference_distance','canonical_context_missing_or_unresolved');else if(local.length!==1)assess(record,'city_reference_distance',local.length?'ambiguous_exact_city_in_country':'no_exact_city_in_country');else{
   const anchor=local[0],distance=greatCircleKm(point,anchor);record.reference_city={geonames_id:anchor.id,country:anchor.country,feature:anchor.feature,distance_km:Math.round(distance*1000)/1000};assess(record,'city_reference_distance','assessed',distance>=distanceThresholdKm?'point_far_from_unique_declared_city_reference':null);
  }
  const source=row.source_address_parts&&typeof row.source_address_parts==='object'&&!Array.isArray(row.source_address_parts)?row.source_address_parts:{};
  const sourceCountry=countryCode(source.country,g);
  if(!code||!sourceCountry)assess(record,'stored_source_country',!present(source.country)?'stored_source_country_missing':'country_reference_unresolved');else assess(record,'stored_source_country','assessed',code!==sourceCountry?'stored_source_country_differs':null);
  if(!present(row.city)||!present(source.city))assess(record,'stored_source_city','comparison_value_missing');else{
   const sourceCity=exact(source.city),sourceIds=new Set(g.names.get(sourceCity)||[]),sameName=city===sourceCity,sameUniqueAnchor=local.length===1&&sourceIds.has(local[0].id)&&[...sourceIds].filter(id=>g.places.get(id).country===code).length===1;
   assess(record,'stored_source_city','assessed',sameName||sameUniqueAnchor?null:'stored_source_city_literal_differs');
  }
  if(!present(row.address)||!present(source.street))assess(record,'stored_source_street','comparison_value_missing');else{
   const a=street(row.address),b=street(source.street),compatible=a===b||a.startsWith(b+' ')||b.startsWith(a+' ');
   assess(record,'stored_source_street','assessed',compatible?null:'stored_source_street_literal_differs');
  }
  const held=[row.source_scope_mismatch,row.scope_review_required,row.organization_identity_quarantine].some(v=>v===true||v==='true')||row.blocked_reason==='source_scope_mismatch'||row.source_kind==='association_member'||row.identity_scope==='organization'&&['artist','creator','professional'].includes(row.entity_type);
  assess(record,'source_scope_metadata','assessed',held?'stored_source_identity_or_scope_hold':null);
  const coarse=coarseCountrySuspicion(point,code,coarseBoundaries);assess(record,'coarse_country_polygon',coarse.state,coarse.flag);if(coarse.point_map_code)record.coarse_map_country_code=coarse.point_map_code;
  assess(record,'country_boundary','no_retained_administrative_polygons');
  assess(record,'address_location_verification','no_independent_current_address_source_review_in_this_analysis');
  record.position_diagnosis_evidence_scope='Stored columns/metadata/cohorts only; current reviewed-point receipts were not queried.';record.position_diagnosis=diagnosePosition({...row,source_context:{source_scope_mismatch:row.source_scope_mismatch,scope_review_required:row.scope_review_required,organization_identity_quarantine:row.organization_identity_quarantine,blocked_reason:row.blocked_reason,source_kind:row.source_kind,identity_scope:row.identity_scope},geo_metadata:{method:row.geo_method}},{cohort:cohorts.get(row.id)});
  const country=text(row.country)||'Unresolved country',family=text(row.entity_type)||'Unresolved family';for(const [map,key]of[[countries,country],[families,family]]){map[key]||={records:0,records_with_suspected_flags:0};map[key].records++;if(record.flags.length)map[key].records_with_suspected_flags++;}records.push(record);
 }
 const flagged=records.filter(r=>r.flags.length),flagCounts={};for(const r of flagged)for(const f of r.flags)flagCounts[f]=(flagCounts[f]||0)+1;
 return{schema_version:1,kind:'read_only_geography_population_triage',captured_at:capturedAt,snapshot_integrity:snapshotIntegrity,records:rows.length,buckets,suspected_unique_records:flagged.length,overlapping_flag_counts:flagCounts,countries,families,distance_threshold_km:distanceThresholdKm,coarse_boundary_reference:coarseBoundaries?.reference||null,coarse_boundary_uncertainty_km:50,reference_sha256:g.source_sha256,verified_corrections:0,coordinate_writes:0,provider_calls:0,limits:['GeoNames populated-place references are points, not administrative boundaries or address evidence.','At least100km from a unique exact city-country reference is a conservative suspicion threshold, not proof of an incorrect place.','cities1000 omits smaller places and may lack aliases; matching only another country is a suspicion about reference coverage, not a verified country error.','Stored machine source fields may be stale, held or wrongly attributed; comparisons do not validate source identity or establish which value is correct.','Optional Natural Earth map-unit containment is generalized de-facto cartographic suspicion only. Only unique main-country units without dispute/territory flags and points more than50km from every mapped coast/border are assessable; polar/dateline and other uncertain cases are unassessed.','No authoritative country boundary, coast, territory or street/address location is verified by this analysis.','Shared stored-position diagnosis has no current reviewed-point receipt input; it does not measure or revoke accepted receipts.','Unflagged means this detector found no suspicion; it does not mean verified.'],private_records:records};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const [snapshot,countryFile,cityFile,output,boundaryBase]=process.argv.slice(2);if(!output)throw Error('usage: snapshot.json countryInfo.txt cities1000.txt new-private-report.json [retained-map-unit-base]');const input=JSON.parse(await readFile(snapshot,'utf8')),g=readGeoNames(await readFile(countryFile,'utf8'),await readFile(cityFile,'utf8')),coarseBoundaries=boundaryBase?readNaturalEarthMapUnits(await readFile(boundaryBase+'.shp'),await readFile(boundaryBase+'.dbf'),{version:(await readFile(boundaryBase+'.VERSION.txt','utf8')).trim(),prj:await readFile(boundaryBase+'.prj','utf8')}):null,report=auditPopulationMismatches(input.rows||input,g,{capturedAt:input.captured_at||null,snapshotIntegrity:input.snapshot_integrity||null,coarseBoundaries});await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({records:report.records,suspected_unique_records:report.suspected_unique_records,verified_corrections:0,coordinate_writes:0,provider_calls:0}));}

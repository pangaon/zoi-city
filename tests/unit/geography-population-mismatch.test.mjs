import test from 'node:test';
import assert from 'node:assert/strict';
import {readGeoNames,auditPopulationMismatches,greatCircleKm,prepareCoarseBoundaries,coarseCountrySuspicion,segmentDistanceKm,readNaturalEarthMapUnits} from '../../scripts/geography/population-mismatch-audit.mjs';
const country='US\tUSA\t840\tUS\tUnited States\nGR\tGRC\t300\tGR\tGreece\nCA\tCAN\t124\tCA\tCanada\n';
const city=(id,name,aliases,lat,lng,code,feature='PPL')=>[id,name,name,aliases,lat,lng,'P',feature,code,'','','','','',1001,'','','UTC','2026-10-14'].join('\t');
const cities=[city(1,'Athens','Athína,Αθήνα',37.98,23.72,'GR'),city(2,'Athens','',33.95,-83.38,'US'),city(3,'Springfield','',40,-90,'US'),city(4,'Springfield','',42,-72,'US'),city(5,'Toronto','',43.65,-79.38,'CA')].join('\n');
const g=readGeoNames(country,cities),row={id:'one',name:'Actual venue',entity_type:'business',city:'Athens',country:'Greece',address:'1 Actual street',latitude:37.98,longitude:23.72};
const run=(rows,options)=>auditPopulationMismatches(rows,g,options);
test('exact declared-country matching prevents same-name cities in different countries from becoming automatic relocations',()=>{
 const a=run([row]);assert.equal(a.buckets.city_reference_distance.assessable,1);assert.equal(a.private_records[0].reference_city.geonames_id,1);assert.equal(a.suspected_unique_records,0);assert.equal(a.verified_corrections,0);assert.equal(a.coordinate_writes,0);
});
test('exact official alternate name and ISO alpha2/alpha3 country labels are supported without fuzzy transliteration',()=>{
 for(const [city,country]of[['Αθήνα','GR'],['Athína','GRC'],['  ATHENS  ','Greece']])assert.equal(run([{...row,city,country}]).private_records[0].reference_city.geonames_id,1);
 assert.equal(run([{...row,city:'Athina'}]).buckets.city_reference_distance.unassessed,1);
});
test('same-country ambiguous names remain unassessed, even if one anchor is closer',()=>{
 const a=run([{...row,city:'Springfield',country:'United States',latitude:40,longitude:-90}]);assert.equal(a.buckets.city_reference_distance.unassessed_reasons.ambiguous_exact_city_in_country,1);assert.equal(a.private_records[0].reference_city,undefined);
});
test('missing/invalid pairs and unresolved countries/cities each keep explicit unassessed denominators',()=>{
 const a=run([{...row,id:'missing',latitude:null},{...row,id:'invalid',latitude:999},{...row,id:'unknown-country',country:'Unknown'},{...row,id:'unknown-city',city:'Small unpublished village'}]);
 assert.equal(a.records,4);assert.equal(a.buckets.coordinate_pair.assessable,2);assert.equal(a.buckets.city_reference_distance.assessable,0);assert.equal(a.buckets.country_reference.unassessed,1);for(const b of Object.values(a.buckets))assert.equal(b.assessable+b.unassessed,4);
});
test('far-away unique declared-city references flag suspicion without claiming country boundaries or street verification',()=>{
 const a=run([{...row,latitude:43.65,longitude:-79.38}]);assert.equal(a.overlapping_flag_counts.point_far_from_unique_declared_city_reference,1);assert.equal(a.buckets.country_boundary.assessable,0);assert.equal(a.buckets.address_location_verification.assessable,0);assert.equal(a.verified_corrections,0);assert.ok(a.private_records[0].reference_city.distance_km>5000);assert.throws(()=>run([row],{distanceThresholdKm:25}),/invalid_population_analysis/);
});
test('city names referenced only in another country are a coverage-qualified suspicion, not a guessed replacement',()=>{
 const a=run([{...row,city:'Toronto'}]);assert.equal(a.overlapping_flag_counts.city_name_only_referenced_in_other_countries,1);assert.equal(a.buckets.city_reference_distance.unassessed,1);assert.equal(a.private_records[0].reference_city,undefined);
});
test('stored source country/city/street differences remain independent overlapping unverified comparison flags',()=>{
 const original={...row,source_address_parts:{country:'CA',city:'Toronto',street:'999 Different road'},scope_review_required:true},before=structuredClone(original),a=run([original]);assert.deepEqual(original,before);assert.equal(a.suspected_unique_records,1);assert.equal(a.buckets.stored_source_country.flagged,1);assert.equal(a.buckets.stored_source_city.flagged,1);assert.equal(a.buckets.stored_source_street.flagged,1);assert.equal(a.buckets.source_scope_metadata.flagged,1);assert.equal(Object.values(a.overlapping_flag_counts).reduce((a,b)=>a+b),4);assert.equal(a.verified_corrections,0);
});
test('source street with canonical city/postcode suffix and exact reference aliases do not create literal disagreement',()=>{
 const a=run([{...row,address:'1 Actual street, Athens 10557',source_address_parts:{country:'GRC',city:'Αθήνα',street:'1 Actual street'}}]);assert.equal(a.buckets.stored_source_street.flagged,0);assert.equal(a.buckets.stored_source_city.flagged,0);assert.equal(a.buckets.stored_source_country.flagged,0);
});
test('owner-managed rows, claimed street precision and centroid methods never become verified corrections',()=>{
 const a=run([{...row,owner_managed:true,geo_precision:'street',geo_method:'city centroid'}]);assert.equal(a.private_records[0].position_diagnosis.effective_precision,'city');assert.equal(a.verified_corrections,0);assert.equal(a.buckets.address_location_verification.assessable,0);
});
test('great circle handles dateline and pole distances without rectangular boundary assumptions',()=>{
 assert.ok(greatCircleKm({latitude:0,longitude:179.9},{latitude:0,longitude:-179.9})<23);assert.ok(greatCircleKm({latitude:89.9,longitude:0},{latitude:89.9,longitude:180})<23);
});
test('duplicate rows, malformed reference rows and unsupported input fail without writing',()=>{
 assert.throws(()=>run([row,row]),/invalid_population_analysis/);assert.throws(()=>readGeoNames(country,'malformed'),/invalid_city_reference/);assert.throws(()=>readGeoNames(country,cities+'\n'+cities.split('\n')[0]),/duplicate_city_reference/);
});
const unit=(code,left=0,extra={})=>({metadata:{TYPE:'Sovereign country',HOMEPART:'1',BRK_DIFF:'0',NOTE_BRK:'',NOTE_ADM0:'',ISO_A2:code,ISO_A2_EH:code,...extra},antimeridian:false,box:[left,0,left+10,10],rings:[[[left,0],[left+10,0],[left+10,10],[left,10],[left,0]]]});
const point=(latitude=5,longitude=5)=>({latitude,longitude,valid:true});
test('coarse polygon interior mismatch is suspicion only and retains authoritative country/address unassessed buckets',()=>{
 const boundaries=prepareCoarseBoundaries([unit('GR'),unit('US',20)]),r=coarseCountrySuspicion(point(),'US',boundaries);assert.equal(r.flag,'point_in_different_unambiguous_coarse_country_interior');assert.equal(coarseCountrySuspicion(point(),'GR',boundaries).flag,null);
 const a=auditPopulationMismatches([{...row,country:'United States',latitude:5,longitude:5}],g,{coarseBoundaries:boundaries});assert.equal(a.buckets.coarse_country_polygon.flagged,1);assert.equal(a.buckets.country_boundary.assessable,0);assert.equal(a.buckets.address_location_verification.assessable,0);assert.equal(a.verified_corrections,0);
});
test('coastal/border buffer, ocean, polar and dateline positions are explicitly unassessed',()=>{
 const boundaries=prepareCoarseBoundaries([unit('GR')]);assert.equal(coarseCountrySuspicion(point(.1,5),'GR',boundaries).state,'within_50km_of_coast_border_or_map_unit_boundary');assert.match(coarseCountrySuspicion(point(30,30),'GR',boundaries).state,/ocean/);for(const p of[point(80,5),point(5,179.5)])assert.equal(coarseCountrySuspicion(p,'GR',boundaries).state,'polar_or_antimeridian_uncertainty');
});
test('map units, overseas, disputed, ambiguous and overlap identities are never converted to country corrections',()=>{
 for(const metadata of[{TYPE:'Dependency'},{TYPE:'Geo unit'},{BRK_DIFF:'1'},{NOTE_BRK:'Disputed'},{HOMEPART:'-99'},{ISO_A2_EH:'US'}]){const b=prepareCoarseBoundaries([unit('GR',0,metadata),unit('US',20)]);assert.match(coarseCountrySuspicion(point(),'GR',b).state,/identity_uncertain/);assert.match(coarseCountrySuspicion(point(),'US',b).state,/territory_uncertain/);}
 const b=prepareCoarseBoundaries([unit('GR'),unit('GR',20)]);assert.match(coarseCountrySuspicion(point(),'GR',b).state,/identity_uncertain/);const overlap=prepareCoarseBoundaries([unit('GR'),unit('US')]);assert.match(coarseCountrySuspicion(point(),'GR',overlap).state,/overlap/);
});
test('polygon holes remain outside instead of counting an enclosing rectangle as location evidence',()=>{
 const u=unit('GR');u.rings.push([[4,4],[6,4],[6,6],[4,6],[4,4]]);const b=prepareCoarseBoundaries([u]);assert.match(coarseCountrySuspicion(point(),'GR',b).state,/ocean/);
});
test('spherical segment distance uses the segment endpoints and great-circle cross-track distance',()=>{
 const a={latitude:0,longitude:0},b={latitude:0,longitude:10};assert.ok(Math.abs(segmentDistanceKm({latitude:1,longitude:5},a,b)-111.195)<.01);assert.ok(Math.abs(segmentDistanceKm({latitude:0,longitude:-1},a,b)-111.195)<.01);assert.equal(segmentDistanceKm(a,a,b),0);
});
test('unversioned/truncated/mismatched-projection shape inputs fail closed before parsing',()=>{
 assert.throws(()=>readNaturalEarthMapUnits(Buffer.alloc(100),Buffer.alloc(100),{version:'other',prj:'GCS_WGS_1984'}),/invalid_boundary_reference/);assert.throws(()=>readNaturalEarthMapUnits(Buffer.alloc(100),Buffer.alloc(100),{version:'5.1.1',prj:'unknown'}),/invalid_boundary_reference/);
});

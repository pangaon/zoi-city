import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractSourceCoordinates,coordinateSnapshot,reviewCoordinateCandidate} from '../../scripts/geography/source-coordinates.mjs';
import {sha256,canonical} from '../../scripts/quality/evidence.mjs';
const row={id:'controlled-hotel',name:'Actual Sydney Hotel',website:'https://publisher.example/hotels/actual/',address:'1 Oxford Street',city:'Paddington',country:'Australia',latitude:null,longitude:null,public_eligible:true,source_kind:'official_website',source_fingerprint:'frozen-source',owner_hash:'frozen-owner'};
const sourceUrl='https://publisher.example/contact/';
const short='https://maps.app.goo.gl/Actual123';
const final='https://www.google.com/maps/place/Actual+Sydney+Hotel/@0,0,17z/data=!4m9!3m8!1s0x123:0x456!5m2!4m1!1i2!8m2!3d-33.8818077!4d151.2192239!16s%2Fg%2Factual?entry=tts';
const card=`<details><summary>Actual Sydney Hotel</summary><p>1 Oxford Street, Paddington NSW 2021</p><a href="${short}">Driving Directions</a></details>`;
const html='<main>'+card+'</main>';
const bbox={source_url:'https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Administrative_Boundaries/MapServer/0',south:-33.88990972456109,north:-33.876779430730046,west:151.21818568826185,east:151.2376219544052};
const destinationBody='retained destination Actual Sydney Hotel 0x123:0x456';
const identity={listing_id:row.id,snapshot_sha256:coordinateSnapshot(row),source_url:sourceUrl,source_sha256:sha256(html),reviewer:'source-reviewer',reviewed_at:'2026-10-02',exact_address_confirmed:true,source_address:{street:'1 Oxford Street',city:'Paddington',region:'NSW',postal_code:'2021',country:'Australia'},publisher_contact_scope:true,destination_purpose:'place_location',contact_card_html:card,contact_card_sha256:sha256(card),destination_locality:bbox,shortlink_capture:{url:short,redirects:[{url:short,status:302,location:final}],final_url:final,final_status:200,final_html:destinationBody,final_sha256:sha256(destinationBody),captured_at:'2026-10-02',place_id:'0x123:0x456'}};
const run=(r=row,i=identity,h=html)=>extractSourceCoordinates(h,r,{sourceUrl,identityReview:i});
function alteredCapture(patch){const c={...identity.shortlink_capture,...patch};return{...identity,shortlink_capture:c};}
test('exact reviewed source card and captured named destination yield candidate, not camera coordinates or apply approval',()=>{
 const r=run();assert.equal(r.candidate.latitude,-33.8818077);assert.equal(r.candidate.longitude,151.2192239);assert.equal(r.candidate.evidence_kind,'reviewed_named_place_shortlink');assert.equal(r.coordinate_writes,0);assert.equal(r.status,'review_required');
 assert.throws(()=>reviewCoordinateCandidate(r,{report_sha256:sha256(canonical(r)),reviewer:'independent',reviewed_at:'2026-10-02',exact_address_confirmed:true,not_area_centroid:true,locality_extent:bbox},row),/coordinate_report_invalid/,'existing writer review does not silently admit new publisher scope');
});
test('snapshot changes, ownership, sparse identity and missing explicit parent-page scope refuse',()=>{
 for(const patch of[{owner_hash:'changed'},{source_fingerprint:'changed'},{name:'Other Hotel'},{address:'Moved'},{owner_managed:true},{owner_workspace_id:'owner'},{public_eligible:false},{address:''}])assert.ok(!run({...row,...patch}).candidate,JSON.stringify(patch));
 assert.ok(!run(row,{...identity,publisher_contact_scope:false}).candidate);assert.ok(!run(row,null).candidate);
});
test('card must be exact unique source bytes with correct heading/address; parking is never the hotel',()=>{
 for(const changed of[card.replace('Actual Sydney Hotel','Other Branch'),card.replace('1 Oxford Street','99 Another Street'),card.replace('Driving Directions','Parking directions'),card.replace('</p>',' Parking</p>')]){
  const h='<main>'+changed+'</main>',i={...identity,source_sha256:sha256(h),contact_card_html:changed,contact_card_sha256:sha256(changed)};assert.ok(!run(row,i,h).candidate);
 }
 const h=html+card;assert.ok(!run(row,{...identity,source_sha256:sha256(h)},h).candidate);
 assert.ok(!run(row,{...identity,contact_card_sha256:'wrong'}).candidate);
});
test('redirect capture binds first URL, exact final URL/status/bytes and place identity',()=>{
 assert.ok(!run(row,alteredCapture({final_html:'Consent required',final_sha256:sha256('Consent required')})).candidate);
 for(const patch of[{final_status:503},{final_sha256:'changed'},{final_html:'changed'},{captured_at:'invalid'},{place_id:'0x999:0x123'},{redirects:[]},{redirects:[{url:short,status:302,location:'https://attacker.example'}]},{redirects:[{url:short,status:200,location:final}]}])assert.ok(!run(row,alteredCapture(patch)).candidate,JSON.stringify(patch));
});
test('camera-only, wrong place, credentials, foreign host, query injection and multiple destination forms fail',()=>{
 for(const value of[final.replace('!8m2!3d-33.8818077!4d151.2192239',''),final.replace('Actual+Sydney+Hotel','Another+Hotel'),final.replace('www.google.com','google.com.attacker.test'),final.replace('https://','https://user@'),final+'&destination=Other',final.replace('!16s','!3d-33.881!4d151.219!16s')]){
  assert.ok(!run(row,alteredCapture({final_url:value,redirects:[{url:short,status:302,location:value}]})).candidate,value);
 }
});
test('locality must be independently sourced, bounded and contain the destination',()=>{
 for(const b of[null,{...bbox,west:150,east:151},{...bbox,south:0,north:10},{...bbox,source_url:'http://untrusted.example'}])assert.ok(!run(row,{...identity,destination_locality:b}).candidate);
});
test('retained official Paddington polygon independently contains candidate, without changing a listing snapshot',()=>{
 const data=JSON.parse(readFileSync(new URL('../../docs/audits/evidence/olympia-locality-2026-10-02/paddington.json',import.meta.url)));
 assert.equal(data.features.length,1);assert.equal(data.features[0].attributes.suburbname,'PADDINGTON');
 const p=[151.2192239,-33.8818077];let inside=false;
 for(const ring of data.features[0].geometry.rings){for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }}assert.equal(inside,true);
});

test('independent named-place review binds source, identity, card, capture, destination and locality before review stage',()=>{
 const r=run(),c=r.candidate;
 const reviewed={report_sha256:sha256(canonical(r)),reviewer:'independent-reviewer',reviewed_at:'2026-10-02',exact_address_confirmed:true,not_area_centroid:true,publisher_contact_scope:true,named_place_confirmed:true,destination_purpose:'place_location',source_sha256:r.source_sha256,identity_review_sha256:r.identity_review_sha256,capture_sha256:c.capture_sha256,contact_card_sha256:c.contact_card_sha256,destination_url:c.evidence_url,shortlink_url:c.shortlink_url,place_id:c.place_id,locality_extent:c.destination_locality};
 assert.equal(reviewCoordinateCandidate(r,reviewed,row).status,'reviewed_pending_guarded_writer');
 for(const key of ['capture_sha256','source_sha256','identity_review_sha256','contact_card_sha256','destination_url','place_id'])assert.throws(()=>reviewCoordinateCandidate(r,{...reviewed,[key]:'changed'},row),/report_invalid|named_place_review/);
});

test('bounded collector fetches only snapshot-approved publisher page and retains exact source/report evidence',async()=>{
 const {auditCoordinateSources}=await import('../../scripts/geography/source-coordinate-audit.mjs');const{mkdtemp,readFile,rm}=await import('node:fs/promises');const{tmpdir}=await import('node:os');const{join}=await import('node:path');const directory=await mkdtemp(join(tmpdir(),'shortlink-collector-'));const seen=[];
 try{const result=await auditCoordinateSources([row],{directory,identityReviews:{[row.id]:identity},sourceFetch:async url=>{seen.push(url);return{url,status:200,text:html}}});assert.deepEqual(seen,[sourceUrl]);assert.equal(result.coordinate_writes,0);const evidence=JSON.parse(await readFile(join(directory,result.reports[0].evidence_file),'utf8'));const report=JSON.parse(await readFile(join(directory,evidence.report.file),'utf8'));assert.equal(report.candidate.evidence_kind,'reviewed_named_place_shortlink');assert.equal(evidence.source.sha256,sha256(html));
 }finally{await rm(directory,{recursive:true,force:true});}
});

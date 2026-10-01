import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash=text=>createHash('sha256').update(text,'utf8').digest('hex');
// Prepare transport only. Server authorization, current-row CAS and independent
// evidence gates remain mandatory; this artifact does not approve or write a pin.
export function prepareCoordinateRequest({requestId,reportText,review,snapshot,now=Date.now()}){
 if(!uuid.test(requestId||'')||typeof reportText!=='string'||Buffer.byteLength(reportText)>32768)throw Error('invalid_coordinate_request');
 const report=JSON.parse(reportText);
 if(!snapshot||!uuid.test(snapshot.id||'')||report.listing_id!==snapshot.id||!snapshot.database_snapshot||review?.database_snapshot!==snapshot.database_snapshot||report.source_fingerprint!==snapshot.source_fingerprint)throw Error('coordinate_snapshot_mismatch');
 if(review.report_sha256!==hash(reportText))throw Error('exact_report_hash_mismatch');
 if(report.schema!==1||report.kind!=='official_coordinate_dry_run'||report.status!=='review_required'||report.reason!=='coordinate_plausibility_review_required'||report.http_status!==200||!report.candidate)throw Error('coordinate_candidate_missing');
 const time=Date.parse(review.reviewed_at);if(!Number.isFinite(time)||time<now-7*86400000||time>now+300000)throw Error('coordinate_review_expired');
 if(typeof review.reviewer!=='string'||typeof review.specialist!=='string'||!review.reviewer.trim()||!review.specialist.trim()||review.reviewer.trim().toLowerCase()===review.specialist.trim().toLowerCase())throw Error('independent_review_required');
 if(report.collector&&report.collector.trim().toLowerCase()!==review.specialist.trim().toLowerCase())throw Error('collector_identity_mismatch');
 for(const field of ['official_source_confirmed','exact_address_confirmed','not_area_centroid'])if(review[field]!==true)throw Error('coordinate_review_incomplete');
 for(const field of ['address','city','country'])if(review['stored_'+field]!==snapshot[field])throw Error('coordinate_address_mismatch');
 const c=report.candidate,b=review.locality_extent;
 if(!b||![c.latitude,c.longitude,b.south,b.north,b.west,b.east].every(Number.isFinite)||b.south>=b.north||b.west>=b.east||b.south< -90||b.north>90||b.west< -180||b.east>180||b.north-b.south>5||b.east-b.west>5||c.latitude<b.south||c.latitude>b.north||c.longitude<b.west||c.longitude>b.east)throw Error('coordinate_locality_mismatch');
 return {rpc:'geography_review_apply',arguments:{p_request:requestId,p_listing:snapshot.id,p_expected:snapshot.database_snapshot,p_report_text:reportText,p_review:review},coordinate_writes:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [requestId,reportFile,reviewFile,snapshotFile,output]=process.argv.slice(2);
 if(!output)throw Error('usage: requestUUID report.json review.json single-snapshot.json output.json');
 const request=prepareCoordinateRequest({requestId,reportText:await readFile(reportFile,'utf8'),review:JSON.parse(await readFile(reviewFile,'utf8')),snapshot:JSON.parse(await readFile(snapshotFile,'utf8'))});
 await writeFile(output,JSON.stringify(request,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({request_id:requestId,output,coordinate_writes:0}));
}

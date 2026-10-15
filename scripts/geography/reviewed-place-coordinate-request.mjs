import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createReviewedPlaceReport,reviewedPlaceRequestMatches,REVIEWED_PLACE_LIMITS} from './reviewed-place-evidence.mjs';
import {prepareCoordinateRequest} from './reviewed-coordinate-request.mjs';
// Explicit offline reviewed lane. Never fetches, takes a lease or applies facts.
export {createReviewedPlaceReport};
export function prepareReviewedPlaceRequest(input){
 if(typeof input?.reportText!=='string'||Buffer.byteLength(input.reportText)>REVIEWED_PLACE_LIMITS.report||Buffer.byteLength(JSON.stringify(input.review??null))>REVIEWED_PLACE_LIMITS.review)throw Error('invalid_reviewed_place_request');
 const report=JSON.parse(input.reportText);reviewedPlaceRequestMatches(report,input.review,input.snapshot,{now:input.now});return prepareCoordinateRequest(input);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const[requestId,reportFile,reviewFile,snapshotFile,output]=process.argv.slice(2);if(!output)throw Error('usage: requestUUID reviewed-report.json independent-review.json current-snapshot.json output.json');const request=prepareReviewedPlaceRequest({requestId,reportText:await readFile(reportFile,'utf8'),review:JSON.parse(await readFile(reviewFile,'utf8')),snapshot:JSON.parse(await readFile(snapshotFile,'utf8'))});await writeFile(output,JSON.stringify(request,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({request_id:requestId,output,coordinate_writes:0}));}

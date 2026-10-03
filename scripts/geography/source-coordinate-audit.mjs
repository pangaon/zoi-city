import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createSourceSession} from '../quality/source-fetch.mjs';
import {canonical,sha256} from '../quality/evidence.mjs';
import {sourceFailureReason} from '../enrichment/source-errors.mjs';
import {extractSourceCoordinates,reviewedContactSource} from './source-coordinates.mjs';
async function retain(directory,body,suffix){const hash=sha256(body),file=path.join(directory,hash+suffix);try{await writeFile(file,body,{flag:'wx',mode:0o600})}catch(e){if(e.code!=='EEXIST'||await readFile(file,'utf8')!==body)throw e;}return{sha256:hash,file:path.basename(file)};}
export async function auditCoordinateSources(rows,{directory='coordinate-evidence',sourceFetch=null,identityReviews={}}={}){
 if(!Array.isArray(rows)||rows.length<1||rows.length>3||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('coordinate_canary_limit');
 const session=createSourceSession({maxRequests:18,maxBytes:4500000,deadline:Date.now()+60000});const fetchSource=sourceFetch||session.sourceFetch;
 await mkdir(directory,{recursive:true,mode:0o700});const reports=[];
 for(const row of rows){let report,page=null,source=null;const pre=extractSourceCoordinates('',row);if(pre.reason!=='matching_structured_coordinates_missing')report={...pre,http_status:null};else try{page=await fetchSource(reviewedContactSource(row,identityReviews[row.id]));report=extractSourceCoordinates(page.text,row,{sourceUrl:page.url,httpStatus:page.status,identityReview:identityReviews[row.id]||null})}catch(e){report={...pre,http_status:null,reason:sourceFailureReason(e)}}
 // Persist the same decoded source text used by the extractor. Storage failures
 // are fatal, never misreported as unavailable source or a reviewable capture.
 if(page&&typeof page.text==='string')source=await retain(directory,page.text,'.source.html');
 const snapshot=await retain(directory,canonical(Object.fromEntries(['id','website','name','address','city','country','latitude','longitude','geo_precision','source_fingerprint','database_snapshot','owner_hash','public_eligible','source_kind','owner_managed'].filter(k=>Object.hasOwn(row,k)).map(k=>[k,row[k]]))),'.snapshot.json');
 const identity=identityReviews[row.id]?await retain(directory,canonical(identityReviews[row.id]),'.identity.json'):null;
 const saved=await retain(directory,canonical(report),'.json');
 const evidence=await retain(directory,canonical({listing_id:row.id,ownership_gate:Boolean(row.owner_managed||row.owner_workspace_id),report:saved,source,snapshot,identity_review:identity,source_encoding:'decoded_utf8',coordinate_writes:0}),'.evidence.json');
 reports.push({listing_id:row.id,report_sha256:saved.sha256,evidence_file:evidence.file,status:report.status,reason:report.reason});
 }
 return{reports,source_requests:session.stats.requests,provider_calls:0,coordinate_writes:0};
}
if(process.argv[1]?.endsWith('/source-coordinate-audit.mjs')){const [input,directory]=process.argv.slice(2);if(!input)throw Error('reviewed_snapshot_file_required');auditCoordinateSources(JSON.parse(await readFile(input,'utf8')),{directory}).then(r=>console.log(JSON.stringify(r))).catch(()=>{console.error('coordinate_audit_failed_no_writes');process.exitCode=1});}

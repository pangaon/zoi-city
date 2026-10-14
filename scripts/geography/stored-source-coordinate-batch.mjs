// Bounded research captures from registered websites. Registration is not an
// independent official-source review; candidates remain blocked for application.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createSourceSession} from '../quality/source-fetch.mjs';
import {sha256} from '../quality/evidence.mjs';
import {extractSourceCoordinates} from './source-coordinates.mjs';
const [input,directory,limitArg='36']=process.argv.slice(2),limit=Number(limitArg);
if(!input||!directory||!Number.isInteger(limit)||limit<1||limit>500)throw Error('bounded_batch_required');
const rows=JSON.parse(await readFile(input,'utf8'));
const aggregator=/^(?:www\.)?(?:agfg\.com\.au|tripadvisor\.[a-z.]+|yelp\.[a-z.]+|facebook\.com|instagram\.com|booking\.com|wikipedia\.org)$/i;
const strategy_version='stored_source_coordinates_v1';
const previous=new Map();for(const row of rows){try{const report=JSON.parse(await readFile(path.join(directory,row.id+'.report.json'),'utf8'));if(report.database_snapshot===row.database_snapshot&&report.strategy_version===strategy_version)previous.set(row.id,report);}catch{}}
const pending=rows.filter(r=>{try{return !previous.has(r.id)&&!r.owner_managed&&new URL(r.website).protocol==='https:'&&!aggregator.test(new URL(r.website).hostname)}catch{return false}}).sort((a,b)=>{
 const d=r=>Math.abs(r.latitude-(r.enrichment?.geo?.lat??r.latitude))+Math.abs(r.longitude-(r.enrichment?.geo?.lng??r.longitude));return d(b)-d(a);
}).slice(0,limit);
await mkdir(directory,{recursive:true});let cursor=0,requests=0;const reports=[];
for(const row of rows){
 if(previous.has(row.id)||pending.some(r=>r.id===row.id))continue;
 let reason='outside_current_batch';try{if(row.owner_managed)reason='owner_managed_requires_owner_action';else if(aggregator.test(new URL(row.website).hostname))reason='registered_source_aggregator_requires_official_identification';else if(new URL(row.website).protocol!=='https:')reason='secure_official_source_missing';}catch{reason='official_source_missing';}
 if(reason==='outside_current_batch')continue;
 const report={listing_id:row.id,database_snapshot:row.database_snapshot,strategy_version,reason,application_state:'unresolved',application_result:'not_applied',confidence:'unresolved',captured_at:new Date().toISOString(),current:{latitude:row.latitude,longitude:row.longitude,precision:row.geo_precision,address:row.address,city:row.city,country:row.country},idempotency_key:sha256(row.id+'|'+row.database_snapshot+'|'+strategy_version)};
 await writeFile(path.join(directory,row.id+'.report.json'),JSON.stringify(report,null,2));reports.push(report);
}

await Promise.all(Array.from({length:3},async()=>{
 const session=createSourceSession({maxRequests:1200,maxBytes:200000000,deadline:Date.now()+1200000,spacingMs:1100});
 while(cursor<pending.length){const row=pending[cursor++];let report;
 try{const page=await session.sourceFetch(row.website),hash=sha256(page.text);await writeFile(path.join(directory,hash+'.source.html'),page.text,{mode:0o600});
 report={...extractSourceCoordinates(page.text,{...row,source_kind:'official_website'},{sourceUrl:page.url,httpStatus:page.status}),registered_source_official_review_required:true,application_state:'independent_source_identity_address_review_required',captured_at:new Date().toISOString(),source_file:hash+'.source.html',stored_candidate:row.enrichment?.geo,database_snapshot:row.database_snapshot};
 }catch(error){report={listing_id:row.id,reason:String(error.message),application_state:'source_capture_blocked',captured_at:new Date().toISOString()};}
 report.database_snapshot=row.database_snapshot;report.strategy_version=strategy_version;report.current={latitude:row.latitude,longitude:row.longitude,precision:row.geo_precision,address:row.address,city:row.city,country:row.country};report.confidence=report.candidate?'source_published_pending_independent_review':'unresolved';report.application_result='not_applied';report.idempotency_key=sha256(row.id+'|'+row.database_snapshot+'|'+strategy_version);
 reports.push(report);await writeFile(path.join(directory,row.id+'.report.json'),JSON.stringify(report,null,2));
 }
 requests+=session.stats.requests;
}));
const summary={captured_at:new Date().toISOString(),inventory_rows:rows.length,batch_rows:pending.length,resumed_unchanged_rows:previous.size,reports,requests,provider_calls:0,coordinate_writes:0};
await writeFile(path.join(directory,'batch-summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({batch_rows:pending.length,requests,reasons:reports.reduce((a,r)=>(a[r.reason]=(a[r.reason]||0)+1,a),{}),provider_calls:0,coordinate_writes:0}));

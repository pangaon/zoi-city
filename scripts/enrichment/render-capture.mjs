#!/usr/bin/env node
import {sourceFailureReason} from './source-errors.mjs';
// Operator/CI source capture: inputs are stored listing rows from the existing
// quality/enrichment queues. No database writes, publication, or invented signoff.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {renderOfficialSource} from './render-source.mjs';
import {canonical,sha256} from '../quality/evidence.mjs';
export async function captureRows(rows,{directory='.recovery/rendered-sources',render=renderOfficialSource}={}){
 if(!Array.isArray(rows)||rows.length<1||rows.length>20)throw Error('invalid_capture_batch');
 await mkdir(directory,{recursive:true,mode:0o700});const receipts=[];
 for(const row of rows){if(!/^[0-9a-f-]{36}$/i.test(row.listing_id||row.id||'')||!row.website)throw Error('invalid_listing_identity');
  const identity=sha256(canonical({id:row.listing_id||row.id,website:row.website,fingerprint:row.source_fingerprint||null}));const pointer=path.join(directory,identity+'.capture.json');
  try{const previous=JSON.parse(await readFile(pointer,'utf8'));const bytes=await readFile(path.join(directory,previous.hash+'.json'),'utf8');if(sha256(bytes)!==previous.hash)throw Error('capture_hash_mismatch');receipts.push({...previous,resumed:true});continue;}catch(e){if(e.code!=='ENOENT')throw e;}
  let report;try{report=await render(row);}catch(e){report={schema:1,listing_id:row.listing_id||row.id,website:row.website,collected_at:new Date().toISOString(),source_fingerprint:row.source_fingerprint||null,status:'repair_required',reason:sourceFailureReason(e),specialist:'enrichment'};}
  report.source_fingerprint=row.source_fingerprint||null;
  const body=canonical(report),hash=sha256(body);await writeFile(path.join(directory,hash+'.json'),body,{flag:'wx',mode:0o600});
  const receipt={listing_id:row.listing_id||row.id,hash,status:report.status||'captured_pending_review',source_fingerprint:row.source_fingerprint||null};await writeFile(pointer,canonical(receipt),{flag:'wx',mode:0o600});receipts.push(receipt);
 }return receipts;
}
if(process.argv[1]?.endsWith('/render-capture.mjs')){
 const args=process.argv.slice(2),index=args.indexOf('--input'),out=args.indexOf('--report-dir');
 if(!args.includes('--execute'))console.log(JSON.stringify({mode:'plan_only',writes:0,network_requests:0,required:'--execute --input stored-listing-rows.json [--report-dir directory]'}));
 else if(index<0||!args[index+1]){console.error('stored_listing_rows_required');process.exitCode=1;}
 else captureRows(JSON.parse(await readFile(args[index+1],'utf8')),{directory:out>=0?args[out+1]:undefined}).then(r=>console.log(JSON.stringify(r))).catch(()=>{console.error('capture_failed_preserve_existing_reports');process.exitCode=1;});
}

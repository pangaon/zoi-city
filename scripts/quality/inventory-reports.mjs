#!/usr/bin/env node
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonical,sha256} from './evidence.mjs';
import {immutableFile} from '../quality-collector.mjs';
export function profileInventoryReport(row,snapshot){
 if(!Array.isArray(row)||row.length!==16||!/^[0-9a-f-]{36}$/i.test(row[0])||!row[3])throw Error('invalid_inventory_row');
 const [id,slug,family,fingerprint,eligible,owner,source,enrichment,classification,design,verification,media,contact,coordinates,crawlStatus,lastError]=row;
 const issues=[];const add=(specialist,criterion,reason)=>issues.push({specialist,criterion_hint:criterion,reason,action:'review_existing_quality_checklist',status:'pending'});
 if(eligible!=='true')add('classification','public_visibility','published_but_not_public_eligible');
 if(source!=='true')add('enrichment','source_identity','source_missing');
 if(!media)add('enrichment','source_media','no_primary_image_in_inspected_fields');
 if(!contact)add('enrichment','source_contacts','no_direct_contact_in_inspected_fields');
 if(!coordinates)add('geospatial','map_location','coordinates_missing');
 if(crawlStatus==='error')add('enrichment','source_content',/^[a-z0-9_-]{1,80}$/i.test(lastError||'')?lastError:/certificate|tls|handshake/i.test(lastError||'')?'source_tls_failure':/abort|timeout/i.test(lastError||'')?'source_timeout':'source_transport_failure');
 if(classification!=='verified')add('classification','source_identity','stored_classification_task_not_verified');
 if(design!=='verified')add('design','rendered_design','stored_visual_task_not_verified');
 if(verification!=='verified')add('journey_qa','customer_journey','stored_journey_task_not_verified');
 return {schema:1,snapshot,listing:{id,slug,family,source_fingerprint:fingerprint,public_eligible:eligible==='true',owner_managed:owner==='true'},observation:{kind:'stored_metadata_inventory',source:{status:'not_visited_in_this_audit',stored_task_status:enrichment,stored_crawl_status:crawlStatus},rendered:{status:'not_rendered_in_this_audit',stored_task_status:design},journey:{status:'not_exercised_in_this_audit',stored_task_status:verification},classification:{stored_task_status:classification},capability_hints:{source_available:source==='true',primary_image_present:media,direct_contact_present:contact,coordinates_present:coordinates},limitations:['Field presence is not source validation or customer functionality.','Image and contact hints inspect selected owner/base/machine fields, not every family adapter.','Owner clears and source rights require review before repair.']},existing_checklist:{rpc:'listing_quality_checklist',listing_id:id,status:'not_fetched_in_this_inventory'},repair_plan:issues};
}
export async function inventoryReports(input,output,{expectedCount}={}){
 if(!Number.isInteger(expectedCount)||expectedCount<1)throw Error('expected_inventory_count_required');
 const files=(await readdir(input)).filter(n=>/^page-\d+\.json$/.test(n)).sort();if(!files.length)throw Error('inventory_snapshot_missing');
 const pages=[];for(const file of files){const rows=JSON.parse(await readFile(path.join(input,file),'utf8'));if(!Array.isArray(rows))throw Error('invalid_inventory_page');pages.push({file,rows,hash:sha256(canonical(rows))});}
 const snapshot=sha256(canonical(pages.map(({file,hash})=>({file,hash}))));const ids=new Set();let prior='';
 for(const {rows} of pages)for(const row of rows){if(ids.has(row[0])||row[0]<=prior)throw Error('inventory_duplicate_or_unordered');ids.add(row[0]);prior=row[0];}
 if(ids.size!==expectedCount)throw Error('inventory_count_mismatch');
 const summary={schema:1,snapshot_sha256:snapshot,kind:'stored_metadata_inventory',records:ids.size,expected_records:expectedCount,source_visits:0,rendered_visits:0,journeys_exercised:0,quality_receipts_written:0,families:{},issues:{},pages:pages.map(({file,hash,rows})=>({file,sha256:hash,count:rows.length})),snapshot_consistency:'Ordered read-only pages collected over an interval; not a single database transaction.'};
 const queue=[];await mkdir(output,{recursive:true});
 for(const {rows} of pages)for(const row of rows){const report=profileInventoryReport(row,snapshot);await immutableFile(path.join(output,'profiles'),row[0]+'.json',report);summary.families[row[2]]=(summary.families[row[2]]||0)+1;for(const issue of report.repair_plan){const key=issue.specialist+':'+issue.reason;summary.issues[key]=(summary.issues[key]||0)+1;}queue.push({listing_id:row[0],source_fingerprint:row[3],report:'profiles/'+row[0]+'.json',specialists:[...new Set(report.repair_plan.map(i=>i.specialist))],issue_count:report.repair_plan.length});}
 await immutableFile(output,'summary.json',summary);await immutableFile(output,'repair-plan.json',queue);return summary;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const [input,output,expected]=process.argv.slice(2);if(!input||!output)throw Error('usage_inventory_reports_snapshot_directory_output_directory_expected_count');inventoryReports(input,output,{expectedCount:Number(expected)}).then(s=>console.log(JSON.stringify(s))).catch(e=>{console.error(e.message);process.exitCode=1});}

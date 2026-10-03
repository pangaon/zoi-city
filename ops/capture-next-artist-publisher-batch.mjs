// Read-only publisher evidence collector; never leases, applies or edits a listing.
import{readFile,writeFile,mkdir}from'node:fs/promises';
import{createSourceSession}from'../scripts/quality/source-fetch.mjs';
import{inspectSourceDocument}from'../supabase/functions/zoi-enrich/_document-quality.js';
import{extractRenderedSource,extractorHash}from'../scripts/enrichment/extractor.mjs';
import{canonical,sha256}from'../scripts/quality/evidence.mjs';
const d='docs/audits/evidence/artist-next-batch-2026-10-02';
const inventory=JSON.parse(await readFile(d+'/current-gap-inventory.json','utf8')).records;
const roster=JSON.parse(await readFile(d+'/minos-roster-links.json','utf8'));
const normalize=s=>String(s).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'');
const targets=[];
for(const row of inventory){
 const normalized=normalize(row.name);if(!normalized)continue;
 const links=roster.filter(l=>normalize(l.text)===normalized);
 const unique=[...new Set(links.map(l=>l.url))];if(unique.length!==1)continue;
 targets.push({...row,source:unique[0],roster_identity:links[0].text.trim()});
}
const tsalikis=inventory.find(r=>r.id==='6cddc7aa-7898-4b79-8940-d119db00ab18');
const greek=roster.find(l=>l.text.trim()==='ΓΙΩΡΓΟΣ ΤΣΑΛΙΚΗΣ');if(tsalikis&&greek)targets.push({...tsalikis,source:greek.url,roster_identity:greek.text.trim()});
if(targets.length>20||targets.length!==new Set(targets.map(r=>r.id)).size)throw Error('bounded_unique_batch_required');
await mkdir(d+'/profiles',{recursive:true});
await writeFile(d+'/source-targets.json',JSON.stringify({scope:'exact_unique_roster_matches_only',targets},null,2)+'\n');
const session=createSourceSession({maxRequests:30,maxBytes:5000000,deadline:Date.now()+160000});
const results=[];
for(const row of targets){
 const evidence={listing_id:row.id,name:row.name,slug:row.slug,prior_row_hash:row.row_hash,requested_url:row.source,roster_identity:row.roster_identity,checked_at:new Date().toISOString(),scope:'source_only_no_render_no_production_write'};
 try{
  const response=await session.sourceFetch(row.source);const html=response.text,quality=inspectSourceDocument(html),extracted=extractRenderedSource(html,response.url);
  const headings=[...html.matchAll(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/gi)].map(m=>m[1].replace(/<[^>]+>/g,'').trim());
  const identity=headings.some(h=>h.normalize('NFKC').toLowerCase()===row.roster_identity.normalize('NFKC').toLowerCase());
  const accepted=response.status===200&&quality.source_state==='html_available'&&!quality.requires_rendering&&identity&&!extracted.aggregator&&new URL(response.url).pathname===new URL(row.source).pathname;
  const photoBlock=/<div\b[^>]*class=["'][^"']*artist__photo[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1]||'';
  const images=[...new Set((extracted.profile.photo_urls||[]).filter(u=>photoBlock.includes(u)))];
  Object.assign(evidence,{http_status:response.status,final_url:response.url,source_sha256:sha256(response.body),source_bytes:response.bytes,quality,headings,identity_match:identity,accepted_source_body:accepted,extractor_sha256:extractorHash,source_linked_listen:extracted.profile.listen||{},primary_artist_photo_candidates:images,excluded_image_count:(extracted.profile.photo_urls||[]).length-images.length,source_artifact:d+'/profiles/'+row.id+'.html',next_gates:accepted?['exact fresh full record preflight','portrait byte decode and independent visual identity','individual substantive biography facts','independent source approval','guarded genuine lease/apply','public projection and actual guest journey']:['source identity/challenge/path/body resolution']});
  await writeFile(evidence.source_artifact,response.body);
 }catch(error){evidence.error=error.message;evidence.accepted_source_body=false;}
 await writeFile(d+'/profiles/'+row.id+'.json',JSON.stringify(evidence,null,2)+'\n');results.push(evidence);
 console.log(JSON.stringify({id:row.id,name:row.name,accepted:evidence.accepted_source_body,reason:evidence.error||evidence.quality?.source_state,photos:evidence.primary_artist_photo_candidates?.length||0}));
}
await writeFile(d+'/source-batch-report.json',JSON.stringify({schema:1,read_only:true,source_bodies_only:true,requests:session.stats,records:results,accepted_count:results.filter(r=>r.accepted_source_body).length},null,2)+'\n');

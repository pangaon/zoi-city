// Local evidence packaging only. Reads retained public source/records; no production calls.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {musicHomeContent} from '../api/_music-home.js';
import {inspectSourceDocument} from '../supabase/functions/zoi-enrich/_document-quality.js';
const directory='docs/audits/evidence/artist-next-batch-2026-10-02',out=directory+'/packets';
const sha=value=>createHash('sha256').update(value).digest('hex');
const json=file=>readFile(file,'utf8').then(JSON.parse);
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const sources=(await json(directory+'/source-batch-report.json')).records;
const specs=(await json(directory+'/individual-specifications.json')).records;
const portraits=(await json(directory+'/portrait-reviewed.json')).records;
const records=(await json(directory+'/target-exact-current-rows.json')).records;
const defs=(await json('docs/audits/evidence/kakosaios/ready-packets-2026-10-02/kakosaios.json')).function_guards;
await mkdir(out,{recursive:true});
const manifest={schema:1,status:'producer_batch_requires_independent_review_not_applied',created_at:new Date().toISOString(),records:[],blocked_records:[],runtime_changes:[],production_writes:0};
for(const spec of specs){
 const s={key:spec.id,id:spec.id},before=records.find(r=>r.id===spec.id),row=JSON.parse(before.row_json_text),e=sources.find(r=>r.listing_id===spec.id),p=portraits.find(r=>r.listing_id===spec.id);
 const html=await readFile(e.source_artifact),text=html.toString('utf8'),source=e.final_url,quality=inspectSourceDocument(text),spotify=e.source_linked_listen.spotify;
 if(!e.accepted_source_body||e.source_sha256!==sha(html)||quality.source_state!=='html_available'||quality.requires_rendering||!text.includes(spotify)||!/^https:\/\/open\.spotify\.com\/artist\/[A-Za-z0-9]{22}$/.test(spotify))throw Error('source_not_qualified:'+row.name);
 if(row.entity_type!=='artist'||row.owner_user_id||row.owner_workspace_id||row.website||row.profile?._enrich||row.claim_status!=='unclaimed'||row.publish_status!=='published'||!['clean','cleared'].includes(row.moderation_status))throw Error('snapshot_not_eligible:'+row.name);
 const fields={site_lang:/<html[^>]*lang=["']([^"']+)/i.exec(text)?.[1]||'und',source_kind:'label_artist_profile',listen:{spotify},crawl_status:'ok'};
 if(spec.description)fields.description=spec.description;
 let images=[];
 if(p.accepted_raster){
  const bytes=await readFile(p.artifact);
  if(sha(bytes)!==p.sha256||!e.primary_artist_photo_candidates.includes(p.url)||!text.includes(p.url)||p.visual_inspection!=='producer_viewed_original')throw Error('portrait_evidence_not_reviewed:'+row.name);
  images=[p];Object.assign(fields,{photo_urls:[p.url],photo_url:p.url,hero_url:p.url});
 }
 const packet={schema:1,status:'producer_requires_independent_review_not_applied',listing:{id:row.id,name:row.name,slug:row.slug,entity_type:row.entity_type},source_scope:'record_label',source_kind:'label_artist_profile',source_url:source,source_artifact:e.source_artifact,source_sha256:sha(html),source_quality:quality,identity_basis:{roster_identity:e.roster_identity,exact_primary_heading:e.headings[0],unique_roster_match:true},fact_basis:spec.fact_basis,source_biography_present:spec.source_fact_ready,images,proposed_machine_fields:fields,prior_whole_row_hash:before.row_hash,prior_machine_profile:{},prior_source_url:row.source_url,preserve:['All owner overrides and top-level fields except exact source assignment/trigger timestamp','Entire nonmachine profile, including original biography, geography and unknown prior claims','Canonical identity, ownership, publication and marketplace state'],excluded:spec.exclusions,function_guards:defs,pending:['Independent exact per-record source/fact/image approval','Production current-row and writer-definition recheck','DefaultROLLBACK actual genuine lease/apply with protected content/evidence assertions','Lead-controlled explicit commit variant only after accepted dry run','Public seo_entity readback and actual390/1440 guest listening/gallery/source journey','Native/device handoff acceptance']};
 const file=out+'/'+s.key+'.json',body=JSON.stringify(packet,null,2)+'\n',hash=sha(body);await writeFile(file,body);
 const hypothetical={...row,website:source,source_url:row.source_url||source,profile:{...row.profile,_enrich:{...fields,source_url:source,checked_at:e.checked_at}}};
 const content=musicHomeContent(hypothetical);
 if(content.source_label!=='Record label artist page'||spec.description&&content.story!==spec.description||images.length&&content.portrait!==p.url)throw Error('local_model_projection_failed:'+row.name);
 if(content.spotify!==spotify){
  const gap={status:'blocked_provider_identity_conflict_not_apply_ready',id:row.id,name:row.name,packet:file,packet_sha256:hash,publisher_spotify:spotify,retained_authoritative_spotify:content.spotify,preserved_social_links:row.social_links,next:'Reconcile both valid artist identities before proposing top-level edits; source/link priority is intentionally preserved.'};
  await writeFile(out+'/'+s.key+'-projection-gap.json',JSON.stringify(gap,null,2)+'\n');manifest.blocked_records.push(gap);continue;
 }
 await writeFile(out+'/'+s.key+'-local-projection.json',JSON.stringify({status:'hypothetical_local_model_only_not_public_readback',listing_id:row.id,content},null,2)+'\n');
 const guardSQL=packet.function_guards.map(g=>` IF md5(pg_get_functiondef(to_regprocedure(${quote(g.schema+'.'+g.name+'('+g.args.replace(/^\w+\s+/,'')+')')}))) IS DISTINCT FROM ${quote(g.definition_md5)} THEN RAISE EXCEPTION 'writer_definition_changed:${g.schema}.${g.name}';END IF;`).join('\n');
 const statement=`-- NON-APPLIED exact publisher proposal. Default ROLLBACK. No source fetch is a verification receipt.
-- Independent reviewer supplies actual actor and this packet hash in transaction settings.
-- File ${file}; SHA256 ${hash}; source SHA256 ${packet.source_sha256}.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $reviewed$
DECLARE b zoi.listings;a zoi.listings;leased record;result record;fp text;reviewer text;
 source text:=${quote(source)};
 machine jsonb:=${quote(JSON.stringify(fields))}::jsonb;
BEGIN
 reviewer:=nullif(current_setting('zoi.publisher_review_actor',true),'');
 IF reviewer IS NULL OR current_setting('zoi.publisher_review_packet_sha256',true) IS DISTINCT FROM ${quote(hash)} THEN RAISE EXCEPTION 'exact_independent_packet_review_required';END IF;
${guardSQL}
 SELECT * INTO b FROM zoi.listings WHERE id=${quote(row.id)} FOR UPDATE;
 IF NOT FOUND OR md5(to_jsonb(b)::text) IS DISTINCT FROM ${quote(before.row_hash)} THEN RAISE EXCEPTION 'review_snapshot_changed';END IF;
 IF b.name IS DISTINCT FROM ${quote(row.name)} OR b.slug IS DISTINCT FROM ${quote(row.slug)} OR b.entity_type IS DISTINCT FROM 'artist' OR b.website IS NOT NULL OR b.source_url IS DISTINCT FROM ${row.source_url===null?'NULL':quote(row.source_url)} OR b.owner_user_id IS NOT NULL OR b.owner_workspace_id IS NOT NULL OR b.claim_status IS DISTINCT FROM 'unclaimed' OR b.publish_status IS DISTINCT FROM 'published' OR b.moderation_status NOT IN('clean','cleared') OR b.moderation_status IS NULL OR coalesce(b.marketplace_status,'')='hidden' OR b.profile ? '_enrich' THEN RAISE EXCEPTION 'identity_source_owner_changed';END IF;
 UPDATE zoi.listings SET website=source,source_url=coalesce(b.source_url,source) WHERE id=b.id;
 SELECT * INTO STRICT leased FROM public.enrich_sample_lease(ARRAY[b.id]);
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 fp:=zoi.listing_quality_fingerprint(a);
 IF leased.listing_id IS DISTINCT FROM b.id OR leased.website IS DISTINCT FROM source OR leased.slug IS DISTINCT FROM b.slug OR leased.owner_managed IS DISTINCT FROM false OR leased.existing_enrich IS DISTINCT FROM '{}'::jsonb OR a.profile#>>'{_enrich,lease,id}' IS DISTINCT FROM leased.lease_id OR a.profile#>>'{_enrich,lease,task}' IS DISTINCT FROM 'enrichment' OR a.profile#>>'{_enrich,lease,fingerprint}' IS DISTINCT FROM fp THEN RAISE EXCEPTION 'real_lease_binding_failed';END IF;
 machine:=machine||jsonb_build_object('publisher_source_evidence',jsonb_build_object('packet_sha256',${quote(hash)},'source_sha256',${quote(packet.source_sha256)},'prior_row_hash',${quote(before.row_hash)},'source_fingerprint',fp,'reviewer',reviewer,'method','atomic_reviewed_publisher_proposal','approved_image_hashes',${quote(JSON.stringify(images.map(x=>x.sha256)))}::jsonb));
 SELECT * INTO STRICT result FROM zoi.enrich_apply(jsonb_build_array(jsonb_build_object('slug',b.slug,'website',source,'lease_id',leased.lease_id,'profile',machine,'provenance',jsonb_build_object('source_kind','record_label','description','reviewed-record-label:'||source,'listen','record-label-linked-artist:'||source,'hero_url','reviewed-record-label-portrait:'||source))));
 IF result.applied IS DISTINCT FROM true OR result.slug IS DISTINCT FROM b.slug THEN RAISE EXCEPTION 'enrichment_not_applied';END IF;
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 IF a.source_url IS DISTINCT FROM coalesce(b.source_url,source) THEN RAISE EXCEPTION 'existing_source_history_changed';END IF;
 IF (to_jsonb(a)-ARRAY['website','source_url','profile','updated_at']) IS DISTINCT FROM (to_jsonb(b)-ARRAY['website','source_url','profile','updated_at']) OR (a.profile-'_enrich'-'_coverage') IS DISTINCT FROM b.profile THEN RAISE EXCEPTION 'protected_fields_changed';END IF;
 IF a.profile#>>'{_enrich,publisher_source_evidence,packet_sha256}' IS DISTINCT FROM ${quote(hash)} OR a.profile#>>'{_enrich,publisher_source_evidence,source_sha256}' IS DISTINCT FROM ${quote(packet.source_sha256)} OR a.profile#>>'{_enrich,publisher_source_evidence,reviewer}' IS DISTINCT FROM reviewer OR a.profile#>>'{_enrich,publisher_source_evidence,prior_row_hash}' IS DISTINCT FROM ${quote(before.row_hash)} OR a.profile#>>'{_enrich,publisher_source_evidence,source_fingerprint}' IS DISTINCT FROM fp OR a.profile#>'{_enrich,publisher_source_evidence,approved_image_hashes}' IS DISTINCT FROM ${quote(JSON.stringify(images.map(x=>x.sha256)))}::jsonb OR a.profile#>>'{_enrich,source_kind}' IS DISTINCT FROM 'label_artist_profile' OR a.profile#>'{_enrich,listen}' IS DISTINCT FROM machine->'listen' OR a.profile#>>'{_enrich,description}' IS DISTINCT FROM machine->>'description' OR a.profile#>>'{_enrich,source_url}' IS DISTINCT FROM source OR a.profile#>>'{_enrich,hero_url}' IS DISTINCT FROM machine->>'hero_url' THEN RAISE EXCEPTION 'publisher_projection_fields_missing';END IF;
END $reviewed$;
SELECT id,slug,website,source_url,profile->'_enrich' machine_readback,profile#>'{_coverage,tasks}' coverage_readback,md5(to_jsonb(l)::text) after_row_hash FROM zoi.listings l WHERE id=${quote(row.id)};
ROLLBACK;
`;
 const sql=out+'/'+s.key+'-rollback.sql';await writeFile(sql,statement);

 manifest.records.push({id:row.id,name:row.name,packet:file,packet_sha256:hash,sql,sql_sha256:sha(statement),source_sha256:packet.source_sha256,prior_row_hash:before.row_hash,image_hashes:images.map(x=>x.sha256),biography:!!spec.description,portrait:images.length===1,local_projection_only:true});
}
await writeFile(out+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({records:manifest.records.length,portraits:manifest.records.filter(r=>r.portrait).length,biographies:manifest.records.filter(r=>r.biography).length,production_writes:0}));

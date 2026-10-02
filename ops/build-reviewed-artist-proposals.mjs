// Local evidence packaging only. No database connection or mutation is performed.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {canonical} from '../scripts/quality/evidence.mjs';
import {inspectSourceDocument} from '../supabase/functions/zoi-enrich/_document-quality.js';
import {musicHomeContent} from '../api/_music-home.js';
const directory='docs/audits/evidence/kakosaios';
const out=directory+'/ready-packets-2026-10-02';
const sha=value=>createHash('sha256').update(value).digest('hex');
const json=file=>readFile(file,'utf8').then(JSON.parse);
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const records=(await json(directory+'/ready-artist-records-refresh-2026-10-02.json')).rows;
const defs=(await json(directory+'/current-authoritative-preflight-refresh-2026-10-02.json')).artist_read_1;
for(const d of (await json(directory+'/current-aux-definitions-refresh-2026-10-02.json')).rows.filter(d=>['enrich_timestamp','listing_quality_state'].includes(d.proname)))defs.push({nspname:d.nspname,proname:d.proname,signature:d.args,definition_md5:d.definition_hash});
const specifications=[
 {key:'kakosaios',id:'5a1da680-196d-465b-acd1-25bfb6059df8',source:'https://www.minosemi.gr/artists/γιώργος-κακοσαίος/',html:directory+'/refresh-2026-10-02/raw-page.html',spotify:'https://open.spotify.com/artist/4uyuai6Pqgz3kSx1Jme2PJ',language:'en-us',name_marker:'ΓΙΩΡΓΟΣ ΚΑΚΟΣΑΙΟΣ',description:'Giorgos Kakosaios is a Greek singer and composer. His releases include Monaxia, Ti Na Sas Po and the album Mathe Mou Ton Erota, released by Minos EMI. He has collaborated with Giannis Ploutarchos, Elli Kokkinou and Vasilis Karras.',portrait:directory+'/refresh-2026-10-02/portrait.json',exclusions:['Relative age25 and undated “this summer” tour are not current facts or dated shows.','Publisher navigation images, corporate contact channels, copyright/rights link and news sidebar are excluded.']},
 {key:'sabanis',id:'b2ccabbb-bf1c-4b01-b0b3-bd6e88beadab',source:'https://www.universalmusic.fr/artistes/30792301385',html:directory+'/other-official-2026-10-02/sabanis-universal.html',spotify:'https://open.spotify.com/artist/6ZGwdAmu91r8mpA6SXodzd',language:'fr-fr',name_marker:'Γεώργιος Σαμπάνης',description:'Giorgos Sabanis is a Greek singer and songwriter. His recordings include Haramata, Mistirio Treno, Logia Pou Kaine and Paraxena Demenoi. Universal Music France’s artist page links his Spotify catalogue.',exclusions:['No source-matched portrait: extracted image URLs belong to unrelated publisher news releases. No images are approved.','Publisher social/contact/store links are excluded. No current record-label contract, residence, dated shows, prices or booking availability inferred.','Votanikos lists the2026–27 programme with Friday/Saturday23:00 but no dated start/end; no calendar occurrences synthesized.']}
];
await mkdir(out,{recursive:true});
const manifest={schema:1,status:'producer_proposal_requires_independent_review_not_applied',created_at:new Date().toISOString(),records:[],runtime_changes:[],production_writes:0};
for(const s of specifications){
 const before=records.find(x=>x.row.id===s.id);if(!before)throw Error('record_missing');
 const row=before.row,html=await readFile(s.html),text=html.toString('utf8'),quality=inspectSourceDocument(text);
 if(quality.source_state!=='html_available'||quality.requires_rendering||!text.includes(s.name_marker)||!text.includes(s.spotify))throw Error('source_not_qualified:'+s.key);
 if(row.entity_type!=='artist'||row.owner_user_id||row.owner_workspace_id||row.website||row.source_url||row.profile?._enrich||row.claim_status!=='unclaimed'||row.publish_status!=='published'||!['clean','cleared'].includes(row.moderation_status))throw Error('snapshot_not_eligible');
 const source=new URL(s.source).href;
 const fields={site_lang:s.language,source_kind:'label_artist_profile',description:s.description,listen:{spotify:s.spotify},crawl_status:'ok'};
 let images=[];
 if(s.portrait){const evidence=await json(s.portrait),bytes=await readFile(directory+'/refresh-2026-10-02/portrait.jpeg');if(evidence.status!==200||sha(bytes)!==evidence.sha256||!text.includes(evidence.url)||evidence.dimensions.width!==1000||evidence.dimensions.height!==1000)throw Error('portrait_evidence_changed');images=[{...evidence,artifact:directory+'/refresh-2026-10-02/portrait.jpeg',visually_inspected:true,inspection:'Exact source-linked artist portrait; no unrelated publisher imagery.'}];Object.assign(fields,{photo_urls:[evidence.url],photo_url:evidence.url,hero_url:evidence.url});}
 const packet={schema:1,status:'producer_proposal_requires_independent_review_not_lease_bound_not_applied',listing:{id:row.id,name:row.name,slug:row.slug,entity_type:row.entity_type},source_scope:'record_label',source_kind:'label_artist_profile',source_url:source,source_artifact:s.html,source_sha256:sha(html),source_quality:quality,identity_basis:s.name_marker,images,proposed_machine_fields:fields,prior_whole_row_hash:before.row_hash,prior_machine_profile:{},preserve:['owner_content and all top-level fields except source assignment/trigger timestamp','entire nonmachine profile including original biography and geography','canonical ID, slug, ownership, moderation, publication and marketplace state'],excluded:s.exclusions,function_guards:defs.map(d=>({schema:d.nspname,name:d.proname,args:d.signature,definition_md5:d.definition_md5})),pending:['independent exact artifact and identity approval','bounded atomic ROLLBACK dry run with real lease/apply and protected-field assertions','lead-reviewed commit variant only after dry-run/readback','public seo_entity and deployed home projection','actual390/1440 listening/gallery/source/owner-clear journeys','native handoff/device acceptance']};
 const file=out+'/'+s.key+'.json',body=JSON.stringify(packet,null,2)+'\n',hash=sha(body);await writeFile(file,body);
 const hypothetical={...row,website:source,source_url:source,profile:{...row.profile,_enrich:{...fields,source_url:source,checked_at:'2026-10-02'}}};
 const content=musicHomeContent(hypothetical);if(content.source_label!=='Record label artist page'||content.spotify!==s.spotify||content.story!==s.description||content.email||content.phone||content.shows.length)throw Error('local_projection_failed');
 if(s.portrait&&content.portrait!==images[0].url)throw Error('portrait_projection_failed');
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
 IF b.name IS DISTINCT FROM ${quote(row.name)} OR b.slug IS DISTINCT FROM ${quote(row.slug)} OR b.entity_type IS DISTINCT FROM 'artist' OR b.website IS NOT NULL OR b.source_url IS NOT NULL OR b.owner_user_id IS NOT NULL OR b.owner_workspace_id IS NOT NULL OR b.claim_status IS DISTINCT FROM 'unclaimed' OR b.publish_status IS DISTINCT FROM 'published' OR b.moderation_status NOT IN('clean','cleared') OR b.moderation_status IS NULL OR coalesce(b.marketplace_status,'')='hidden' OR b.profile ? '_enrich' THEN RAISE EXCEPTION 'identity_source_owner_changed';END IF;
 UPDATE zoi.listings SET website=source,source_url=source WHERE id=b.id;
 SELECT * INTO STRICT leased FROM public.enrich_sample_lease(ARRAY[b.id]);
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 fp:=zoi.listing_quality_fingerprint(a);
 IF leased.listing_id IS DISTINCT FROM b.id OR leased.website IS DISTINCT FROM source OR leased.slug IS DISTINCT FROM b.slug OR leased.owner_managed IS DISTINCT FROM false OR leased.existing_enrich IS DISTINCT FROM '{}'::jsonb OR a.profile#>>'{_enrich,lease,id}' IS DISTINCT FROM leased.lease_id OR a.profile#>>'{_enrich,lease,task}' IS DISTINCT FROM 'enrichment' OR a.profile#>>'{_enrich,lease,fingerprint}' IS DISTINCT FROM fp THEN RAISE EXCEPTION 'real_lease_binding_failed';END IF;
 machine:=machine||jsonb_build_object('publisher_source_evidence',jsonb_build_object('packet_sha256',${quote(hash)},'source_sha256',${quote(packet.source_sha256)},'prior_row_hash',${quote(before.row_hash)},'source_fingerprint',fp,'reviewer',reviewer,'method','atomic_reviewed_publisher_proposal','approved_image_hashes',${quote(JSON.stringify(images.map(x=>x.sha256)))}::jsonb));
 SELECT * INTO STRICT result FROM zoi.enrich_apply(jsonb_build_array(jsonb_build_object('slug',b.slug,'website',source,'lease_id',leased.lease_id,'profile',machine,'provenance',jsonb_build_object('source_kind','record_label','description','reviewed-record-label:'||source,'listen','record-label-linked-artist:'||source,'hero_url','reviewed-record-label-portrait:'||source))));
 IF result.applied IS DISTINCT FROM true OR result.slug IS DISTINCT FROM b.slug THEN RAISE EXCEPTION 'enrichment_not_applied';END IF;
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 IF (to_jsonb(a)-ARRAY['website','source_url','profile','updated_at']) IS DISTINCT FROM (to_jsonb(b)-ARRAY['website','source_url','profile','updated_at']) OR (a.profile-'_enrich'-'_coverage') IS DISTINCT FROM b.profile THEN RAISE EXCEPTION 'protected_fields_changed';END IF;
 IF a.profile#>>'{_enrich,publisher_source_evidence,packet_sha256}' IS DISTINCT FROM ${quote(hash)} OR a.profile#>>'{_enrich,publisher_source_evidence,source_sha256}' IS DISTINCT FROM ${quote(packet.source_sha256)} OR a.profile#>>'{_enrich,publisher_source_evidence,reviewer}' IS DISTINCT FROM reviewer OR a.profile#>>'{_enrich,publisher_source_evidence,prior_row_hash}' IS DISTINCT FROM ${quote(before.row_hash)} OR a.profile#>>'{_enrich,publisher_source_evidence,source_fingerprint}' IS DISTINCT FROM fp OR a.profile#>'{_enrich,publisher_source_evidence,approved_image_hashes}' IS DISTINCT FROM ${quote(JSON.stringify(images.map(x=>x.sha256)))}::jsonb OR a.profile#>>'{_enrich,source_kind}' IS DISTINCT FROM 'label_artist_profile' OR a.profile#>'{_enrich,listen}' IS DISTINCT FROM machine->'listen' OR a.profile#>>'{_enrich,description}' IS DISTINCT FROM machine->>'description' OR a.profile#>>'{_enrich,source_url}' IS DISTINCT FROM source OR a.profile#>>'{_enrich,hero_url}' IS DISTINCT FROM machine->>'hero_url' THEN RAISE EXCEPTION 'publisher_projection_fields_missing';END IF;
END $reviewed$;
SELECT id,slug,website,source_url,profile->'_enrich' machine_readback,profile#>'{_coverage,tasks}' coverage_readback,md5(to_jsonb(l)::text) after_row_hash FROM zoi.listings l WHERE id=${quote(row.id)};
ROLLBACK;
`;
 const sql='ops/'+s.key+'-publisher-refresh-proposal.sql';await writeFile(sql,statement);
 manifest.records.push({id:row.id,name:row.name,packet:file,packet_sha256:hash,sql,sql_sha256:sha(statement),source_sha256:packet.source_sha256,prior_row_hash:before.row_hash,image_hashes:images.map(x=>x.sha256),local_projection_only:true});
}
await writeFile(out+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest));

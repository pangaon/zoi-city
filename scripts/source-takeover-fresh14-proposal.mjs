#!/usr/bin/env node
// Proposed data receipt through existing service-only writers, not a migration.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {credentialFindings} from './check-source-credentials.mjs';
const root=resolve(process.argv[2]||'.'),base='docs/audits/evidence/source-takeover-fresh14-2026-10-03';
const dispositions=JSON.parse(await readFile(resolve(root,base,'reviewed-dispositions.json'),'utf8'));
const currentBytes=await readFile(resolve(root,base,'current-public-records.json'));
const current=JSON.parse(currentBytes);
const baseline=JSON.parse(await readFile(resolve(root,base,'current-writers.json'),'utf8'));
const supplement=JSON.parse(await readFile(resolve(root,base,'current-writer-supplement.json'),'utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
if(hash(currentBytes)!==dispositions.current_public_records_sha256)throw Error('current_record_review_bytes_changed');
const kinds=new Map([['confirmed_gambling_takeover','gambling'],['confirmed_domain_sale_takeover','domain_sale'],['confirmed_unrelated_gaming_takeover','unrelated_gaming'],['confirmed_unrelated_content_takeover','unrelated_content'],['invalid_import_domain_sale','invalid_import'],['invalid_import_unrelated_ai','invalid_import']]);
const targets=await Promise.all(dispositions.receipts.map(async receipt=>{
 const r=current.rows.find(x=>x.public_record.id===receipt.id),p=r?.public_record?.profile||{},b=r?.public_record;
 if(!r||!receipt.reviewed_current_fields||!kinds.has(receipt.disposition)||r.row_hash!==receipt.row_hash||r.profile_hash!==receipt.profile_hash||r.authored_profile_hash!==receipt.authored_profile_hash)throw Error('review_identity_changed');
 if(r.has_owner_user||r.has_owner_workspace||b.claim_status!=='unclaimed'||Object.hasOwn(p,'website')||Object.hasOwn(p.owner_content||{},'website')||Object.hasOwn(p.operational||{},'website'))throw Error('current_owner_guard');
 if(b.publish_status!=='published'||!['clean','cleared'].includes(b.moderation_status)||b.marketplace_status==='hidden')throw Error('current_visibility_guard');
 const bytes=await readFile(resolve(root,receipt.capture_path));
 if(hash(bytes)!==receipt.capture_sha256)throw Error('reviewed_source_capture_changed');
 return {id:b.id,slug:b.slug,name:b.name,entity_type:b.entity_type,source_url:b.source_url,website:b.website,imported_source:p._enrich?.source_url,row_hash:r.row_hash,profile_hash:r.profile_hash,authored_profile_hash:r.authored_profile_hash,disposition:receipt.disposition,capture_sha256:receipt.capture_sha256,last_error:'source_identity_'+kinds.get(receipt.disposition)+':'+receipt.capture_sha256};
}));
if(targets.length!==14||new Set(targets.map(x=>x.id)).size!==14)throw Error('expected_exact_fourteen');
const guards=[...baseline.rows,...supplement.rows].map(r=>({signature:r.signature.startsWith('zoi.')?r.signature:'public.'+r.signature,body_md5:r.body_md5,acl:r.acl}));
const json=value=>JSON.stringify(value);
const sql=`-- NEW current full-record/source review proposal only. Original37b packet remains held. Default ROLLBACK. No alternate URLs or schema changes.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
SET LOCAL idle_in_transaction_session_timeout = '30s';
DO $takeover$
DECLARE expected jsonb := $targets$${json(targets)}$targets$::jsonb;
 guards jsonb := $guards$${json(guards)}$guards$::jsonb;
 g jsonb; t jsonb; before_row zoi.listings; after_row zoi.listings;
 leased record; applied_row record; locked_count integer := 0;
BEGIN
 FOR g IN SELECT value FROM jsonb_array_elements(guards) LOOP
  IF to_regprocedure(g->>'signature') IS NULL OR
     md5(pg_get_functiondef(to_regprocedure(g->>'signature'))) IS DISTINCT FROM g->>'body_md5' OR
     (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure(g->>'signature')) IS DISTINCT FROM g->>'acl'
  THEN RAISE EXCEPTION 'takeover_writer_baseline_changed:%',g->>'signature'; END IF;
 END LOOP;
 -- Lock and validate every exact target before the first writer lease.
 FOR before_row IN SELECT l.* FROM zoi.listings l
 WHERE l.id IN (SELECT (value->>'id')::uuid FROM jsonb_array_elements(expected))
 ORDER BY l.id FOR UPDATE LOOP
  locked_count:=locked_count+1;
  SELECT value INTO t FROM jsonb_array_elements(expected) WHERE value->>'id'=before_row.id::text;
  IF md5(to_jsonb(before_row)::text) IS DISTINCT FROM t->>'row_hash' OR
     before_row.slug IS DISTINCT FROM t->>'slug' OR before_row.name IS DISTINCT FROM t->>'name' OR
     before_row.website IS DISTINCT FROM t->>'website' OR
     before_row.entity_type IS DISTINCT FROM t->>'entity_type' OR
     before_row.source_url IS DISTINCT FROM t->>'source_url' OR
     md5(before_row.profile::text) IS DISTINCT FROM t->>'profile_hash' OR
     before_row.profile#>>'{_enrich,source_url}' IS DISTINCT FROM t->>'imported_source' OR
     before_row.owner_user_id IS NOT NULL OR before_row.owner_workspace_id IS NOT NULL OR
     before_row.claim_status IS DISTINCT FROM 'unclaimed' OR
     before_row.publish_status IS DISTINCT FROM 'published' OR
     before_row.moderation_status NOT IN ('clean','cleared') OR before_row.moderation_status IS NULL OR
     coalesce(before_row.marketplace_status,'')='hidden' OR
     before_row.profile ? 'website' OR coalesce((before_row.profile->'owner_content')?'website',false) OR
     coalesce((before_row.profile->'operational')?'website',false)
  THEN RAISE EXCEPTION 'takeover_record_preflight_changed:%',before_row.id; END IF;
 END LOOP;
 IF locked_count<>jsonb_array_length(expected) THEN RAISE EXCEPTION 'takeover_target_missing'; END IF;
 FOR t IN SELECT value FROM jsonb_array_elements(expected) ORDER BY value->>'id' LOOP
  SELECT * INTO STRICT before_row FROM zoi.listings WHERE id=(t->>'id')::uuid;
  SELECT * INTO STRICT leased FROM public.enrich_sample_lease(ARRAY[before_row.id]);
  IF leased.listing_id IS DISTINCT FROM before_row.id OR leased.slug IS DISTINCT FROM before_row.slug OR
     leased.website IS DISTINCT FROM before_row.website OR leased.owner_managed OR leased.owner_workspace_id IS NOT NULL
  THEN RAISE EXCEPTION 'takeover_lease_identity_mismatch'; END IF;
  SELECT * INTO STRICT applied_row FROM public.enrich_apply(jsonb_build_array(jsonb_build_object(
   'slug',leased.slug,'lease_id',leased.lease_id,'website',leased.website,
   'profile',jsonb_build_object('crawl_status','error','blocked','true',
    'blocked_reason','source_scope_mismatch','last_error',t->>'last_error'))));
  IF NOT applied_row.applied OR applied_row.slug IS DISTINCT FROM before_row.slug THEN RAISE EXCEPTION 'takeover_writer_rejected'; END IF;
  SELECT * INTO STRICT after_row FROM zoi.listings WHERE id=before_row.id;
  IF (to_jsonb(after_row)-'profile'-'updated_at') IS DISTINCT FROM (to_jsonb(before_row)-'profile'-'updated_at') OR
     md5((after_row.profile-'_enrich'-'_coverage')::text) IS DISTINCT FROM t->>'authored_profile_hash' OR
     after_row.profile#>>'{_enrich,blocked_reason}' IS DISTINCT FROM 'source_scope_mismatch' OR
     after_row.profile#>>'{_enrich,blocked}' IS DISTINCT FROM 'true' OR
     after_row.profile#>>'{_enrich,last_error}' IS DISTINCT FROM t->>'last_error' OR
     after_row.profile#>>'{_coverage,tasks,enrichment,status}' IS DISTINCT FROM 'blocked' OR
     after_row.profile#>'{_enrich,lease}' IS NOT NULL OR
     ((after_row.profile->'_enrich')-'crawl_status'-'status'-'last_error'-'last_attempt_at'-'blocked'-'blocked_reason')
      IS DISTINCT FROM ((before_row.profile->'_enrich')-'lease'-'crawl_status'-'status'-'last_error'-'last_attempt_at'-'blocked'-'blocked_reason')
  THEN RAISE EXCEPTION 'takeover_preservation_failed:%',before_row.id; END IF;
 END LOOP;
END $takeover$;
-- Replace ROLLBACK with COMMIT only after independent exact packet and fresh preflight review.
ROLLBACK;
`;
if(credentialFindings(sql).length)throw Error('credential_before_retaining_proposal');
await mkdir(resolve(root,'ops/proposals'),{recursive:true});
await writeFile(resolve(root,'ops/proposals/source-takeover-fresh14-2026-10-03.sql'),sql);
await writeFile(resolve(root,base,'quarantine-targets.json'),JSON.stringify({targets,guards,default_rollback:true,no_production_writes:true},null,2)+'\n');
console.log(JSON.stringify({targets:targets.length,guards:guards.length,default_rollback:true,new_current_review:true}));

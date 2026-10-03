-- NON-APPLIED exact publisher proposal. Default ROLLBACK. No source fetch is a verification receipt.
-- Independent reviewer supplies actual actor and this packet hash in transaction settings.
-- File docs/audits/evidence/artist-next-batch-2026-10-02/packets/74505bc2-d26c-4b19-891c-bfa9dd0a018b.json; SHA256 45b491cd182eab1ffb884281dc2de47845f7bfef84d76fe3ab4a5752f54c7b41; source SHA256 e6fdb8e2507eb9d8b2dd6aad10d8b7a556400cba0df47866603fdc0447486b9f.
BEGIN;
SET LOCAL zoi.publisher_review_actor = 'Codex independent reviewer /root/youth_review';
SET LOCAL zoi.publisher_review_packet_sha256 = '45b491cd182eab1ffb884281dc2de47845f7bfef84d76fe3ab4a5752f54c7b41';
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $reviewed$
DECLARE b zoi.listings;a zoi.listings;leased record;result record;fp text;reviewer text;
 source text:='https://www.minosemi.gr/artists/bloody-hawk/';
 machine jsonb:='{"site_lang":"en-US","source_kind":"label_artist_profile","listen":{"spotify":"https://open.spotify.com/artist/4NKSnDH3KS823DGnHDDDsy"},"crawl_status":"ok","photo_urls":["https://www.minosemi.gr/wp-content/uploads/sites/946/2021/11/Bloody-Hawk-Website.png"],"photo_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2021/11/Bloody-Hawk-Website.png","hero_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2021/11/Bloody-Hawk-Website.png"}'::jsonb;
BEGIN
 reviewer:=nullif(current_setting('zoi.publisher_review_actor',true),'');
 IF reviewer IS NULL OR current_setting('zoi.publisher_review_packet_sha256',true) IS DISTINCT FROM '45b491cd182eab1ffb884281dc2de47845f7bfef84d76fe3ab4a5752f54c7b41' THEN RAISE EXCEPTION 'exact_independent_packet_review_required';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_apply(jsonb)'))) IS DISTINCT FROM '396c9e8ef6e7a19cb7e2c361a21bccbb' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_sample_lease(uuid[])'))) IS DISTINCT FROM '16a53918d76c896492c47dcca32806ca' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_sample_lease';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.seo_entity(text)'))) IS DISTINCT FROM 'e01c20df827c18865a0bfaadff2a9d49' THEN RAISE EXCEPTION 'writer_definition_changed:public.seo_entity';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_apply(jsonb)'))) IS DISTINCT FROM '8e41b35a16426573b5867436e60f0abf' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_fingerprint(zoi.listings)'))) IS DISTINCT FROM 'cc69353ab17d09e06846eb90c1ee34cd' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_fingerprint';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.profile_strip(jsonb)'))) IS DISTINCT FROM '8b20fc1c36fca6647a69e155fbeb377f' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.profile_strip';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_timestamp(text)'))) IS DISTINCT FROM '281a90ff6e44c1a64b2d3c8977f1c38c' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_timestamp';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_state(zoi.listings)'))) IS DISTINCT FROM 'ea1641facea45c788f8e6ca84feaf6d4' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_state';END IF;
 SELECT * INTO b FROM zoi.listings WHERE id='74505bc2-d26c-4b19-891c-bfa9dd0a018b' FOR UPDATE;
 IF NOT FOUND OR md5(to_jsonb(b)::text) IS DISTINCT FROM 'c5b67d905d3ae5af7f7244c0348b7901' THEN RAISE EXCEPTION 'review_snapshot_changed';END IF;
 IF b.name IS DISTINCT FROM 'Bloody Hawk' OR b.slug IS DISTINCT FROM 'bloody-hawk-athens-74505b' OR b.entity_type IS DISTINCT FROM 'artist' OR b.website IS NOT NULL OR b.source_url IS DISTINCT FROM NULL OR b.owner_user_id IS NOT NULL OR b.owner_workspace_id IS NOT NULL OR b.claim_status IS DISTINCT FROM 'unclaimed' OR b.publish_status IS DISTINCT FROM 'published' OR b.moderation_status NOT IN('clean','cleared') OR b.moderation_status IS NULL OR coalesce(b.marketplace_status,'')='hidden' OR b.profile ? '_enrich' THEN RAISE EXCEPTION 'identity_source_owner_changed';END IF;
 UPDATE zoi.listings SET website=source,source_url=coalesce(b.source_url,source) WHERE id=b.id;
 SELECT * INTO STRICT leased FROM public.enrich_sample_lease(ARRAY[b.id]);
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 fp:=zoi.listing_quality_fingerprint(a);
 IF leased.listing_id IS DISTINCT FROM b.id OR leased.website IS DISTINCT FROM source OR leased.slug IS DISTINCT FROM b.slug OR leased.owner_managed IS DISTINCT FROM false OR leased.existing_enrich IS DISTINCT FROM '{}'::jsonb OR a.profile#>>'{_enrich,lease,id}' IS DISTINCT FROM leased.lease_id OR a.profile#>>'{_enrich,lease,task}' IS DISTINCT FROM 'enrichment' OR a.profile#>>'{_enrich,lease,fingerprint}' IS DISTINCT FROM fp THEN RAISE EXCEPTION 'real_lease_binding_failed';END IF;
 machine:=machine||jsonb_build_object('publisher_source_evidence',jsonb_build_object('packet_sha256','45b491cd182eab1ffb884281dc2de47845f7bfef84d76fe3ab4a5752f54c7b41','source_sha256','e6fdb8e2507eb9d8b2dd6aad10d8b7a556400cba0df47866603fdc0447486b9f','prior_row_hash','c5b67d905d3ae5af7f7244c0348b7901','source_fingerprint',fp,'reviewer',reviewer,'method','atomic_reviewed_publisher_proposal','approved_image_hashes','["3aeb8822702c539fbc6185925d4a782926197f56ccf35c21db12d2ad8b75ff1a"]'::jsonb));
 SELECT * INTO STRICT result FROM zoi.enrich_apply(jsonb_build_array(jsonb_build_object('slug',b.slug,'website',source,'lease_id',leased.lease_id,'profile',machine,'provenance',jsonb_build_object('source_kind','record_label','description','reviewed-record-label:'||source,'listen','record-label-linked-artist:'||source,'hero_url','reviewed-record-label-portrait:'||source))));
 IF result.applied IS DISTINCT FROM true OR result.slug IS DISTINCT FROM b.slug THEN RAISE EXCEPTION 'enrichment_not_applied';END IF;
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 IF a.source_url IS DISTINCT FROM coalesce(b.source_url,source) THEN RAISE EXCEPTION 'existing_source_history_changed';END IF;
 IF (to_jsonb(a)-ARRAY['website','source_url','profile','updated_at']) IS DISTINCT FROM (to_jsonb(b)-ARRAY['website','source_url','profile','updated_at']) OR (a.profile-'_enrich'-'_coverage') IS DISTINCT FROM b.profile THEN RAISE EXCEPTION 'protected_fields_changed';END IF;
 IF a.profile#>>'{_enrich,publisher_source_evidence,packet_sha256}' IS DISTINCT FROM '45b491cd182eab1ffb884281dc2de47845f7bfef84d76fe3ab4a5752f54c7b41' OR a.profile#>>'{_enrich,publisher_source_evidence,source_sha256}' IS DISTINCT FROM 'e6fdb8e2507eb9d8b2dd6aad10d8b7a556400cba0df47866603fdc0447486b9f' OR a.profile#>>'{_enrich,publisher_source_evidence,reviewer}' IS DISTINCT FROM reviewer OR a.profile#>>'{_enrich,publisher_source_evidence,prior_row_hash}' IS DISTINCT FROM 'c5b67d905d3ae5af7f7244c0348b7901' OR a.profile#>>'{_enrich,publisher_source_evidence,source_fingerprint}' IS DISTINCT FROM fp OR a.profile#>'{_enrich,publisher_source_evidence,approved_image_hashes}' IS DISTINCT FROM '["3aeb8822702c539fbc6185925d4a782926197f56ccf35c21db12d2ad8b75ff1a"]'::jsonb OR a.profile#>>'{_enrich,source_kind}' IS DISTINCT FROM 'label_artist_profile' OR a.profile#>'{_enrich,listen}' IS DISTINCT FROM machine->'listen' OR a.profile#>>'{_enrich,description}' IS DISTINCT FROM machine->>'description' OR a.profile#>>'{_enrich,source_url}' IS DISTINCT FROM source OR a.profile#>>'{_enrich,hero_url}' IS DISTINCT FROM machine->>'hero_url' THEN RAISE EXCEPTION 'publisher_projection_fields_missing';END IF;
END $reviewed$;
SELECT id,slug,website,source_url,profile->'_enrich' machine_readback,profile#>'{_coverage,tasks}' coverage_readback,md5(to_jsonb(l)::text) after_row_hash FROM zoi.listings l WHERE id='74505bc2-d26c-4b19-891c-bfa9dd0a018b';
COMMIT;


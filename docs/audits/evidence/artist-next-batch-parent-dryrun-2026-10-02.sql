-- NON-APPLIED exact publisher proposal. Default ROLLBACK. No source fetch is a verification receipt.
-- Independent reviewer supplies actual actor and this packet hash in transaction settings.
-- File docs/audits/evidence/artist-next-batch-2026-10-02/packets/b5a1fb8a-1ffd-41cb-ad87-218479ec0952.json; SHA256 8c7c88f1c7d3b075ea235b191c9a734052109388c2a7671eaaea5b9644de2dfb; source SHA256 97982b583bdf65235401f3ac8b830a9337aa207bf5a57671948e4522c7f4c99e.
BEGIN;
SET LOCAL zoi.publisher_review_actor = 'Codex independent reviewer /root/youth_review';
SET LOCAL zoi.publisher_review_packet_sha256 = '8c7c88f1c7d3b075ea235b191c9a734052109388c2a7671eaaea5b9644de2dfb';
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $reviewed$
DECLARE b zoi.listings;a zoi.listings;leased record;result record;fp text;reviewer text;
 source text:='https://www.minosemi.gr/artists/5017/';
 machine jsonb:='{"site_lang":"en-US","source_kind":"label_artist_profile","listen":{"spotify":"https://open.spotify.com/artist/0ryXG4cu4Ac81CojYsKcTL"},"crawl_status":"ok","description":"Akylas is a Greek pop artist originally from Serres. His music combines electronic pop with Greek and Balkan influences. His releases include Atelie and Ferto."}'::jsonb;
BEGIN
 reviewer:=nullif(current_setting('zoi.publisher_review_actor',true),'');
 IF reviewer IS NULL OR current_setting('zoi.publisher_review_packet_sha256',true) IS DISTINCT FROM '8c7c88f1c7d3b075ea235b191c9a734052109388c2a7671eaaea5b9644de2dfb' THEN RAISE EXCEPTION 'exact_independent_packet_review_required';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_apply(jsonb)'))) IS DISTINCT FROM '396c9e8ef6e7a19cb7e2c361a21bccbb' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_sample_lease(uuid[])'))) IS DISTINCT FROM '16a53918d76c896492c47dcca32806ca' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_sample_lease';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.seo_entity(text)'))) IS DISTINCT FROM 'e01c20df827c18865a0bfaadff2a9d49' THEN RAISE EXCEPTION 'writer_definition_changed:public.seo_entity';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_apply(jsonb)'))) IS DISTINCT FROM '8e41b35a16426573b5867436e60f0abf' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_fingerprint(zoi.listings)'))) IS DISTINCT FROM 'cc69353ab17d09e06846eb90c1ee34cd' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_fingerprint';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.profile_strip(jsonb)'))) IS DISTINCT FROM '8b20fc1c36fca6647a69e155fbeb377f' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.profile_strip';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_timestamp(text)'))) IS DISTINCT FROM '281a90ff6e44c1a64b2d3c8977f1c38c' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_timestamp';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_state(zoi.listings)'))) IS DISTINCT FROM 'ea1641facea45c788f8e6ca84feaf6d4' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_state';END IF;
 SELECT * INTO b FROM zoi.listings WHERE id='b5a1fb8a-1ffd-41cb-ad87-218479ec0952' FOR UPDATE;
 IF NOT FOUND OR md5(to_jsonb(b)::text) IS DISTINCT FROM 'ac967ae58f8c8c81d16d1f15793101c2' THEN RAISE EXCEPTION 'review_snapshot_changed';END IF;
 IF b.name IS DISTINCT FROM 'Akylas' OR b.slug IS DISTINCT FROM 'akylas-athens' OR b.entity_type IS DISTINCT FROM 'artist' OR b.website IS NOT NULL OR b.source_url IS DISTINCT FROM 'https://en.wikipedia.org/wiki/Akylas' OR b.owner_user_id IS NOT NULL OR b.owner_workspace_id IS NOT NULL OR b.claim_status IS DISTINCT FROM 'unclaimed' OR b.publish_status IS DISTINCT FROM 'published' OR b.moderation_status NOT IN('clean','cleared') OR b.moderation_status IS NULL OR coalesce(b.marketplace_status,'')='hidden' OR b.profile ? '_enrich' THEN RAISE EXCEPTION 'identity_source_owner_changed';END IF;
 UPDATE zoi.listings SET website=source,source_url=coalesce(b.source_url,source) WHERE id=b.id;
 SELECT * INTO STRICT leased FROM public.enrich_sample_lease(ARRAY[b.id]);
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 fp:=zoi.listing_quality_fingerprint(a);
 IF leased.listing_id IS DISTINCT FROM b.id OR leased.website IS DISTINCT FROM source OR leased.slug IS DISTINCT FROM b.slug OR leased.owner_managed IS DISTINCT FROM false OR leased.existing_enrich IS DISTINCT FROM '{}'::jsonb OR a.profile#>>'{_enrich,lease,id}' IS DISTINCT FROM leased.lease_id OR a.profile#>>'{_enrich,lease,task}' IS DISTINCT FROM 'enrichment' OR a.profile#>>'{_enrich,lease,fingerprint}' IS DISTINCT FROM fp THEN RAISE EXCEPTION 'real_lease_binding_failed';END IF;
 machine:=machine||jsonb_build_object('publisher_source_evidence',jsonb_build_object('packet_sha256','8c7c88f1c7d3b075ea235b191c9a734052109388c2a7671eaaea5b9644de2dfb','source_sha256','97982b583bdf65235401f3ac8b830a9337aa207bf5a57671948e4522c7f4c99e','prior_row_hash','ac967ae58f8c8c81d16d1f15793101c2','source_fingerprint',fp,'reviewer',reviewer,'method','atomic_reviewed_publisher_proposal','approved_image_hashes','[]'::jsonb));
 SELECT * INTO STRICT result FROM zoi.enrich_apply(jsonb_build_array(jsonb_build_object('slug',b.slug,'website',source,'lease_id',leased.lease_id,'profile',machine,'provenance',jsonb_build_object('source_kind','record_label','description','reviewed-record-label:'||source,'listen','record-label-linked-artist:'||source,'hero_url','reviewed-record-label-portrait:'||source))));
 IF result.applied IS DISTINCT FROM true OR result.slug IS DISTINCT FROM b.slug THEN RAISE EXCEPTION 'enrichment_not_applied';END IF;
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 IF a.source_url IS DISTINCT FROM coalesce(b.source_url,source) THEN RAISE EXCEPTION 'existing_source_history_changed';END IF;
 IF (to_jsonb(a)-ARRAY['website','source_url','profile','updated_at']) IS DISTINCT FROM (to_jsonb(b)-ARRAY['website','source_url','profile','updated_at']) OR (a.profile-'_enrich'-'_coverage') IS DISTINCT FROM b.profile THEN RAISE EXCEPTION 'protected_fields_changed';END IF;
 IF a.profile#>>'{_enrich,publisher_source_evidence,packet_sha256}' IS DISTINCT FROM '8c7c88f1c7d3b075ea235b191c9a734052109388c2a7671eaaea5b9644de2dfb' OR a.profile#>>'{_enrich,publisher_source_evidence,source_sha256}' IS DISTINCT FROM '97982b583bdf65235401f3ac8b830a9337aa207bf5a57671948e4522c7f4c99e' OR a.profile#>>'{_enrich,publisher_source_evidence,reviewer}' IS DISTINCT FROM reviewer OR a.profile#>>'{_enrich,publisher_source_evidence,prior_row_hash}' IS DISTINCT FROM 'ac967ae58f8c8c81d16d1f15793101c2' OR a.profile#>>'{_enrich,publisher_source_evidence,source_fingerprint}' IS DISTINCT FROM fp OR a.profile#>'{_enrich,publisher_source_evidence,approved_image_hashes}' IS DISTINCT FROM '[]'::jsonb OR a.profile#>>'{_enrich,source_kind}' IS DISTINCT FROM 'label_artist_profile' OR a.profile#>'{_enrich,listen}' IS DISTINCT FROM machine->'listen' OR a.profile#>>'{_enrich,description}' IS DISTINCT FROM machine->>'description' OR a.profile#>>'{_enrich,source_url}' IS DISTINCT FROM source OR a.profile#>>'{_enrich,hero_url}' IS DISTINCT FROM machine->>'hero_url' THEN RAISE EXCEPTION 'publisher_projection_fields_missing';END IF;
END $reviewed$;
SELECT id,slug,website,source_url,profile->'_enrich' machine_readback,profile#>'{_coverage,tasks}' coverage_readback,md5(to_jsonb(l)::text) after_row_hash FROM zoi.listings l WHERE id='b5a1fb8a-1ffd-41cb-ad87-218479ec0952';
ROLLBACK;

-- NON-APPLIED exact publisher proposal. Default ROLLBACK. No source fetch is a verification receipt.
-- Independent reviewer supplies actual actor and this packet hash in transaction settings.
-- File docs/audits/evidence/artist-next-batch-2026-10-02/packets/6314023e-c3e9-4f0d-bc1d-29440872e2fd.json; SHA256 a73deb84986791cff12a20b7d8df453ade10eb2ce6dd8838e3682a3b00852619; source SHA256 663655432c1552025e3e803e3b20f7ca99a1ed914a96491ff88d7f09768e8de4.
BEGIN;
SET LOCAL zoi.publisher_review_actor = 'Codex independent reviewer /root/youth_review';
SET LOCAL zoi.publisher_review_packet_sha256 = 'a73deb84986791cff12a20b7d8df453ade10eb2ce6dd8838e3682a3b00852619';
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $reviewed$
DECLARE b zoi.listings;a zoi.listings;leased record;result record;fp text;reviewer text;
 source text:='https://www.minosemi.gr/artists/antigoni/';
 machine jsonb:='{"site_lang":"en-US","source_kind":"label_artist_profile","listen":{"spotify":"https://open.spotify.com/artist/1w3S0hfHSbOupc4EVLRGrW"},"crawl_status":"ok","description":"Antigoni is a singer and songwriter with Greek Cypriot roots, born and raised in North London. Her music combines pop, hip-hop and bouzouki influences. She toured with Marina Satti in 2025.","photo_urls":["https://www.minosemi.gr/wp-content/uploads/sites/946/2026/02/ab6761610000e5eb84fa8c3b48e6dc85922d4b95-500x500.jpg"],"photo_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2026/02/ab6761610000e5eb84fa8c3b48e6dc85922d4b95-500x500.jpg","hero_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2026/02/ab6761610000e5eb84fa8c3b48e6dc85922d4b95-500x500.jpg"}'::jsonb;
BEGIN
 reviewer:=nullif(current_setting('zoi.publisher_review_actor',true),'');
 IF reviewer IS NULL OR current_setting('zoi.publisher_review_packet_sha256',true) IS DISTINCT FROM 'a73deb84986791cff12a20b7d8df453ade10eb2ce6dd8838e3682a3b00852619' THEN RAISE EXCEPTION 'exact_independent_packet_review_required';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_apply(jsonb)'))) IS DISTINCT FROM '396c9e8ef6e7a19cb7e2c361a21bccbb' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_sample_lease(uuid[])'))) IS DISTINCT FROM '16a53918d76c896492c47dcca32806ca' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_sample_lease';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.seo_entity(text)'))) IS DISTINCT FROM 'e01c20df827c18865a0bfaadff2a9d49' THEN RAISE EXCEPTION 'writer_definition_changed:public.seo_entity';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_apply(jsonb)'))) IS DISTINCT FROM '8e41b35a16426573b5867436e60f0abf' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_fingerprint(zoi.listings)'))) IS DISTINCT FROM 'cc69353ab17d09e06846eb90c1ee34cd' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_fingerprint';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.profile_strip(jsonb)'))) IS DISTINCT FROM '8b20fc1c36fca6647a69e155fbeb377f' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.profile_strip';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_timestamp(text)'))) IS DISTINCT FROM '281a90ff6e44c1a64b2d3c8977f1c38c' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_timestamp';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_state(zoi.listings)'))) IS DISTINCT FROM 'ea1641facea45c788f8e6ca84feaf6d4' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_state';END IF;
 SELECT * INTO b FROM zoi.listings WHERE id='6314023e-c3e9-4f0d-bc1d-29440872e2fd' FOR UPDATE;
 IF NOT FOUND OR md5(to_jsonb(b)::text) IS DISTINCT FROM 'da68d8a18db7bd299aabca2136eed695' THEN RAISE EXCEPTION 'review_snapshot_changed';END IF;
 IF b.name IS DISTINCT FROM 'Antigoni' OR b.slug IS DISTINCT FROM 'antigoni-london' OR b.entity_type IS DISTINCT FROM 'artist' OR b.website IS NOT NULL OR b.source_url IS DISTINCT FROM NULL OR b.owner_user_id IS NOT NULL OR b.owner_workspace_id IS NOT NULL OR b.claim_status IS DISTINCT FROM 'unclaimed' OR b.publish_status IS DISTINCT FROM 'published' OR b.moderation_status NOT IN('clean','cleared') OR b.moderation_status IS NULL OR coalesce(b.marketplace_status,'')='hidden' OR b.profile ? '_enrich' THEN RAISE EXCEPTION 'identity_source_owner_changed';END IF;
 UPDATE zoi.listings SET website=source,source_url=coalesce(b.source_url,source) WHERE id=b.id;
 SELECT * INTO STRICT leased FROM public.enrich_sample_lease(ARRAY[b.id]);
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 fp:=zoi.listing_quality_fingerprint(a);
 IF leased.listing_id IS DISTINCT FROM b.id OR leased.website IS DISTINCT FROM source OR leased.slug IS DISTINCT FROM b.slug OR leased.owner_managed IS DISTINCT FROM false OR leased.existing_enrich IS DISTINCT FROM '{}'::jsonb OR a.profile#>>'{_enrich,lease,id}' IS DISTINCT FROM leased.lease_id OR a.profile#>>'{_enrich,lease,task}' IS DISTINCT FROM 'enrichment' OR a.profile#>>'{_enrich,lease,fingerprint}' IS DISTINCT FROM fp THEN RAISE EXCEPTION 'real_lease_binding_failed';END IF;
 machine:=machine||jsonb_build_object('publisher_source_evidence',jsonb_build_object('packet_sha256','a73deb84986791cff12a20b7d8df453ade10eb2ce6dd8838e3682a3b00852619','source_sha256','663655432c1552025e3e803e3b20f7ca99a1ed914a96491ff88d7f09768e8de4','prior_row_hash','da68d8a18db7bd299aabca2136eed695','source_fingerprint',fp,'reviewer',reviewer,'method','atomic_reviewed_publisher_proposal','approved_image_hashes','["4993419933a3993df0cfa3b9a85d4c8ddfc3cbe669efbe64cd7e9d586ba051ba"]'::jsonb));
 SELECT * INTO STRICT result FROM zoi.enrich_apply(jsonb_build_array(jsonb_build_object('slug',b.slug,'website',source,'lease_id',leased.lease_id,'profile',machine,'provenance',jsonb_build_object('source_kind','record_label','description','reviewed-record-label:'||source,'listen','record-label-linked-artist:'||source,'hero_url','reviewed-record-label-portrait:'||source))));
 IF result.applied IS DISTINCT FROM true OR result.slug IS DISTINCT FROM b.slug THEN RAISE EXCEPTION 'enrichment_not_applied';END IF;
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 IF a.source_url IS DISTINCT FROM coalesce(b.source_url,source) THEN RAISE EXCEPTION 'existing_source_history_changed';END IF;
 IF (to_jsonb(a)-ARRAY['website','source_url','profile','updated_at']) IS DISTINCT FROM (to_jsonb(b)-ARRAY['website','source_url','profile','updated_at']) OR (a.profile-'_enrich'-'_coverage') IS DISTINCT FROM b.profile THEN RAISE EXCEPTION 'protected_fields_changed';END IF;
 IF a.profile#>>'{_enrich,publisher_source_evidence,packet_sha256}' IS DISTINCT FROM 'a73deb84986791cff12a20b7d8df453ade10eb2ce6dd8838e3682a3b00852619' OR a.profile#>>'{_enrich,publisher_source_evidence,source_sha256}' IS DISTINCT FROM '663655432c1552025e3e803e3b20f7ca99a1ed914a96491ff88d7f09768e8de4' OR a.profile#>>'{_enrich,publisher_source_evidence,reviewer}' IS DISTINCT FROM reviewer OR a.profile#>>'{_enrich,publisher_source_evidence,prior_row_hash}' IS DISTINCT FROM 'da68d8a18db7bd299aabca2136eed695' OR a.profile#>>'{_enrich,publisher_source_evidence,source_fingerprint}' IS DISTINCT FROM fp OR a.profile#>'{_enrich,publisher_source_evidence,approved_image_hashes}' IS DISTINCT FROM '["4993419933a3993df0cfa3b9a85d4c8ddfc3cbe669efbe64cd7e9d586ba051ba"]'::jsonb OR a.profile#>>'{_enrich,source_kind}' IS DISTINCT FROM 'label_artist_profile' OR a.profile#>'{_enrich,listen}' IS DISTINCT FROM machine->'listen' OR a.profile#>>'{_enrich,description}' IS DISTINCT FROM machine->>'description' OR a.profile#>>'{_enrich,source_url}' IS DISTINCT FROM source OR a.profile#>>'{_enrich,hero_url}' IS DISTINCT FROM machine->>'hero_url' THEN RAISE EXCEPTION 'publisher_projection_fields_missing';END IF;
END $reviewed$;
SELECT id,slug,website,source_url,profile->'_enrich' machine_readback,profile#>'{_coverage,tasks}' coverage_readback,md5(to_jsonb(l)::text) after_row_hash FROM zoi.listings l WHERE id='6314023e-c3e9-4f0d-bc1d-29440872e2fd';
ROLLBACK;

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
ROLLBACK;

-- NON-APPLIED exact publisher proposal. Default ROLLBACK. No source fetch is a verification receipt.
-- Independent reviewer supplies actual actor and this packet hash in transaction settings.
-- File docs/audits/evidence/artist-next-batch-2026-10-02/packets/accc5252-87e6-4ce7-8088-e43dccdac8d9.json; SHA256 839051d6b8309d738bed1f2a90dcdfaec90acf34894f38bf695a39edce675bd9; source SHA256 c2db49ffb891414b47866d4c6f0a3e8dc5e8eb1b3604232e9fcfa81e9fab53a0.
BEGIN;
SET LOCAL zoi.publisher_review_actor = 'Codex independent reviewer /root/youth_review';
SET LOCAL zoi.publisher_review_packet_sha256 = '839051d6b8309d738bed1f2a90dcdfaec90acf34894f38bf695a39edce675bd9';
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $reviewed$
DECLARE b zoi.listings;a zoi.listings;leased record;result record;fp text;reviewer text;
 source text:='https://www.minosemi.gr/artists/bossikan/';
 machine jsonb:='{"site_lang":"en-US","source_kind":"label_artist_profile","listen":{"spotify":"https://open.spotify.com/artist/2Iy8kK89T3l62dJcAkflqM"},"crawl_status":"ok","description":"Bossikan is a Greek trap artist. His releases include Full Press with FLY LO and Ricta, XCM, S’agapw and the 2024 album ALEQUAN. He has collaborated with VLOSPA and Hawk.","photo_urls":["https://www.minosemi.gr/wp-content/uploads/sites/946/2020/10/bossikan-photo-2048x2048.png"],"photo_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2020/10/bossikan-photo-2048x2048.png","hero_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2020/10/bossikan-photo-2048x2048.png"}'::jsonb;
BEGIN
 reviewer:=nullif(current_setting('zoi.publisher_review_actor',true),'');
 IF reviewer IS NULL OR current_setting('zoi.publisher_review_packet_sha256',true) IS DISTINCT FROM '839051d6b8309d738bed1f2a90dcdfaec90acf34894f38bf695a39edce675bd9' THEN RAISE EXCEPTION 'exact_independent_packet_review_required';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_apply(jsonb)'))) IS DISTINCT FROM '396c9e8ef6e7a19cb7e2c361a21bccbb' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_sample_lease(uuid[])'))) IS DISTINCT FROM '16a53918d76c896492c47dcca32806ca' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_sample_lease';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.seo_entity(text)'))) IS DISTINCT FROM 'e01c20df827c18865a0bfaadff2a9d49' THEN RAISE EXCEPTION 'writer_definition_changed:public.seo_entity';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_apply(jsonb)'))) IS DISTINCT FROM '8e41b35a16426573b5867436e60f0abf' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_fingerprint(zoi.listings)'))) IS DISTINCT FROM 'cc69353ab17d09e06846eb90c1ee34cd' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_fingerprint';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.profile_strip(jsonb)'))) IS DISTINCT FROM '8b20fc1c36fca6647a69e155fbeb377f' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.profile_strip';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_timestamp(text)'))) IS DISTINCT FROM '281a90ff6e44c1a64b2d3c8977f1c38c' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_timestamp';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_state(zoi.listings)'))) IS DISTINCT FROM 'ea1641facea45c788f8e6ca84feaf6d4' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_state';END IF;
 SELECT * INTO b FROM zoi.listings WHERE id='accc5252-87e6-4ce7-8088-e43dccdac8d9' FOR UPDATE;
 IF NOT FOUND OR md5(to_jsonb(b)::text) IS DISTINCT FROM 'afd730477900ca37fe81f794a4386e57' THEN RAISE EXCEPTION 'review_snapshot_changed';END IF;
 IF b.name IS DISTINCT FROM 'Bossikan' OR b.slug IS DISTINCT FROM 'bossikan-athens' OR b.entity_type IS DISTINCT FROM 'artist' OR b.website IS NOT NULL OR b.source_url IS DISTINCT FROM NULL OR b.owner_user_id IS NOT NULL OR b.owner_workspace_id IS NOT NULL OR b.claim_status IS DISTINCT FROM 'unclaimed' OR b.publish_status IS DISTINCT FROM 'published' OR b.moderation_status NOT IN('clean','cleared') OR b.moderation_status IS NULL OR coalesce(b.marketplace_status,'')='hidden' OR b.profile ? '_enrich' THEN RAISE EXCEPTION 'identity_source_owner_changed';END IF;
 UPDATE zoi.listings SET website=source,source_url=coalesce(b.source_url,source) WHERE id=b.id;
 SELECT * INTO STRICT leased FROM public.enrich_sample_lease(ARRAY[b.id]);
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 fp:=zoi.listing_quality_fingerprint(a);
 IF leased.listing_id IS DISTINCT FROM b.id OR leased.website IS DISTINCT FROM source OR leased.slug IS DISTINCT FROM b.slug OR leased.owner_managed IS DISTINCT FROM false OR leased.existing_enrich IS DISTINCT FROM '{}'::jsonb OR a.profile#>>'{_enrich,lease,id}' IS DISTINCT FROM leased.lease_id OR a.profile#>>'{_enrich,lease,task}' IS DISTINCT FROM 'enrichment' OR a.profile#>>'{_enrich,lease,fingerprint}' IS DISTINCT FROM fp THEN RAISE EXCEPTION 'real_lease_binding_failed';END IF;
 machine:=machine||jsonb_build_object('publisher_source_evidence',jsonb_build_object('packet_sha256','839051d6b8309d738bed1f2a90dcdfaec90acf34894f38bf695a39edce675bd9','source_sha256','c2db49ffb891414b47866d4c6f0a3e8dc5e8eb1b3604232e9fcfa81e9fab53a0','prior_row_hash','afd730477900ca37fe81f794a4386e57','source_fingerprint',fp,'reviewer',reviewer,'method','atomic_reviewed_publisher_proposal','approved_image_hashes','["d2096055109d6077d92cbcc00b376d74a34804b013a23c66e7826312c1d4e1dc"]'::jsonb));
 SELECT * INTO STRICT result FROM zoi.enrich_apply(jsonb_build_array(jsonb_build_object('slug',b.slug,'website',source,'lease_id',leased.lease_id,'profile',machine,'provenance',jsonb_build_object('source_kind','record_label','description','reviewed-record-label:'||source,'listen','record-label-linked-artist:'||source,'hero_url','reviewed-record-label-portrait:'||source))));
 IF result.applied IS DISTINCT FROM true OR result.slug IS DISTINCT FROM b.slug THEN RAISE EXCEPTION 'enrichment_not_applied';END IF;
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 IF a.source_url IS DISTINCT FROM coalesce(b.source_url,source) THEN RAISE EXCEPTION 'existing_source_history_changed';END IF;
 IF (to_jsonb(a)-ARRAY['website','source_url','profile','updated_at']) IS DISTINCT FROM (to_jsonb(b)-ARRAY['website','source_url','profile','updated_at']) OR (a.profile-'_enrich'-'_coverage') IS DISTINCT FROM b.profile THEN RAISE EXCEPTION 'protected_fields_changed';END IF;
 IF a.profile#>>'{_enrich,publisher_source_evidence,packet_sha256}' IS DISTINCT FROM '839051d6b8309d738bed1f2a90dcdfaec90acf34894f38bf695a39edce675bd9' OR a.profile#>>'{_enrich,publisher_source_evidence,source_sha256}' IS DISTINCT FROM 'c2db49ffb891414b47866d4c6f0a3e8dc5e8eb1b3604232e9fcfa81e9fab53a0' OR a.profile#>>'{_enrich,publisher_source_evidence,reviewer}' IS DISTINCT FROM reviewer OR a.profile#>>'{_enrich,publisher_source_evidence,prior_row_hash}' IS DISTINCT FROM 'afd730477900ca37fe81f794a4386e57' OR a.profile#>>'{_enrich,publisher_source_evidence,source_fingerprint}' IS DISTINCT FROM fp OR a.profile#>'{_enrich,publisher_source_evidence,approved_image_hashes}' IS DISTINCT FROM '["d2096055109d6077d92cbcc00b376d74a34804b013a23c66e7826312c1d4e1dc"]'::jsonb OR a.profile#>>'{_enrich,source_kind}' IS DISTINCT FROM 'label_artist_profile' OR a.profile#>'{_enrich,listen}' IS DISTINCT FROM machine->'listen' OR a.profile#>>'{_enrich,description}' IS DISTINCT FROM machine->>'description' OR a.profile#>>'{_enrich,source_url}' IS DISTINCT FROM source OR a.profile#>>'{_enrich,hero_url}' IS DISTINCT FROM machine->>'hero_url' THEN RAISE EXCEPTION 'publisher_projection_fields_missing';END IF;
END $reviewed$;
SELECT id,slug,website,source_url,profile->'_enrich' machine_readback,profile#>'{_coverage,tasks}' coverage_readback,md5(to_jsonb(l)::text) after_row_hash FROM zoi.listings l WHERE id='accc5252-87e6-4ce7-8088-e43dccdac8d9';
ROLLBACK;

-- NON-APPLIED exact publisher proposal. Default ROLLBACK. No source fetch is a verification receipt.
-- Independent reviewer supplies actual actor and this packet hash in transaction settings.
-- File docs/audits/evidence/artist-next-batch-2026-10-02/packets/56f6e20a-002e-475c-821d-ff1cada01c62.json; SHA256 925724769f030129849f0ae2105af99367f22720daa11e48222892a83bd987fc; source SHA256 f4105e3547fd525835c20b4dcf5670f5d6e428c7abd01050cc7ce6d044ae88cf.
BEGIN;
SET LOCAL zoi.publisher_review_actor = 'Codex independent reviewer /root/youth_review';
SET LOCAL zoi.publisher_review_packet_sha256 = '925724769f030129849f0ae2105af99367f22720daa11e48222892a83bd987fc';
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $reviewed$
DECLARE b zoi.listings;a zoi.listings;leased record;result record;fp text;reviewer text;
 source text:='https://www.minosemi.gr/artists/claydee/';
 machine jsonb:='{"site_lang":"en-US","source_kind":"label_artist_profile","listen":{"spotify":"https://open.spotify.com/artist/2rcsCDLsJw6erBukvjEsrP"},"crawl_status":"ok","photo_urls":["https://www.minosemi.gr/wp-content/uploads/sites/946/2025/10/ab6761610000e5eba3ad7af2a4e9f58275b60d23.jpg"],"photo_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2025/10/ab6761610000e5eba3ad7af2a4e9f58275b60d23.jpg","hero_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2025/10/ab6761610000e5eba3ad7af2a4e9f58275b60d23.jpg"}'::jsonb;
BEGIN
 reviewer:=nullif(current_setting('zoi.publisher_review_actor',true),'');
 IF reviewer IS NULL OR current_setting('zoi.publisher_review_packet_sha256',true) IS DISTINCT FROM '925724769f030129849f0ae2105af99367f22720daa11e48222892a83bd987fc' THEN RAISE EXCEPTION 'exact_independent_packet_review_required';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_apply(jsonb)'))) IS DISTINCT FROM '396c9e8ef6e7a19cb7e2c361a21bccbb' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_sample_lease(uuid[])'))) IS DISTINCT FROM '16a53918d76c896492c47dcca32806ca' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_sample_lease';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.seo_entity(text)'))) IS DISTINCT FROM 'e01c20df827c18865a0bfaadff2a9d49' THEN RAISE EXCEPTION 'writer_definition_changed:public.seo_entity';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_apply(jsonb)'))) IS DISTINCT FROM '8e41b35a16426573b5867436e60f0abf' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_fingerprint(zoi.listings)'))) IS DISTINCT FROM 'cc69353ab17d09e06846eb90c1ee34cd' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_fingerprint';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.profile_strip(jsonb)'))) IS DISTINCT FROM '8b20fc1c36fca6647a69e155fbeb377f' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.profile_strip';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_timestamp(text)'))) IS DISTINCT FROM '281a90ff6e44c1a64b2d3c8977f1c38c' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_timestamp';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_state(zoi.listings)'))) IS DISTINCT FROM 'ea1641facea45c788f8e6ca84feaf6d4' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_state';END IF;
 SELECT * INTO b FROM zoi.listings WHERE id='56f6e20a-002e-475c-821d-ff1cada01c62' FOR UPDATE;
 IF NOT FOUND OR md5(to_jsonb(b)::text) IS DISTINCT FROM 'dd88a7d60a083547b91b83eb5ae4e033' THEN RAISE EXCEPTION 'review_snapshot_changed';END IF;
 IF b.name IS DISTINCT FROM 'Claydee' OR b.slug IS DISTINCT FROM 'claydee-athens-56f6e2' OR b.entity_type IS DISTINCT FROM 'artist' OR b.website IS NOT NULL OR b.source_url IS DISTINCT FROM NULL OR b.owner_user_id IS NOT NULL OR b.owner_workspace_id IS NOT NULL OR b.claim_status IS DISTINCT FROM 'unclaimed' OR b.publish_status IS DISTINCT FROM 'published' OR b.moderation_status NOT IN('clean','cleared') OR b.moderation_status IS NULL OR coalesce(b.marketplace_status,'')='hidden' OR b.profile ? '_enrich' THEN RAISE EXCEPTION 'identity_source_owner_changed';END IF;
 UPDATE zoi.listings SET website=source,source_url=coalesce(b.source_url,source) WHERE id=b.id;
 SELECT * INTO STRICT leased FROM public.enrich_sample_lease(ARRAY[b.id]);
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 fp:=zoi.listing_quality_fingerprint(a);
 IF leased.listing_id IS DISTINCT FROM b.id OR leased.website IS DISTINCT FROM source OR leased.slug IS DISTINCT FROM b.slug OR leased.owner_managed IS DISTINCT FROM false OR leased.existing_enrich IS DISTINCT FROM '{}'::jsonb OR a.profile#>>'{_enrich,lease,id}' IS DISTINCT FROM leased.lease_id OR a.profile#>>'{_enrich,lease,task}' IS DISTINCT FROM 'enrichment' OR a.profile#>>'{_enrich,lease,fingerprint}' IS DISTINCT FROM fp THEN RAISE EXCEPTION 'real_lease_binding_failed';END IF;
 machine:=machine||jsonb_build_object('publisher_source_evidence',jsonb_build_object('packet_sha256','925724769f030129849f0ae2105af99367f22720daa11e48222892a83bd987fc','source_sha256','f4105e3547fd525835c20b4dcf5670f5d6e428c7abd01050cc7ce6d044ae88cf','prior_row_hash','dd88a7d60a083547b91b83eb5ae4e033','source_fingerprint',fp,'reviewer',reviewer,'method','atomic_reviewed_publisher_proposal','approved_image_hashes','["6d36f1ffdebb70f6b3d2e0c83b2a29d9770dd3c11530792d71074936d0182456"]'::jsonb));
 SELECT * INTO STRICT result FROM zoi.enrich_apply(jsonb_build_array(jsonb_build_object('slug',b.slug,'website',source,'lease_id',leased.lease_id,'profile',machine,'provenance',jsonb_build_object('source_kind','record_label','description','reviewed-record-label:'||source,'listen','record-label-linked-artist:'||source,'hero_url','reviewed-record-label-portrait:'||source))));
 IF result.applied IS DISTINCT FROM true OR result.slug IS DISTINCT FROM b.slug THEN RAISE EXCEPTION 'enrichment_not_applied';END IF;
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 IF a.source_url IS DISTINCT FROM coalesce(b.source_url,source) THEN RAISE EXCEPTION 'existing_source_history_changed';END IF;
 IF (to_jsonb(a)-ARRAY['website','source_url','profile','updated_at']) IS DISTINCT FROM (to_jsonb(b)-ARRAY['website','source_url','profile','updated_at']) OR (a.profile-'_enrich'-'_coverage') IS DISTINCT FROM b.profile THEN RAISE EXCEPTION 'protected_fields_changed';END IF;
 IF a.profile#>>'{_enrich,publisher_source_evidence,packet_sha256}' IS DISTINCT FROM '925724769f030129849f0ae2105af99367f22720daa11e48222892a83bd987fc' OR a.profile#>>'{_enrich,publisher_source_evidence,source_sha256}' IS DISTINCT FROM 'f4105e3547fd525835c20b4dcf5670f5d6e428c7abd01050cc7ce6d044ae88cf' OR a.profile#>>'{_enrich,publisher_source_evidence,reviewer}' IS DISTINCT FROM reviewer OR a.profile#>>'{_enrich,publisher_source_evidence,prior_row_hash}' IS DISTINCT FROM 'dd88a7d60a083547b91b83eb5ae4e033' OR a.profile#>>'{_enrich,publisher_source_evidence,source_fingerprint}' IS DISTINCT FROM fp OR a.profile#>'{_enrich,publisher_source_evidence,approved_image_hashes}' IS DISTINCT FROM '["6d36f1ffdebb70f6b3d2e0c83b2a29d9770dd3c11530792d71074936d0182456"]'::jsonb OR a.profile#>>'{_enrich,source_kind}' IS DISTINCT FROM 'label_artist_profile' OR a.profile#>'{_enrich,listen}' IS DISTINCT FROM machine->'listen' OR a.profile#>>'{_enrich,description}' IS DISTINCT FROM machine->>'description' OR a.profile#>>'{_enrich,source_url}' IS DISTINCT FROM source OR a.profile#>>'{_enrich,hero_url}' IS DISTINCT FROM machine->>'hero_url' THEN RAISE EXCEPTION 'publisher_projection_fields_missing';END IF;
END $reviewed$;
SELECT id,slug,website,source_url,profile->'_enrich' machine_readback,profile#>'{_coverage,tasks}' coverage_readback,md5(to_jsonb(l)::text) after_row_hash FROM zoi.listings l WHERE id='56f6e20a-002e-475c-821d-ff1cada01c62';
ROLLBACK;

-- NON-APPLIED exact publisher proposal. Default ROLLBACK. No source fetch is a verification receipt.
-- Independent reviewer supplies actual actor and this packet hash in transaction settings.
-- File docs/audits/evidence/artist-next-batch-2026-10-02/packets/c860e992-8d41-4f10-92db-5bcad471552d.json; SHA256 353429b8d6733c9c17e9d126a9ca5807ead635aacda6f1179144308b137b3e1c; source SHA256 87be9b9b4cc1bff1d23ded0ccc91a3dad5b3df3838322bcdbfd161c157050b19.
BEGIN;
SET LOCAL zoi.publisher_review_actor = 'Codex independent reviewer /root/youth_review';
SET LOCAL zoi.publisher_review_packet_sha256 = '353429b8d6733c9c17e9d126a9ca5807ead635aacda6f1179144308b137b3e1c';
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $reviewed$
DECLARE b zoi.listings;a zoi.listings;leased record;result record;fp text;reviewer text;
 source text:='https://www.minosemi.gr/artists/evangelia/';
 machine jsonb:='{"site_lang":"en-US","source_kind":"label_artist_profile","listen":{"spotify":"https://open.spotify.com/artist/3J7SI1JrZt43ZBlH24IqCK"},"crawl_status":"ok","description":"Evangelia is a Greek-American singer and songwriter whose music combines Greek folk influences with contemporary pop. Raised between New Jersey and Crete, she performs bilingually. Her releases include Fotia, Alitheia?!, Pali and Vradia.","photo_urls":["https://www.minosemi.gr/wp-content/uploads/sites/946/2024/08/Evangelia_square.jpg"],"photo_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2024/08/Evangelia_square.jpg","hero_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2024/08/Evangelia_square.jpg"}'::jsonb;
BEGIN
 reviewer:=nullif(current_setting('zoi.publisher_review_actor',true),'');
 IF reviewer IS NULL OR current_setting('zoi.publisher_review_packet_sha256',true) IS DISTINCT FROM '353429b8d6733c9c17e9d126a9ca5807ead635aacda6f1179144308b137b3e1c' THEN RAISE EXCEPTION 'exact_independent_packet_review_required';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_apply(jsonb)'))) IS DISTINCT FROM '396c9e8ef6e7a19cb7e2c361a21bccbb' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_sample_lease(uuid[])'))) IS DISTINCT FROM '16a53918d76c896492c47dcca32806ca' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_sample_lease';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.seo_entity(text)'))) IS DISTINCT FROM 'e01c20df827c18865a0bfaadff2a9d49' THEN RAISE EXCEPTION 'writer_definition_changed:public.seo_entity';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_apply(jsonb)'))) IS DISTINCT FROM '8e41b35a16426573b5867436e60f0abf' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_fingerprint(zoi.listings)'))) IS DISTINCT FROM 'cc69353ab17d09e06846eb90c1ee34cd' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_fingerprint';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.profile_strip(jsonb)'))) IS DISTINCT FROM '8b20fc1c36fca6647a69e155fbeb377f' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.profile_strip';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_timestamp(text)'))) IS DISTINCT FROM '281a90ff6e44c1a64b2d3c8977f1c38c' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_timestamp';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_state(zoi.listings)'))) IS DISTINCT FROM 'ea1641facea45c788f8e6ca84feaf6d4' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_state';END IF;
 SELECT * INTO b FROM zoi.listings WHERE id='c860e992-8d41-4f10-92db-5bcad471552d' FOR UPDATE;
 IF NOT FOUND OR md5(to_jsonb(b)::text) IS DISTINCT FROM 'e5f1f302cce45ab778c6fbbffeeec8f5' THEN RAISE EXCEPTION 'review_snapshot_changed';END IF;
 IF b.name IS DISTINCT FROM 'Evangelia' OR b.slug IS DISTINCT FROM 'evangelia-new-york' OR b.entity_type IS DISTINCT FROM 'artist' OR b.website IS NOT NULL OR b.source_url IS DISTINCT FROM NULL OR b.owner_user_id IS NOT NULL OR b.owner_workspace_id IS NOT NULL OR b.claim_status IS DISTINCT FROM 'unclaimed' OR b.publish_status IS DISTINCT FROM 'published' OR b.moderation_status NOT IN('clean','cleared') OR b.moderation_status IS NULL OR coalesce(b.marketplace_status,'')='hidden' OR b.profile ? '_enrich' THEN RAISE EXCEPTION 'identity_source_owner_changed';END IF;
 UPDATE zoi.listings SET website=source,source_url=coalesce(b.source_url,source) WHERE id=b.id;
 SELECT * INTO STRICT leased FROM public.enrich_sample_lease(ARRAY[b.id]);
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 fp:=zoi.listing_quality_fingerprint(a);
 IF leased.listing_id IS DISTINCT FROM b.id OR leased.website IS DISTINCT FROM source OR leased.slug IS DISTINCT FROM b.slug OR leased.owner_managed IS DISTINCT FROM false OR leased.existing_enrich IS DISTINCT FROM '{}'::jsonb OR a.profile#>>'{_enrich,lease,id}' IS DISTINCT FROM leased.lease_id OR a.profile#>>'{_enrich,lease,task}' IS DISTINCT FROM 'enrichment' OR a.profile#>>'{_enrich,lease,fingerprint}' IS DISTINCT FROM fp THEN RAISE EXCEPTION 'real_lease_binding_failed';END IF;
 machine:=machine||jsonb_build_object('publisher_source_evidence',jsonb_build_object('packet_sha256','353429b8d6733c9c17e9d126a9ca5807ead635aacda6f1179144308b137b3e1c','source_sha256','87be9b9b4cc1bff1d23ded0ccc91a3dad5b3df3838322bcdbfd161c157050b19','prior_row_hash','e5f1f302cce45ab778c6fbbffeeec8f5','source_fingerprint',fp,'reviewer',reviewer,'method','atomic_reviewed_publisher_proposal','approved_image_hashes','["30022bafab66076cca72c5cabf9e28760f0561e721eb09835e12df18adbfe274"]'::jsonb));
 SELECT * INTO STRICT result FROM zoi.enrich_apply(jsonb_build_array(jsonb_build_object('slug',b.slug,'website',source,'lease_id',leased.lease_id,'profile',machine,'provenance',jsonb_build_object('source_kind','record_label','description','reviewed-record-label:'||source,'listen','record-label-linked-artist:'||source,'hero_url','reviewed-record-label-portrait:'||source))));
 IF result.applied IS DISTINCT FROM true OR result.slug IS DISTINCT FROM b.slug THEN RAISE EXCEPTION 'enrichment_not_applied';END IF;
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 IF a.source_url IS DISTINCT FROM coalesce(b.source_url,source) THEN RAISE EXCEPTION 'existing_source_history_changed';END IF;
 IF (to_jsonb(a)-ARRAY['website','source_url','profile','updated_at']) IS DISTINCT FROM (to_jsonb(b)-ARRAY['website','source_url','profile','updated_at']) OR (a.profile-'_enrich'-'_coverage') IS DISTINCT FROM b.profile THEN RAISE EXCEPTION 'protected_fields_changed';END IF;
 IF a.profile#>>'{_enrich,publisher_source_evidence,packet_sha256}' IS DISTINCT FROM '353429b8d6733c9c17e9d126a9ca5807ead635aacda6f1179144308b137b3e1c' OR a.profile#>>'{_enrich,publisher_source_evidence,source_sha256}' IS DISTINCT FROM '87be9b9b4cc1bff1d23ded0ccc91a3dad5b3df3838322bcdbfd161c157050b19' OR a.profile#>>'{_enrich,publisher_source_evidence,reviewer}' IS DISTINCT FROM reviewer OR a.profile#>>'{_enrich,publisher_source_evidence,prior_row_hash}' IS DISTINCT FROM 'e5f1f302cce45ab778c6fbbffeeec8f5' OR a.profile#>>'{_enrich,publisher_source_evidence,source_fingerprint}' IS DISTINCT FROM fp OR a.profile#>'{_enrich,publisher_source_evidence,approved_image_hashes}' IS DISTINCT FROM '["30022bafab66076cca72c5cabf9e28760f0561e721eb09835e12df18adbfe274"]'::jsonb OR a.profile#>>'{_enrich,source_kind}' IS DISTINCT FROM 'label_artist_profile' OR a.profile#>'{_enrich,listen}' IS DISTINCT FROM machine->'listen' OR a.profile#>>'{_enrich,description}' IS DISTINCT FROM machine->>'description' OR a.profile#>>'{_enrich,source_url}' IS DISTINCT FROM source OR a.profile#>>'{_enrich,hero_url}' IS DISTINCT FROM machine->>'hero_url' THEN RAISE EXCEPTION 'publisher_projection_fields_missing';END IF;
END $reviewed$;
SELECT id,slug,website,source_url,profile->'_enrich' machine_readback,profile#>'{_coverage,tasks}' coverage_readback,md5(to_jsonb(l)::text) after_row_hash FROM zoi.listings l WHERE id='c860e992-8d41-4f10-92db-5bcad471552d';
ROLLBACK;

-- NON-APPLIED exact publisher proposal. Default ROLLBACK. No source fetch is a verification receipt.
-- Independent reviewer supplies actual actor and this packet hash in transaction settings.
-- File docs/audits/evidence/artist-next-batch-2026-10-02/packets/3f708bed-a4d0-4424-9497-bde4047573f4.json; SHA256 510d8b41bba8d3b29fdacf2467344df1213f0045dc0d2284140f4c1fd8a79d6a; source SHA256 0b1b7fe5ad83bb946c6d0b62563f6a9b710fce3c8ad5f6b05b74cc45960ed2f7.
BEGIN;
SET LOCAL zoi.publisher_review_actor = 'Codex independent reviewer /root/youth_review';
SET LOCAL zoi.publisher_review_packet_sha256 = '510d8b41bba8d3b29fdacf2467344df1213f0045dc0d2284140f4c1fd8a79d6a';
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $reviewed$
DECLARE b zoi.listings;a zoi.listings;leased record;result record;fp text;reviewer text;
 source text:='https://www.minosemi.gr/artists/fly-lo/';
 machine jsonb:='{"site_lang":"en-US","source_kind":"label_artist_profile","listen":{"spotify":"https://open.spotify.com/artist/1zeAbUJAbLOWeYpgRVnYmu"},"crawl_status":"ok","description":"FLY LO is an artist in the Greek trap scene. His releases include Crystal, Chinchila with Snik, the 2023 album Traplife and the 2024 collaboration ILEGAL with Toquel and Beyond.","photo_urls":["https://www.minosemi.gr/wp-content/uploads/sites/946/2022/10/zenith0203-1000x1000.jpeg"],"photo_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2022/10/zenith0203-1000x1000.jpeg","hero_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2022/10/zenith0203-1000x1000.jpeg"}'::jsonb;
BEGIN
 reviewer:=nullif(current_setting('zoi.publisher_review_actor',true),'');
 IF reviewer IS NULL OR current_setting('zoi.publisher_review_packet_sha256',true) IS DISTINCT FROM '510d8b41bba8d3b29fdacf2467344df1213f0045dc0d2284140f4c1fd8a79d6a' THEN RAISE EXCEPTION 'exact_independent_packet_review_required';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_apply(jsonb)'))) IS DISTINCT FROM '396c9e8ef6e7a19cb7e2c361a21bccbb' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_sample_lease(uuid[])'))) IS DISTINCT FROM '16a53918d76c896492c47dcca32806ca' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_sample_lease';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.seo_entity(text)'))) IS DISTINCT FROM 'e01c20df827c18865a0bfaadff2a9d49' THEN RAISE EXCEPTION 'writer_definition_changed:public.seo_entity';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_apply(jsonb)'))) IS DISTINCT FROM '8e41b35a16426573b5867436e60f0abf' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_fingerprint(zoi.listings)'))) IS DISTINCT FROM 'cc69353ab17d09e06846eb90c1ee34cd' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_fingerprint';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.profile_strip(jsonb)'))) IS DISTINCT FROM '8b20fc1c36fca6647a69e155fbeb377f' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.profile_strip';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_timestamp(text)'))) IS DISTINCT FROM '281a90ff6e44c1a64b2d3c8977f1c38c' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_timestamp';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_state(zoi.listings)'))) IS DISTINCT FROM 'ea1641facea45c788f8e6ca84feaf6d4' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_state';END IF;
 SELECT * INTO b FROM zoi.listings WHERE id='3f708bed-a4d0-4424-9497-bde4047573f4' FOR UPDATE;
 IF NOT FOUND OR md5(to_jsonb(b)::text) IS DISTINCT FROM '67e9121df1669bdde8f32071f4ce697e' THEN RAISE EXCEPTION 'review_snapshot_changed';END IF;
 IF b.name IS DISTINCT FROM 'FLY LO' OR b.slug IS DISTINCT FROM 'fly-lo-athens-3f708b' OR b.entity_type IS DISTINCT FROM 'artist' OR b.website IS NOT NULL OR b.source_url IS DISTINCT FROM NULL OR b.owner_user_id IS NOT NULL OR b.owner_workspace_id IS NOT NULL OR b.claim_status IS DISTINCT FROM 'unclaimed' OR b.publish_status IS DISTINCT FROM 'published' OR b.moderation_status NOT IN('clean','cleared') OR b.moderation_status IS NULL OR coalesce(b.marketplace_status,'')='hidden' OR b.profile ? '_enrich' THEN RAISE EXCEPTION 'identity_source_owner_changed';END IF;
 UPDATE zoi.listings SET website=source,source_url=coalesce(b.source_url,source) WHERE id=b.id;
 SELECT * INTO STRICT leased FROM public.enrich_sample_lease(ARRAY[b.id]);
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 fp:=zoi.listing_quality_fingerprint(a);
 IF leased.listing_id IS DISTINCT FROM b.id OR leased.website IS DISTINCT FROM source OR leased.slug IS DISTINCT FROM b.slug OR leased.owner_managed IS DISTINCT FROM false OR leased.existing_enrich IS DISTINCT FROM '{}'::jsonb OR a.profile#>>'{_enrich,lease,id}' IS DISTINCT FROM leased.lease_id OR a.profile#>>'{_enrich,lease,task}' IS DISTINCT FROM 'enrichment' OR a.profile#>>'{_enrich,lease,fingerprint}' IS DISTINCT FROM fp THEN RAISE EXCEPTION 'real_lease_binding_failed';END IF;
 machine:=machine||jsonb_build_object('publisher_source_evidence',jsonb_build_object('packet_sha256','510d8b41bba8d3b29fdacf2467344df1213f0045dc0d2284140f4c1fd8a79d6a','source_sha256','0b1b7fe5ad83bb946c6d0b62563f6a9b710fce3c8ad5f6b05b74cc45960ed2f7','prior_row_hash','67e9121df1669bdde8f32071f4ce697e','source_fingerprint',fp,'reviewer',reviewer,'method','atomic_reviewed_publisher_proposal','approved_image_hashes','["dd968bdc06b62c357995aacb7c9417c93eb1aee883d6ac713d0489f9cc9609ed"]'::jsonb));
 SELECT * INTO STRICT result FROM zoi.enrich_apply(jsonb_build_array(jsonb_build_object('slug',b.slug,'website',source,'lease_id',leased.lease_id,'profile',machine,'provenance',jsonb_build_object('source_kind','record_label','description','reviewed-record-label:'||source,'listen','record-label-linked-artist:'||source,'hero_url','reviewed-record-label-portrait:'||source))));
 IF result.applied IS DISTINCT FROM true OR result.slug IS DISTINCT FROM b.slug THEN RAISE EXCEPTION 'enrichment_not_applied';END IF;
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 IF a.source_url IS DISTINCT FROM coalesce(b.source_url,source) THEN RAISE EXCEPTION 'existing_source_history_changed';END IF;
 IF (to_jsonb(a)-ARRAY['website','source_url','profile','updated_at']) IS DISTINCT FROM (to_jsonb(b)-ARRAY['website','source_url','profile','updated_at']) OR (a.profile-'_enrich'-'_coverage') IS DISTINCT FROM b.profile THEN RAISE EXCEPTION 'protected_fields_changed';END IF;
 IF a.profile#>>'{_enrich,publisher_source_evidence,packet_sha256}' IS DISTINCT FROM '510d8b41bba8d3b29fdacf2467344df1213f0045dc0d2284140f4c1fd8a79d6a' OR a.profile#>>'{_enrich,publisher_source_evidence,source_sha256}' IS DISTINCT FROM '0b1b7fe5ad83bb946c6d0b62563f6a9b710fce3c8ad5f6b05b74cc45960ed2f7' OR a.profile#>>'{_enrich,publisher_source_evidence,reviewer}' IS DISTINCT FROM reviewer OR a.profile#>>'{_enrich,publisher_source_evidence,prior_row_hash}' IS DISTINCT FROM '67e9121df1669bdde8f32071f4ce697e' OR a.profile#>>'{_enrich,publisher_source_evidence,source_fingerprint}' IS DISTINCT FROM fp OR a.profile#>'{_enrich,publisher_source_evidence,approved_image_hashes}' IS DISTINCT FROM '["dd968bdc06b62c357995aacb7c9417c93eb1aee883d6ac713d0489f9cc9609ed"]'::jsonb OR a.profile#>>'{_enrich,source_kind}' IS DISTINCT FROM 'label_artist_profile' OR a.profile#>'{_enrich,listen}' IS DISTINCT FROM machine->'listen' OR a.profile#>>'{_enrich,description}' IS DISTINCT FROM machine->>'description' OR a.profile#>>'{_enrich,source_url}' IS DISTINCT FROM source OR a.profile#>>'{_enrich,hero_url}' IS DISTINCT FROM machine->>'hero_url' THEN RAISE EXCEPTION 'publisher_projection_fields_missing';END IF;
END $reviewed$;
SELECT id,slug,website,source_url,profile->'_enrich' machine_readback,profile#>'{_coverage,tasks}' coverage_readback,md5(to_jsonb(l)::text) after_row_hash FROM zoi.listings l WHERE id='3f708bed-a4d0-4424-9497-bde4047573f4';
ROLLBACK;

-- NON-APPLIED exact publisher proposal. Default ROLLBACK. No source fetch is a verification receipt.
-- Independent reviewer supplies actual actor and this packet hash in transaction settings.
-- File docs/audits/evidence/artist-next-batch-2026-10-02/packets/bd3ed9f5-1c9e-4235-8468-c0bb03febb98.json; SHA256 e640607f002be578ef67eed2fdfdeef3255d800ebb63b0cd4e7b3ba38c7b5b3f; source SHA256 4fc266d60c0dedf30ed49f741c70efb7c309be7da8be75d5675b833213b8b6eb.
BEGIN;
SET LOCAL zoi.publisher_review_actor = 'Codex independent reviewer /root/youth_review';
SET LOCAL zoi.publisher_review_packet_sha256 = 'e640607f002be578ef67eed2fdfdeef3255d800ebb63b0cd4e7b3ba38c7b5b3f';
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $reviewed$
DECLARE b zoi.listings;a zoi.listings;leased record;result record;fp text;reviewer text;
 source text:='https://www.minosemi.gr/artists/hgemona/';
 machine jsonb:='{"site_lang":"en-US","source_kind":"label_artist_profile","listen":{"spotify":"https://open.spotify.com/artist/1POlf5v8Q8ciCcWlAcxnEm"},"crawl_status":"ok","description":"HGEMONA$ is a Greek rap artist. His recordings include Dope Sport, Dope Sport Vol. 2, 4Seasons and DOPE BOYZ. He has collaborated with LEX, FLY LO, Bossikan and Mente Fuerte.","photo_urls":["https://www.minosemi.gr/wp-content/uploads/sites/946/2024/04/hgemonas.png"],"photo_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2024/04/hgemonas.png","hero_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2024/04/hgemonas.png"}'::jsonb;
BEGIN
 reviewer:=nullif(current_setting('zoi.publisher_review_actor',true),'');
 IF reviewer IS NULL OR current_setting('zoi.publisher_review_packet_sha256',true) IS DISTINCT FROM 'e640607f002be578ef67eed2fdfdeef3255d800ebb63b0cd4e7b3ba38c7b5b3f' THEN RAISE EXCEPTION 'exact_independent_packet_review_required';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_apply(jsonb)'))) IS DISTINCT FROM '396c9e8ef6e7a19cb7e2c361a21bccbb' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_sample_lease(uuid[])'))) IS DISTINCT FROM '16a53918d76c896492c47dcca32806ca' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_sample_lease';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.seo_entity(text)'))) IS DISTINCT FROM 'e01c20df827c18865a0bfaadff2a9d49' THEN RAISE EXCEPTION 'writer_definition_changed:public.seo_entity';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_apply(jsonb)'))) IS DISTINCT FROM '8e41b35a16426573b5867436e60f0abf' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_fingerprint(zoi.listings)'))) IS DISTINCT FROM 'cc69353ab17d09e06846eb90c1ee34cd' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_fingerprint';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.profile_strip(jsonb)'))) IS DISTINCT FROM '8b20fc1c36fca6647a69e155fbeb377f' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.profile_strip';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_timestamp(text)'))) IS DISTINCT FROM '281a90ff6e44c1a64b2d3c8977f1c38c' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_timestamp';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_state(zoi.listings)'))) IS DISTINCT FROM 'ea1641facea45c788f8e6ca84feaf6d4' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_state';END IF;
 SELECT * INTO b FROM zoi.listings WHERE id='bd3ed9f5-1c9e-4235-8468-c0bb03febb98' FOR UPDATE;
 IF NOT FOUND OR md5(to_jsonb(b)::text) IS DISTINCT FROM 'a9bc94951bab1ceffb76978af3392290' THEN RAISE EXCEPTION 'review_snapshot_changed';END IF;
 IF b.name IS DISTINCT FROM 'HGEMONA$' OR b.slug IS DISTINCT FROM 'hgemona-athens' OR b.entity_type IS DISTINCT FROM 'artist' OR b.website IS NOT NULL OR b.source_url IS DISTINCT FROM NULL OR b.owner_user_id IS NOT NULL OR b.owner_workspace_id IS NOT NULL OR b.claim_status IS DISTINCT FROM 'unclaimed' OR b.publish_status IS DISTINCT FROM 'published' OR b.moderation_status NOT IN('clean','cleared') OR b.moderation_status IS NULL OR coalesce(b.marketplace_status,'')='hidden' OR b.profile ? '_enrich' THEN RAISE EXCEPTION 'identity_source_owner_changed';END IF;
 UPDATE zoi.listings SET website=source,source_url=coalesce(b.source_url,source) WHERE id=b.id;
 SELECT * INTO STRICT leased FROM public.enrich_sample_lease(ARRAY[b.id]);
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 fp:=zoi.listing_quality_fingerprint(a);
 IF leased.listing_id IS DISTINCT FROM b.id OR leased.website IS DISTINCT FROM source OR leased.slug IS DISTINCT FROM b.slug OR leased.owner_managed IS DISTINCT FROM false OR leased.existing_enrich IS DISTINCT FROM '{}'::jsonb OR a.profile#>>'{_enrich,lease,id}' IS DISTINCT FROM leased.lease_id OR a.profile#>>'{_enrich,lease,task}' IS DISTINCT FROM 'enrichment' OR a.profile#>>'{_enrich,lease,fingerprint}' IS DISTINCT FROM fp THEN RAISE EXCEPTION 'real_lease_binding_failed';END IF;
 machine:=machine||jsonb_build_object('publisher_source_evidence',jsonb_build_object('packet_sha256','e640607f002be578ef67eed2fdfdeef3255d800ebb63b0cd4e7b3ba38c7b5b3f','source_sha256','4fc266d60c0dedf30ed49f741c70efb7c309be7da8be75d5675b833213b8b6eb','prior_row_hash','a9bc94951bab1ceffb76978af3392290','source_fingerprint',fp,'reviewer',reviewer,'method','atomic_reviewed_publisher_proposal','approved_image_hashes','["9685cb30288a6fdcae4747b2ce96930fd1f9786b9dfd8a3424e9a0e5e5977fc8"]'::jsonb));
 SELECT * INTO STRICT result FROM zoi.enrich_apply(jsonb_build_array(jsonb_build_object('slug',b.slug,'website',source,'lease_id',leased.lease_id,'profile',machine,'provenance',jsonb_build_object('source_kind','record_label','description','reviewed-record-label:'||source,'listen','record-label-linked-artist:'||source,'hero_url','reviewed-record-label-portrait:'||source))));
 IF result.applied IS DISTINCT FROM true OR result.slug IS DISTINCT FROM b.slug THEN RAISE EXCEPTION 'enrichment_not_applied';END IF;
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 IF a.source_url IS DISTINCT FROM coalesce(b.source_url,source) THEN RAISE EXCEPTION 'existing_source_history_changed';END IF;
 IF (to_jsonb(a)-ARRAY['website','source_url','profile','updated_at']) IS DISTINCT FROM (to_jsonb(b)-ARRAY['website','source_url','profile','updated_at']) OR (a.profile-'_enrich'-'_coverage') IS DISTINCT FROM b.profile THEN RAISE EXCEPTION 'protected_fields_changed';END IF;
 IF a.profile#>>'{_enrich,publisher_source_evidence,packet_sha256}' IS DISTINCT FROM 'e640607f002be578ef67eed2fdfdeef3255d800ebb63b0cd4e7b3ba38c7b5b3f' OR a.profile#>>'{_enrich,publisher_source_evidence,source_sha256}' IS DISTINCT FROM '4fc266d60c0dedf30ed49f741c70efb7c309be7da8be75d5675b833213b8b6eb' OR a.profile#>>'{_enrich,publisher_source_evidence,reviewer}' IS DISTINCT FROM reviewer OR a.profile#>>'{_enrich,publisher_source_evidence,prior_row_hash}' IS DISTINCT FROM 'a9bc94951bab1ceffb76978af3392290' OR a.profile#>>'{_enrich,publisher_source_evidence,source_fingerprint}' IS DISTINCT FROM fp OR a.profile#>'{_enrich,publisher_source_evidence,approved_image_hashes}' IS DISTINCT FROM '["9685cb30288a6fdcae4747b2ce96930fd1f9786b9dfd8a3424e9a0e5e5977fc8"]'::jsonb OR a.profile#>>'{_enrich,source_kind}' IS DISTINCT FROM 'label_artist_profile' OR a.profile#>'{_enrich,listen}' IS DISTINCT FROM machine->'listen' OR a.profile#>>'{_enrich,description}' IS DISTINCT FROM machine->>'description' OR a.profile#>>'{_enrich,source_url}' IS DISTINCT FROM source OR a.profile#>>'{_enrich,hero_url}' IS DISTINCT FROM machine->>'hero_url' THEN RAISE EXCEPTION 'publisher_projection_fields_missing';END IF;
END $reviewed$;
SELECT id,slug,website,source_url,profile->'_enrich' machine_readback,profile#>'{_coverage,tasks}' coverage_readback,md5(to_jsonb(l)::text) after_row_hash FROM zoi.listings l WHERE id='bd3ed9f5-1c9e-4235-8468-c0bb03febb98';
ROLLBACK;

-- NON-APPLIED exact publisher proposal. Default ROLLBACK. No source fetch is a verification receipt.
-- Independent reviewer supplies actual actor and this packet hash in transaction settings.
-- File docs/audits/evidence/artist-next-batch-2026-10-02/packets/ec23a7e7-ac4e-4b11-aac1-be43e433fd6d.json; SHA256 a3a6a00ab1d08f750fd29f06f1f567c7fd5866a2da85314ce465c65c586f07ad; source SHA256 6f7fbab0b88092306c369606754dcc2e448cb361694c1650f0621c507a1a38de.
BEGIN;
SET LOCAL zoi.publisher_review_actor = 'Codex independent reviewer /root/youth_review';
SET LOCAL zoi.publisher_review_packet_sha256 = 'a3a6a00ab1d08f750fd29f06f1f567c7fd5866a2da85314ce465c65c586f07ad';
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $reviewed$
DECLARE b zoi.listings;a zoi.listings;leased record;result record;fp text;reviewer text;
 source text:='https://www.minosemi.gr/artists/illeoo/';
 machine jsonb:='{"site_lang":"en-US","source_kind":"label_artist_profile","listen":{"spotify":"https://open.spotify.com/artist/1SZwJYkX5jEm8xqZXSGXjj"},"crawl_status":"ok","photo_urls":["https://www.minosemi.gr/wp-content/uploads/sites/946/2026/07/1-3-e1785163428421-500x500.jpg"],"photo_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2026/07/1-3-e1785163428421-500x500.jpg","hero_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2026/07/1-3-e1785163428421-500x500.jpg"}'::jsonb;
BEGIN
 reviewer:=nullif(current_setting('zoi.publisher_review_actor',true),'');
 IF reviewer IS NULL OR current_setting('zoi.publisher_review_packet_sha256',true) IS DISTINCT FROM 'a3a6a00ab1d08f750fd29f06f1f567c7fd5866a2da85314ce465c65c586f07ad' THEN RAISE EXCEPTION 'exact_independent_packet_review_required';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_apply(jsonb)'))) IS DISTINCT FROM '396c9e8ef6e7a19cb7e2c361a21bccbb' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_sample_lease(uuid[])'))) IS DISTINCT FROM '16a53918d76c896492c47dcca32806ca' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_sample_lease';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.seo_entity(text)'))) IS DISTINCT FROM 'e01c20df827c18865a0bfaadff2a9d49' THEN RAISE EXCEPTION 'writer_definition_changed:public.seo_entity';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_apply(jsonb)'))) IS DISTINCT FROM '8e41b35a16426573b5867436e60f0abf' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_fingerprint(zoi.listings)'))) IS DISTINCT FROM 'cc69353ab17d09e06846eb90c1ee34cd' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_fingerprint';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.profile_strip(jsonb)'))) IS DISTINCT FROM '8b20fc1c36fca6647a69e155fbeb377f' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.profile_strip';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_timestamp(text)'))) IS DISTINCT FROM '281a90ff6e44c1a64b2d3c8977f1c38c' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_timestamp';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_state(zoi.listings)'))) IS DISTINCT FROM 'ea1641facea45c788f8e6ca84feaf6d4' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_state';END IF;
 SELECT * INTO b FROM zoi.listings WHERE id='ec23a7e7-ac4e-4b11-aac1-be43e433fd6d' FOR UPDATE;
 IF NOT FOUND OR md5(to_jsonb(b)::text) IS DISTINCT FROM '414f1307329f15b99aafd992dbc17bbd' THEN RAISE EXCEPTION 'review_snapshot_changed';END IF;
 IF b.name IS DISTINCT FROM 'iLLEOo' OR b.slug IS DISTINCT FROM 'illeoo-athens' OR b.entity_type IS DISTINCT FROM 'artist' OR b.website IS NOT NULL OR b.source_url IS DISTINCT FROM NULL OR b.owner_user_id IS NOT NULL OR b.owner_workspace_id IS NOT NULL OR b.claim_status IS DISTINCT FROM 'unclaimed' OR b.publish_status IS DISTINCT FROM 'published' OR b.moderation_status NOT IN('clean','cleared') OR b.moderation_status IS NULL OR coalesce(b.marketplace_status,'')='hidden' OR b.profile ? '_enrich' THEN RAISE EXCEPTION 'identity_source_owner_changed';END IF;
 UPDATE zoi.listings SET website=source,source_url=coalesce(b.source_url,source) WHERE id=b.id;
 SELECT * INTO STRICT leased FROM public.enrich_sample_lease(ARRAY[b.id]);
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 fp:=zoi.listing_quality_fingerprint(a);
 IF leased.listing_id IS DISTINCT FROM b.id OR leased.website IS DISTINCT FROM source OR leased.slug IS DISTINCT FROM b.slug OR leased.owner_managed IS DISTINCT FROM false OR leased.existing_enrich IS DISTINCT FROM '{}'::jsonb OR a.profile#>>'{_enrich,lease,id}' IS DISTINCT FROM leased.lease_id OR a.profile#>>'{_enrich,lease,task}' IS DISTINCT FROM 'enrichment' OR a.profile#>>'{_enrich,lease,fingerprint}' IS DISTINCT FROM fp THEN RAISE EXCEPTION 'real_lease_binding_failed';END IF;
 machine:=machine||jsonb_build_object('publisher_source_evidence',jsonb_build_object('packet_sha256','a3a6a00ab1d08f750fd29f06f1f567c7fd5866a2da85314ce465c65c586f07ad','source_sha256','6f7fbab0b88092306c369606754dcc2e448cb361694c1650f0621c507a1a38de','prior_row_hash','414f1307329f15b99aafd992dbc17bbd','source_fingerprint',fp,'reviewer',reviewer,'method','atomic_reviewed_publisher_proposal','approved_image_hashes','["3372f859b4f79bf64748f3673c195536826bb1cf9ac81f8baa5dfda4b8cda051"]'::jsonb));
 SELECT * INTO STRICT result FROM zoi.enrich_apply(jsonb_build_array(jsonb_build_object('slug',b.slug,'website',source,'lease_id',leased.lease_id,'profile',machine,'provenance',jsonb_build_object('source_kind','record_label','description','reviewed-record-label:'||source,'listen','record-label-linked-artist:'||source,'hero_url','reviewed-record-label-portrait:'||source))));
 IF result.applied IS DISTINCT FROM true OR result.slug IS DISTINCT FROM b.slug THEN RAISE EXCEPTION 'enrichment_not_applied';END IF;
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 IF a.source_url IS DISTINCT FROM coalesce(b.source_url,source) THEN RAISE EXCEPTION 'existing_source_history_changed';END IF;
 IF (to_jsonb(a)-ARRAY['website','source_url','profile','updated_at']) IS DISTINCT FROM (to_jsonb(b)-ARRAY['website','source_url','profile','updated_at']) OR (a.profile-'_enrich'-'_coverage') IS DISTINCT FROM b.profile THEN RAISE EXCEPTION 'protected_fields_changed';END IF;
 IF a.profile#>>'{_enrich,publisher_source_evidence,packet_sha256}' IS DISTINCT FROM 'a3a6a00ab1d08f750fd29f06f1f567c7fd5866a2da85314ce465c65c586f07ad' OR a.profile#>>'{_enrich,publisher_source_evidence,source_sha256}' IS DISTINCT FROM '6f7fbab0b88092306c369606754dcc2e448cb361694c1650f0621c507a1a38de' OR a.profile#>>'{_enrich,publisher_source_evidence,reviewer}' IS DISTINCT FROM reviewer OR a.profile#>>'{_enrich,publisher_source_evidence,prior_row_hash}' IS DISTINCT FROM '414f1307329f15b99aafd992dbc17bbd' OR a.profile#>>'{_enrich,publisher_source_evidence,source_fingerprint}' IS DISTINCT FROM fp OR a.profile#>'{_enrich,publisher_source_evidence,approved_image_hashes}' IS DISTINCT FROM '["3372f859b4f79bf64748f3673c195536826bb1cf9ac81f8baa5dfda4b8cda051"]'::jsonb OR a.profile#>>'{_enrich,source_kind}' IS DISTINCT FROM 'label_artist_profile' OR a.profile#>'{_enrich,listen}' IS DISTINCT FROM machine->'listen' OR a.profile#>>'{_enrich,description}' IS DISTINCT FROM machine->>'description' OR a.profile#>>'{_enrich,source_url}' IS DISTINCT FROM source OR a.profile#>>'{_enrich,hero_url}' IS DISTINCT FROM machine->>'hero_url' THEN RAISE EXCEPTION 'publisher_projection_fields_missing';END IF;
END $reviewed$;
SELECT id,slug,website,source_url,profile->'_enrich' machine_readback,profile#>'{_coverage,tasks}' coverage_readback,md5(to_jsonb(l)::text) after_row_hash FROM zoi.listings l WHERE id='ec23a7e7-ac4e-4b11-aac1-be43e433fd6d';
ROLLBACK;

-- NON-APPLIED exact publisher proposal. Default ROLLBACK. No source fetch is a verification receipt.
-- Independent reviewer supplies actual actor and this packet hash in transaction settings.
-- File docs/audits/evidence/artist-next-batch-2026-10-02/packets/62ad40b8-f575-4f68-b7d7-efac8d882662.json; SHA256 8cad9653b5dc235f6415fe81ff88572adab5a5dbd8cb89090df4488c79ddc110; source SHA256 f1acb3acf7d9b555dec36fb837c9622ec5c019236661e13caa1b04824f4a8176.
BEGIN;
SET LOCAL zoi.publisher_review_actor = 'Codex independent reviewer /root/youth_review';
SET LOCAL zoi.publisher_review_packet_sha256 = '8cad9653b5dc235f6415fe81ff88572adab5a5dbd8cb89090df4488c79ddc110';
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $reviewed$
DECLARE b zoi.listings;a zoi.listings;leased record;result record;fp text;reviewer text;
 source text:='https://www.minosemi.gr/artists/light/';
 machine jsonb:='{"site_lang":"en-US","source_kind":"label_artist_profile","listen":{"spotify":"https://open.spotify.com/artist/1UdbiTrv73Dp7F0s3OHmn2"},"crawl_status":"ok","description":"Light is a Greek rapper from Thessaloniki who began releasing music in 2012. He is associated with the Greek rap label Capital Music.","photo_urls":["https://www.minosemi.gr/wp-content/uploads/sites/946/2025/04/Untitled-design-1000x1000.png"],"photo_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2025/04/Untitled-design-1000x1000.png","hero_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2025/04/Untitled-design-1000x1000.png"}'::jsonb;
BEGIN
 reviewer:=nullif(current_setting('zoi.publisher_review_actor',true),'');
 IF reviewer IS NULL OR current_setting('zoi.publisher_review_packet_sha256',true) IS DISTINCT FROM '8cad9653b5dc235f6415fe81ff88572adab5a5dbd8cb89090df4488c79ddc110' THEN RAISE EXCEPTION 'exact_independent_packet_review_required';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_apply(jsonb)'))) IS DISTINCT FROM '396c9e8ef6e7a19cb7e2c361a21bccbb' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_sample_lease(uuid[])'))) IS DISTINCT FROM '16a53918d76c896492c47dcca32806ca' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_sample_lease';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.seo_entity(text)'))) IS DISTINCT FROM 'e01c20df827c18865a0bfaadff2a9d49' THEN RAISE EXCEPTION 'writer_definition_changed:public.seo_entity';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_apply(jsonb)'))) IS DISTINCT FROM '8e41b35a16426573b5867436e60f0abf' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_fingerprint(zoi.listings)'))) IS DISTINCT FROM 'cc69353ab17d09e06846eb90c1ee34cd' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_fingerprint';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.profile_strip(jsonb)'))) IS DISTINCT FROM '8b20fc1c36fca6647a69e155fbeb377f' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.profile_strip';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_timestamp(text)'))) IS DISTINCT FROM '281a90ff6e44c1a64b2d3c8977f1c38c' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_timestamp';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_state(zoi.listings)'))) IS DISTINCT FROM 'ea1641facea45c788f8e6ca84feaf6d4' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_state';END IF;
 SELECT * INTO b FROM zoi.listings WHERE id='62ad40b8-f575-4f68-b7d7-efac8d882662' FOR UPDATE;
 IF NOT FOUND OR md5(to_jsonb(b)::text) IS DISTINCT FROM '781143f2f5e554bb911d264131220296' THEN RAISE EXCEPTION 'review_snapshot_changed';END IF;
 IF b.name IS DISTINCT FROM 'Light' OR b.slug IS DISTINCT FROM 'light-thessaloniki-62ad40' OR b.entity_type IS DISTINCT FROM 'artist' OR b.website IS NOT NULL OR b.source_url IS DISTINCT FROM NULL OR b.owner_user_id IS NOT NULL OR b.owner_workspace_id IS NOT NULL OR b.claim_status IS DISTINCT FROM 'unclaimed' OR b.publish_status IS DISTINCT FROM 'published' OR b.moderation_status NOT IN('clean','cleared') OR b.moderation_status IS NULL OR coalesce(b.marketplace_status,'')='hidden' OR b.profile ? '_enrich' THEN RAISE EXCEPTION 'identity_source_owner_changed';END IF;
 UPDATE zoi.listings SET website=source,source_url=coalesce(b.source_url,source) WHERE id=b.id;
 SELECT * INTO STRICT leased FROM public.enrich_sample_lease(ARRAY[b.id]);
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 fp:=zoi.listing_quality_fingerprint(a);
 IF leased.listing_id IS DISTINCT FROM b.id OR leased.website IS DISTINCT FROM source OR leased.slug IS DISTINCT FROM b.slug OR leased.owner_managed IS DISTINCT FROM false OR leased.existing_enrich IS DISTINCT FROM '{}'::jsonb OR a.profile#>>'{_enrich,lease,id}' IS DISTINCT FROM leased.lease_id OR a.profile#>>'{_enrich,lease,task}' IS DISTINCT FROM 'enrichment' OR a.profile#>>'{_enrich,lease,fingerprint}' IS DISTINCT FROM fp THEN RAISE EXCEPTION 'real_lease_binding_failed';END IF;
 machine:=machine||jsonb_build_object('publisher_source_evidence',jsonb_build_object('packet_sha256','8cad9653b5dc235f6415fe81ff88572adab5a5dbd8cb89090df4488c79ddc110','source_sha256','f1acb3acf7d9b555dec36fb837c9622ec5c019236661e13caa1b04824f4a8176','prior_row_hash','781143f2f5e554bb911d264131220296','source_fingerprint',fp,'reviewer',reviewer,'method','atomic_reviewed_publisher_proposal','approved_image_hashes','["4fc9475211987ddbf8288ad0789cd2b1dc8373e39438904f17ad99f96a5950e5"]'::jsonb));
 SELECT * INTO STRICT result FROM zoi.enrich_apply(jsonb_build_array(jsonb_build_object('slug',b.slug,'website',source,'lease_id',leased.lease_id,'profile',machine,'provenance',jsonb_build_object('source_kind','record_label','description','reviewed-record-label:'||source,'listen','record-label-linked-artist:'||source,'hero_url','reviewed-record-label-portrait:'||source))));
 IF result.applied IS DISTINCT FROM true OR result.slug IS DISTINCT FROM b.slug THEN RAISE EXCEPTION 'enrichment_not_applied';END IF;
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 IF a.source_url IS DISTINCT FROM coalesce(b.source_url,source) THEN RAISE EXCEPTION 'existing_source_history_changed';END IF;
 IF (to_jsonb(a)-ARRAY['website','source_url','profile','updated_at']) IS DISTINCT FROM (to_jsonb(b)-ARRAY['website','source_url','profile','updated_at']) OR (a.profile-'_enrich'-'_coverage') IS DISTINCT FROM b.profile THEN RAISE EXCEPTION 'protected_fields_changed';END IF;
 IF a.profile#>>'{_enrich,publisher_source_evidence,packet_sha256}' IS DISTINCT FROM '8cad9653b5dc235f6415fe81ff88572adab5a5dbd8cb89090df4488c79ddc110' OR a.profile#>>'{_enrich,publisher_source_evidence,source_sha256}' IS DISTINCT FROM 'f1acb3acf7d9b555dec36fb837c9622ec5c019236661e13caa1b04824f4a8176' OR a.profile#>>'{_enrich,publisher_source_evidence,reviewer}' IS DISTINCT FROM reviewer OR a.profile#>>'{_enrich,publisher_source_evidence,prior_row_hash}' IS DISTINCT FROM '781143f2f5e554bb911d264131220296' OR a.profile#>>'{_enrich,publisher_source_evidence,source_fingerprint}' IS DISTINCT FROM fp OR a.profile#>'{_enrich,publisher_source_evidence,approved_image_hashes}' IS DISTINCT FROM '["4fc9475211987ddbf8288ad0789cd2b1dc8373e39438904f17ad99f96a5950e5"]'::jsonb OR a.profile#>>'{_enrich,source_kind}' IS DISTINCT FROM 'label_artist_profile' OR a.profile#>'{_enrich,listen}' IS DISTINCT FROM machine->'listen' OR a.profile#>>'{_enrich,description}' IS DISTINCT FROM machine->>'description' OR a.profile#>>'{_enrich,source_url}' IS DISTINCT FROM source OR a.profile#>>'{_enrich,hero_url}' IS DISTINCT FROM machine->>'hero_url' THEN RAISE EXCEPTION 'publisher_projection_fields_missing';END IF;
END $reviewed$;
SELECT id,slug,website,source_url,profile->'_enrich' machine_readback,profile#>'{_coverage,tasks}' coverage_readback,md5(to_jsonb(l)::text) after_row_hash FROM zoi.listings l WHERE id='62ad40b8-f575-4f68-b7d7-efac8d882662';
ROLLBACK;

-- NON-APPLIED exact publisher proposal. Default ROLLBACK. No source fetch is a verification receipt.
-- Independent reviewer supplies actual actor and this packet hash in transaction settings.
-- File docs/audits/evidence/artist-next-batch-2026-10-02/packets/cf1f93d4-4740-45a3-866f-dced6d7cc18b.json; SHA256 620e8ff5beb41f0f3f6d4365bb4aa1a5299d28cb889d86cdc41b0d18a94a00fd; source SHA256 f880290c04819002a6e52429e92769052ed2b40f89c0383154dd9f6ab48e560c.
BEGIN;
SET LOCAL zoi.publisher_review_actor = 'Codex independent reviewer /root/youth_review';
SET LOCAL zoi.publisher_review_packet_sha256 = '620e8ff5beb41f0f3f6d4365bb4aa1a5299d28cb889d86cdc41b0d18a94a00fd';
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $reviewed$
DECLARE b zoi.listings;a zoi.listings;leased record;result record;fp text;reviewer text;
 source text:='https://www.minosemi.gr/artists/prestige-the-band/';
 machine jsonb:='{"site_lang":"en-US","source_kind":"label_artist_profile","listen":{"spotify":"https://open.spotify.com/artist/5MUIT3CRWoIKfi49gK3mRv"},"crawl_status":"ok","description":"Prestige The Band formed in 2009. The band combines Greek and international songs with a funk-influenced sound. Its recordings include Tora Arhizo Na Zo and Konta Sou (Moonlight).","photo_urls":["https://www.minosemi.gr/wp-content/uploads/sites/946/2019/01/Prestige-The-Band_1-1024x1024.jpg"],"photo_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2019/01/Prestige-The-Band_1-1024x1024.jpg","hero_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2019/01/Prestige-The-Band_1-1024x1024.jpg"}'::jsonb;
BEGIN
 reviewer:=nullif(current_setting('zoi.publisher_review_actor',true),'');
 IF reviewer IS NULL OR current_setting('zoi.publisher_review_packet_sha256',true) IS DISTINCT FROM '620e8ff5beb41f0f3f6d4365bb4aa1a5299d28cb889d86cdc41b0d18a94a00fd' THEN RAISE EXCEPTION 'exact_independent_packet_review_required';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_apply(jsonb)'))) IS DISTINCT FROM '396c9e8ef6e7a19cb7e2c361a21bccbb' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_sample_lease(uuid[])'))) IS DISTINCT FROM '16a53918d76c896492c47dcca32806ca' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_sample_lease';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.seo_entity(text)'))) IS DISTINCT FROM 'e01c20df827c18865a0bfaadff2a9d49' THEN RAISE EXCEPTION 'writer_definition_changed:public.seo_entity';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_apply(jsonb)'))) IS DISTINCT FROM '8e41b35a16426573b5867436e60f0abf' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_fingerprint(zoi.listings)'))) IS DISTINCT FROM 'cc69353ab17d09e06846eb90c1ee34cd' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_fingerprint';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.profile_strip(jsonb)'))) IS DISTINCT FROM '8b20fc1c36fca6647a69e155fbeb377f' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.profile_strip';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_timestamp(text)'))) IS DISTINCT FROM '281a90ff6e44c1a64b2d3c8977f1c38c' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_timestamp';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_state(zoi.listings)'))) IS DISTINCT FROM 'ea1641facea45c788f8e6ca84feaf6d4' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_state';END IF;
 SELECT * INTO b FROM zoi.listings WHERE id='cf1f93d4-4740-45a3-866f-dced6d7cc18b' FOR UPDATE;
 IF NOT FOUND OR md5(to_jsonb(b)::text) IS DISTINCT FROM '6a4b9ec42ec302bb430e3500806d9b8d' THEN RAISE EXCEPTION 'review_snapshot_changed';END IF;
 IF b.name IS DISTINCT FROM 'Prestige The Band' OR b.slug IS DISTINCT FROM 'prestige-the-band-athens' OR b.entity_type IS DISTINCT FROM 'artist' OR b.website IS NOT NULL OR b.source_url IS DISTINCT FROM NULL OR b.owner_user_id IS NOT NULL OR b.owner_workspace_id IS NOT NULL OR b.claim_status IS DISTINCT FROM 'unclaimed' OR b.publish_status IS DISTINCT FROM 'published' OR b.moderation_status NOT IN('clean','cleared') OR b.moderation_status IS NULL OR coalesce(b.marketplace_status,'')='hidden' OR b.profile ? '_enrich' THEN RAISE EXCEPTION 'identity_source_owner_changed';END IF;
 UPDATE zoi.listings SET website=source,source_url=coalesce(b.source_url,source) WHERE id=b.id;
 SELECT * INTO STRICT leased FROM public.enrich_sample_lease(ARRAY[b.id]);
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 fp:=zoi.listing_quality_fingerprint(a);
 IF leased.listing_id IS DISTINCT FROM b.id OR leased.website IS DISTINCT FROM source OR leased.slug IS DISTINCT FROM b.slug OR leased.owner_managed IS DISTINCT FROM false OR leased.existing_enrich IS DISTINCT FROM '{}'::jsonb OR a.profile#>>'{_enrich,lease,id}' IS DISTINCT FROM leased.lease_id OR a.profile#>>'{_enrich,lease,task}' IS DISTINCT FROM 'enrichment' OR a.profile#>>'{_enrich,lease,fingerprint}' IS DISTINCT FROM fp THEN RAISE EXCEPTION 'real_lease_binding_failed';END IF;
 machine:=machine||jsonb_build_object('publisher_source_evidence',jsonb_build_object('packet_sha256','620e8ff5beb41f0f3f6d4365bb4aa1a5299d28cb889d86cdc41b0d18a94a00fd','source_sha256','f880290c04819002a6e52429e92769052ed2b40f89c0383154dd9f6ab48e560c','prior_row_hash','6a4b9ec42ec302bb430e3500806d9b8d','source_fingerprint',fp,'reviewer',reviewer,'method','atomic_reviewed_publisher_proposal','approved_image_hashes','["259e93c6cab04bed824f80a0c861358968849df1b99cb106d1ee3bdbc7b7c39c"]'::jsonb));
 SELECT * INTO STRICT result FROM zoi.enrich_apply(jsonb_build_array(jsonb_build_object('slug',b.slug,'website',source,'lease_id',leased.lease_id,'profile',machine,'provenance',jsonb_build_object('source_kind','record_label','description','reviewed-record-label:'||source,'listen','record-label-linked-artist:'||source,'hero_url','reviewed-record-label-portrait:'||source))));
 IF result.applied IS DISTINCT FROM true OR result.slug IS DISTINCT FROM b.slug THEN RAISE EXCEPTION 'enrichment_not_applied';END IF;
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 IF a.source_url IS DISTINCT FROM coalesce(b.source_url,source) THEN RAISE EXCEPTION 'existing_source_history_changed';END IF;
 IF (to_jsonb(a)-ARRAY['website','source_url','profile','updated_at']) IS DISTINCT FROM (to_jsonb(b)-ARRAY['website','source_url','profile','updated_at']) OR (a.profile-'_enrich'-'_coverage') IS DISTINCT FROM b.profile THEN RAISE EXCEPTION 'protected_fields_changed';END IF;
 IF a.profile#>>'{_enrich,publisher_source_evidence,packet_sha256}' IS DISTINCT FROM '620e8ff5beb41f0f3f6d4365bb4aa1a5299d28cb889d86cdc41b0d18a94a00fd' OR a.profile#>>'{_enrich,publisher_source_evidence,source_sha256}' IS DISTINCT FROM 'f880290c04819002a6e52429e92769052ed2b40f89c0383154dd9f6ab48e560c' OR a.profile#>>'{_enrich,publisher_source_evidence,reviewer}' IS DISTINCT FROM reviewer OR a.profile#>>'{_enrich,publisher_source_evidence,prior_row_hash}' IS DISTINCT FROM '6a4b9ec42ec302bb430e3500806d9b8d' OR a.profile#>>'{_enrich,publisher_source_evidence,source_fingerprint}' IS DISTINCT FROM fp OR a.profile#>'{_enrich,publisher_source_evidence,approved_image_hashes}' IS DISTINCT FROM '["259e93c6cab04bed824f80a0c861358968849df1b99cb106d1ee3bdbc7b7c39c"]'::jsonb OR a.profile#>>'{_enrich,source_kind}' IS DISTINCT FROM 'label_artist_profile' OR a.profile#>'{_enrich,listen}' IS DISTINCT FROM machine->'listen' OR a.profile#>>'{_enrich,description}' IS DISTINCT FROM machine->>'description' OR a.profile#>>'{_enrich,source_url}' IS DISTINCT FROM source OR a.profile#>>'{_enrich,hero_url}' IS DISTINCT FROM machine->>'hero_url' THEN RAISE EXCEPTION 'publisher_projection_fields_missing';END IF;
END $reviewed$;
SELECT id,slug,website,source_url,profile->'_enrich' machine_readback,profile#>'{_coverage,tasks}' coverage_readback,md5(to_jsonb(l)::text) after_row_hash FROM zoi.listings l WHERE id='cf1f93d4-4740-45a3-866f-dced6d7cc18b';
ROLLBACK;

-- NON-APPLIED exact publisher proposal. Default ROLLBACK. No source fetch is a verification receipt.
-- Independent reviewer supplies actual actor and this packet hash in transaction settings.
-- File docs/audits/evidence/artist-next-batch-2026-10-02/packets/098a3b82-afb4-4532-a6c8-b9f6641bc90f.json; SHA256 b468e15dde5e8455f19fddbe88aa4176553dc652b389bf1f8bf6b426a25ac768; source SHA256 b18054d95ace06545c779a15ce8dbafbb47f341394315233b41a70efa86f6b18.
BEGIN;
SET LOCAL zoi.publisher_review_actor = 'Codex independent reviewer /root/youth_review';
SET LOCAL zoi.publisher_review_packet_sha256 = 'b468e15dde5e8455f19fddbe88aa4176553dc652b389bf1f8bf6b426a25ac768';
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $reviewed$
DECLARE b zoi.listings;a zoi.listings;leased record;result record;fp text;reviewer text;
 source text:='https://www.minosemi.gr/artists/slogan/';
 machine jsonb:='{"site_lang":"en-US","source_kind":"label_artist_profile","listen":{"spotify":"https://open.spotify.com/artist/64Eb4jttIVIP6T2qVBP8wh"},"crawl_status":"ok","photo_urls":["https://www.minosemi.gr/wp-content/uploads/sites/946/2020/02/slogan-photo-2048x2048.jpg"],"photo_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2020/02/slogan-photo-2048x2048.jpg","hero_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2020/02/slogan-photo-2048x2048.jpg"}'::jsonb;
BEGIN
 reviewer:=nullif(current_setting('zoi.publisher_review_actor',true),'');
 IF reviewer IS NULL OR current_setting('zoi.publisher_review_packet_sha256',true) IS DISTINCT FROM 'b468e15dde5e8455f19fddbe88aa4176553dc652b389bf1f8bf6b426a25ac768' THEN RAISE EXCEPTION 'exact_independent_packet_review_required';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_apply(jsonb)'))) IS DISTINCT FROM '396c9e8ef6e7a19cb7e2c361a21bccbb' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_sample_lease(uuid[])'))) IS DISTINCT FROM '16a53918d76c896492c47dcca32806ca' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_sample_lease';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.seo_entity(text)'))) IS DISTINCT FROM 'e01c20df827c18865a0bfaadff2a9d49' THEN RAISE EXCEPTION 'writer_definition_changed:public.seo_entity';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_apply(jsonb)'))) IS DISTINCT FROM '8e41b35a16426573b5867436e60f0abf' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_fingerprint(zoi.listings)'))) IS DISTINCT FROM 'cc69353ab17d09e06846eb90c1ee34cd' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_fingerprint';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.profile_strip(jsonb)'))) IS DISTINCT FROM '8b20fc1c36fca6647a69e155fbeb377f' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.profile_strip';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_timestamp(text)'))) IS DISTINCT FROM '281a90ff6e44c1a64b2d3c8977f1c38c' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_timestamp';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_state(zoi.listings)'))) IS DISTINCT FROM 'ea1641facea45c788f8e6ca84feaf6d4' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_state';END IF;
 SELECT * INTO b FROM zoi.listings WHERE id='098a3b82-afb4-4532-a6c8-b9f6641bc90f' FOR UPDATE;
 IF NOT FOUND OR md5(to_jsonb(b)::text) IS DISTINCT FROM '26c40fcc3d22337492c20f7851676596' THEN RAISE EXCEPTION 'review_snapshot_changed';END IF;
 IF b.name IS DISTINCT FROM 'Slogan' OR b.slug IS DISTINCT FROM 'slogan-athens' OR b.entity_type IS DISTINCT FROM 'artist' OR b.website IS NOT NULL OR b.source_url IS DISTINCT FROM NULL OR b.owner_user_id IS NOT NULL OR b.owner_workspace_id IS NOT NULL OR b.claim_status IS DISTINCT FROM 'unclaimed' OR b.publish_status IS DISTINCT FROM 'published' OR b.moderation_status NOT IN('clean','cleared') OR b.moderation_status IS NULL OR coalesce(b.marketplace_status,'')='hidden' OR b.profile ? '_enrich' THEN RAISE EXCEPTION 'identity_source_owner_changed';END IF;
 UPDATE zoi.listings SET website=source,source_url=coalesce(b.source_url,source) WHERE id=b.id;
 SELECT * INTO STRICT leased FROM public.enrich_sample_lease(ARRAY[b.id]);
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 fp:=zoi.listing_quality_fingerprint(a);
 IF leased.listing_id IS DISTINCT FROM b.id OR leased.website IS DISTINCT FROM source OR leased.slug IS DISTINCT FROM b.slug OR leased.owner_managed IS DISTINCT FROM false OR leased.existing_enrich IS DISTINCT FROM '{}'::jsonb OR a.profile#>>'{_enrich,lease,id}' IS DISTINCT FROM leased.lease_id OR a.profile#>>'{_enrich,lease,task}' IS DISTINCT FROM 'enrichment' OR a.profile#>>'{_enrich,lease,fingerprint}' IS DISTINCT FROM fp THEN RAISE EXCEPTION 'real_lease_binding_failed';END IF;
 machine:=machine||jsonb_build_object('publisher_source_evidence',jsonb_build_object('packet_sha256','b468e15dde5e8455f19fddbe88aa4176553dc652b389bf1f8bf6b426a25ac768','source_sha256','b18054d95ace06545c779a15ce8dbafbb47f341394315233b41a70efa86f6b18','prior_row_hash','26c40fcc3d22337492c20f7851676596','source_fingerprint',fp,'reviewer',reviewer,'method','atomic_reviewed_publisher_proposal','approved_image_hashes','["d9d44c9c3f4e19a9b944b9012f138afee2d943dc2cbe9129c0be67903ec5fd47"]'::jsonb));
 SELECT * INTO STRICT result FROM zoi.enrich_apply(jsonb_build_array(jsonb_build_object('slug',b.slug,'website',source,'lease_id',leased.lease_id,'profile',machine,'provenance',jsonb_build_object('source_kind','record_label','description','reviewed-record-label:'||source,'listen','record-label-linked-artist:'||source,'hero_url','reviewed-record-label-portrait:'||source))));
 IF result.applied IS DISTINCT FROM true OR result.slug IS DISTINCT FROM b.slug THEN RAISE EXCEPTION 'enrichment_not_applied';END IF;
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 IF a.source_url IS DISTINCT FROM coalesce(b.source_url,source) THEN RAISE EXCEPTION 'existing_source_history_changed';END IF;
 IF (to_jsonb(a)-ARRAY['website','source_url','profile','updated_at']) IS DISTINCT FROM (to_jsonb(b)-ARRAY['website','source_url','profile','updated_at']) OR (a.profile-'_enrich'-'_coverage') IS DISTINCT FROM b.profile THEN RAISE EXCEPTION 'protected_fields_changed';END IF;
 IF a.profile#>>'{_enrich,publisher_source_evidence,packet_sha256}' IS DISTINCT FROM 'b468e15dde5e8455f19fddbe88aa4176553dc652b389bf1f8bf6b426a25ac768' OR a.profile#>>'{_enrich,publisher_source_evidence,source_sha256}' IS DISTINCT FROM 'b18054d95ace06545c779a15ce8dbafbb47f341394315233b41a70efa86f6b18' OR a.profile#>>'{_enrich,publisher_source_evidence,reviewer}' IS DISTINCT FROM reviewer OR a.profile#>>'{_enrich,publisher_source_evidence,prior_row_hash}' IS DISTINCT FROM '26c40fcc3d22337492c20f7851676596' OR a.profile#>>'{_enrich,publisher_source_evidence,source_fingerprint}' IS DISTINCT FROM fp OR a.profile#>'{_enrich,publisher_source_evidence,approved_image_hashes}' IS DISTINCT FROM '["d9d44c9c3f4e19a9b944b9012f138afee2d943dc2cbe9129c0be67903ec5fd47"]'::jsonb OR a.profile#>>'{_enrich,source_kind}' IS DISTINCT FROM 'label_artist_profile' OR a.profile#>'{_enrich,listen}' IS DISTINCT FROM machine->'listen' OR a.profile#>>'{_enrich,description}' IS DISTINCT FROM machine->>'description' OR a.profile#>>'{_enrich,source_url}' IS DISTINCT FROM source OR a.profile#>>'{_enrich,hero_url}' IS DISTINCT FROM machine->>'hero_url' THEN RAISE EXCEPTION 'publisher_projection_fields_missing';END IF;
END $reviewed$;
SELECT id,slug,website,source_url,profile->'_enrich' machine_readback,profile#>'{_coverage,tasks}' coverage_readback,md5(to_jsonb(l)::text) after_row_hash FROM zoi.listings l WHERE id='098a3b82-afb4-4532-a6c8-b9f6641bc90f';
ROLLBACK;

-- NON-APPLIED exact publisher proposal. Default ROLLBACK. No source fetch is a verification receipt.
-- Independent reviewer supplies actual actor and this packet hash in transaction settings.
-- File docs/audits/evidence/artist-next-batch-2026-10-02/packets/cdbc7823-7817-4e37-a9a0-36048ba5828f.json; SHA256 bd3dd905160f14492c5b191802b8209dc79bc9dd5d00a8cb175efb1fb677be89; source SHA256 791045fa06b2e90976461a8ec15fc232dd633c57574bedfe44751b22c34102d6.
BEGIN;
SET LOCAL zoi.publisher_review_actor = 'Codex independent reviewer /root/youth_review';
SET LOCAL zoi.publisher_review_packet_sha256 = 'bd3dd905160f14492c5b191802b8209dc79bc9dd5d00a8cb175efb1fb677be89';
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $reviewed$
DECLARE b zoi.listings;a zoi.listings;leased record;result record;fp text;reviewer text;
 source text:='https://www.minosemi.gr/artists/thug-slime/';
 machine jsonb:='{"site_lang":"en-US","source_kind":"label_artist_profile","listen":{"spotify":"https://open.spotify.com/artist/2CeSpJpSDU42CUgPdGfyo0"},"crawl_status":"ok","photo_urls":["https://www.minosemi.gr/wp-content/uploads/sites/946/2025/04/Untitled-design-6-1000x1000.png"],"photo_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2025/04/Untitled-design-6-1000x1000.png","hero_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2025/04/Untitled-design-6-1000x1000.png"}'::jsonb;
BEGIN
 reviewer:=nullif(current_setting('zoi.publisher_review_actor',true),'');
 IF reviewer IS NULL OR current_setting('zoi.publisher_review_packet_sha256',true) IS DISTINCT FROM 'bd3dd905160f14492c5b191802b8209dc79bc9dd5d00a8cb175efb1fb677be89' THEN RAISE EXCEPTION 'exact_independent_packet_review_required';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_apply(jsonb)'))) IS DISTINCT FROM '396c9e8ef6e7a19cb7e2c361a21bccbb' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_sample_lease(uuid[])'))) IS DISTINCT FROM '16a53918d76c896492c47dcca32806ca' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_sample_lease';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.seo_entity(text)'))) IS DISTINCT FROM 'e01c20df827c18865a0bfaadff2a9d49' THEN RAISE EXCEPTION 'writer_definition_changed:public.seo_entity';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_apply(jsonb)'))) IS DISTINCT FROM '8e41b35a16426573b5867436e60f0abf' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_fingerprint(zoi.listings)'))) IS DISTINCT FROM 'cc69353ab17d09e06846eb90c1ee34cd' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_fingerprint';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.profile_strip(jsonb)'))) IS DISTINCT FROM '8b20fc1c36fca6647a69e155fbeb377f' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.profile_strip';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_timestamp(text)'))) IS DISTINCT FROM '281a90ff6e44c1a64b2d3c8977f1c38c' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_timestamp';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_state(zoi.listings)'))) IS DISTINCT FROM 'ea1641facea45c788f8e6ca84feaf6d4' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_state';END IF;
 SELECT * INTO b FROM zoi.listings WHERE id='cdbc7823-7817-4e37-a9a0-36048ba5828f' FOR UPDATE;
 IF NOT FOUND OR md5(to_jsonb(b)::text) IS DISTINCT FROM 'f13362772173950f887e51c451b8ab07' THEN RAISE EXCEPTION 'review_snapshot_changed';END IF;
 IF b.name IS DISTINCT FROM 'Thug Slime' OR b.slug IS DISTINCT FROM 'thug-slime-athens' OR b.entity_type IS DISTINCT FROM 'artist' OR b.website IS NOT NULL OR b.source_url IS DISTINCT FROM NULL OR b.owner_user_id IS NOT NULL OR b.owner_workspace_id IS NOT NULL OR b.claim_status IS DISTINCT FROM 'unclaimed' OR b.publish_status IS DISTINCT FROM 'published' OR b.moderation_status NOT IN('clean','cleared') OR b.moderation_status IS NULL OR coalesce(b.marketplace_status,'')='hidden' OR b.profile ? '_enrich' THEN RAISE EXCEPTION 'identity_source_owner_changed';END IF;
 UPDATE zoi.listings SET website=source,source_url=coalesce(b.source_url,source) WHERE id=b.id;
 SELECT * INTO STRICT leased FROM public.enrich_sample_lease(ARRAY[b.id]);
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 fp:=zoi.listing_quality_fingerprint(a);
 IF leased.listing_id IS DISTINCT FROM b.id OR leased.website IS DISTINCT FROM source OR leased.slug IS DISTINCT FROM b.slug OR leased.owner_managed IS DISTINCT FROM false OR leased.existing_enrich IS DISTINCT FROM '{}'::jsonb OR a.profile#>>'{_enrich,lease,id}' IS DISTINCT FROM leased.lease_id OR a.profile#>>'{_enrich,lease,task}' IS DISTINCT FROM 'enrichment' OR a.profile#>>'{_enrich,lease,fingerprint}' IS DISTINCT FROM fp THEN RAISE EXCEPTION 'real_lease_binding_failed';END IF;
 machine:=machine||jsonb_build_object('publisher_source_evidence',jsonb_build_object('packet_sha256','bd3dd905160f14492c5b191802b8209dc79bc9dd5d00a8cb175efb1fb677be89','source_sha256','791045fa06b2e90976461a8ec15fc232dd633c57574bedfe44751b22c34102d6','prior_row_hash','f13362772173950f887e51c451b8ab07','source_fingerprint',fp,'reviewer',reviewer,'method','atomic_reviewed_publisher_proposal','approved_image_hashes','["68839885fc6f46650f07a522e5a2172565767135709db576d63cff0dccf6c8b4"]'::jsonb));
 SELECT * INTO STRICT result FROM zoi.enrich_apply(jsonb_build_array(jsonb_build_object('slug',b.slug,'website',source,'lease_id',leased.lease_id,'profile',machine,'provenance',jsonb_build_object('source_kind','record_label','description','reviewed-record-label:'||source,'listen','record-label-linked-artist:'||source,'hero_url','reviewed-record-label-portrait:'||source))));
 IF result.applied IS DISTINCT FROM true OR result.slug IS DISTINCT FROM b.slug THEN RAISE EXCEPTION 'enrichment_not_applied';END IF;
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 IF a.source_url IS DISTINCT FROM coalesce(b.source_url,source) THEN RAISE EXCEPTION 'existing_source_history_changed';END IF;
 IF (to_jsonb(a)-ARRAY['website','source_url','profile','updated_at']) IS DISTINCT FROM (to_jsonb(b)-ARRAY['website','source_url','profile','updated_at']) OR (a.profile-'_enrich'-'_coverage') IS DISTINCT FROM b.profile THEN RAISE EXCEPTION 'protected_fields_changed';END IF;
 IF a.profile#>>'{_enrich,publisher_source_evidence,packet_sha256}' IS DISTINCT FROM 'bd3dd905160f14492c5b191802b8209dc79bc9dd5d00a8cb175efb1fb677be89' OR a.profile#>>'{_enrich,publisher_source_evidence,source_sha256}' IS DISTINCT FROM '791045fa06b2e90976461a8ec15fc232dd633c57574bedfe44751b22c34102d6' OR a.profile#>>'{_enrich,publisher_source_evidence,reviewer}' IS DISTINCT FROM reviewer OR a.profile#>>'{_enrich,publisher_source_evidence,prior_row_hash}' IS DISTINCT FROM 'f13362772173950f887e51c451b8ab07' OR a.profile#>>'{_enrich,publisher_source_evidence,source_fingerprint}' IS DISTINCT FROM fp OR a.profile#>'{_enrich,publisher_source_evidence,approved_image_hashes}' IS DISTINCT FROM '["68839885fc6f46650f07a522e5a2172565767135709db576d63cff0dccf6c8b4"]'::jsonb OR a.profile#>>'{_enrich,source_kind}' IS DISTINCT FROM 'label_artist_profile' OR a.profile#>'{_enrich,listen}' IS DISTINCT FROM machine->'listen' OR a.profile#>>'{_enrich,description}' IS DISTINCT FROM machine->>'description' OR a.profile#>>'{_enrich,source_url}' IS DISTINCT FROM source OR a.profile#>>'{_enrich,hero_url}' IS DISTINCT FROM machine->>'hero_url' THEN RAISE EXCEPTION 'publisher_projection_fields_missing';END IF;
END $reviewed$;
SELECT id,slug,website,source_url,profile->'_enrich' machine_readback,profile#>'{_coverage,tasks}' coverage_readback,md5(to_jsonb(l)::text) after_row_hash FROM zoi.listings l WHERE id='cdbc7823-7817-4e37-a9a0-36048ba5828f';
ROLLBACK;

-- NON-APPLIED exact publisher proposal. Default ROLLBACK. No source fetch is a verification receipt.
-- Independent reviewer supplies actual actor and this packet hash in transaction settings.
-- File docs/audits/evidence/artist-next-batch-2026-10-02/packets/a72b6c42-cba0-457b-965a-6510a07f3b31.json; SHA256 fdfbe83397bf90da368df18cd016bb0135c80f91a56a493eabb58851f15a6a33; source SHA256 56b2c831788ebe5413ee8664ba53970bcf4ae95c4c0dcd8eb2e6125f21a95685.
BEGIN;
SET LOCAL zoi.publisher_review_actor = 'Codex independent reviewer /root/youth_review';
SET LOCAL zoi.publisher_review_packet_sha256 = 'fdfbe83397bf90da368df18cd016bb0135c80f91a56a493eabb58851f15a6a33';
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $reviewed$
DECLARE b zoi.listings;a zoi.listings;leased record;result record;fp text;reviewer text;
 source text:='https://www.minosemi.gr/artists/toquel/';
 machine jsonb:='{"site_lang":"en-US","source_kind":"label_artist_profile","listen":{"spotify":"https://open.spotify.com/artist/7AWAljMatr7bxddF4kWzXG"},"crawl_status":"ok","description":"Toquel is a Greek rapper who began his music career in 2010. His recordings include I Roda Girise, Tora I Pote, Ligo Parapano and the 2019 album 777.","photo_urls":["https://www.minosemi.gr/wp-content/uploads/sites/946/2019/01/image00001-5-1000x1000.jpeg"],"photo_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2019/01/image00001-5-1000x1000.jpeg","hero_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2019/01/image00001-5-1000x1000.jpeg"}'::jsonb;
BEGIN
 reviewer:=nullif(current_setting('zoi.publisher_review_actor',true),'');
 IF reviewer IS NULL OR current_setting('zoi.publisher_review_packet_sha256',true) IS DISTINCT FROM 'fdfbe83397bf90da368df18cd016bb0135c80f91a56a493eabb58851f15a6a33' THEN RAISE EXCEPTION 'exact_independent_packet_review_required';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_apply(jsonb)'))) IS DISTINCT FROM '396c9e8ef6e7a19cb7e2c361a21bccbb' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_sample_lease(uuid[])'))) IS DISTINCT FROM '16a53918d76c896492c47dcca32806ca' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_sample_lease';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.seo_entity(text)'))) IS DISTINCT FROM 'e01c20df827c18865a0bfaadff2a9d49' THEN RAISE EXCEPTION 'writer_definition_changed:public.seo_entity';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_apply(jsonb)'))) IS DISTINCT FROM '8e41b35a16426573b5867436e60f0abf' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_fingerprint(zoi.listings)'))) IS DISTINCT FROM 'cc69353ab17d09e06846eb90c1ee34cd' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_fingerprint';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.profile_strip(jsonb)'))) IS DISTINCT FROM '8b20fc1c36fca6647a69e155fbeb377f' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.profile_strip';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_timestamp(text)'))) IS DISTINCT FROM '281a90ff6e44c1a64b2d3c8977f1c38c' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_timestamp';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_state(zoi.listings)'))) IS DISTINCT FROM 'ea1641facea45c788f8e6ca84feaf6d4' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_state';END IF;
 SELECT * INTO b FROM zoi.listings WHERE id='a72b6c42-cba0-457b-965a-6510a07f3b31' FOR UPDATE;
 IF NOT FOUND OR md5(to_jsonb(b)::text) IS DISTINCT FROM '695de3ef995a133e8157946d53f53486' THEN RAISE EXCEPTION 'review_snapshot_changed';END IF;
 IF b.name IS DISTINCT FROM 'Toquel' OR b.slug IS DISTINCT FROM 'toquel-athens-a72b6c' OR b.entity_type IS DISTINCT FROM 'artist' OR b.website IS NOT NULL OR b.source_url IS DISTINCT FROM NULL OR b.owner_user_id IS NOT NULL OR b.owner_workspace_id IS NOT NULL OR b.claim_status IS DISTINCT FROM 'unclaimed' OR b.publish_status IS DISTINCT FROM 'published' OR b.moderation_status NOT IN('clean','cleared') OR b.moderation_status IS NULL OR coalesce(b.marketplace_status,'')='hidden' OR b.profile ? '_enrich' THEN RAISE EXCEPTION 'identity_source_owner_changed';END IF;
 UPDATE zoi.listings SET website=source,source_url=coalesce(b.source_url,source) WHERE id=b.id;
 SELECT * INTO STRICT leased FROM public.enrich_sample_lease(ARRAY[b.id]);
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 fp:=zoi.listing_quality_fingerprint(a);
 IF leased.listing_id IS DISTINCT FROM b.id OR leased.website IS DISTINCT FROM source OR leased.slug IS DISTINCT FROM b.slug OR leased.owner_managed IS DISTINCT FROM false OR leased.existing_enrich IS DISTINCT FROM '{}'::jsonb OR a.profile#>>'{_enrich,lease,id}' IS DISTINCT FROM leased.lease_id OR a.profile#>>'{_enrich,lease,task}' IS DISTINCT FROM 'enrichment' OR a.profile#>>'{_enrich,lease,fingerprint}' IS DISTINCT FROM fp THEN RAISE EXCEPTION 'real_lease_binding_failed';END IF;
 machine:=machine||jsonb_build_object('publisher_source_evidence',jsonb_build_object('packet_sha256','fdfbe83397bf90da368df18cd016bb0135c80f91a56a493eabb58851f15a6a33','source_sha256','56b2c831788ebe5413ee8664ba53970bcf4ae95c4c0dcd8eb2e6125f21a95685','prior_row_hash','695de3ef995a133e8157946d53f53486','source_fingerprint',fp,'reviewer',reviewer,'method','atomic_reviewed_publisher_proposal','approved_image_hashes','["591366cbc85a005c535a4c20f6cceb38c0fc4baeb50233d0d2c7e1312fbb9f6e"]'::jsonb));
 SELECT * INTO STRICT result FROM zoi.enrich_apply(jsonb_build_array(jsonb_build_object('slug',b.slug,'website',source,'lease_id',leased.lease_id,'profile',machine,'provenance',jsonb_build_object('source_kind','record_label','description','reviewed-record-label:'||source,'listen','record-label-linked-artist:'||source,'hero_url','reviewed-record-label-portrait:'||source))));
 IF result.applied IS DISTINCT FROM true OR result.slug IS DISTINCT FROM b.slug THEN RAISE EXCEPTION 'enrichment_not_applied';END IF;
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 IF a.source_url IS DISTINCT FROM coalesce(b.source_url,source) THEN RAISE EXCEPTION 'existing_source_history_changed';END IF;
 IF (to_jsonb(a)-ARRAY['website','source_url','profile','updated_at']) IS DISTINCT FROM (to_jsonb(b)-ARRAY['website','source_url','profile','updated_at']) OR (a.profile-'_enrich'-'_coverage') IS DISTINCT FROM b.profile THEN RAISE EXCEPTION 'protected_fields_changed';END IF;
 IF a.profile#>>'{_enrich,publisher_source_evidence,packet_sha256}' IS DISTINCT FROM 'fdfbe83397bf90da368df18cd016bb0135c80f91a56a493eabb58851f15a6a33' OR a.profile#>>'{_enrich,publisher_source_evidence,source_sha256}' IS DISTINCT FROM '56b2c831788ebe5413ee8664ba53970bcf4ae95c4c0dcd8eb2e6125f21a95685' OR a.profile#>>'{_enrich,publisher_source_evidence,reviewer}' IS DISTINCT FROM reviewer OR a.profile#>>'{_enrich,publisher_source_evidence,prior_row_hash}' IS DISTINCT FROM '695de3ef995a133e8157946d53f53486' OR a.profile#>>'{_enrich,publisher_source_evidence,source_fingerprint}' IS DISTINCT FROM fp OR a.profile#>'{_enrich,publisher_source_evidence,approved_image_hashes}' IS DISTINCT FROM '["591366cbc85a005c535a4c20f6cceb38c0fc4baeb50233d0d2c7e1312fbb9f6e"]'::jsonb OR a.profile#>>'{_enrich,source_kind}' IS DISTINCT FROM 'label_artist_profile' OR a.profile#>'{_enrich,listen}' IS DISTINCT FROM machine->'listen' OR a.profile#>>'{_enrich,description}' IS DISTINCT FROM machine->>'description' OR a.profile#>>'{_enrich,source_url}' IS DISTINCT FROM source OR a.profile#>>'{_enrich,hero_url}' IS DISTINCT FROM machine->>'hero_url' THEN RAISE EXCEPTION 'publisher_projection_fields_missing';END IF;
END $reviewed$;
SELECT id,slug,website,source_url,profile->'_enrich' machine_readback,profile#>'{_coverage,tasks}' coverage_readback,md5(to_jsonb(l)::text) after_row_hash FROM zoi.listings l WHERE id='a72b6c42-cba0-457b-965a-6510a07f3b31';
ROLLBACK;

-- NON-APPLIED exact publisher proposal. Default ROLLBACK. No source fetch is a verification receipt.
-- Independent reviewer supplies actual actor and this packet hash in transaction settings.
-- File docs/audits/evidence/artist-next-batch-2026-10-02/packets/197f8060-75fd-442c-8509-adfd2f852705.json; SHA256 fdb4a88e0e9207715feeae0eecf4ddaef35db8d37a55d7e1ba506b3966974c71; source SHA256 a269675d9b2301fa2c2b4cf476d85b6badb12e80bd1c181eff426ff352528c8f.
BEGIN;
SET LOCAL zoi.publisher_review_actor = 'Codex independent reviewer /root/youth_review';
SET LOCAL zoi.publisher_review_packet_sha256 = 'fdb4a88e0e9207715feeae0eecf4ddaef35db8d37a55d7e1ba506b3966974c71';
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $reviewed$
DECLARE b zoi.listings;a zoi.listings;leased record;result record;fp text;reviewer text;
 source text:='https://www.minosemi.gr/artists/vlospa/';
 machine jsonb:='{"site_lang":"en-US","source_kind":"label_artist_profile","listen":{"spotify":"https://open.spotify.com/artist/5VzicjuhIv0IwMz15hEORa"},"crawl_status":"ok","description":"VLOSPA is a French-Greek rap artist who performs in Greek and French. His recordings include Mano A Mano and the 2020 album Mektoub.","photo_urls":["https://www.minosemi.gr/wp-content/uploads/sites/946/2023/05/vlospa-photo-2048x2048.png"],"photo_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2023/05/vlospa-photo-2048x2048.png","hero_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2023/05/vlospa-photo-2048x2048.png"}'::jsonb;
BEGIN
 reviewer:=nullif(current_setting('zoi.publisher_review_actor',true),'');
 IF reviewer IS NULL OR current_setting('zoi.publisher_review_packet_sha256',true) IS DISTINCT FROM 'fdb4a88e0e9207715feeae0eecf4ddaef35db8d37a55d7e1ba506b3966974c71' THEN RAISE EXCEPTION 'exact_independent_packet_review_required';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_apply(jsonb)'))) IS DISTINCT FROM '396c9e8ef6e7a19cb7e2c361a21bccbb' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_sample_lease(uuid[])'))) IS DISTINCT FROM '16a53918d76c896492c47dcca32806ca' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_sample_lease';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.seo_entity(text)'))) IS DISTINCT FROM 'e01c20df827c18865a0bfaadff2a9d49' THEN RAISE EXCEPTION 'writer_definition_changed:public.seo_entity';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_apply(jsonb)'))) IS DISTINCT FROM '8e41b35a16426573b5867436e60f0abf' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_fingerprint(zoi.listings)'))) IS DISTINCT FROM 'cc69353ab17d09e06846eb90c1ee34cd' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_fingerprint';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.profile_strip(jsonb)'))) IS DISTINCT FROM '8b20fc1c36fca6647a69e155fbeb377f' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.profile_strip';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_timestamp(text)'))) IS DISTINCT FROM '281a90ff6e44c1a64b2d3c8977f1c38c' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_timestamp';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_state(zoi.listings)'))) IS DISTINCT FROM 'ea1641facea45c788f8e6ca84feaf6d4' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_state';END IF;
 SELECT * INTO b FROM zoi.listings WHERE id='197f8060-75fd-442c-8509-adfd2f852705' FOR UPDATE;
 IF NOT FOUND OR md5(to_jsonb(b)::text) IS DISTINCT FROM 'fabbcd726f212e47261400a7a2780868' THEN RAISE EXCEPTION 'review_snapshot_changed';END IF;
 IF b.name IS DISTINCT FROM 'VLOSPA' OR b.slug IS DISTINCT FROM 'vlospa-paris' OR b.entity_type IS DISTINCT FROM 'artist' OR b.website IS NOT NULL OR b.source_url IS DISTINCT FROM NULL OR b.owner_user_id IS NOT NULL OR b.owner_workspace_id IS NOT NULL OR b.claim_status IS DISTINCT FROM 'unclaimed' OR b.publish_status IS DISTINCT FROM 'published' OR b.moderation_status NOT IN('clean','cleared') OR b.moderation_status IS NULL OR coalesce(b.marketplace_status,'')='hidden' OR b.profile ? '_enrich' THEN RAISE EXCEPTION 'identity_source_owner_changed';END IF;
 UPDATE zoi.listings SET website=source,source_url=coalesce(b.source_url,source) WHERE id=b.id;
 SELECT * INTO STRICT leased FROM public.enrich_sample_lease(ARRAY[b.id]);
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 fp:=zoi.listing_quality_fingerprint(a);
 IF leased.listing_id IS DISTINCT FROM b.id OR leased.website IS DISTINCT FROM source OR leased.slug IS DISTINCT FROM b.slug OR leased.owner_managed IS DISTINCT FROM false OR leased.existing_enrich IS DISTINCT FROM '{}'::jsonb OR a.profile#>>'{_enrich,lease,id}' IS DISTINCT FROM leased.lease_id OR a.profile#>>'{_enrich,lease,task}' IS DISTINCT FROM 'enrichment' OR a.profile#>>'{_enrich,lease,fingerprint}' IS DISTINCT FROM fp THEN RAISE EXCEPTION 'real_lease_binding_failed';END IF;
 machine:=machine||jsonb_build_object('publisher_source_evidence',jsonb_build_object('packet_sha256','fdb4a88e0e9207715feeae0eecf4ddaef35db8d37a55d7e1ba506b3966974c71','source_sha256','a269675d9b2301fa2c2b4cf476d85b6badb12e80bd1c181eff426ff352528c8f','prior_row_hash','fabbcd726f212e47261400a7a2780868','source_fingerprint',fp,'reviewer',reviewer,'method','atomic_reviewed_publisher_proposal','approved_image_hashes','["fce1e9bd37407789613a6a84b43b7de9197c27cfccc58cd7e91e3c5402423bec"]'::jsonb));
 SELECT * INTO STRICT result FROM zoi.enrich_apply(jsonb_build_array(jsonb_build_object('slug',b.slug,'website',source,'lease_id',leased.lease_id,'profile',machine,'provenance',jsonb_build_object('source_kind','record_label','description','reviewed-record-label:'||source,'listen','record-label-linked-artist:'||source,'hero_url','reviewed-record-label-portrait:'||source))));
 IF result.applied IS DISTINCT FROM true OR result.slug IS DISTINCT FROM b.slug THEN RAISE EXCEPTION 'enrichment_not_applied';END IF;
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 IF a.source_url IS DISTINCT FROM coalesce(b.source_url,source) THEN RAISE EXCEPTION 'existing_source_history_changed';END IF;
 IF (to_jsonb(a)-ARRAY['website','source_url','profile','updated_at']) IS DISTINCT FROM (to_jsonb(b)-ARRAY['website','source_url','profile','updated_at']) OR (a.profile-'_enrich'-'_coverage') IS DISTINCT FROM b.profile THEN RAISE EXCEPTION 'protected_fields_changed';END IF;
 IF a.profile#>>'{_enrich,publisher_source_evidence,packet_sha256}' IS DISTINCT FROM 'fdb4a88e0e9207715feeae0eecf4ddaef35db8d37a55d7e1ba506b3966974c71' OR a.profile#>>'{_enrich,publisher_source_evidence,source_sha256}' IS DISTINCT FROM 'a269675d9b2301fa2c2b4cf476d85b6badb12e80bd1c181eff426ff352528c8f' OR a.profile#>>'{_enrich,publisher_source_evidence,reviewer}' IS DISTINCT FROM reviewer OR a.profile#>>'{_enrich,publisher_source_evidence,prior_row_hash}' IS DISTINCT FROM 'fabbcd726f212e47261400a7a2780868' OR a.profile#>>'{_enrich,publisher_source_evidence,source_fingerprint}' IS DISTINCT FROM fp OR a.profile#>'{_enrich,publisher_source_evidence,approved_image_hashes}' IS DISTINCT FROM '["fce1e9bd37407789613a6a84b43b7de9197c27cfccc58cd7e91e3c5402423bec"]'::jsonb OR a.profile#>>'{_enrich,source_kind}' IS DISTINCT FROM 'label_artist_profile' OR a.profile#>'{_enrich,listen}' IS DISTINCT FROM machine->'listen' OR a.profile#>>'{_enrich,description}' IS DISTINCT FROM machine->>'description' OR a.profile#>>'{_enrich,source_url}' IS DISTINCT FROM source OR a.profile#>>'{_enrich,hero_url}' IS DISTINCT FROM machine->>'hero_url' THEN RAISE EXCEPTION 'publisher_projection_fields_missing';END IF;
END $reviewed$;
SELECT id,slug,website,source_url,profile->'_enrich' machine_readback,profile#>'{_coverage,tasks}' coverage_readback,md5(to_jsonb(l)::text) after_row_hash FROM zoi.listings l WHERE id='197f8060-75fd-442c-8509-adfd2f852705';
ROLLBACK;

-- NON-APPLIED exact publisher proposal. Default ROLLBACK. No source fetch is a verification receipt.
-- Independent reviewer supplies actual actor and this packet hash in transaction settings.
-- File docs/audits/evidence/artist-next-batch-2026-10-02/packets/6cddc7aa-7898-4b79-8940-d119db00ab18.json; SHA256 ea200526b125312b96e25d783b6692276f521a58d572e8069440724800212029; source SHA256 deca0d9d0be49a6b28fc62a9764383cd1c9447a0fed298735f6e830b009cb0fc.
BEGIN;
SET LOCAL zoi.publisher_review_actor = 'Codex independent reviewer /root/youth_review';
SET LOCAL zoi.publisher_review_packet_sha256 = 'ea200526b125312b96e25d783b6692276f521a58d572e8069440724800212029';
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $reviewed$
DECLARE b zoi.listings;a zoi.listings;leased record;result record;fp text;reviewer text;
 source text:='https://www.minosemi.gr/artists/%ce%b3%ce%b9%cf%89%cf%81%ce%b3%ce%bf%cf%82-%cf%84%cf%83%ce%b1%ce%bb%ce%b9%ce%ba%ce%b7%cf%82/';
 machine jsonb:='{"site_lang":"en-US","source_kind":"label_artist_profile","listen":{"spotify":"https://open.spotify.com/artist/7wdFPENV7NBZ4o3tHqsWhD"},"crawl_status":"ok","photo_urls":["https://www.minosemi.gr/wp-content/uploads/sites/946/2026/08/711695774_18591560482054129_7748260434817798528_n-scaled-e1787562420792-1000x1000.jpg"],"photo_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2026/08/711695774_18591560482054129_7748260434817798528_n-scaled-e1787562420792-1000x1000.jpg","hero_url":"https://www.minosemi.gr/wp-content/uploads/sites/946/2026/08/711695774_18591560482054129_7748260434817798528_n-scaled-e1787562420792-1000x1000.jpg"}'::jsonb;
BEGIN
 reviewer:=nullif(current_setting('zoi.publisher_review_actor',true),'');
 IF reviewer IS NULL OR current_setting('zoi.publisher_review_packet_sha256',true) IS DISTINCT FROM 'ea200526b125312b96e25d783b6692276f521a58d572e8069440724800212029' THEN RAISE EXCEPTION 'exact_independent_packet_review_required';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_apply(jsonb)'))) IS DISTINCT FROM '396c9e8ef6e7a19cb7e2c361a21bccbb' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.enrich_sample_lease(uuid[])'))) IS DISTINCT FROM '16a53918d76c896492c47dcca32806ca' THEN RAISE EXCEPTION 'writer_definition_changed:public.enrich_sample_lease';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.seo_entity(text)'))) IS DISTINCT FROM 'e01c20df827c18865a0bfaadff2a9d49' THEN RAISE EXCEPTION 'writer_definition_changed:public.seo_entity';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_apply(jsonb)'))) IS DISTINCT FROM '8e41b35a16426573b5867436e60f0abf' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_apply';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_fingerprint(zoi.listings)'))) IS DISTINCT FROM 'cc69353ab17d09e06846eb90c1ee34cd' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_fingerprint';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.profile_strip(jsonb)'))) IS DISTINCT FROM '8b20fc1c36fca6647a69e155fbeb377f' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.profile_strip';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.enrich_timestamp(text)'))) IS DISTINCT FROM '281a90ff6e44c1a64b2d3c8977f1c38c' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.enrich_timestamp';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('zoi.listing_quality_state(zoi.listings)'))) IS DISTINCT FROM 'ea1641facea45c788f8e6ca84feaf6d4' THEN RAISE EXCEPTION 'writer_definition_changed:zoi.listing_quality_state';END IF;
 SELECT * INTO b FROM zoi.listings WHERE id='6cddc7aa-7898-4b79-8940-d119db00ab18' FOR UPDATE;
 IF NOT FOUND OR md5(to_jsonb(b)::text) IS DISTINCT FROM '32ad475463f0b7d850c6cf5c2aeb6cb2' THEN RAISE EXCEPTION 'review_snapshot_changed';END IF;
 IF b.name IS DISTINCT FROM 'Giorgos Tsalikis' OR b.slug IS DISTINCT FROM 'giorgos-tsalikis-ioannina-6cddc7' OR b.entity_type IS DISTINCT FROM 'artist' OR b.website IS NOT NULL OR b.source_url IS DISTINCT FROM NULL OR b.owner_user_id IS NOT NULL OR b.owner_workspace_id IS NOT NULL OR b.claim_status IS DISTINCT FROM 'unclaimed' OR b.publish_status IS DISTINCT FROM 'published' OR b.moderation_status NOT IN('clean','cleared') OR b.moderation_status IS NULL OR coalesce(b.marketplace_status,'')='hidden' OR b.profile ? '_enrich' THEN RAISE EXCEPTION 'identity_source_owner_changed';END IF;
 UPDATE zoi.listings SET website=source,source_url=coalesce(b.source_url,source) WHERE id=b.id;
 SELECT * INTO STRICT leased FROM public.enrich_sample_lease(ARRAY[b.id]);
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 fp:=zoi.listing_quality_fingerprint(a);
 IF leased.listing_id IS DISTINCT FROM b.id OR leased.website IS DISTINCT FROM source OR leased.slug IS DISTINCT FROM b.slug OR leased.owner_managed IS DISTINCT FROM false OR leased.existing_enrich IS DISTINCT FROM '{}'::jsonb OR a.profile#>>'{_enrich,lease,id}' IS DISTINCT FROM leased.lease_id OR a.profile#>>'{_enrich,lease,task}' IS DISTINCT FROM 'enrichment' OR a.profile#>>'{_enrich,lease,fingerprint}' IS DISTINCT FROM fp THEN RAISE EXCEPTION 'real_lease_binding_failed';END IF;
 machine:=machine||jsonb_build_object('publisher_source_evidence',jsonb_build_object('packet_sha256','ea200526b125312b96e25d783b6692276f521a58d572e8069440724800212029','source_sha256','deca0d9d0be49a6b28fc62a9764383cd1c9447a0fed298735f6e830b009cb0fc','prior_row_hash','32ad475463f0b7d850c6cf5c2aeb6cb2','source_fingerprint',fp,'reviewer',reviewer,'method','atomic_reviewed_publisher_proposal','approved_image_hashes','["c7bb27a32321198fde5a3334e79dfa67cffcee6d746f606bd261fc2bd08b39df"]'::jsonb));
 SELECT * INTO STRICT result FROM zoi.enrich_apply(jsonb_build_array(jsonb_build_object('slug',b.slug,'website',source,'lease_id',leased.lease_id,'profile',machine,'provenance',jsonb_build_object('source_kind','record_label','description','reviewed-record-label:'||source,'listen','record-label-linked-artist:'||source,'hero_url','reviewed-record-label-portrait:'||source))));
 IF result.applied IS DISTINCT FROM true OR result.slug IS DISTINCT FROM b.slug THEN RAISE EXCEPTION 'enrichment_not_applied';END IF;
 SELECT * INTO a FROM zoi.listings WHERE id=b.id;
 IF a.source_url IS DISTINCT FROM coalesce(b.source_url,source) THEN RAISE EXCEPTION 'existing_source_history_changed';END IF;
 IF (to_jsonb(a)-ARRAY['website','source_url','profile','updated_at']) IS DISTINCT FROM (to_jsonb(b)-ARRAY['website','source_url','profile','updated_at']) OR (a.profile-'_enrich'-'_coverage') IS DISTINCT FROM b.profile THEN RAISE EXCEPTION 'protected_fields_changed';END IF;
 IF a.profile#>>'{_enrich,publisher_source_evidence,packet_sha256}' IS DISTINCT FROM 'ea200526b125312b96e25d783b6692276f521a58d572e8069440724800212029' OR a.profile#>>'{_enrich,publisher_source_evidence,source_sha256}' IS DISTINCT FROM 'deca0d9d0be49a6b28fc62a9764383cd1c9447a0fed298735f6e830b009cb0fc' OR a.profile#>>'{_enrich,publisher_source_evidence,reviewer}' IS DISTINCT FROM reviewer OR a.profile#>>'{_enrich,publisher_source_evidence,prior_row_hash}' IS DISTINCT FROM '32ad475463f0b7d850c6cf5c2aeb6cb2' OR a.profile#>>'{_enrich,publisher_source_evidence,source_fingerprint}' IS DISTINCT FROM fp OR a.profile#>'{_enrich,publisher_source_evidence,approved_image_hashes}' IS DISTINCT FROM '["c7bb27a32321198fde5a3334e79dfa67cffcee6d746f606bd261fc2bd08b39df"]'::jsonb OR a.profile#>>'{_enrich,source_kind}' IS DISTINCT FROM 'label_artist_profile' OR a.profile#>'{_enrich,listen}' IS DISTINCT FROM machine->'listen' OR a.profile#>>'{_enrich,description}' IS DISTINCT FROM machine->>'description' OR a.profile#>>'{_enrich,source_url}' IS DISTINCT FROM source OR a.profile#>>'{_enrich,hero_url}' IS DISTINCT FROM machine->>'hero_url' THEN RAISE EXCEPTION 'publisher_projection_fields_missing';END IF;
END $reviewed$;
SELECT id,slug,website,source_url,profile->'_enrich' machine_readback,profile#>'{_coverage,tasks}' coverage_readback,md5(to_jsonb(l)::text) after_row_hash FROM zoi.listings l WHERE id='6cddc7aa-7898-4b79-8940-d119db00ab18';
ROLLBACK;

SELECT id,md5(to_jsonb(l)::text) after_rollback_row_hash FROM zoi.listings l WHERE id IN ('b5a1fb8a-1ffd-41cb-ad87-218479ec0952','6314023e-c3e9-4f0d-bc1d-29440872e2fd','74505bc2-d26c-4b19-891c-bfa9dd0a018b','accc5252-87e6-4ce7-8088-e43dccdac8d9','56f6e20a-002e-475c-821d-ff1cada01c62','c860e992-8d41-4f10-92db-5bcad471552d','3f708bed-a4d0-4424-9497-bde4047573f4','bd3ed9f5-1c9e-4235-8468-c0bb03febb98','ec23a7e7-ac4e-4b11-aac1-be43e433fd6d','62ad40b8-f575-4f68-b7d7-efac8d882662','cf1f93d4-4740-45a3-866f-dced6d7cc18b','098a3b82-afb4-4532-a6c8-b9f6641bc90f','cdbc7823-7817-4e37-a9a0-36048ba5828f','a72b6c42-cba0-457b-965a-6510a07f3b31','197f8060-75fd-442c-8509-adfd2f852705','6cddc7aa-7898-4b79-8940-d119db00ab18') ORDER BY id;

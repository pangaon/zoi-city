-- Root-only after the reviewed migration, during a quiet enrichment window.
-- Synthetic listings and all canonical lease/writer changes are rolled back.
-- No source fetch, provider call, lease backfill or existing listing write.
BEGIN;
SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='20s';
DO $qa$ DECLARE e jsonb;positive constant uuid:='c658c9a1-f354-4d07-b655-106151212001';stale constant uuid:='c658c9a1-f354-4d07-b655-106151212002';category bigint;l record;positive_lease record;stale_lease record;ack record;before_stale text;BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'qa_enrich_executor_required';END IF;
 IF EXISTS(SELECT 1 FROM zoi.listings WHERE id IN(positive,stale) OR slug IN('qa-enrich-authority-positive-20261015','qa-enrich-authority-stale-20261015')) THEN RAISE EXCEPTION 'qa_enrich_fixture_collision';END IF;
 FOR e IN SELECT value FROM jsonb_array_elements('[{"signature":"public.enrich_sample_lease(uuid[])","md5":"15626a3b9a0f095af32bb748627e651a"},{"signature":"zoi.enrich_queue_lease(integer,integer,integer)","md5":"950a5ee4f0fad7fa4700805d0ac034ee"},{"signature":"zoi.enrich_apply(jsonb)","md5":"310678a4bd7d77d5467dbd07604349d9"},{"signature":"zoi.enrich_authority_fingerprint(zoi.listings)","md5":"f88710fbc5694cccad696f7550429a65"}]'::jsonb) LOOP
  IF md5(pg_get_functiondef(to_regprocedure(e->>'signature'))) IS DISTINCT FROM e->>'md5' THEN RAISE EXCEPTION 'qa_enrich_served_contract_drift';END IF;
 END LOOP;
 IF has_function_privilege('anon','zoi.enrich_authority_fingerprint(zoi.listings)','execute') OR has_function_privilege('authenticated','zoi.enrich_authority_fingerprint(zoi.listings)','execute') OR has_function_privilege('service_role','zoi.enrich_authority_fingerprint(zoi.listings)','execute') THEN RAISE EXCEPTION 'qa_enrich_private_helper_exposed';END IF;
 SELECT id INTO category FROM zoi.categories WHERE slug='restaurants' LIMIT 1;IF category IS NULL THEN RAISE EXCEPTION 'qa_enrich_category_unavailable';END IF;
 INSERT INTO zoi.listings(id,entity_type,name,slug,primary_category_id,website,city,country,address,publish_status,moderation_status,marketplace_status,duplicate_status,profile)
 VALUES(positive,'business','Rollback-only enrichment authority positive','qa-enrich-authority-positive-20261015',category,'https://example.org/qa-enrich-authority-positive','London','United Kingdom','1 QA Fixture Street','published','clean','none','unique','{"_enrich":{"phone":"BEFORE"}}'),
 (stale,'business','Rollback-only enrichment authority stale','qa-enrich-authority-stale-20261015',category,'https://example.org/qa-enrich-authority-stale','London','United Kingdom','2 QA Fixture Street','published','clean','none','unique','{"_enrich":{"phone":"BEFORE"}}');
 FOR l IN SELECT * FROM public.enrich_sample_lease(ARRAY[positive,stale]) LOOP
  IF l.listing_id=positive THEN positive_lease:=l;ELSIF l.listing_id=stale THEN stale_lease:=l;ELSE RAISE EXCEPTION 'qa_enrich_unexpected_lease';END IF;
 END LOOP;
 IF positive_lease.listing_id IS DISTINCT FROM positive OR stale_lease.listing_id IS DISTINCT FROM stale THEN RAISE EXCEPTION 'qa_enrich_exact_leases_missing';END IF;
 SELECT * INTO STRICT ack FROM public.enrich_apply(jsonb_build_array(jsonb_build_object('slug',positive_lease.slug,'website',positive_lease.website,'lease_id',positive_lease.lease_id,'profile',jsonb_build_object('phone','AFTER'),'provenance',jsonb_build_object('phone','rollback-only-source-fixture'))));
 IF ack.applied IS DISTINCT FROM true OR (SELECT profile#>>'{_enrich,phone}' FROM zoi.listings WHERE id=positive) IS DISTINCT FROM 'AFTER' THEN RAISE EXCEPTION 'qa_enrich_unchanged_context_failed';END IF;
 UPDATE zoi.listings SET address='99 QA Changed Branch' WHERE id=stale;
 SELECT md5(to_jsonb(t)::text) INTO before_stale FROM zoi.listings t WHERE t.id=stale;
 SELECT * INTO STRICT ack FROM public.enrich_apply(jsonb_build_array(jsonb_build_object('slug',stale_lease.slug,'website',stale_lease.website,'lease_id',stale_lease.lease_id,'profile',jsonb_build_object('phone','STALE'),'provenance',jsonb_build_object('phone','rollback-only-source-fixture'),'expected_source_context',jsonb_build_object('address','99 QA Changed Branch'))));
 IF ack.applied IS DISTINCT FROM false OR (SELECT md5(to_jsonb(t)::text) FROM zoi.listings t WHERE t.id=stale) IS DISTINCT FROM before_stale THEN RAISE EXCEPTION 'qa_enrich_changed_branch_not_refused';END IF;
END $qa$;
ROLLBACK;
DO $absence$ BEGIN IF EXISTS(SELECT 1 FROM zoi.listings WHERE id IN('c658c9a1-f354-4d07-b655-106151212001','c658c9a1-f354-4d07-b655-106151212002')) THEN RAISE EXCEPTION 'qa_enrich_rollback_not_absent';END IF;END $absence$;
SELECT jsonb_build_object('rollback_verified',true,'positive_current_context_applied',true,'changed_branch_refused_without_row_change',true,'synthetic_listings_absent',2,'existing_listing_writes',0,'source_or_provider_requests',0) AS enrichment_authority_rollback;

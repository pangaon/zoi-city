BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='20s';
DO $$
DECLARE v_listing uuid;before_profile jsonb;leased record;r jsonb;changed boolean;n bigint;
BEGIN
 SELECT count(*)INTO n FROM zoi.v_listing_quality_coverage;
 IF n<>(SELECT count(*)FROM zoi.listings)THEN RAISE EXCEPTION 'coverage_row_count_mismatch';END IF;
 IF has_function_privilege('anon','public.listing_quality_audit(integer)','EXECUTE')OR has_function_privilege('authenticated','public.listing_quality_task_finish(uuid,text,text,jsonb)','EXECUTE')THEN RAISE EXCEPTION 'quality_worker_acl_failed';END IF;
 SELECT l.id,l.profile INTO v_listing,before_profile FROM zoi.listings l WHERE l.publish_status='published'AND l.moderation_status IN('clean','cleared')AND coalesce(l.marketplace_status,'')<>'hidden'AND l.website~*'^https?://'AND coalesce(l.profile#>>'{_enrich,blocked}','')<>'true'AND coalesce(zoi.enrich_timestamp(l.profile#>>'{_enrich,lease,expires_at}'),'-infinity')<now()ORDER BY l.id LIMIT 1 FOR UPDATE;
 IF v_listing IS NULL THEN RAISE EXCEPTION 'quality_no_eligible_rollback_canary';END IF;
 SELECT * INTO leased FROM public.enrich_sample_lease(ARRAY[v_listing]);
 IF leased.listing_id IS DISTINCT FROM v_listing OR leased.name IS NULL OR leased.entity_type IS NULL OR leased.existing_enrich IS NULL THEN RAISE EXCEPTION 'quality_lease_context_failed';END IF;
 SELECT applied INTO changed FROM public.enrich_apply(jsonb_build_array(jsonb_build_object('slug',leased.slug,'website',leased.website,'lease_id',leased.lease_id,'profile',jsonb_build_object('crawl_status','error','last_error','isolated_rollback_contract_check'))));
 IF changed IS DISTINCT FROM true THEN RAISE EXCEPTION 'quality_apply_receipt_failed';END IF;
 IF (SELECT profile-'_enrich'-'_coverage'FROM zoi.listings WHERE listings.id=v_listing)IS DISTINCT FROM(coalesce(before_profile,'{}')-'_enrich'-'_coverage')THEN RAISE EXCEPTION 'quality_owner_profile_changed';END IF;
 r:=public.listing_quality_audit(2);
 IF(r->>'processed')::integer>2 OR r->>'network_requests'<>'0' THEN RAISE EXCEPTION 'quality_audit_bound_failed';END IF;
END $$;
SELECT jsonb_build_object('quality_coverage_verified',true,'context_and_owner_fencing_verified',true,'external_requests',0,'persisted_changes',0)AS sanitized_result;
ROLLBACK;

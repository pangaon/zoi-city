BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='20s';
-- Dashboard polling reads job columns and only validates applied receipts.
-- Population-wide eligibility and input freshness are measured separately.
CREATE FUNCTION zoi.delivery_job_status() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH counts AS(SELECT count(*)AS total,count(*)FILTER(WHERE captured_at IS NOT NULL OR applied_at IS NOT NULL)AS processed,count(*)FILTER(WHERE status='source_blocked')AS failed,count(*)FILTER(WHERE attempts>1)AS retried,max(updated_at)AS as_of FROM zoi.geography_repair_jobs),
 accepted AS(SELECT j.id FROM zoi.geography_repair_jobs j JOIN zoi.geography_reviews r ON r.request_id=CASE WHEN j.application_result->>'request_id'~'^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$'THEN(j.application_result->>'request_id')::uuid END JOIN zoi.listings l ON l.id=j.listing_id WHERE j.status='applied'AND r.listing_id=j.listing_id AND r.reverted_at IS NULL AND r.receipt->>'precision'='street'AND r.after_fingerprint=zoi.geography_fingerprint(l)AND l.profile#>>'{_geo,request_id}'=r.request_id::text AND l.geo_precision='street'AND l.profile#>>'{_geo,precision}'='street'AND l.duplicate_status IS DISTINCT FROM 'confirmed'AND l.owner_user_id IS NULL AND l.owner_workspace_id IS NULL AND l.publish_status='published'AND l.moderation_status IN('clean','cleared')AND coalesce(l.marketplace_status,'')<>'hidden')
 SELECT jsonb_build_object('total',total,'processed',processed,'remaining',total-(SELECT count(*)FROM accepted),'failed',failed,'retried',retried,'as_of',as_of,'states',(SELECT jsonb_object_agg(status,n)FROM(SELECT status,count(*)n FROM zoi.geography_repair_jobs GROUP BY status)s),'definition','Job workload. Processed includes captured research or applied results and overlaps remaining; it is not a count of corrected addresses.','current_input_validation','Not measured across the full population; checked at bounded processing boundaries.')FROM counts
$$;
REVOKE ALL ON FUNCTION zoi.delivery_job_status() FROM PUBLIC,anon,authenticated;
DO $projection$ DECLARE definition text;needle text:='RETURN jsonb_build_object(''schema_version''';BEGIN
 SELECT pg_get_functiondef('public.zoi_delivery_dashboard(timestamp with time zone)'::regprocedure)INTO definition;
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'delivery_job_projection_contract_changed';END IF;
 EXECUTE replace(definition,needle,'RETURN jsonb_build_object(''jobs'',zoi.delivery_job_status())||jsonb_build_object(''schema_version''');
END $projection$;
NOTIFY pgrst,'reload schema';
COMMIT;

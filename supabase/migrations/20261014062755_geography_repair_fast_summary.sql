BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
-- Source work is an as-of job inventory. Full input freshness is checked at
-- bounded lease/finish/review boundaries; polling must not hash the catalogue.
-- Only actual applied jobs pay for the immutable current public receipt check.
CREATE OR REPLACE FUNCTION public.geography_repair_summary() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH eligible AS MATERIALIZED (
 SELECT e.id FROM zoi.v_public_listings e JOIN zoi.listings l ON l.id=e.id
 WHERE l.marketplace_status IS DISTINCT FROM 'hidden'
 ),applied AS MATERIALIZED (
 SELECT j.listing_id,j.application_result,
 public.geography_reviewed_point(j.listing_id) AS current_receipt
 FROM zoi.geography_repair_jobs j WHERE j.status='applied'
 ),accepted AS (
 SELECT * FROM applied WHERE current_receipt->>'request_id'=application_result->>'request_id'
 ),counts AS (
 SELECT count(*) AS jobs,count(distinct listing_id) AS unique_records,
 count(*) FILTER(WHERE status IN ('queued','leased')) AS pending_jobs,
 count(*) FILTER(WHERE captured_at IS NOT NULL OR applied_at IS NOT NULL) AS processed_jobs,
 count(*) FILTER(WHERE status<>'applied') AS remaining_jobs,
 count(*) FILTER(WHERE status='source_blocked') AS failed_jobs,
 count(*) FILTER(WHERE attempts>1) AS retried_jobs,
 max(updated_at) AS last_job_update FROM zoi.geography_repair_jobs
 )
 SELECT jsonb_build_object('measured_at',now(),'eligible_population',(SELECT count(*) FROM eligible),
 'seeded_eligible_records',(SELECT count(distinct j.listing_id) FROM zoi.geography_repair_jobs j JOIN eligible e ON e.id=j.listing_id),
 'jobs',jsonb_build_object('total',jobs,'processed',processed_jobs,'remaining',jobs-(SELECT count(*) FROM accepted),'failed',failed_jobs,'retried',retried_jobs,'states',(SELECT jsonb_object_agg(status,n) FROM (SELECT status,count(*) n FROM zoi.geography_repair_jobs GROUP BY status)s),'as_of',last_job_update,'current_input_validation','not measured across full population'),'total_jobs',jobs,'unique_records',unique_records,'pending_jobs',pending_jobs,'last_job_update',last_job_update,
 'remaining_unique_records',(SELECT count(*) FROM eligible)-(SELECT count(distinct a.listing_id) FROM accepted a JOIN eligible e ON e.id=a.listing_id),
 'current_records',NULL,'current_jobs',NULL,'input_freshness','checked_at_bounded_lease_finish_and_review_not_catalogue_poll',
 'current_applied_records',(SELECT count(distinct listing_id) FROM accepted),
 'actual_coordinate_corrections',(SELECT count(distinct listing_id) FROM accepted WHERE application_result->>'coordinate_changed'='true'),
 'historical_statuses',(SELECT jsonb_object_agg(status,n) FROM (SELECT status,count(*) n FROM zoi.geography_repair_jobs GROUP BY status)s))
 FROM counts
$$;
REVOKE ALL ON FUNCTION public.geography_repair_summary() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.geography_repair_summary() TO service_role;
COMMIT;

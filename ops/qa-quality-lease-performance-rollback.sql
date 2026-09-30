BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='8s';
DO $$
DECLARE started timestamptz:=clock_timestamp(); n integer;
BEGIN
 SELECT count(*) INTO n FROM public.listing_quality_task_lease('verification',10);
 IF n>10 THEN RAISE EXCEPTION 'quality_lease_limit_failed'; END IF;
 IF clock_timestamp()-started>interval '7 seconds' THEN RAISE EXCEPTION 'quality_lease_latency_failed'; END IF;
 IF has_function_privilege('anon','public.listing_quality_task_lease(text,integer)','EXECUTE') OR has_function_privilege('authenticated','public.listing_quality_task_lease(text,integer)','EXECUTE') THEN RAISE EXCEPTION 'quality_lease_access_failed'; END IF;
END $$;
SELECT 'quality_lease_latency_access_and_limit_passed' AS result;
ROLLBACK;

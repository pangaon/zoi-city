-- Session-only identical registered publisher document cohorts. No factual writer.
BEGIN;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='5s';
DO $guard$
DECLARE signature text; expected text;
BEGIN
 FOR signature,expected IN SELECT * FROM (VALUES
 ('public.geography_publisher_lease(integer)','ab188abad781c14a80df7bbb882e1546'),
 ('public.geography_repair_lease(integer,text)','7dee3566b96b2466515aba4097227661'),
 ('public.geography_repair_finish(uuid,uuid,jsonb)','cf487fc76279292be05fad43b48e56db')) v(signature,expected)
 LOOP
  IF md5(pg_get_functiondef(signature::regprocedure)) IS DISTINCT FROM expected THEN RAISE EXCEPTION 'publisher_cohort_dependency_changed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=signature::regprocedure AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text='{postgres=X/postgres,service_role=X/postgres}') THEN RAISE EXCEPTION 'publisher_cohort_dependency_acl_changed'; END IF;
 END LOOP;
END $guard$;
CREATE INDEX geography_publisher_document_pending_idx
 ON zoi.geography_repair_jobs (strategy,(original->>'source_url'),created_at,id)
 WHERE strategy='publisher_profiles_v1' AND status IN('queued','leased');
CREATE FUNCTION public.geography_publisher_document_lease(p_limit integer DEFAULT 4)
 RETURNS SETOF zoi.geography_repair_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE head zoi.geography_repair_jobs; cap integer:=greatest(least(coalesce(p_limit,4),4),1);
BEGIN
 -- Existing head admission owns host pacing, holds, expiry and generation checks.
 SELECT * INTO head FROM public.geography_publisher_lease(1);
 IF head.id IS NULL THEN RETURN; END IF;
 RETURN NEXT head;
 IF cap=1 THEN RETURN; END IF;
 RETURN QUERY WITH picked AS MATERIALIZED (
  SELECT j.id FROM zoi.geography_repair_jobs j
  WHERE j.strategy='publisher_profiles_v1' AND j.status IN('queued','leased')
  AND j.original->>'source_url'=head.original->>'source_url' AND j.id<>head.id
  AND (j.status='queued' OR (j.lease_expires_at<now() AND j.attempts<3))
  ORDER BY j.created_at,j.id LIMIT cap-1 FOR UPDATE SKIP LOCKED
 ), checked AS MATERIALIZED (
  SELECT p.id,zoi.geography_source_job_current(j,l) AS current_input FROM picked p
  JOIN zoi.geography_repair_jobs j ON j.id=p.id JOIN zoi.listings l ON l.id=j.listing_id FOR SHARE OF l
 ), updated AS (
  UPDATE zoi.geography_repair_jobs j SET
   status=CASE WHEN c.current_input IS TRUE THEN 'leased' ELSE 'input_changed' END,
   reason=CASE WHEN c.current_input IS TRUE THEN j.reason ELSE 'listing_input_changed_before_capture' END,
   lease_id=CASE WHEN c.current_input IS TRUE THEN gen_random_uuid() ELSE NULL END,
   lease_expires_at=CASE WHEN c.current_input IS TRUE THEN now()+interval '15 minutes' ELSE NULL END,
   attempts=j.attempts+CASE WHEN c.current_input IS TRUE THEN 1 ELSE 0 END,updated_at=now()
  FROM checked c WHERE c.id=j.id RETURNING j.*
 ) SELECT * FROM updated WHERE status='leased';
END $function$;
ALTER FUNCTION public.geography_publisher_document_lease(integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.geography_publisher_document_lease(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.geography_publisher_document_lease(integer) TO service_role;
COMMENT ON FUNCTION public.geography_publisher_document_lease(integer) IS 'At most four current publisher jobs sharing one exact immutable registered URL. Session capture only; existing finish CAS and source authority unchanged.';

COMMIT;

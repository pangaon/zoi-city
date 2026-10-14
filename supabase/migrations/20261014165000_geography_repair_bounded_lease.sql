BEGIN;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='5s';
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.geography_repair_lease(integer,text)'::regprocedure AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text='{postgres=X/postgres,service_role=X/postgres}') THEN RAISE EXCEPTION 'geography_lease_contract_changed';END IF;
 IF md5(pg_get_functiondef('public.geography_repair_lease(integer,text)'::regprocedure)) IS DISTINCT FROM '5b2efa05369af2a08ee1cf5053805150' THEN RAISE EXCEPTION 'geography_lease_definition_changed';END IF;
END $guard$;
CREATE INDEX geography_repair_pending_order_idx ON zoi.geography_repair_jobs(strategy,created_at,id) WHERE status IN('queued','leased');
CREATE OR REPLACE FUNCTION public.geography_repair_lease(p_limit integer DEFAULT 10, p_strategy text DEFAULT 'official_sources_v1'::text)
 RETURNS SETOF zoi.geography_repair_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF p_strategy IS NULL OR p_strategy NOT IN('official_sources_v1','publisher_profiles_v1') THEN RAISE EXCEPTION 'unsupported_geography_source_strategy';END IF;
 IF p_strategy='official_sources_v1' THEN
 UPDATE zoi.geography_repair_jobs SET status='unresolved',reason='capture_interrupted_three_times_requires_changed_strategy',lease_id=null,lease_expires_at=null,updated_at=now() WHERE strategy=p_strategy AND status='leased' AND lease_expires_at<now() AND attempts>=3;
 RETURN QUERY WITH picked AS MATERIALIZED (
 SELECT j.id FROM zoi.geography_repair_jobs j WHERE j.strategy=p_strategy
 AND j.status IN('queued','leased')
 AND (j.status='queued' OR (j.lease_expires_at<now() AND j.attempts<3))
 ORDER BY j.created_at,j.id LIMIT greatest(least(coalesce(p_limit,10),30),1) FOR UPDATE SKIP LOCKED ),checked AS MATERIALIZED (
 SELECT p.id,CASE WHEN l.owner_user_id IS NULL AND l.owner_workspace_id IS NULL AND l.marketplace_status IS DISTINCT FROM 'hidden' AND EXISTS(SELECT 1 FROM zoi.v_public_listings v WHERE v.id=l.id) AND coalesce(l.profile#>>'{_enrich,scope_review_required}','false')<>'true' AND coalesce(l.profile#>>'{_enrich,organization_identity_quarantine}','false')<>'true' AND l.profile#>>'{_enrich,blocked_reason}' IS DISTINCT FROM 'source_scope_mismatch' THEN zoi.geography_repair_strategy_input(l,j.strategy) ELSE NULL END AS current_input FROM picked p
 JOIN zoi.geography_repair_jobs j ON j.id=p.id JOIN zoi.listings l ON l.id=j.listing_id FOR SHARE OF l
 ),updated AS (
 UPDATE zoi.geography_repair_jobs j SET
 status=CASE WHEN j.input_fingerprint IS DISTINCT FROM c.current_input THEN 'input_changed' ELSE 'leased' END,
 reason=CASE WHEN j.input_fingerprint IS DISTINCT FROM c.current_input THEN 'listing_input_changed_before_capture' ELSE j.reason END,
 lease_id=CASE WHEN j.input_fingerprint IS DISTINCT FROM c.current_input THEN NULL ELSE gen_random_uuid() END,
 lease_expires_at=CASE WHEN j.input_fingerprint IS DISTINCT FROM c.current_input THEN NULL ELSE now()+interval '15 minutes' END,
 attempts=j.attempts+CASE WHEN j.input_fingerprint IS DISTINCT FROM c.current_input THEN 0 ELSE 1 END,updated_at=now()
 FROM checked c WHERE c.id=j.id RETURNING j.*
 ) SELECT * FROM updated WHERE status='leased';
 ELSE
 UPDATE zoi.geography_repair_jobs SET status='unresolved',reason='capture_interrupted_three_times_requires_changed_strategy',lease_id=null,lease_expires_at=null,updated_at=now() WHERE strategy=p_strategy AND status='leased' AND lease_expires_at<now() AND attempts>=3;
 RETURN QUERY WITH picked AS MATERIALIZED (
 SELECT j.id FROM zoi.geography_repair_jobs j WHERE j.strategy=p_strategy
 AND (j.strategy<>'publisher_profiles_v1' OR NOT EXISTS(SELECT 1 FROM zoi.geography_publisher_host_holds h WHERE h.host=zoi.geography_publisher_host(j.original->>'source_url') AND h.blocked_until>now()))
 AND (j.strategy<>'publisher_profiles_v1' OR NOT EXISTS(SELECT 1 FROM zoi.geography_repair_jobs peer WHERE peer.strategy='publisher_profiles_v1' AND peer.status IN('queued','leased') AND peer.id<>j.id AND peer.original->>'source_host'=j.original->>'source_host' AND ((peer.status='leased' AND peer.lease_expires_at>now()) OR (peer.status='queued' AND (peer.created_at,peer.id)<(j.created_at,j.id)))))
 AND j.status IN('queued','leased')
 AND (j.status='queued' OR (j.status='leased' AND j.lease_expires_at<now() AND j.attempts<3))
 ORDER BY j.created_at,j.id LIMIT greatest(least(coalesce(p_limit,10),30),1) FOR UPDATE SKIP LOCKED
 ),checked AS MATERIALIZED (
 SELECT p.id,CASE WHEN l.owner_user_id IS NULL AND l.owner_workspace_id IS NULL AND l.marketplace_status IS DISTINCT FROM 'hidden' AND EXISTS(SELECT 1 FROM zoi.v_public_listings v WHERE v.id=l.id) AND coalesce(l.profile#>>'{_enrich,scope_review_required}','false')<>'true' AND coalesce(l.profile#>>'{_enrich,organization_identity_quarantine}','false')<>'true' AND l.profile#>>'{_enrich,blocked_reason}' IS DISTINCT FROM 'source_scope_mismatch' THEN zoi.geography_repair_strategy_input(l,j.strategy) ELSE NULL END AS current_input FROM picked p
 JOIN zoi.geography_repair_jobs j ON j.id=p.id JOIN zoi.listings l ON l.id=j.listing_id FOR SHARE OF l
 ),updated AS (
 UPDATE zoi.geography_repair_jobs j SET
 status=CASE WHEN j.input_fingerprint IS DISTINCT FROM c.current_input THEN 'input_changed' ELSE 'leased' END,
 reason=CASE WHEN j.input_fingerprint IS DISTINCT FROM c.current_input THEN 'listing_input_changed_before_capture' ELSE j.reason END,
 lease_id=CASE WHEN j.input_fingerprint IS DISTINCT FROM c.current_input THEN NULL ELSE gen_random_uuid() END,
 lease_expires_at=CASE WHEN j.input_fingerprint IS DISTINCT FROM c.current_input THEN NULL ELSE now()+interval '15 minutes' END,
 attempts=j.attempts+CASE WHEN j.input_fingerprint IS DISTINCT FROM c.current_input THEN 0 ELSE 1 END,updated_at=now()
 FROM checked c WHERE c.id=j.id RETURNING j.*
 ) SELECT * FROM updated WHERE status='leased';
 END IF;
END $function$;
COMMIT;

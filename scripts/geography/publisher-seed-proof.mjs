/** Fixed service-only cursor seeding proof. Produces reviewable SQL only;
 * no network, credentials, application writer or customer listing updates. */
export function publisherSeedProofSQL({limit=25,after=null,expectedDefinitionMD5='8c0fecfcdc02faae2ba544ee3a8c4640'}={}){
 if(!/^[a-f0-9]{32}$/.test(expectedDefinitionMD5))throw Error('publisher_seed_definition_required');
 if(!Number.isInteger(limit)||limit<1||limit>1000||after!==null&&!/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(after))throw Error('bounded_publisher_cursor_required');
 const cursor=after===null?'NULL':"'"+after+"'::uuid";
 return `BEGIN;
SET LOCAL statement_timeout='30s';SET LOCAL lock_timeout='3s';
DO $prerequisites$ BEGIN
 IF md5(pg_get_functiondef('public.geography_publisher_enqueue(integer,uuid)'::regprocedure)) IS DISTINCT FROM '${expectedDefinitionMD5}' OR NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.geography_publisher_enqueue(integer,uuid)'::regprocedure AND pg_get_userbyid(p.proowner)='postgres'AND p.proacl::text='{postgres=X/postgres,service_role=X/postgres}') THEN RAISE EXCEPTION 'publisher_seed_definition_changed';END IF;
 IF has_function_privilege('anon','public.geography_publisher_enqueue(integer,uuid)','execute') OR has_function_privilege('authenticated','public.geography_publisher_enqueue(integer,uuid)','execute') OR NOT has_function_privilege('service_role','public.geography_publisher_enqueue(integer,uuid)','execute') THEN RAISE EXCEPTION 'publisher_seed_private_service_required';END IF;
END $prerequisites$;
CREATE TEMP TABLE publisher_seed_scope ON COMMIT DROP AS SELECT l.id FROM zoi.listings l JOIN zoi.v_public_listings e ON e.id=l.id WHERE l.marketplace_status IS DISTINCT FROM 'hidden' AND nullif(btrim(l.website),'') IS NULL AND zoi.geography_publisher_host(l.source_url) IS NOT NULL AND (${cursor} IS NULL OR l.id>${cursor}) ORDER BY l.id LIMIT ${limit};
CREATE TEMP TABLE publisher_seed_before ON COMMIT DROP AS SELECT j.id,md5(to_jsonb(j)::text) AS fingerprint FROM zoi.geography_repair_jobs j JOIN publisher_seed_scope s ON s.id=j.listing_id;
CREATE TEMP TABLE publisher_seed_listing_before ON COMMIT DROP AS SELECT l.id,zoi.geography_fingerprint(l) AS fingerprint FROM zoi.listings l JOIN publisher_seed_scope s ON s.id=l.id;
CREATE TEMP TABLE publisher_seed_result(value jsonb) ON COMMIT DROP;
INSERT INTO publisher_seed_result SELECT public.geography_publisher_enqueue(${limit},${cursor});
DO $proof$ DECLARE first jsonb;again jsonb;BEGIN
 SELECT value INTO first FROM publisher_seed_result;
 again:=public.geography_publisher_enqueue(${limit},${cursor});
 IF (first->>'processed')::integer>${limit} OR (again->>'new_jobs')::integer<>0 OR first->'last_id' IS DISTINCT FROM again->'last_id' OR first->'done' IS DISTINCT FROM again->'done' THEN RAISE EXCEPTION 'publisher_seed_cursor_or_replay_invalid';END IF;
 IF (SELECT count(*)FROM zoi.geography_repair_jobs j JOIN publisher_seed_scope s ON s.id=j.listing_id WHERE NOT EXISTS(SELECT 1 FROM publisher_seed_before b WHERE b.id=j.id)) IS DISTINCT FROM (first->>'new_jobs')::bigint THEN RAISE EXCEPTION 'publisher_seed_scoped_insert_count_changed';END IF;
 IF EXISTS(SELECT 1 FROM publisher_seed_before b LEFT JOIN zoi.geography_repair_jobs j ON j.id=b.id WHERE j.id IS NULL OR md5(to_jsonb(j)::text) IS DISTINCT FROM b.fingerprint) THEN RAISE EXCEPTION 'publisher_seed_existing_jobs_changed';END IF;
 IF EXISTS(SELECT 1 FROM publisher_seed_listing_before b JOIN zoi.listings l ON l.id=b.id WHERE zoi.geography_fingerprint(l) IS DISTINCT FROM b.fingerprint) THEN RAISE EXCEPTION 'publisher_seed_listing_changed';END IF;
 IF EXISTS(SELECT 1 FROM zoi.geography_repair_jobs j JOIN publisher_seed_scope s ON s.id=j.listing_id WHERE NOT EXISTS(SELECT 1 FROM publisher_seed_before b WHERE b.id=j.id) AND (j.strategy<>'publisher_profiles_v1' OR j.captured_at IS NOT NULL OR j.reviewed_at IS NOT NULL OR j.applied_at IS NOT NULL OR j.application_result IS NOT NULL OR j.lease_id IS NOT NULL OR j.attempts<>0 OR j.status NOT IN('queued','source_blocked','owner_action') OR j.original->>'source_kind' IS DISTINCT FROM 'supporting_publisher_profile' OR nullif(j.original->>'source_url','') IS NULL)) THEN RAISE EXCEPTION 'publisher_seed_source_only_boundary_invalid';END IF;
END $proof$;
SELECT value||jsonb_build_object('rollback_only',true,'coordinate_writes',0,'website_writes',0,'listing_writes',0) AS bounded_publisher_seed_proof FROM publisher_seed_result;
ROLLBACK;`;
}

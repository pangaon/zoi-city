BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
-- Supporting publisher evidence is an additional task, never an official website or pin approval.
CREATE FUNCTION zoi.geography_publisher_host(p_url text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN length(p_url)<=2000 AND p_url~*'^https?://[a-z0-9.-]+([/?#]|$)' THEN regexp_replace(lower(substring(p_url from '(?i)^https?://([^/?#]+)')),'^www\.','') ELSE NULL END
$$;
CREATE FUNCTION zoi.geography_publisher_document_key(p_url text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN zoi.geography_publisher_host(p_url) IS NOT NULL THEN zoi.geography_publisher_host(p_url)||regexp_replace(regexp_replace(p_url,'(?i)^https?://[^/?#]+',''),'/($|[?#])','\1') ELSE NULL END
$$;
CREATE FUNCTION zoi.geography_publisher_held(l zoi.listings) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(l.profile#>>'{_enrich,blocked_reason}'='source_scope_mismatch',false)
 OR coalesce(l.profile#>>'{_enrich,scope_review_required}'='true',false)
 OR coalesce(l.profile#>>'{_enrich,organization_identity_quarantine}'='true',false)
$$;
CREATE FUNCTION zoi.geography_repair_strategy_input(l zoi.listings,p_strategy text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN p_strategy='publisher_profiles_v1' THEN md5(jsonb_build_object('base',zoi.geography_repair_input(l),'blocked_reason',l.profile#>'{_enrich,blocked_reason}','scope_review_required',l.profile#>'{_enrich,scope_review_required}','organization_identity_quarantine',l.profile#>'{_enrich,organization_identity_quarantine}')::text) ELSE zoi.geography_repair_input(l) END
$$;
CREATE TABLE zoi.geography_publisher_host_holds(
 host text PRIMARY KEY CHECK(length(host) BETWEEN 3 AND 253 AND host~'^[a-z0-9.-]+$'),
 blocked_until timestamptz NOT NULL, reason text NOT NULL CHECK(reason IN('source_challenge','robots_disallow')),
 observed_job uuid NOT NULL REFERENCES zoi.geography_repair_jobs(id),observed_sha256 text NOT NULL CHECK(observed_sha256~'^[a-f0-9]{64}$'),
 actual_observations integer NOT NULL DEFAULT 1 CHECK(actual_observations>0),updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE zoi.geography_publisher_host_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.geography_publisher_host_holds FROM PUBLIC,anon,authenticated;
GRANT SELECT ON zoi.geography_publisher_host_holds TO service_role;
CREATE TABLE zoi.geography_publisher_host_observations(job_id uuid PRIMARY KEY REFERENCES zoi.geography_repair_jobs(id),host text NOT NULL,sha256 text NOT NULL CHECK(sha256~'^[a-f0-9]{64}$'),observed_at timestamptz NOT NULL);
ALTER TABLE zoi.geography_publisher_host_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.geography_publisher_host_observations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON zoi.geography_publisher_host_observations TO service_role;
CREATE INDEX geography_publisher_pending_host_idx ON zoi.geography_repair_jobs((original->>'source_host'),created_at,id) WHERE strategy='publisher_profiles_v1' AND status IN('queued','leased');
CREATE FUNCTION zoi.geography_publisher_job_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l zoi.listings;BEGIN
 IF TG_OP='UPDATE' AND OLD.strategy='publisher_profiles_v1' AND NEW.strategy IS DISTINCT FROM OLD.strategy THEN RAISE EXCEPTION 'publisher_strategy_immutable';END IF;
 IF NEW.strategy<>'publisher_profiles_v1' THEN RETURN NEW;END IF;
 IF NEW.status IN('reviewed','applied','needs_coordinate_review') OR NEW.application_result IS NOT NULL OR NEW.applied_at IS NOT NULL
 THEN RAISE EXCEPTION 'publisher_source_cannot_approve_or_apply_geography';END IF;
 IF NEW.precision IS NOT NULL AND NEW.precision<>'unknown' THEN RAISE EXCEPTION 'publisher_source_precision_must_remain_unknown';END IF;
 IF NEW.proposed IS NOT NULL AND NEW.proposed<>'null'::jsonb AND
 (jsonb_typeof(NEW.proposed)<>'object' OR NEW.proposed->>'kind' IS DISTINCT FROM 'supporting_source_proposal'
 OR NEW.proposed->'official_website_confirmed' IS DISTINCT FROM 'false'::jsonb
 OR NEW.proposed->'client_ownership_verified' IS DISTINCT FROM 'false'::jsonb
 OR NEW.proposed->'independent_review_required' IS DISTINCT FROM 'true'::jsonb
 OR jsonb_path_exists(NEW.proposed,'$.**.lat') OR jsonb_path_exists(NEW.proposed,'$.**.lng') OR jsonb_path_exists(NEW.proposed,'$.**.lon')
 OR jsonb_path_exists(NEW.proposed,'$.**.latitude') OR jsonb_path_exists(NEW.proposed,'$.**.longitude')
 OR jsonb_path_exists(NEW.proposed,'$.**.coordinates') OR jsonb_path_exists(NEW.proposed,'$.**.candidate')
 OR jsonb_path_exists(NEW.proposed,'$.**.official_website_confirmed ? (@ != false)'))
 THEN RAISE EXCEPTION 'publisher_proposal_supporting_source_only';END IF;
 IF NEW.source IS NOT NULL AND NEW.source<>'null'::jsonb AND
 (jsonb_typeof(NEW.source)<>'object' OR NEW.source->>'kind' IS DISTINCT FROM 'supporting_publisher_profile'
 OR NEW.source->'official_website_confirmed' IS DISTINCT FROM 'false'::jsonb
 OR NEW.source->'client_ownership_verified' IS DISTINCT FROM 'false'::jsonb
 OR NEW.source->>'registered_source_url' IS DISTINCT FROM NEW.original->>'source_url'
 OR zoi.geography_publisher_document_key(NEW.source->>'url') IS NULL
 OR zoi.geography_publisher_document_key(NEW.source->>'url') IS DISTINCT FROM zoi.geography_publisher_document_key(NEW.original->>'source_url')
 OR NEW.source->>'url'!~'^https://'
 OR jsonb_path_exists(NEW.source,'$.**.lat') OR jsonb_path_exists(NEW.source,'$.**.lng') OR jsonb_path_exists(NEW.source,'$.**.lon')
 OR jsonb_path_exists(NEW.source,'$.**.latitude') OR jsonb_path_exists(NEW.source,'$.**.longitude')
 OR coalesce(NEW.source->>'sha256','')!~'^[a-f0-9]{64}$')
 THEN RAISE EXCEPTION 'publisher_source_authority_required';END IF;
 IF TG_OP='INSERT' OR NEW.status='leased' THEN
 SELECT * INTO l FROM zoi.listings WHERE id=NEW.listing_id FOR SHARE;
 IF NEW.input_fingerprint IS DISTINCT FROM zoi.geography_repair_strategy_input(l,NEW.strategy)
 OR NEW.original->>'source_url' IS DISTINCT FROM l.source_url
 OR NEW.original->>'source_kind' IS DISTINCT FROM 'supporting_publisher_profile'
 THEN RAISE EXCEPTION 'publisher_current_source_input_required';END IF;
 IF NEW.status='leased' AND (l.owner_user_id IS NOT NULL OR l.owner_workspace_id IS NOT NULL OR zoi.geography_publisher_held(l)
 OR EXISTS(SELECT 1 FROM zoi.geography_publisher_host_holds h WHERE h.host=zoi.geography_publisher_host(l.source_url) AND h.blocked_until>now()))
 THEN RAISE EXCEPTION 'publisher_source_access_or_owner_hold';END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER geography_publisher_job_guard BEFORE INSERT OR UPDATE ON zoi.geography_repair_jobs FOR EACH ROW EXECUTE FUNCTION zoi.geography_publisher_job_guard();
CREATE FUNCTION public.geography_publisher_enqueue(p_limit integer DEFAULT 1000,p_after uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l zoi.listings;input_hash text;added integer:=0;processed integer:=0;affected integer;last_id uuid:=p_after;n integer:=greatest(least(coalesce(p_limit,1000),1000),1);BEGIN
 FOR l IN SELECT catalogue_row.* FROM zoi.v_public_listings e JOIN zoi.listings catalogue_row ON catalogue_row.id=e.id
 WHERE catalogue_row.marketplace_status IS DISTINCT FROM 'hidden' AND nullif(btrim(catalogue_row.website),'') IS NULL
 AND zoi.geography_publisher_host(catalogue_row.source_url) IS NOT NULL AND (p_after IS NULL OR e.id>p_after)
 ORDER BY e.id LIMIT n LOOP
 input_hash:=zoi.geography_repair_strategy_input(l,'publisher_profiles_v1');
 INSERT INTO zoi.geography_repair_jobs(listing_id,strategy,input_fingerprint,database_snapshot,idempotency_key,status,original,reason)
 VALUES(l.id,'publisher_profiles_v1',input_hash,zoi.geography_fingerprint(l),md5(l.id::text||'|publisher_profiles_v1|'||input_hash),
 CASE WHEN l.owner_user_id IS NOT NULL OR l.owner_workspace_id IS NOT NULL THEN 'owner_action' WHEN zoi.geography_publisher_held(l) THEN 'source_blocked' ELSE 'queued' END,
 jsonb_build_object('name',l.name,'slug',l.slug,'entity_type',l.entity_type,'address',l.address,'city',l.city,'country',l.country,'website',l.website,'source_url',l.source_url,'source_kind','supporting_publisher_profile','source_host',zoi.geography_publisher_host(l.source_url),'profile',jsonb_build_object('_enrich',jsonb_build_object('blocked_reason',l.profile#>'{_enrich,blocked_reason}','scope_review_required',l.profile#>'{_enrich,scope_review_required}','organization_identity_quarantine',l.profile#>'{_enrich,organization_identity_quarantine}'))),
 CASE WHEN l.owner_user_id IS NOT NULL OR l.owner_workspace_id IS NOT NULL THEN 'preserve_owner_source' WHEN zoi.geography_publisher_held(l) THEN 'source_hold_preserved' ELSE 'individual_supporting_publisher_source_requires_research' END)
 ON CONFLICT(listing_id,strategy,input_fingerprint) DO NOTHING;
 GET DIAGNOSTICS affected=ROW_COUNT;added:=added+affected;processed:=processed+1;last_id:=l.id;
 END LOOP;
 RETURN jsonb_build_object('strategy','publisher_profiles_v1','new_jobs',added,'processed',processed,'last_id',last_id,'done',processed<n,'coordinate_writes',0,'website_writes',0,'additional_tasks_not_additional_catalogue_records',true);
END $$;
-- Cooldown requires one actual finished challenge/robots result and its immutable source hash.
CREATE FUNCTION public.geography_publisher_host_cooldown(p_job uuid,p_sha256 text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j zoi.geography_repair_jobs;source_host text;until_time timestamptz;BEGIN
 SELECT * INTO j FROM zoi.geography_repair_jobs WHERE id=p_job FOR SHARE;
 source_host:=zoi.geography_publisher_host(j.original->>'source_url');
 IF j.id IS NULL OR j.strategy<>'publisher_profiles_v1' OR j.status<>'source_blocked' OR j.captured_at IS NULL
 OR j.reason NOT IN('source_challenge','robots_disallow') OR source_host IS NULL
 OR j.source->>'sha256' IS DISTINCT FROM p_sha256 OR p_sha256!~'^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'actual_publisher_host_observation_required';END IF;
 INSERT INTO zoi.geography_publisher_host_observations(job_id,host,sha256,observed_at) VALUES(j.id,source_host,p_sha256,j.captured_at) ON CONFLICT(job_id) DO NOTHING;
 INSERT INTO zoi.geography_publisher_host_holds(host,blocked_until,reason,observed_job,observed_sha256)
 VALUES(source_host,j.captured_at+interval '24 hours',j.reason,j.id,p_sha256)
 ON CONFLICT(host) DO UPDATE SET blocked_until=greatest(zoi.geography_publisher_host_holds.blocked_until,excluded.blocked_until),reason=excluded.reason,
 actual_observations=(SELECT count(*) FROM zoi.geography_publisher_host_observations o WHERE o.host=source_host),
 observed_job=excluded.observed_job,observed_sha256=excluded.observed_sha256,updated_at=now()
 RETURNING blocked_until INTO until_time;
 RETURN jsonb_build_object('host',source_host,'blocked_until',until_time,'remaining_records_still_pending_access',true,'coordinate_writes',0);
END $$;
CREATE FUNCTION public.geography_publisher_review(p_job uuid,p_review jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j zoi.geography_repair_jobs;l zoi.listings;BEGIN
 SELECT * INTO j FROM zoi.geography_repair_jobs WHERE id=p_job FOR UPDATE;
 SELECT * INTO l FROM zoi.listings WHERE id=j.listing_id FOR SHARE;
 IF j.id IS NULL OR j.strategy<>'publisher_profiles_v1' OR j.status NOT IN('needs_identity_review','needs_address_review')
 OR j.input_fingerprint IS DISTINCT FROM zoi.geography_repair_strategy_input(l,j.strategy)
 OR l.owner_user_id IS NOT NULL OR l.owner_workspace_id IS NOT NULL OR zoi.geography_publisher_held(l)
 OR jsonb_typeof(j.proposed) IS DISTINCT FROM 'object' OR jsonb_typeof(j.source) IS DISTINCT FROM 'object'
 OR jsonb_typeof(p_review) IS DISTINCT FROM 'object' OR octet_length(p_review::text)>50000
 OR nullif(btrim(p_review->>'reviewer'),'') IS NULL OR nullif(btrim(p_review->>'specialist'),'') IS NULL
 OR lower(btrim(p_review->>'reviewer'))=lower(btrim(p_review->>'specialist'))
 OR p_review->>'input_fingerprint' IS DISTINCT FROM j.input_fingerprint OR p_review->>'proposed_hash' IS DISTINCT FROM md5(j.proposed::text)
 OR p_review->>'source_hash' IS DISTINCT FROM md5(j.source::text)
 OR p_review->'exact_client_card_confirmed' IS DISTINCT FROM 'true'::jsonb
 OR p_review->'official_website_confirmed' IS DISTINCT FROM 'false'::jsonb OR p_review->'coordinate_approval' IS DISTINCT FROM 'false'::jsonb
 THEN RAISE EXCEPTION 'independent_supporting_source_review_required';END IF;
 UPDATE zoi.geography_repair_jobs SET review_result=p_review,reviewed_at=now(),updated_at=now(),reason='supporting_source_review_recorded_no_factual_write' WHERE id=j.id;
 RETURN jsonb_build_object('status',j.status,'supporting_source_reviewed',true,'official_website_confirmed',false,'coordinate_writes',0,'website_writes',0);
END $$;
REVOKE ALL ON FUNCTION zoi.geography_publisher_document_key(text),zoi.geography_publisher_host(text),zoi.geography_publisher_held(zoi.listings),zoi.geography_repair_strategy_input(zoi.listings,text),zoi.geography_publisher_job_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.geography_publisher_enqueue(integer,uuid),public.geography_publisher_host_cooldown(uuid,text),public.geography_publisher_review(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.geography_publisher_enqueue(integer,uuid),public.geography_publisher_host_cooldown(uuid,text),public.geography_publisher_review(uuid,jsonb) TO service_role;

DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.geography_repair_lease(integer,text)'::regprocedure AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text='{postgres=X/postgres,service_role=X/postgres}') THEN RAISE EXCEPTION 'publisher_existing_function_acl_changed';END IF; IF md5(pg_get_functiondef('public.geography_repair_lease(integer,text)'::regprocedure)) IS DISTINCT FROM '27b9efe2d8dfd244257a74c32a71bc6a' THEN RAISE EXCEPTION 'publisher_existing_function_changed';END IF;END $guard$;
CREATE OR REPLACE FUNCTION public.geography_repair_lease(p_limit integer DEFAULT 10, p_strategy text DEFAULT 'official_sources_v1'::text)
 RETURNS SETOF zoi.geography_repair_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 UPDATE zoi.geography_repair_jobs SET status='unresolved',reason='capture_interrupted_three_times_requires_changed_strategy',lease_id=null,lease_expires_at=null,updated_at=now() WHERE strategy=p_strategy AND status='leased' AND lease_expires_at<now() AND attempts>=3;
 RETURN QUERY WITH picked AS MATERIALIZED (
 SELECT j.id FROM zoi.geography_repair_jobs j WHERE j.strategy=p_strategy
 AND (j.strategy<>'publisher_profiles_v1' OR NOT EXISTS(SELECT 1 FROM zoi.geography_publisher_host_holds h WHERE h.host=zoi.geography_publisher_host(j.original->>'source_url') AND h.blocked_until>now()))
 AND (j.strategy<>'publisher_profiles_v1' OR NOT EXISTS(SELECT 1 FROM zoi.geography_repair_jobs peer WHERE peer.strategy='publisher_profiles_v1' AND peer.status IN('queued','leased') AND peer.id<>j.id AND peer.original->>'source_host'=j.original->>'source_host' AND ((peer.status='leased' AND peer.lease_expires_at>now()) OR (peer.status='queued' AND (peer.created_at,peer.id)<(j.created_at,j.id)))))
 AND (j.status='queued' OR (j.status='leased' AND j.lease_expires_at<now() AND j.attempts<3))
 ORDER BY j.created_at,j.id LIMIT greatest(least(coalesce(p_limit,10),30),1) FOR UPDATE SKIP LOCKED
 ),checked AS MATERIALIZED (
 SELECT p.id,zoi.geography_repair_strategy_input(l,j.strategy) AS current_input FROM picked p
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
END $function$
;

DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.geography_repair_finish(uuid,uuid,jsonb)'::regprocedure AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text='{postgres=X/postgres,service_role=X/postgres}') THEN RAISE EXCEPTION 'publisher_existing_function_acl_changed';END IF; IF md5(pg_get_functiondef('public.geography_repair_finish(uuid,uuid,jsonb)'::regprocedure)) IS DISTINCT FROM '254aee4135015269672ef6e57e0a4c15' THEN RAISE EXCEPTION 'publisher_existing_function_changed';END IF;END $guard$;
CREATE OR REPLACE FUNCTION public.geography_repair_finish(p_job uuid, p_lease uuid, p_result jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE j zoi.geography_repair_jobs;l zoi.listings;next_status text;BEGIN
 SELECT * INTO j FROM zoi.geography_repair_jobs WHERE id=p_job FOR UPDATE;
 IF j.id IS NOT NULL AND j.completed_lease_id=p_lease AND j.capture_result_hash=md5(p_result::text) THEN RETURN jsonb_build_object('status',j.status,'coordinate_writes',0,'replayed',true);END IF;
 IF j.id IS NULL OR j.lease_id IS DISTINCT FROM p_lease OR j.status<>'leased' OR j.lease_expires_at<now() THEN RAISE EXCEPTION 'geography_lease_unavailable';END IF;
 SELECT * INTO l FROM zoi.listings WHERE id=j.listing_id FOR SHARE;
 IF j.input_fingerprint IS DISTINCT FROM zoi.geography_repair_strategy_input(l,j.strategy) THEN
 UPDATE zoi.geography_repair_jobs SET status='input_changed',reason='listing_changed_during_capture',completed_lease_id=p_lease,capture_result_hash=md5(p_result::text),lease_id=null,lease_expires_at=null,updated_at=now() WHERE id=j.id;
 RETURN jsonb_build_object('status','input_changed','coordinate_writes',0);END IF;
 next_status=p_result->>'status';
 IF jsonb_typeof(p_result) IS DISTINCT FROM 'object' OR octet_length(p_result::text)>100000
 OR next_status IS NULL OR next_status NOT IN('source_blocked','needs_identity_review','needs_address_review','needs_coordinate_review','unresolved')
 OR nullif(btrim(p_result->>'reason'),'') IS NULL THEN RAISE EXCEPTION 'invalid_geography_capture_result';END IF;
 UPDATE zoi.geography_repair_jobs SET status=next_status,reason=left(p_result->>'reason',500),proposed=p_result->'proposed',source=p_result->'source',precision=left(p_result->>'precision',80),confidence=left(p_result->>'confidence',80),captured_at=now(),updated_at=now(),completed_lease_id=p_lease,capture_result_hash=md5(p_result::text),lease_id=null,lease_expires_at=null,database_snapshot=zoi.geography_fingerprint(l) WHERE id=j.id;
 RETURN jsonb_build_object('status',next_status,'coordinate_writes',0);
END $function$
;

DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.geography_repair_review(uuid,jsonb)'::regprocedure AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text='{postgres=X/postgres,service_role=X/postgres}') THEN RAISE EXCEPTION 'publisher_existing_function_acl_changed';END IF; IF md5(pg_get_functiondef('public.geography_repair_review(uuid,jsonb)'::regprocedure)) IS DISTINCT FROM 'fef6f1adf28ed3802665d7e0aeecc1f3' THEN RAISE EXCEPTION 'publisher_existing_function_changed';END IF;END $guard$;
CREATE OR REPLACE FUNCTION public.geography_repair_review(p_job uuid, p_review jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE j zoi.geography_repair_jobs;l zoi.listings;BEGIN
 SELECT * INTO j FROM zoi.geography_repair_jobs WHERE id=p_job FOR UPDATE;
 SELECT * INTO l FROM zoi.listings WHERE id=j.listing_id FOR SHARE;
 IF j.id IS NULL OR j.status NOT IN ('needs_identity_review','needs_address_review','needs_coordinate_review','reviewed')
 OR j.input_fingerprint IS DISTINCT FROM zoi.geography_repair_strategy_input(l,j.strategy)
 OR jsonb_typeof(j.proposed) IS DISTINCT FROM 'object' OR jsonb_typeof(j.source) IS DISTINCT FROM 'object'
 OR jsonb_typeof(p_review) IS DISTINCT FROM 'object' OR octet_length(p_review::text)>50000
 OR nullif(btrim(p_review->>'reviewer'),'') IS NULL OR nullif(btrim(p_review->>'specialist'),'') IS NULL
 OR lower(btrim(p_review->>'reviewer'))=lower(btrim(p_review->>'specialist'))
 OR p_review->>'input_fingerprint' IS DISTINCT FROM j.input_fingerprint
 OR p_review->>'proposed_hash' IS DISTINCT FROM md5(j.proposed::text)
 OR p_review->>'source_hash' IS DISTINCT FROM md5(j.source::text)
 OR p_review->'official_source_confirmed' IS DISTINCT FROM 'true'::jsonb
 OR p_review->'exact_identity_confirmed' IS DISTINCT FROM 'true'::jsonb
 OR p_review->'exact_address_confirmed' IS DISTINCT FROM 'true'::jsonb
 THEN RAISE EXCEPTION 'independent_current_geography_review_required';END IF;
 UPDATE zoi.geography_repair_jobs SET status='reviewed',review_result=p_review,reviewed_at=now(),updated_at=now(),reason='independent_review_recorded_existing_writer_still_required' WHERE id=j.id;
 RETURN jsonb_build_object('status','reviewed','coordinate_writes',0);
END $function$
;
CREATE FUNCTION public.geography_publisher_lease(p_limit integer DEFAULT 8) RETURNS SETOF zoi.geography_repair_jobs LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT * FROM public.geography_repair_lease(greatest(least(coalesce(p_limit,8),8),1),'publisher_profiles_v1')
$$;
REVOKE ALL ON FUNCTION public.geography_publisher_lease(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.geography_publisher_lease(integer) TO service_role;
COMMIT;

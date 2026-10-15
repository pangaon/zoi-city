BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
-- Source generations supplement, never change, the established official hash.
-- New tasks retain historical terminal rows, including failed captured attempts.
ALTER TABLE zoi.geography_repair_jobs ADD COLUMN source_generation bigint NOT NULL DEFAULT 0 CHECK(source_generation>=0),ADD COLUMN source_authority_fingerprint text NOT NULL DEFAULT '' CHECK(source_authority_fingerprint='' OR source_authority_fingerprint~'^[a-f0-9]{32}$');
DO $unique$ DECLARE old_name text;BEGIN
 SELECT conname INTO STRICT old_name FROM pg_constraint WHERE conrelid='zoi.geography_repair_jobs'::regclass AND contype='u'AND pg_get_constraintdef(oid)='UNIQUE (listing_id, strategy, input_fingerprint)';
 EXECUTE format('ALTER TABLE zoi.geography_repair_jobs DROP CONSTRAINT %I',old_name);
END $unique$;
ALTER TABLE zoi.geography_repair_jobs ADD CONSTRAINT geography_repair_generation_unique UNIQUE(listing_id,strategy,input_fingerprint,source_generation);
CREATE INDEX geography_repair_listing_generation_idx ON zoi.geography_repair_jobs(listing_id,source_generation DESC,id);
CREATE FUNCTION zoi.geography_source_authority_input(l zoi.listings) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT md5(jsonb_build_object('source_scope_mismatch',coalesce(l.profile#>>'{_enrich,blocked_reason}'='source_scope_mismatch',false),'scope_review_required',coalesce(l.profile#>>'{_enrich,scope_review_required}'='true',false),'organization_identity_quarantine',coalesce(l.profile#>>'{_enrich,organization_identity_quarantine}'='true',false))::text)
$$;
CREATE FUNCTION zoi.geography_source_generation(p_listing uuid) RETURNS bigint LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce((SELECT source_generation FROM zoi.geography_repair_jobs WHERE listing_id=p_listing ORDER BY source_generation DESC,id LIMIT 1),0)
$$;
CREATE FUNCTION zoi.geography_source_eligible(l zoi.listings) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT l.owner_user_id IS NULL AND l.owner_workspace_id IS NULL AND l.marketplace_status IS DISTINCT FROM 'hidden' AND EXISTS(SELECT 1 FROM zoi.v_public_listings e WHERE e.id=l.id)
$$;
CREATE FUNCTION zoi.geography_source_job_current(j zoi.geography_repair_jobs,l zoi.listings) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT j.input_fingerprint=zoi.geography_repair_strategy_input(l,j.strategy)
 AND j.source_generation=zoi.geography_source_generation(l.id)
 AND(j.source_authority_fingerprint=''OR j.source_authority_fingerprint=zoi.geography_source_authority_input(l))
 AND zoi.geography_source_eligible(l) AND NOT zoi.geography_publisher_held(l)
 AND public.geography_reviewed_point(l.id) IS NULL
$$;
CREATE FUNCTION zoi.geography_source_enqueue_one(l zoi.listings,p_strategy text,p_generation bigint) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE input_hash text;affected integer;authority_hash text;state text;why text;BEGIN
 IF p_strategy NOT IN('official_sources_v1','publisher_profiles_v1')OR p_generation<0 THEN RAISE EXCEPTION 'invalid_continuous_source_strategy';END IF;
 IF NOT zoi.geography_source_eligible(l) THEN RETURN 0;END IF;
 -- The deferred listing hook runs after the guarded writer's receipt insert.
 -- A fresh accepted street point is resolved, not another crawl opportunity.
 IF public.geography_reviewed_point(l.id) IS NOT NULL THEN RETURN 0;END IF;
 IF p_strategy='publisher_profiles_v1'AND(nullif(btrim(l.website),'')IS NOT NULL OR zoi.geography_publisher_host(l.source_url)IS NULL) THEN RETURN 0;END IF;
 input_hash:=zoi.geography_repair_strategy_input(l,p_strategy);authority_hash:=zoi.geography_source_authority_input(l);
 -- Do not lock or rewrite existing jobs while a listing write holds its row.
 -- This avoids reversing the worker's job->listing lock order.
 IF EXISTS(SELECT 1 FROM zoi.geography_repair_jobs j WHERE j.listing_id=l.id AND j.strategy=p_strategy AND j.input_fingerprint=input_hash AND j.source_generation=p_generation) THEN RETURN 0;END IF;
 state:=CASE WHEN zoi.geography_publisher_held(l) THEN 'source_blocked' WHEN p_strategy='publisher_profiles_v1' THEN 'queued' WHEN nullif(btrim(l.address),'')IS NULL THEN 'needs_address' WHEN l.website IS NULL OR l.website!~'^https://' THEN 'needs_source' ELSE 'queued' END;
 why:=CASE WHEN zoi.geography_publisher_held(l) THEN 'source_hold_preserved' WHEN p_strategy='publisher_profiles_v1' THEN 'individual_supporting_publisher_source_requires_research' WHEN state='needs_address' THEN 'public_address_requires_research' WHEN state='needs_source' THEN 'official_source_requires_identification' ELSE 'registered_source_requires_identity_address_coordinate_research' END;
 INSERT INTO zoi.geography_repair_jobs(listing_id,strategy,input_fingerprint,database_snapshot,idempotency_key,status,original,reason,source_generation,source_authority_fingerprint)
 VALUES(l.id,p_strategy,input_hash,zoi.geography_fingerprint(l),md5(l.id::text||'|'||p_strategy||'|'||input_hash||'|generation:'||p_generation::text),state,
 jsonb_build_object('name',l.name,'slug',l.slug,'entity_type',l.entity_type,'address',l.address,'city',l.city,'country',l.country,'website',l.website,'source_url',l.source_url,'source_kind',CASE WHEN p_strategy='publisher_profiles_v1' THEN 'supporting_publisher_profile' ELSE 'official_website' END,'source_host',zoi.geography_publisher_host(l.source_url),'latitude',l.latitude,'longitude',l.longitude,'precision',l.geo_precision,'metadata',l.profile->'_geo','profile',jsonb_build_object('_enrich',jsonb_build_object('blocked_reason',l.profile#>'{_enrich,blocked_reason}','scope_review_required',l.profile#>'{_enrich,scope_review_required}','organization_identity_quarantine',l.profile#>'{_enrich,organization_identity_quarantine}'))),why,p_generation,authority_hash)
 ON CONFLICT(listing_id,strategy,input_fingerprint,source_generation) DO NOTHING;
 GET DIAGNOSTICS affected=ROW_COUNT;RETURN affected;
END $$;
CREATE FUNCTION zoi.geography_source_listing_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l zoi.listings;generation bigint;previous zoi.geography_repair_jobs;became_unowned_public boolean:=false;current_hash text;authority_hash text;BEGIN
 -- Deferred events must use the final row, not an intermediate NEW snapshot.
 SELECT * INTO l FROM zoi.listings WHERE id=NEW.id;
 IF l.id IS NULL OR NOT zoi.geography_source_eligible(l) OR public.geography_reviewed_point(l.id) IS NOT NULL THEN RETURN NULL;END IF;
 IF TG_OP='UPDATE' THEN became_unowned_public:=OLD.owner_user_id IS NOT NULL OR OLD.owner_workspace_id IS NOT NULL OR OLD.publish_status IS DISTINCT FROM 'published' OR (OLD.moderation_status IS DISTINCT FROM 'clean' AND OLD.moderation_status IS DISTINCT FROM 'cleared') OR OLD.marketplace_status='hidden';END IF;
 current_hash:=zoi.geography_repair_input(l);authority_hash:=zoi.geography_source_authority_input(l);generation:=zoi.geography_source_generation(l.id);
 SELECT * INTO previous FROM zoi.geography_repair_jobs WHERE listing_id=l.id AND strategy='official_sources_v1'AND source_generation=generation ORDER BY created_at DESC,id DESC LIMIT 1;
 IF NOT coalesce(became_unowned_public,false) AND previous.id IS NOT NULL AND previous.input_fingerprint=current_hash AND(previous.source_authority_fingerprint=authority_hash OR(previous.source_authority_fingerprint=''AND(TG_OP='INSERT'OR zoi.geography_source_authority_input(OLD)=authority_hash)))THEN
  -- Same final input/generation: terminal history does not cause endless retries.
  -- Still add a missing supporting lane idempotently when appropriate.
  PERFORM zoi.geography_source_enqueue_one(l,'publisher_profiles_v1',generation);RETURN NULL;
 END IF;
 generation:=generation+1;
 PERFORM zoi.geography_source_enqueue_one(l,'official_sources_v1',generation);
 PERFORM zoi.geography_source_enqueue_one(l,'publisher_profiles_v1',generation);
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER geography_source_listing_insert AFTER INSERT ON zoi.listings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION zoi.geography_source_listing_changed();
CREATE CONSTRAINT TRIGGER geography_source_listing_update AFTER UPDATE ON zoi.listings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 WHEN((OLD.name,OLD.entity_type,OLD.address,OLD.city,OLD.country,OLD.website,OLD.source_url,OLD.latitude,OLD.longitude,OLD.geo_precision,OLD.owner_user_id,OLD.owner_workspace_id,OLD.publish_status,OLD.moderation_status,OLD.marketplace_status,OLD.duplicate_status)IS DISTINCT FROM(NEW.name,NEW.entity_type,NEW.address,NEW.city,NEW.country,NEW.website,NEW.source_url,NEW.latitude,NEW.longitude,NEW.geo_precision,NEW.owner_user_id,NEW.owner_workspace_id,NEW.publish_status,NEW.moderation_status,NEW.marketplace_status,NEW.duplicate_status)
 OR OLD.profile->'_geo'IS DISTINCT FROM NEW.profile->'_geo'
 OR OLD.profile#>'{_enrich,blocked_reason}'IS DISTINCT FROM NEW.profile#>'{_enrich,blocked_reason}'
 OR OLD.profile#>'{_enrich,scope_review_required}'IS DISTINCT FROM NEW.profile#>'{_enrich,scope_review_required}'
 OR OLD.profile#>'{_enrich,organization_identity_quarantine}'IS DISTINCT FROM NEW.profile#>'{_enrich,organization_identity_quarantine}')
 EXECUTE FUNCTION zoi.geography_source_listing_changed();
REVOKE ALL ON FUNCTION zoi.geography_source_authority_input(zoi.listings),zoi.geography_source_generation(uuid),zoi.geography_source_eligible(zoi.listings),zoi.geography_source_job_current(zoi.geography_repair_jobs,zoi.listings),zoi.geography_source_enqueue_one(zoi.listings,text,bigint),zoi.geography_source_listing_changed() FROM PUBLIC,anon,authenticated;

DO $guard$ BEGIN IF md5(pg_get_functiondef('public.geography_repair_enqueue(text,integer,uuid)'::regprocedure)) IS DISTINCT FROM '91398af174968e4ffa52ea80cb76bf10' THEN RAISE EXCEPTION 'continuous_source_existing_function_changed';END IF;IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.geography_repair_enqueue(text,integer,uuid)'::regprocedure AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text='{postgres=X/postgres,service_role=X/postgres}') THEN RAISE EXCEPTION 'continuous_source_existing_acl_changed';END IF;END $guard$;
CREATE OR REPLACE FUNCTION public.geography_repair_enqueue(p_strategy text DEFAULT 'official_sources_v1'::text, p_limit integer DEFAULT 1000, p_after uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE added integer:=0;processed integer:=0;last_id uuid:=p_after;l zoi.listings;input_hash text;affected integer;generation bigint;n integer:=greatest(least(coalesce(p_limit,1000),1000),1);BEGIN
 IF p_strategy IS DISTINCT FROM 'official_sources_v1' THEN RAISE EXCEPTION 'official_source_strategy_required';END IF;
 FOR l IN SELECT catalogue_row.* FROM zoi.v_public_listings e JOIN zoi.listings catalogue_row ON catalogue_row.id=e.id
 WHERE catalogue_row.marketplace_status IS DISTINCT FROM 'hidden' AND (p_after IS NULL OR e.id>p_after)
 ORDER BY e.id LIMIT n LOOP
 input_hash:=zoi.geography_repair_strategy_input(l,p_strategy);generation:=zoi.geography_source_generation(l.id);
 affected:=zoi.geography_source_enqueue_one(l,p_strategy,generation);
 added:=added+affected;processed:=processed+1;last_id:=l.id;
 END LOOP;
 RETURN jsonb_build_object('new_jobs',added,'processed',processed,'last_id',last_id,'done',processed<n,'strategy',p_strategy,'coordinate_writes',0);
END $function$
;

DO $guard$ BEGIN IF md5(pg_get_functiondef('public.geography_repair_lease(integer,text)'::regprocedure)) IS DISTINCT FROM '3726b3f5fb307bdbf690f72f374df815' THEN RAISE EXCEPTION 'continuous_source_existing_function_changed';END IF;IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.geography_repair_lease(integer,text)'::regprocedure AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text='{postgres=X/postgres,service_role=X/postgres}') THEN RAISE EXCEPTION 'continuous_source_existing_acl_changed';END IF;END $guard$;
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
 SELECT p.id,CASE WHEN zoi.geography_source_job_current(j,l) THEN j.input_fingerprint ELSE NULL END AS current_input FROM picked p
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
 SELECT p.id,CASE WHEN zoi.geography_source_job_current(j,l) THEN j.input_fingerprint ELSE NULL END AS current_input FROM picked p
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

DO $guard$ BEGIN IF md5(pg_get_functiondef('public.geography_repair_finish(uuid,uuid,jsonb)'::regprocedure)) IS DISTINCT FROM 'fb16665e927b8bf55e37f916adbcfbac' THEN RAISE EXCEPTION 'continuous_source_existing_function_changed';END IF;IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.geography_repair_finish(uuid,uuid,jsonb)'::regprocedure AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text='{postgres=X/postgres,service_role=X/postgres}') THEN RAISE EXCEPTION 'continuous_source_existing_acl_changed';END IF;END $guard$;
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
 IF NOT zoi.geography_source_job_current(j,l) THEN
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

DO $guard$ BEGIN IF md5(pg_get_functiondef('public.geography_repair_review(uuid,jsonb)'::regprocedure)) IS DISTINCT FROM '9ff722c3d8f2d16005b536d03d5c6096' THEN RAISE EXCEPTION 'continuous_source_existing_function_changed';END IF;IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.geography_repair_review(uuid,jsonb)'::regprocedure AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text='{postgres=X/postgres,service_role=X/postgres}') THEN RAISE EXCEPTION 'continuous_source_existing_acl_changed';END IF;END $guard$;
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
 OR NOT zoi.geography_source_job_current(j,l)
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
DO $guard$ BEGIN IF md5(pg_get_functiondef('public.geography_publisher_enqueue(integer,uuid)'::regprocedure)) IS DISTINCT FROM '8c0fecfcdc02faae2ba544ee3a8c4640' THEN RAISE EXCEPTION 'continuous_source_existing_function_changed';END IF;IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.geography_publisher_enqueue(integer,uuid)'::regprocedure AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text='{postgres=X/postgres,service_role=X/postgres}') THEN RAISE EXCEPTION 'continuous_source_existing_acl_changed';END IF;END $guard$;
CREATE OR REPLACE FUNCTION public.geography_publisher_enqueue(p_limit integer DEFAULT 1000,p_after uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $publisher$
DECLARE l zoi.listings;input_hash text;added integer:=0;processed integer:=0;affected integer;generation bigint;last_id uuid:=p_after;n integer:=greatest(least(coalesce(p_limit,1000),1000),1);BEGIN
 FOR l IN SELECT catalogue_row.* FROM zoi.v_public_listings e JOIN zoi.listings catalogue_row ON catalogue_row.id=e.id
 WHERE catalogue_row.marketplace_status IS DISTINCT FROM 'hidden' AND nullif(btrim(catalogue_row.website),'') IS NULL
 AND zoi.geography_publisher_host(catalogue_row.source_url) IS NOT NULL AND (p_after IS NULL OR e.id>p_after)
 ORDER BY e.id LIMIT n LOOP
 input_hash:=zoi.geography_repair_strategy_input(l,'publisher_profiles_v1');generation:=zoi.geography_source_generation(l.id);
 affected:=zoi.geography_source_enqueue_one(l,'publisher_profiles_v1',generation);
 added:=added+affected;processed:=processed+1;last_id:=l.id;
 END LOOP;
 RETURN jsonb_build_object('strategy','publisher_profiles_v1','new_jobs',added,'processed',processed,'last_id',last_id,'done',processed<n,'coordinate_writes',0,'website_writes',0,'additional_tasks_not_additional_catalogue_records',true);
END $publisher$;
DO $guard$ BEGIN IF md5(pg_get_functiondef('public.geography_publisher_review(uuid,jsonb)'::regprocedure)) IS DISTINCT FROM '21a9326bca2957b6d88e926ce4d46c40' THEN RAISE EXCEPTION 'continuous_source_existing_function_changed';END IF;IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.geography_publisher_review(uuid,jsonb)'::regprocedure AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text='{postgres=X/postgres,service_role=X/postgres}') THEN RAISE EXCEPTION 'continuous_source_existing_acl_changed';END IF;END $guard$;
CREATE OR REPLACE FUNCTION public.geography_publisher_review(p_job uuid,p_review jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $source_review$
DECLARE j zoi.geography_repair_jobs;l zoi.listings;BEGIN
 SELECT * INTO j FROM zoi.geography_repair_jobs WHERE id=p_job FOR UPDATE;
 SELECT * INTO l FROM zoi.listings WHERE id=j.listing_id FOR SHARE;
 IF j.id IS NULL OR j.strategy<>'publisher_profiles_v1' OR j.status NOT IN('needs_identity_review','needs_address_review')
 OR NOT zoi.geography_source_job_current(j,l)
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
END $source_review$;
DO $reader$ BEGIN IF md5(pg_get_functiondef('public.geography_repair_summary()'::regprocedure)) IS DISTINCT FROM 'de490ab80b11ea3b54a6a9ed53c45031' OR NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.geography_repair_summary()'::regprocedure AND pg_get_userbyid(p.proowner)='postgres'AND p.proacl::text='{postgres=X/postgres,service_role=X/postgres}') THEN RAISE EXCEPTION 'continuous_source_reader_contract_changed';END IF;END $reader$;
CREATE OR REPLACE FUNCTION public.geography_repair_summary()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 WITH eligible AS MATERIALIZED (
 SELECT e.id FROM zoi.v_public_listings e JOIN zoi.listings l ON l.id=e.id
 WHERE l.marketplace_status IS DISTINCT FROM 'hidden'
 ),applied AS MATERIALIZED (
 SELECT j.listing_id,j.application_result,
 public.geography_reviewed_point(j.listing_id) AS current_receipt
 FROM zoi.geography_repair_jobs j WHERE j.status='applied'
 ),accepted AS (
 SELECT a.* FROM applied a JOIN eligible e ON e.id=a.listing_id WHERE current_receipt->>'request_id'=application_result->>'request_id'
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
 'current_records',NULL,'current_jobs',NULL,'latest_generation_jobs',(SELECT count(*) FROM zoi.geography_repair_jobs j WHERE j.source_generation=zoi.geography_source_generation(j.listing_id)),'historical_job_counts',true,'input_freshness','checked_at_bounded_lease_finish_and_review_not_catalogue_poll',
 'current_applied_records',(SELECT count(distinct listing_id) FROM accepted),
 'actual_coordinate_corrections',(SELECT count(distinct listing_id) FROM accepted WHERE application_result->>'coordinate_changed'='true'),
 'historical_statuses',(SELECT jsonb_object_agg(status,n) FROM (SELECT status,count(*) n FROM zoi.geography_repair_jobs GROUP BY status)s))
 FROM counts
$function$
;
DO $reader$ BEGIN IF md5(pg_get_functiondef('public.zoi_delivery_records(text,integer,integer,text)'::regprocedure)) IS DISTINCT FROM 'f013f9e81e19e6670bf3c673ecfaaab2' OR NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.zoi_delivery_records(text,integer,integer,text)'::regprocedure AND pg_get_userbyid(p.proowner)='postgres'AND p.proacl::text='{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}') THEN RAISE EXCEPTION 'continuous_source_reader_contract_changed';END IF;END $reader$;
CREATE OR REPLACE FUNCTION public.zoi_delivery_records(p_category text, p_limit integer DEFAULT 32, p_offset integer DEFAULT 0, p_query text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor uuid;rows jsonb;total integer;
BEGIN
 actor:=zoi.delivery_require_founder();
 IF p_category NOT IN('websites_reviewed','profiles_enriched','homes_visual','customer_actions','addresses_corrected','precision_labels','city_coordinates','awaiting_review') THEN RAISE EXCEPTION 'invalid_delivery_category';END IF;
 IF p_category IN('addresses_corrected','precision_labels','city_coordinates') THEN
  WITH records AS(SELECT DISTINCT ON(l.id)l.id,l.name,l.entity_type AS category,concat_ws(', ',l.city,zoi.geo_country_canon(l.country))AS location,'/p/'||l.slug AS profile_url,
   CASE WHEN p_category='precision_labels'THEN 'Corrected a city-centre point incorrectly labelled as a street location. Coordinates did not move.'WHEN p_category='city_coordinates'THEN 'Corrected the city-area position using its verified locality. This is not a street-address certification.'ELSE 'Corrected the address-level point using independently reviewed official evidence.'END AS changed,
   CASE WHEN r.after_fingerprint=zoi.geography_fingerprint(l)AND r.reverted_at IS NULL THEN 'Current guarded correction'ELSE 'Historical correction; current record needs rechecking'END AS verification,r.created_at AS completed_at,r.before_geo AS before,jsonb_build_object('latitude',l.latitude,'longitude',l.longitude,'precision',l.geo_precision)AS after,
   jsonb_build_object('request_id',r.request_id,'kind',r.payload->>'kind','source',r.payload#>>'{report,source_url}','source_sha256',r.payload#>>'{report,source_sha256}','coordinate_changed',(r.before_geo->>'latitude')::double precision IS DISTINCT FROM l.latitude OR(r.before_geo->>'longitude')::double precision IS DISTINCT FROM l.longitude)AS evidence
   FROM zoi.geography_reviews r JOIN zoi.listings l ON l.id=r.listing_id WHERE r.reverted_at IS NULL AND l.publish_status='published'AND l.moderation_status IN('clean','cleared')AND coalesce(l.marketplace_status,'')<>'hidden'
    AND CASE WHEN p_category='precision_labels'THEN r.payload->>'kind'='precision_claim_correction'WHEN p_category='city_coordinates'THEN r.receipt->>'precision'='city'AND((r.before_geo->>'latitude')::double precision IS DISTINCT FROM l.latitude OR(r.before_geo->>'longitude')::double precision IS DISTINCT FROM l.longitude)ELSE r.receipt->>'precision'='street'AND r.after_fingerprint=zoi.geography_fingerprint(l)AND((r.before_geo->>'latitude')::double precision IS DISTINCT FROM l.latitude OR(r.before_geo->>'longitude')::double precision IS DISTINCT FROM l.longitude)END
    AND(nullif(btrim(p_query),'')IS NULL OR strpos(lower(l.name||' '||coalesce(l.city,'')),lower(btrim(p_query)))>0)ORDER BY l.id,r.created_at DESC)
   SELECT(SELECT count(*)FROM records),coalesce((SELECT jsonb_agg(to_jsonb(x))FROM(SELECT *FROM records ORDER BY completed_at DESC,id LIMIT least(greatest(coalesce(p_limit,32),1),100)OFFSET greatest(coalesce(p_offset,0),0))x),'[]'::jsonb)INTO total,rows;
 ELSIF p_category='awaiting_review'THEN
  IF to_regclass('zoi.geography_repair_jobs')IS NULL THEN RETURN jsonb_build_object('rows','[]'::jsonb,'total',NULL,'state','not yet measured');END IF;
  EXECUTE 'WITH records AS(SELECT DISTINCT ON(j.listing_id)j.listing_id AS id,l.name,l.entity_type AS category,concat_ws('', '',l.city,l.country) AS location,''/p/''||l.slug AS profile_url,j.reason AS changed,CASE WHEN j.status=''input_changed''THEN ''Changed input awaiting replacement or processing''ELSE j.status END AS verification,j.updated_at AS completed_at,j.original AS before,j.proposed AS after,j.source AS evidence FROM zoi.geography_repair_jobs j JOIN zoi.listings l ON l.id=j.listing_id WHERE j.source_generation=zoi.geography_source_generation(j.listing_id)AND l.owner_user_id IS NULL AND l.owner_workspace_id IS NULL AND l.publish_status=''published''AND l.moderation_status IN(''clean'',''cleared'')AND l.duplicate_status<>''confirmed_duplicate''AND l.marketplace_status IS DISTINCT FROM ''hidden''AND CASE WHEN l.geo_precision=''street''AND l.profile#>>''{_geo,request_id}''IS NOT NULL THEN public.geography_reviewed_point(j.listing_id)IS NULL ELSE true END AND($1 IS NULL OR strpos(lower(l.name),lower($1))>0)ORDER BY j.listing_id,j.updated_at DESC)SELECT(SELECT count(*)FROM records),coalesce((SELECT jsonb_agg(to_jsonb(x))FROM(SELECT *FROM records ORDER BY completed_at DESC,id LIMIT $2 OFFSET $3)x),''[]''::jsonb)'
  INTO total,rows USING nullif(btrim(p_query),''),least(greatest(coalesce(p_limit,32),1),100),greatest(coalesce(p_offset,0),0);
 ELSE
  WITH records AS(SELECT l.id,l.name,l.entity_type AS category,concat_ws(', ',l.city,zoi.geo_country_canon(l.country))AS location,e.changed,CASE WHEN e.record_fingerprint=zoi.geography_fingerprint(l)AND(e.category<>'customer_actions'OR EXISTS(SELECT 1 FROM zoi.delivery_features f WHERE f.state='live and verified'AND f.release->>'id'=e.release->>'id'AND f.proof->'record_ids'@>jsonb_build_array(l.id::text)))THEN e.verification ELSE 'Needs rechecking after record change'END AS verification,e.completed_at,'/p/'||l.slug AS profile_url,e.before_value AS before,e.after_value AS after,e.evidence FROM zoi.delivery_record_evidence e JOIN zoi.listings l ON l.id=e.listing_id WHERE e.category=p_category AND e.record_fingerprint=zoi.geography_fingerprint(l) AND(e.category<>'customer_actions'OR EXISTS(SELECT 1 FROM zoi.delivery_features f WHERE f.state='live and verified'AND f.release->>'id'=e.release->>'id'AND f.proof->'record_ids'@>jsonb_build_array(l.id::text))) AND(nullif(btrim(p_query),'')IS NULL OR strpos(lower(l.name||' '||coalesce(l.city,'')),lower(btrim(p_query)))>0))
  SELECT(SELECT count(*)FROM records),coalesce((SELECT jsonb_agg(to_jsonb(x))FROM(SELECT *FROM records ORDER BY completed_at DESC,id LIMIT least(greatest(coalesce(p_limit,32),1),100)OFFSET greatest(coalesce(p_offset,0),0))x),'[]'::jsonb)INTO total,rows;
 END IF;
 RETURN jsonb_build_object('rows',rows,'total',total,'category',p_category);
END $function$
;
DO $reader$ BEGIN IF md5(pg_get_functiondef('zoi.delivery_job_status()'::regprocedure)) IS DISTINCT FROM '96af51444e6f7ff5091c48ad1c0460a3' OR NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='zoi.delivery_job_status()'::regprocedure AND pg_get_userbyid(p.proowner)='postgres'AND p.proacl::text='{postgres=X/postgres}') THEN RAISE EXCEPTION 'continuous_source_reader_contract_changed';END IF;END $reader$;
CREATE OR REPLACE FUNCTION zoi.delivery_job_status()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 WITH latest AS MATERIALIZED(SELECT DISTINCT ON(listing_id)listing_id,source_generation FROM zoi.geography_repair_jobs ORDER BY listing_id,source_generation DESC,id),generation_counts AS(SELECT count(*) AS total,count(*)FILTER(WHERE j.status IN('queued','leased'))AS pending,count(distinct j.listing_id)AS records FROM zoi.geography_repair_jobs j JOIN latest g ON g.listing_id=j.listing_id AND g.source_generation=j.source_generation),counts AS(SELECT count(*)AS total,count(*)FILTER(WHERE captured_at IS NOT NULL OR applied_at IS NOT NULL)AS processed,count(*)FILTER(WHERE status='source_blocked')AS failed,count(*)FILTER(WHERE attempts>1)AS retried,max(updated_at)AS as_of FROM zoi.geography_repair_jobs),
 accepted AS(SELECT j.id FROM zoi.geography_repair_jobs j JOIN zoi.geography_reviews r ON r.request_id=CASE WHEN j.application_result->>'request_id'~'^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$'THEN(j.application_result->>'request_id')::uuid END JOIN zoi.listings l ON l.id=j.listing_id WHERE j.status='applied'AND r.listing_id=j.listing_id AND r.reverted_at IS NULL AND r.receipt->>'precision'='street'AND r.after_fingerprint=zoi.geography_fingerprint(l)AND l.profile#>>'{_geo,request_id}'=r.request_id::text AND l.geo_precision='street'AND l.profile#>>'{_geo,precision}'='street'AND l.duplicate_status<>'confirmed_duplicate'AND l.owner_user_id IS NULL AND l.owner_workspace_id IS NULL AND l.publish_status='published'AND l.moderation_status IN('clean','cleared')AND coalesce(l.marketplace_status,'')<>'hidden')
 SELECT jsonb_build_object('total',total,'processed',processed,'remaining',total-(SELECT count(*)FROM accepted),'failed',failed,'retried',retried,'as_of',as_of,'states',(SELECT jsonb_object_agg(status,n)FROM(SELECT status,count(*)n FROM zoi.geography_repair_jobs GROUP BY status)s),'historical_job_counts',true,'latest_generation_jobs',(SELECT jsonb_build_object('total',total,'pending',pending,'unique_records',records,'input_validation','as-of latest generation; current eligibility and full source fingerprint are checked at bounded processing boundaries')FROM generation_counts),'definition','Historical job workload. Processed includes captured research or applied results and overlaps remaining; it is not a count of corrected addresses.','current_input_validation','Not measured across the full population; checked at bounded processing boundaries.')FROM counts
$function$
;

NOTIFY pgrst,'reload schema';
COMMIT;

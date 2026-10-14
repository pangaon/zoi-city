BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE zoi.geography_repair_jobs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), listing_id uuid NOT NULL REFERENCES zoi.listings(id),
 strategy text NOT NULL CHECK(length(strategy) BETWEEN 1 AND 100), input_fingerprint text NOT NULL,
 database_snapshot text NOT NULL, idempotency_key text NOT NULL UNIQUE,
 status text NOT NULL CHECK(status IN('queued','leased','needs_source','needs_address','owner_action','source_blocked','needs_identity_review','needs_address_review','needs_coordinate_review','reviewed','applied','input_changed','unresolved')),
 original jsonb NOT NULL, proposed jsonb, source jsonb, precision text, confidence text,
 reason text NOT NULL, review_result jsonb, application_result jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 captured_at timestamptz,reviewed_at timestamptz,applied_at timestamptz,
 lease_id uuid,completed_lease_id uuid,capture_result_hash text,lease_expires_at timestamptz,attempts integer NOT NULL DEFAULT 0,
 UNIQUE(listing_id,strategy,input_fingerprint)
);
ALTER TABLE zoi.geography_repair_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.geography_repair_jobs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON zoi.geography_repair_jobs TO service_role;
CREATE INDEX geography_repair_queue_idx ON zoi.geography_repair_jobs(status,created_at,id);
CREATE FUNCTION zoi.geography_repair_input(l zoi.listings) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT md5(jsonb_build_object('name',l.name,'entity_type',l.entity_type,'address',l.address,'city',l.city,'country',l.country,'website',l.website,'source_url',l.source_url,'latitude',l.latitude,'longitude',l.longitude,'precision',l.geo_precision,'geo',l.profile->'_geo','owner_user',l.owner_user_id,'owner_workspace',l.owner_workspace_id,'published',l.publish_status,'moderation',l.moderation_status,'marketplace',l.marketplace_status,'duplicate',l.duplicate_status)::text)
$$;
REVOKE ALL ON FUNCTION zoi.geography_repair_input(zoi.listings) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.geography_repair_enqueue(p_strategy text DEFAULT 'official_sources_v1',p_limit integer DEFAULT 1000,p_after uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE added integer:=0;processed integer:=0;last_id uuid:=p_after;l zoi.listings;input_hash text;affected integer;n integer:=greatest(least(coalesce(p_limit,1000),1000),1);BEGIN
 IF p_strategy IS NULL OR p_strategy!~'^[a-zA-Z0-9_-]{1,100}$' THEN RAISE EXCEPTION 'invalid_geography_strategy';END IF;
 FOR l IN SELECT catalogue_row.* FROM zoi.v_public_listings e JOIN zoi.listings catalogue_row ON catalogue_row.id=e.id
 WHERE catalogue_row.marketplace_status IS DISTINCT FROM 'hidden' AND (p_after IS NULL OR e.id>p_after)
 ORDER BY e.id LIMIT n LOOP
 input_hash:=zoi.geography_repair_input(l);
 INSERT INTO zoi.geography_repair_jobs(listing_id,strategy,input_fingerprint,database_snapshot,idempotency_key,status,original,reason)
 VALUES(l.id,p_strategy,input_hash,zoi.geography_fingerprint(l),md5(l.id::text||'|'||p_strategy||'|'||input_hash),
 CASE WHEN l.owner_user_id IS NOT NULL OR l.owner_workspace_id IS NOT NULL THEN 'owner_action'
 WHEN nullif(btrim(l.address),'') IS NULL THEN 'needs_address'
 WHEN l.website IS NULL OR l.website!~'^https://' THEN 'needs_source' ELSE 'queued' END,
 jsonb_build_object('name',l.name,'slug',l.slug,'entity_type',l.entity_type,'address',l.address,'city',l.city,'country',l.country,'website',l.website,'latitude',l.latitude,'longitude',l.longitude,'precision',l.geo_precision,'metadata',l.profile->'_geo'),
 CASE WHEN l.owner_user_id IS NOT NULL OR l.owner_workspace_id IS NOT NULL THEN 'preserve_owner_location'
 WHEN nullif(btrim(l.address),'') IS NULL THEN 'public_address_requires_research'
 WHEN l.website IS NULL OR l.website!~'^https://' THEN 'official_source_requires_identification' ELSE 'registered_source_requires_identity_address_coordinate_research' END)
 ON CONFLICT(listing_id,strategy,input_fingerprint) DO NOTHING;
 GET DIAGNOSTICS affected=ROW_COUNT;added:=added+affected;processed:=processed+1;last_id:=l.id;
 END LOOP;
 RETURN jsonb_build_object('new_jobs',added,'processed',processed,'last_id',last_id,'done',processed<n,'strategy',p_strategy,'coordinate_writes',0);
END $$;
CREATE FUNCTION public.geography_repair_lease(p_limit integer DEFAULT 10,p_strategy text DEFAULT 'official_sources_v1') RETURNS SETOF zoi.geography_repair_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE zoi.geography_repair_jobs SET status='unresolved',reason='capture_interrupted_three_times_requires_changed_strategy',lease_id=null,lease_expires_at=null,updated_at=now() WHERE strategy=p_strategy AND status='leased' AND lease_expires_at<now() AND attempts>=3;
 RETURN QUERY WITH picked AS MATERIALIZED (
 SELECT j.id FROM zoi.geography_repair_jobs j WHERE j.strategy=p_strategy
 AND (j.status='queued' OR (j.status='leased' AND j.lease_expires_at<now() AND j.attempts<3))
 ORDER BY j.created_at,j.id LIMIT greatest(least(coalesce(p_limit,10),30),1) FOR UPDATE SKIP LOCKED
 ),checked AS MATERIALIZED (
 SELECT p.id,zoi.geography_repair_input(l) AS current_input FROM picked p
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
END $$;
CREATE FUNCTION public.geography_repair_finish(p_job uuid,p_lease uuid,p_result jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j zoi.geography_repair_jobs;l zoi.listings;next_status text;BEGIN
 SELECT * INTO j FROM zoi.geography_repair_jobs WHERE id=p_job FOR UPDATE;
 IF j.id IS NOT NULL AND j.completed_lease_id=p_lease AND j.capture_result_hash=md5(p_result::text) THEN RETURN jsonb_build_object('status',j.status,'coordinate_writes',0,'replayed',true);END IF;
 IF j.id IS NULL OR j.lease_id IS DISTINCT FROM p_lease OR j.status<>'leased' OR j.lease_expires_at<now() THEN RAISE EXCEPTION 'geography_lease_unavailable';END IF;
 SELECT * INTO l FROM zoi.listings WHERE id=j.listing_id FOR SHARE;
 IF j.input_fingerprint IS DISTINCT FROM zoi.geography_repair_input(l) THEN
 UPDATE zoi.geography_repair_jobs SET status='input_changed',reason='listing_changed_during_capture',completed_lease_id=p_lease,capture_result_hash=md5(p_result::text),lease_id=null,lease_expires_at=null,updated_at=now() WHERE id=j.id;
 RETURN jsonb_build_object('status','input_changed','coordinate_writes',0);END IF;
 next_status=p_result->>'status';
 IF jsonb_typeof(p_result) IS DISTINCT FROM 'object' OR octet_length(p_result::text)>100000
 OR next_status IS NULL OR next_status NOT IN('source_blocked','needs_identity_review','needs_address_review','needs_coordinate_review','unresolved')
 OR nullif(btrim(p_result->>'reason'),'') IS NULL THEN RAISE EXCEPTION 'invalid_geography_capture_result';END IF;
 UPDATE zoi.geography_repair_jobs SET status=next_status,reason=left(p_result->>'reason',500),proposed=p_result->'proposed',source=p_result->'source',precision=left(p_result->>'precision',80),confidence=left(p_result->>'confidence',80),captured_at=now(),updated_at=now(),completed_lease_id=p_lease,capture_result_hash=md5(p_result::text),lease_id=null,lease_expires_at=null,database_snapshot=zoi.geography_fingerprint(l) WHERE id=j.id;
 RETURN jsonb_build_object('status',next_status,'coordinate_writes',0);
END $$;
CREATE FUNCTION public.geography_repair_review(p_job uuid,p_review jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j zoi.geography_repair_jobs;l zoi.listings;BEGIN
 SELECT * INTO j FROM zoi.geography_repair_jobs WHERE id=p_job FOR UPDATE;
 SELECT * INTO l FROM zoi.listings WHERE id=j.listing_id FOR SHARE;
 IF j.id IS NULL OR j.status NOT IN ('needs_identity_review','needs_address_review','needs_coordinate_review','reviewed')
 OR j.input_fingerprint IS DISTINCT FROM zoi.geography_repair_input(l)
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
END $$;
CREATE FUNCTION public.geography_repair_records(p_limit integer DEFAULT 100,p_offset integer DEFAULT 0) RETURNS SETOF zoi.geography_repair_jobs LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT * FROM zoi.geography_repair_jobs ORDER BY updated_at DESC,id LIMIT greatest(least(coalesce(p_limit,100),500),1) OFFSET greatest(coalesce(p_offset,0),0)
$$;
-- Recording acceptance cannot write a location; it requires the existing guarded
-- writer's current immutable receipt, full-row freshness, and owner safety.
CREATE FUNCTION public.geography_repair_record_application(p_job uuid,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j zoi.geography_repair_jobs;l zoi.listings;r zoi.geography_reviews;BEGIN
 SELECT * INTO j FROM zoi.geography_repair_jobs WHERE id=p_job FOR UPDATE;
 SELECT * INTO l FROM zoi.listings WHERE id=j.listing_id FOR SHARE;
 SELECT * INTO r FROM zoi.geography_reviews WHERE request_id=p_request AND listing_id=j.listing_id FOR SHARE;
 IF j.id IS NULL OR r.request_id IS NULL OR r.reverted_at IS NOT NULL OR r.after_fingerprint IS DISTINCT FROM zoi.geography_fingerprint(l)
 OR l.owner_user_id IS NOT NULL OR l.owner_workspace_id IS NOT NULL OR l.publish_status IS DISTINCT FROM 'published'
 OR (l.moderation_status IS DISTINCT FROM 'clean' AND l.moderation_status IS DISTINCT FROM 'cleared') OR l.marketplace_status='hidden'
 OR r.receipt->>'precision' IS DISTINCT FROM 'street' OR l.profile#>>'{_geo,request_id}' IS DISTINCT FROM p_request::text
 THEN RAISE EXCEPTION 'current_guarded_geography_receipt_required';END IF;
 UPDATE zoi.geography_repair_jobs SET status='applied',application_result=r.receipt||jsonb_build_object('coordinate_changed',(j.original->'latitude' IS DISTINCT FROM to_jsonb(l.latitude) OR j.original->'longitude' IS DISTINCT FROM to_jsonb(l.longitude))),applied_at=now(),updated_at=now(),reason='independently_reviewed_guarded_address_position_applied' WHERE id=j.id;
 RETURN r.receipt;
END $$;
CREATE FUNCTION public.geography_repair_summary() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH state AS (
 SELECT j.*,j.input_fingerprint=zoi.geography_repair_input(l) AS input_current,
 CASE WHEN j.status='applied' THEN r.reverted_at IS NULL AND r.request_id IS NOT NULL
 AND r.after_fingerprint=zoi.geography_fingerprint(l)
 AND l.profile#>>'{_geo,request_id}'=r.request_id::text
 AND l.owner_user_id IS NULL AND l.owner_workspace_id IS NULL
 AND l.publish_status='published' AND l.moderation_status IN ('clean','cleared')
 AND l.marketplace_status IS DISTINCT FROM 'hidden'
 ELSE false END AS accepted_current
 FROM zoi.geography_repair_jobs j JOIN zoi.listings l ON l.id=j.listing_id
 LEFT JOIN zoi.geography_reviews r ON j.status='applied' AND r.listing_id=j.listing_id AND r.request_id::text=j.application_result->>'request_id'
 )
 SELECT jsonb_build_object('measured_at',now(),'eligible_population',(SELECT count(*) FROM zoi.v_public_listings e JOIN zoi.listings l ON l.id=e.id WHERE l.marketplace_status IS DISTINCT FROM 'hidden'),'seeded_eligible_records',(SELECT count(distinct j.listing_id) FROM zoi.geography_repair_jobs j JOIN zoi.v_public_listings e ON e.id=j.listing_id JOIN zoi.listings l ON l.id=e.id WHERE l.marketplace_status IS DISTINCT FROM 'hidden'),'jobs',count(*),'unique_records',count(distinct listing_id),
 'current_records',count(distinct listing_id) FILTER(WHERE input_current OR accepted_current),
 'pending_jobs',count(*) FILTER(WHERE status='queued' OR status='leased'),
 'current_jobs',count(*) FILTER(WHERE input_current OR accepted_current),
 'current_applied_records',count(distinct listing_id) FILTER(WHERE accepted_current),
 'actual_coordinate_corrections',count(distinct listing_id) FILTER(WHERE accepted_current AND application_result->>'coordinate_changed'='true'),
 'historical_statuses',(SELECT jsonb_object_agg(status,n) FROM (SELECT status,count(*) n FROM zoi.geography_repair_jobs GROUP BY status)s)) FROM state
$$;
REVOKE ALL ON FUNCTION public.geography_repair_enqueue(text,integer,uuid),public.geography_repair_lease(integer,text),public.geography_repair_finish(uuid,uuid,jsonb),public.geography_repair_record_application(uuid,uuid),public.geography_repair_review(uuid,jsonb),public.geography_repair_records(integer,integer),public.geography_repair_summary() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.geography_repair_enqueue(text,integer,uuid),public.geography_repair_lease(integer,text),public.geography_repair_finish(uuid,uuid,jsonb),public.geography_repair_record_application(uuid,uuid),public.geography_repair_review(uuid,jsonb),public.geography_repair_records(integer,integer),public.geography_repair_summary() TO service_role;
COMMIT;

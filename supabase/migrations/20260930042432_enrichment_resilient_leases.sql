BEGIN;
SET LOCAL lock_timeout='5s';
CREATE OR REPLACE FUNCTION zoi.enrich_timestamp(p_text text) RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path='' AS $$ BEGIN RETURN nullif(p_text,'')::timestamptz;EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN NULL;END $$;
REVOKE ALL ON FUNCTION zoi.enrich_timestamp(text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION zoi.enrich_queue_lease(p_limit integer DEFAULT 40,p_max_age_days integer DEFAULT 30,p_lease_minutes integer DEFAULT 15)
RETURNS TABLE(slug text,website text,lease_id text) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE lease text:=gen_random_uuid()::text;
BEGIN
 RETURN QUERY WITH candidates AS (
 SELECT l.id FROM zoi.listings l WHERE l.website~*'^https?://' AND coalesce(l.profile->'_enrich'->>'blocked','')<>'true'
 AND (zoi.enrich_timestamp(l.profile->'_enrich'->>'checked_at') IS NULL OR zoi.enrich_timestamp(l.profile->'_enrich'->>'checked_at')<current_date-greatest(coalesce(p_max_age_days,30),1) OR l.profile->'_enrich'->>'crawl_status'='error')
 AND (l.profile->'_enrich'->>'crawl_status' IS DISTINCT FROM 'error' OR coalesce(zoi.enrich_timestamp(l.profile->'_enrich'->>'last_attempt_at'),'-infinity')<=now()-interval '6 hours')
 AND coalesce(zoi.enrich_timestamp(l.profile->'_enrich'->'lease'->>'expires_at'),'-infinity')<now()
 ORDER BY (l.verification_status IN('verified','owner_verified','source_verified')) DESC,l.profile->'_enrich'->>'checked_at' NULLS FIRST,l.id
 LIMIT greatest(least(coalesce(p_limit,40),200),1) FOR UPDATE SKIP LOCKED
 ),leased AS (
 UPDATE zoi.listings l SET profile=coalesce(l.profile,'{}')||jsonb_build_object('_enrich',coalesce(l.profile->'_enrich','{}')||jsonb_build_object('lease',jsonb_build_object('id',lease,'source_website',l.website,'expires_at',clock_timestamp()+make_interval(mins=>greatest(least(coalesce(p_lease_minutes,15),60),1))))) FROM candidates c WHERE l.id=c.id RETURNING l.slug,l.website)
 SELECT leased.slug,leased.website,lease FROM leased;
END $$;
-- Explicit operator-selected canary only, not a free-form URL crawler. Max3 stored public listings.
CREATE FUNCTION public.enrich_sample_lease(p_ids uuid[]) RETURNS TABLE(slug text,website text,lease_id text) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE lease text:=gen_random_uuid()::text;
BEGIN
 IF p_ids IS NULL OR cardinality(p_ids) NOT BETWEEN 1 AND 3 OR array_position(p_ids,NULL) IS NOT NULL OR cardinality(p_ids)<>(SELECT count(DISTINCT x) FROM unnest(p_ids)x) THEN RAISE EXCEPTION 'invalid_enrichment_sample';END IF;
 RETURN QUERY WITH candidates AS (
 SELECT l.id FROM zoi.listings l WHERE l.id=ANY(p_ids) AND l.publish_status='published' AND coalesce(l.marketplace_status,'')<>'hidden' AND l.website~*'^https?://' AND coalesce(l.profile->'_enrich'->>'blocked','')<>'true'
 AND coalesce(zoi.enrich_timestamp(l.profile->'_enrich'->'lease'->>'expires_at'),'-infinity')<now()
 ORDER BY l.id FOR UPDATE SKIP LOCKED
 ),leased AS (
 UPDATE zoi.listings l SET profile=coalesce(l.profile,'{}')||jsonb_build_object('_enrich',coalesce(l.profile->'_enrich','{}')||jsonb_build_object('lease',jsonb_build_object('id',lease,'source_website',l.website,'expires_at',clock_timestamp()+interval '15 minutes'))) FROM candidates c WHERE l.id=c.id RETURNING l.slug,l.website)
 SELECT leased.slug,leased.website,lease FROM leased;
END $$;
CREATE OR REPLACE FUNCTION zoi.enrich_apply(p_batch jsonb) RETURNS TABLE(slug text,applied boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb;l zoi.listings;machine jsonb;incoming jsonb;lease jsonb;
BEGIN
 IF jsonb_typeof(p_batch) IS DISTINCT FROM 'array' OR jsonb_array_length(p_batch)>200 OR octet_length(p_batch::text)>2000000 THEN RAISE EXCEPTION 'invalid_enrichment_batch';END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_batch) LOOP
  SELECT * INTO l FROM zoi.listings WHERE listings.slug=r->>'slug' FOR UPDATE;
  lease:=l.profile->'_enrich'->'lease';
  IF l.id IS NULL OR nullif(r->>'lease_id','') IS NULL OR (lease->>'id') IS DISTINCT FROM (r->>'lease_id') OR (lease->>'source_website') IS DISTINCT FROM l.website OR coalesce(zoi.enrich_timestamp(lease->>'expires_at'),'-infinity')<=clock_timestamp() THEN
   RETURN QUERY SELECT r->>'slug',false;CONTINUE;
  END IF;
  incoming:=coalesce(r->'profile','{}');
  IF jsonb_typeof(incoming) IS DISTINCT FROM 'object' OR jsonb_typeof(coalesce(r->'provenance','{}')) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_enrichment_fields';END IF;
  IF incoming->>'crawl_status'='error' THEN
   machine:=(coalesce(l.profile->'_enrich','{}')-'lease')||jsonb_build_object('crawl_status','error','status','error','last_error',left(coalesce(incoming->>'last_error','crawl_failed'),200),'last_attempt_at',clock_timestamp());
  ELSE
   machine:=(zoi.profile_strip(incoming)-'lease')||jsonb_build_object('provenance',coalesce(r->'provenance','{}'),'source_url',r->>'website','checked_at',to_char(now(),'YYYY-MM-DD'),'last_attempt_at',clock_timestamp(),'status',coalesce(incoming->>'crawl_status','ok'));
  END IF;
  UPDATE zoi.listings SET profile=coalesce(l.profile,'{}')||jsonb_build_object('_enrich',machine),updated_at=now() WHERE id=l.id;
  RETURN QUERY SELECT l.slug,true;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION zoi.enrich_queue_lease(integer,integer,integer),zoi.enrich_apply(jsonb),public.enrich_sample_lease(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enrich_sample_lease(uuid[]) TO service_role;
COMMIT;

BEGIN;
SET LOCAL lock_timeout='5s';
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.enrich_queue_lease(integer,integer,integer)'::regprocedure AND md5(prosrc)='d2bf4d2e825bd08d23ab7390d9786d4b' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""']) THEN RAISE EXCEPTION 'canonical_context_queue_baseline_drift';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.enrich_sample_lease(uuid[])'::regprocedure AND md5(prosrc)='d62a6e1e592af9ddf9b1e32714613864' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,service_role=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""']) THEN RAISE EXCEPTION 'canonical_context_sample_baseline_drift';END IF;
END $guard$;
CREATE OR REPLACE FUNCTION zoi.enrich_queue_lease(p_limit integer DEFAULT 40,p_max_age_days integer DEFAULT 30,p_lease_minutes integer DEFAULT 15)
RETURNS TABLE(slug text,website text,lease_id text,listing_id uuid,name text,entity_type text,existing_enrich jsonb,owner_managed boolean,owner_workspace_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE lease text:=gen_random_uuid()::text;n integer:=greatest(least(coalesce(p_limit,3),3),1);fresh_quota integer;chosen uuid[]:=ARRAY[]::uuid[];pick uuid;phase integer;bucket integer;needed integer;
BEGIN
 fresh_quota:=ceil(n*2.0/3)::integer;
 -- Fresh quota, then retry/fallback, then unused fresh capacity. Each branch
 -- stops at its needed rows, not a window ranking of the whole eligible corpus.
 FOR phase IN 1..3 LOOP
  bucket:=CASE WHEN phase=2 THEN 1 ELSE 0 END;
  needed:=CASE WHEN phase=1 THEN fresh_quota ELSE n-cardinality(chosen) END;
  IF needed<=0 THEN CONTINUE;END IF;
  FOR pick IN
   SELECT l.id FROM zoi.listings l
   WHERE l.publish_status='published' AND l.moderation_status IN('clean','cleared') AND coalesce(l.marketplace_status,'')<>'hidden'
   AND l.website~*'^https?://' AND coalesce(l.profile#>>'{_enrich,blocked}','')<>'true'
   AND (CASE WHEN l.profile#>>'{_enrich,crawl_status}'='error' THEN 1 ELSE 0 END)=bucket
   AND NOT(l.id=ANY(chosen))
   AND (
    zoi.enrich_timestamp(l.profile#>>'{_enrich,checked_at}') IS NULL
    OR zoi.enrich_timestamp(l.profile#>>'{_enrich,checked_at}')<current_date-greatest(coalesce(p_max_age_days,30),1)
    OR l.profile#>>'{_enrich,crawl_status}'='error'
    OR (l.profile#>>'{_enrich,crawl_status}' IS NULL AND l.profile#>>'{_enrich,status}' IS NULL
        AND zoi.enrich_timestamp(l.profile#>>'{_enrich,last_attempt_at}') IS NULL
        AND l.profile#>>'{_coverage,tasks,enrichment,status}' IS NULL)
   )
   AND (l.profile#>>'{_enrich,crawl_status}' IS DISTINCT FROM 'error'
        OR coalesce(zoi.enrich_timestamp(l.profile#>>'{_enrich,last_attempt_at}'),zoi.enrich_timestamp(l.profile#>>'{_enrich,checked_at}'),'-infinity')<=now()-interval '6 hours')
   AND coalesce(zoi.enrich_timestamp(l.profile#>>'{_enrich,lease,expires_at}'),'-infinity')<now()
   ORDER BY (l.verification_status IN('verified','owner_verified','source_verified'))DESC,l.profile#>>'{_enrich,checked_at}' NULLS FIRST,l.id
   LIMIT needed FOR UPDATE OF l SKIP LOCKED
  LOOP chosen:=array_append(chosen,pick);END LOOP;
 END LOOP;
 RETURN QUERY WITH leased AS (
 UPDATE zoi.listings l SET profile=coalesce(l.profile,'{}')||jsonb_build_object('_enrich',coalesce(l.profile->'_enrich','{}')||jsonb_build_object('lease',jsonb_build_object('id',lease,'task','enrichment','fingerprint',zoi.listing_quality_fingerprint(l),'source_website',l.website,'expires_at',clock_timestamp()+make_interval(mins=>greatest(least(coalesce(p_lease_minutes,15),60),1)))))
 WHERE l.id=ANY(chosen) RETURNING l.*
 ) SELECT l.slug,l.website,lease,l.id,l.name,l.entity_type,(coalesce(l.profile->'_enrich','{}')-'lease')||jsonb_build_object('_lease_source_context',jsonb_build_object('city',l.city,'country',l.country,'address',l.address)),l.owner_workspace_id IS NOT NULL,l.owner_workspace_id FROM leased l;
END $function$;
CREATE OR REPLACE FUNCTION public.enrich_sample_lease(p_ids uuid[])
 RETURNS TABLE(slug text, website text, lease_id text, listing_id uuid, name text, entity_type text, existing_enrich jsonb, owner_managed boolean, owner_workspace_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE lease text:=gen_random_uuid()::text;
BEGIN
 IF p_ids IS NULL OR cardinality(p_ids) NOT BETWEEN 1 AND 3 OR array_position(p_ids,NULL) IS NOT NULL OR cardinality(p_ids)<>(SELECT count(DISTINCT x) FROM unnest(p_ids)x) THEN RAISE EXCEPTION 'invalid_enrichment_sample';END IF;
 RETURN QUERY WITH candidates AS(SELECT l.id FROM zoi.listings l WHERE l.id=ANY(p_ids) AND l.publish_status='published' AND l.moderation_status IN('clean','cleared') AND coalesce(l.marketplace_status,'')<>'hidden' AND l.website~*'^https?://' AND coalesce(l.profile#>>'{_enrich,blocked}','')<>'true' AND coalesce(zoi.enrich_timestamp(l.profile#>>'{_enrich,lease,expires_at}'),'-infinity')<now() ORDER BY l.id FOR UPDATE SKIP LOCKED),leased AS(
 UPDATE zoi.listings l SET profile=coalesce(l.profile,'{}')||jsonb_build_object('_enrich',coalesce(l.profile->'_enrich','{}')||jsonb_build_object('lease',jsonb_build_object('id',lease,'task','enrichment','fingerprint',zoi.listing_quality_fingerprint(l),'source_website',l.website,'expires_at',clock_timestamp()+interval '15 minutes')))FROM candidates c WHERE l.id=c.id RETURNING l.*)
 SELECT l.slug,l.website,lease,l.id,l.name,l.entity_type,(coalesce(l.profile->'_enrich','{}')-'lease')||jsonb_build_object('_lease_source_context',jsonb_build_object('city',l.city,'country',l.country,'address',l.address)),l.owner_workspace_id IS NOT NULL,l.owner_workspace_id FROM leased l;
END $function$
;
COMMIT;

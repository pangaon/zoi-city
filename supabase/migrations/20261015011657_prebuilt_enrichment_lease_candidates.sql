BEGIN;
SET LOCAL lock_timeout='5s';
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.enrich_queue_lease(integer,integer,integer)'::regprocedure AND md5(prosrc)='8a4967878e916a04eb02514fceed6b06' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""']) OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.enrich_queue_lease(integer,integer,integer)'::regprocedure AND md5(prosrc)='3a90767a8837d74f95b0ed142a3d49c1' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,service_role=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""']) THEN RAISE EXCEPTION 'enrichment_lease_definition_drift';END IF;
END $guard$;
-- Order matches each original fairness bucket. The predicate is deliberately
-- static: time eligibility is still checked against current row under its lock.
DO $index_guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_am am ON am.oid=c.relam WHERE i.indexrelid=to_regclass('zoi.listings_enrichment_candidate_order_idx') AND i.indrelid='zoi.listings'::regclass AND i.indisvalid AND i.indisready AND NOT i.indisunique AND am.amname='btree' AND pg_get_userbyid(c.relowner)='postgres' AND md5(regexp_replace(pg_get_indexdef(i.indexrelid),'[[:space:]]+','','g'))='fc8505a8f97a7b5fbf8d66390e60e6c9') THEN RAISE EXCEPTION 'enrichment_prebuilt_index_missing_or_drift';END IF;
END $index_guard$;
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
 ) SELECT l.slug,l.website,lease,l.id,l.name,l.entity_type,coalesce(l.profile->'_enrich','{}')-'lease',l.owner_workspace_id IS NOT NULL,l.owner_workspace_id FROM leased l;
END $function$;
COMMIT;

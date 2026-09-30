BEGIN;
SET LOCAL lock_timeout='5s';
CREATE OR REPLACE FUNCTION zoi.enrich_queue_lease(p_limit integer DEFAULT 40,p_max_age_days integer DEFAULT 30,p_lease_minutes integer DEFAULT 15)
RETURNS TABLE(slug text,website text,lease_id text,listing_id uuid,name text,entity_type text,existing_enrich jsonb,owner_managed boolean,owner_workspace_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE lease text:=gen_random_uuid()::text;n integer:=greatest(least(coalesce(p_limit,3),3),1);fresh_quota integer;
BEGIN
 fresh_quota:=ceil(n*2.0/3)::integer;
 RETURN QUERY WITH eligible AS MATERIALIZED (
 SELECT l.id,l.verification_status,l.profile#>>'{_enrich,checked_at}' AS checked,
 CASE WHEN l.profile#>>'{_enrich,crawl_status}'='error' THEN 1 ELSE 0 END AS bucket
 FROM zoi.listings l
 WHERE l.publish_status='published' AND l.moderation_status IN('clean','cleared') AND coalesce(l.marketplace_status,'')<>'hidden'
 AND l.website~*'^https?://' AND coalesce(l.profile#>>'{_enrich,blocked}','')<>'true'
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
 ), ranked AS (
 SELECT e.*,row_number() OVER(PARTITION BY bucket ORDER BY (verification_status IN('verified','owner_verified','source_verified'))DESC,checked NULLS FIRST,id) AS rank FROM eligible e
 ), candidates AS (
 SELECT l.id FROM ranked r JOIN zoi.listings l ON l.id=r.id
 WHERE l.publish_status='published' AND l.moderation_status IN('clean','cleared') AND coalesce(l.marketplace_status,'')<>'hidden' AND coalesce(l.profile#>>'{_enrich,blocked}','')<>'true' AND l.website~*'^https?://'
 AND coalesce(zoi.enrich_timestamp(l.profile#>>'{_enrich,lease,expires_at}'),'-infinity')<now()
 ORDER BY CASE WHEN (r.bucket=0 AND r.rank<=fresh_quota) OR (r.bucket=1 AND r.rank<=n-fresh_quota) THEN 0 ELSE 1 END,r.bucket,r.rank
 LIMIT n FOR UPDATE OF l SKIP LOCKED
 ), leased AS (
 UPDATE zoi.listings l SET profile=coalesce(l.profile,'{}')||jsonb_build_object('_enrich',coalesce(l.profile->'_enrich','{}')||jsonb_build_object('lease',jsonb_build_object('id',lease,'task','enrichment','fingerprint',zoi.listing_quality_fingerprint(l),'source_website',l.website,'expires_at',clock_timestamp()+make_interval(mins=>greatest(least(coalesce(p_lease_minutes,15),60),1)))))
 FROM candidates c WHERE l.id=c.id RETURNING l.*
 ) SELECT l.slug,l.website,lease,l.id,l.name,l.entity_type,coalesce(l.profile->'_enrich','{}')-'lease',l.owner_workspace_id IS NOT NULL,l.owner_workspace_id FROM leased l;
END $function$;
COMMIT;

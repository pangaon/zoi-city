-- Keep text-search OR branches indexable and choose a plan for actual filters.
-- Existing lower(name) / search_tsv indexes are reused. Region substring matching
-- was measured scanning 6,304 live heap blocks; btree region indexes cannot serve it.
-- Canonical links always derive from current entity_type and slug.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE INDEX listings_public_region_trgm_idx ON zoi.listings USING gin
 (lower(region) public.gin_trgm_ops,lower(region_native) public.gin_trgm_ops)
 WHERE publish_status='published' AND moderation_status IN ('clean','cleared')
 AND coalesce(marketplace_status,'')<>'hidden';

CREATE OR REPLACE FUNCTION public.explore_search(
 p_q text DEFAULT NULL,p_type text DEFAULT NULL,p_city text DEFAULT NULL,
 p_country text DEFAULT NULL,p_limit integer DEFAULT 24,p_offset integer DEFAULT 0,
 p_region text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
SET plan_cache_mode='force_custom_plan'
AS $$
BEGIN
 RETURN (WITH ranked AS NOT MATERIALIZED (
  SELECT l.id,l.name,l.verification_status,l.trust_score,
   row_number() OVER (
    PARTITION BY lower(trim(coalesce(l.name,''))),lower(trim(coalesce(l.city,''))),
     lower(trim(coalesce(zoi.geo_country_canon(l.country),'')))
    ORDER BY (l.verification_status='verified') DESC,l.trust_score DESC NULLS LAST,
     CASE l.entity_type WHEN 'creator' THEN 0 WHEN 'artist' THEN 1 WHEN 'business' THEN 2 ELSE 3 END,
     l.name,l.id
   ) AS dedupe_rank
  FROM zoi.listings l
  WHERE l.publish_status='published' AND l.moderation_status IN ('clean','cleared')
   AND coalesce(l.marketplace_status,'')<>'hidden'
   AND (p_q IS NULL OR p_q='' OR l.search_tsv @@ plainto_tsquery('simple',p_q)
    OR lower(l.name) LIKE '%'||lower(p_q)||'%' OR lower(l.region) LIKE '%'||lower(p_q)||'%'
    OR lower(l.region_native) LIKE '%'||lower(p_q)||'%')
   AND (p_type IS NULL OR p_type='' OR l.entity_type=p_type)
   AND (p_city IS NULL OR p_city='' OR l.city ILIKE p_city)
   AND (p_country IS NULL OR p_country='' OR zoi.geo_country_canon(l.country) ILIKE p_country)
   AND (p_region IS NULL OR p_region='' OR l.region ILIKE p_region
    OR l.region_native ILIKE p_region OR upper(l.region_code)=upper(p_region))
 ), page AS MATERIALIZED (
  SELECT id,name,verification_status,trust_score
  FROM ranked WHERE dedupe_rank=1
  ORDER BY (verification_status='verified') DESC,trust_score DESC NULLS LAST,name,id
  LIMIT least(greatest(p_limit,1),48) OFFSET greatest(p_offset,0)
 )
 SELECT coalesce(jsonb_agg(to_jsonb(r)-'_sort_verified'-'_sort_trust'
  ORDER BY r._sort_verified DESC,r._sort_trust DESC NULLS LAST,r.name,r.id),'[]'::jsonb)
 FROM (
  SELECT l.id,l.slug,l.name,
   left(coalesce(nullif(l.description,''),nullif(l.profile->>'description',''),
    nullif(l.profile->'_enrich'->>'description',''),''),170) AS description,
   c.label_en AS category,l.entity_type,l.city,zoi.geo_country_canon(l.country) AS country,
   l.region,l.region_code,l.region_native,
   '/'||replace(l.entity_type,'travel_place','travel-place')||'/'||l.slug AS path,
   l.verification_status,l.rating,
   coalesce(nullif(l.photo_url,''),nullif(l.profile->>'photo_url',''),nullif(l.profile->>'logo_url',''),
    nullif(l.profile->'_enrich'->>'photo_url',''),nullif(l.profile->'_enrich'->>'logo_url',''),
    nullif(l.profile->'_enrich'->'fields'->>'photo_url',''),
    nullif(l.profile->'_enrich'->'fields'->>'logo','')) AS photo_url,
   (l.owner_workspace_id IS NULL AND coalesce(l.claim_status,'unclaimed') NOT IN ('claimed','approved')) AS claimable,
   (page.verification_status='verified') AS _sort_verified,page.trust_score AS _sort_trust
  FROM page JOIN zoi.listings l ON l.id=page.id
  LEFT JOIN zoi.categories c ON c.id=l.primary_category_id
 ) r);
END;
$$;

-- Live metadata exposes only the seven-argument overload; fail review loudly if
-- a different legacy overload appears rather than leaving an unguarded endpoint.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='explore_search'
   AND p.oid<>'public.explore_search(text,text,text,text,integer,integer,text)'::regprocedure)
 THEN RAISE EXCEPTION 'unexpected_explore_search_overload_review_required'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.explore_fresh(p_limit integer DEFAULT 6)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(r)-'created_at' ORDER BY r.created_at DESC,r.id),'[]'::jsonb)
 FROM (
  SELECT l.id,l.slug,l.name,l.city,l.country,l.entity_type,
   '/'||replace(l.entity_type,'travel_place','travel-place')||'/'||l.slug AS path,l.created_at
  FROM zoi.listings l
  WHERE l.publish_status='published' AND l.moderation_status IN ('clean','cleared')
   AND coalesce(l.marketplace_status,'')<>'hidden'
  ORDER BY l.created_at DESC,l.id LIMIT least(greatest(coalesce(p_limit,6),1),12)
 ) r;
$$;
REVOKE ALL ON FUNCTION public.explore_search(text,text,text,text,integer,integer,text),
 public.explore_fresh(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.explore_search(text,text,text,text,integer,integer,text),
 public.explore_fresh(integer) TO anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;

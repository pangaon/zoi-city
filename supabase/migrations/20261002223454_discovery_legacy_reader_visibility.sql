-- Correct only public visibility in two legacy discovery readers.
-- Preserve every projection, identity/path, filtering, ranking and pagination
-- expression. The active integer map reader already inherits moderation gates
-- through v_public_listings and is deliberately not replaced.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $guard$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.dir_browse(text,text,integer,integer)')
  AND md5(pg_get_functiondef(p.oid))='ff3ccdfec15af114903090ac43bce4ad'
  AND p.proowner::regrole::text='postgres' AND p.proacl::text='{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}') THEN
  RAISE EXCEPTION 'legacy_discovery_prerequisite_changed: dir_browse(text,text,integer,integer)';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.explore_geo(text,text,text,text,integer)')
  AND md5(pg_get_functiondef(p.oid))='28142c68da9516ffcfcde28451bd683c'
  AND p.proowner::regrole::text='postgres' AND p.proacl::text='{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}') THEN
  RAISE EXCEPTION 'legacy_discovery_prerequisite_changed: explore_geo(text,text,text,text,integer)';
 END IF;
END;
$guard$;
CREATE OR REPLACE FUNCTION public.dir_browse(p_type text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, name text, entity_type text, city text, country text, category text, website text, phone text, logo text, colors jsonb, tagline text, rating numeric, rating_count integer, bookable boolean, sells_products boolean, claim_status text, verification_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    l.id, coalesce(l.display_name, l.name) as name, l.entity_type, l.city, l.country,
    c.label_en as category, l.website, l.phone,
    nullif(l.profile #>> '{brand,logo}', '') as logo,
    coalesce(l.profile #> '{brand,colors}', '[]'::jsonb) as colors,
    nullif(l.profile #>> '{brand,tagline}', '') as tagline,
    l.rating, l.rating_count,
    coalesce(l.bookable,false), coalesce(l.sells_products,false), l.claim_status, l.verification_status
  from zoi.listings l
  left join zoi.categories c on c.id = l.primary_category_id
  where l.publish_status = 'published' and l.moderation_status IN ('clean','cleared')
    and coalesce(l.marketplace_status,'')<>'hidden'
    and (p_type is null or l.entity_type = p_type)
    and (p_city is null or l.city ilike '%'||p_city||'%')
  order by (l.rating is not null) desc, l.rating desc nulls last,
           (nullif(l.profile #>> '{brand,logo}','') is not null) desc,
           l.completeness_score desc nulls last, l.name asc
  limit greatest(1, least(coalesce(p_limit,30), 60))
  offset greatest(0, coalesce(p_offset,0));
$function$;
CREATE OR REPLACE FUNCTION public.explore_geo(p_q text DEFAULT NULL::text, p_type text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_country text DEFAULT NULL::text, p_limit integer DEFAULT 600)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT COALESCE(jsonb_agg(to_jsonb(r)),'[]'::jsonb) FROM(
 SELECT l.id,l.name,COALESCE(l.canonical_path,'/p/'||l.slug) AS path,l.latitude AS lat,l.longitude AS lng,l.entity_type,l.city,(l.verification_status='verified') AS verified
 FROM zoi.listings l WHERE l.publish_status='published' AND l.moderation_status IN ('clean','cleared') AND COALESCE(l.marketplace_status,'')<>'hidden' AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL
 AND(p_type IS NULL OR l.entity_type=p_type) AND(p_city IS NULL OR l.city ILIKE p_city) AND(p_country IS NULL OR l.country ILIKE p_country)
 AND(p_q IS NULL OR l.name ILIKE '%'||p_q||'%' OR l.search_tsv @@ pg_catalog.plainto_tsquery('pg_catalog.simple',p_q))
 ORDER BY(l.verification_status='verified') DESC,l.trust_score DESC NULLS LAST,l.id
 LIMIT LEAST(GREATEST(p_limit,1),1200))r
$function$;
NOTIFY pgrst,'reload schema';
COMMIT;

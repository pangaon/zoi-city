-- Fresh public geography metadata from a narrow covering index.
-- Countries preserve their installed body. Regions/cities/stats acquire the same public
-- visibility contract as directory search. Country aliases and NULL/empty count
-- semantics remain unchanged. No cached counts, coordinates or listing writes.
-- Lead must review production lock/load before applying: this is a bounded,
-- transactional index build, not CONCURRENTLY. A timeout rolls back all changes.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $guard$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.explore_countries()')
   AND md5(pg_get_functiondef(p.oid))='8b87e02e65d94d1617f01cf068777628'
   AND p.proowner::regrole::text='postgres' AND p.proacl::text='{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}') THEN
  RAISE EXCEPTION 'discovery_geography_prerequisite_changed: explore_countries()';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.explore_regions(text)')
   AND md5(pg_get_functiondef(p.oid))='adcb7f5b9a7e346654fd48a7524ecb61'
   AND p.proowner::regrole::text='postgres' AND p.proacl::text='{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}') THEN
  RAISE EXCEPTION 'discovery_geography_prerequisite_changed: explore_regions(text)';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.home_stats()')
   AND md5(pg_get_functiondef(p.oid))='1d58fbf42da01360b389c9b38e04b935'
   AND p.proowner::regrole::text='postgres' AND p.proacl::text='{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}') THEN
  RAISE EXCEPTION 'discovery_geography_prerequisite_changed: home_stats()';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.explore_region_cities(text,text)')
   AND md5(pg_get_functiondef(p.oid))='9a29f951942e3cd3a525ff85c57e3c58'
   AND p.proowner::regrole::text='postgres' AND p.proacl::text='{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}') THEN
  RAISE EXCEPTION 'discovery_geography_prerequisite_changed: explore_region_cities(text,text)';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.explore_cities(integer)')
   AND md5(pg_get_functiondef(p.oid))='e599c251e0f1db639055d6f99a2e8812'
   AND p.proowner::regrole::text='postgres' AND p.proacl::text='{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}') THEN
  RAISE EXCEPTION 'discovery_geography_prerequisite_changed: explore_cities(integer)';
 END IF;
 IF md5(pg_get_functiondef('zoi.geo_country_canon(text)'::regprocedure))<>'a4610e0eee4af255cbc37d228b248be9' THEN
  RAISE EXCEPTION 'discovery_country_normalization_changed';
 END IF;
 IF to_regclass('zoi.listings_public_geography_counts_idx') IS NOT NULL THEN
  RAISE EXCEPTION 'discovery_geography_index_already_exists';
 END IF;
END;
$guard$;
CREATE INDEX listings_public_geography_counts_idx ON zoi.listings
 (country,region,city) INCLUDE (region_code,region_native)
 WHERE publish_status='published' AND moderation_status IN ('clean','cleared')
 AND coalesce(marketplace_status,'')<>'hidden';

CREATE OR REPLACE FUNCTION public.explore_regions(p_country text DEFAULT NULL::text)
RETURNS TABLE(country text,region text,region_code text,listings bigint,cities bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'zoi','public'
AS $function$
 WITH eligible AS MATERIALIZED (
  SELECT l.country,l.region,l.city,l.region_code,count(*) AS n
  FROM zoi.listings l
  WHERE l.publish_status='published' AND l.moderation_status IN ('clean','cleared')
   AND coalesce(l.marketplace_status,'')<>'hidden'
   AND l.region IS NOT NULL AND l.region<>''
  GROUP BY l.country,l.region,l.city,l.region_code
 ), names AS MATERIALIZED (SELECT DISTINCT country FROM eligible),
 canonical AS MATERIALIZED (
  SELECT country AS original,zoi.geo_country_canon(country) AS name FROM names
 )
 SELECT c.name,l.region,max(l.region_code),sum(l.n)::bigint,count(DISTINCT l.city)
 FROM eligible l JOIN canonical c ON c.original=l.country
 WHERE c.name IS NOT NULL
  AND (p_country IS NULL OR p_country='' OR c.name ILIKE p_country)
 GROUP BY c.name,l.region ORDER BY sum(l.n) DESC;
$function$;

CREATE OR REPLACE FUNCTION public.explore_cities(p_limit integer DEFAULT 24)
RETURNS TABLE(city text,country text,n bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'zoi','public'
AS $function$
 WITH eligible AS MATERIALIZED (
  SELECT l.country,l.city,count(*) AS n FROM zoi.listings l
  WHERE l.publish_status='published' AND l.moderation_status IN ('clean','cleared')
   AND coalesce(l.marketplace_status,'')<>'hidden'
   AND l.city IS NOT NULL AND l.city<>''
  GROUP BY l.country,l.city
 ), names AS MATERIALIZED (SELECT DISTINCT country FROM eligible),
 canonical AS MATERIALIZED (
  SELECT country AS original,zoi.geo_country_canon(country) AS name FROM names
 )
 SELECT l.city,c.name,sum(l.n)::bigint
 FROM eligible l LEFT JOIN canonical c ON c.original=l.country
 GROUP BY l.city,c.name ORDER BY sum(l.n) DESC,l.city
 LIMIT least(greatest(coalesce(p_limit,24),1),100);
$function$;

CREATE OR REPLACE FUNCTION public.explore_region_cities(p_country text DEFAULT NULL::text,p_region text DEFAULT NULL::text)
RETURNS TABLE(country text,region text,city text,listings bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'zoi','public'
AS $function$
 WITH eligible AS MATERIALIZED (
  SELECT l.country,l.region,l.city,count(*) AS n FROM zoi.listings l
  WHERE l.publish_status='published' AND l.moderation_status IN ('clean','cleared')
   AND coalesce(l.marketplace_status,'')<>'hidden'
   AND l.city IS NOT NULL AND l.city<>''
   AND (p_region IS NULL OR p_region='' OR l.region ILIKE p_region
    OR l.region_native ILIKE p_region OR upper(l.region_code)=upper(p_region))
  GROUP BY l.country,l.region,l.city
 ), names AS MATERIALIZED (SELECT DISTINCT country FROM eligible),
 canonical AS MATERIALIZED (
  SELECT country AS original,zoi.geo_country_canon(country) AS name FROM names
 )
 SELECT c.name,l.region,l.city,sum(l.n)::bigint
 FROM eligible l JOIN canonical c ON c.original=l.country
 WHERE c.name IS NOT NULL
  AND (p_country IS NULL OR p_country='' OR c.name ILIKE p_country)
 GROUP BY c.name,l.region,l.city ORDER BY sum(l.n) DESC;
$function$;

CREATE OR REPLACE FUNCTION public.home_stats()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'zoi','public'
AS $function$
 SELECT jsonb_build_object('listings',count(*),'cities',count(DISTINCT l.city),
  'countries',count(DISTINCT l.country))
 FROM zoi.listings l
 WHERE l.publish_status='published' AND l.moderation_status IN ('clean','cleared')
  AND coalesce(l.marketplace_status,'')<>'hidden';
$function$;
NOTIFY pgrst,'reload schema';
COMMIT;

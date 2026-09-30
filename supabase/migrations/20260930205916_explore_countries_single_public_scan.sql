-- Compute fresh public country metadata from one narrow listing scan.
-- Keep raw-country alias mapping once per distinct spelling and preserve all
-- existing count/null/distinct/order semantics. No persistent cache or grants.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE OR REPLACE FUNCTION public.explore_countries()
RETURNS TABLE(country text,listings bigint,regions bigint,cities bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
 WITH eligible AS MATERIALIZED (
  SELECT l.country,l.region,l.city,count(*) AS n FROM zoi.listings l
  WHERE l.publish_status='published'
   AND l.moderation_status IN ('clean','cleared')
   AND coalesce(l.marketplace_status,'')<>'hidden'
   AND nullif(l.country,'') IS NOT NULL
  GROUP BY l.country,l.region,l.city
 ), names AS MATERIALIZED (SELECT DISTINCT country FROM eligible),
 canonical AS MATERIALIZED (
  SELECT country AS original,zoi.geo_country_canon(country) AS name FROM names
 )
 SELECT c.name,sum(l.n)::bigint,count(DISTINCT l.region),count(DISTINCT l.city)
 FROM eligible l JOIN canonical c ON c.original=l.country
 WHERE c.name IS NOT NULL GROUP BY c.name ORDER BY sum(l.n) DESC,c.name;
$function$;
NOTIFY pgrst,'reload schema';
COMMIT;

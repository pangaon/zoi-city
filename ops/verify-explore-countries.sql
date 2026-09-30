BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='25s';
SET LOCAL lock_timeout='3s';
-- Read-only consistency check in one snapshot. No synthetic public listings.
DO $check$
DECLARE old_rows jsonb;new_rows jsonb;
BEGIN
 WITH names AS MATERIALIZED (
  SELECT DISTINCT l.country FROM zoi.listings l
  WHERE l.publish_status='published' AND l.moderation_status IN ('clean','cleared')
   AND coalesce(l.marketplace_status,'')<>'hidden' AND nullif(l.country,'') IS NOT NULL
 ), canonical AS MATERIALIZED (
  SELECT country AS original,zoi.geo_country_canon(country) AS name FROM names
 ), expected AS (
  SELECT c.name AS country,count(*) AS listings,count(DISTINCT l.region) AS regions,count(DISTINCT l.city) AS cities
  FROM zoi.listings l JOIN canonical c ON c.original=l.country
  WHERE l.publish_status='published' AND l.moderation_status IN ('clean','cleared')
   AND coalesce(l.marketplace_status,'')<>'hidden' AND c.name IS NOT NULL
  GROUP BY c.name
 ) SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY listings DESC,country),'[]') INTO old_rows FROM expected e;
 SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY listings DESC,country),'[]') INTO new_rows FROM public.explore_countries() e;
 IF old_rows IS DISTINCT FROM new_rows THEN RAISE EXCEPTION 'country_metadata_parity_failed';END IF;
 IF NOT has_function_privilege('anon','public.explore_countries()','execute') OR NOT has_function_privilege('authenticated','public.explore_countries()','execute') THEN RAISE EXCEPTION 'country_metadata_public_grants_changed';END IF;
 RAISE NOTICE 'Country aggregate parity passed: % rows',jsonb_array_length(new_rows);
END $check$;
ROLLBACK;

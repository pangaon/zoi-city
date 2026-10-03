-- Lead owns production load/lock review. No function, ranking or field changes.
-- Cover only the existing public dedupe/ranking input; wide profile projection
-- remains after the bounded page. No profile copy or planner overrides.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $guard$
DECLARE f record; signature text; expected_hash text;
BEGIN
 FOR signature,expected_hash IN SELECT * FROM (VALUES
  ('public.explore_search(text,text,text,text,integer,integer,text)','7fc2041a21a19e4c28f1f5a239d1750e'),
  ('public.explore_search_types(text,text[],text,text,integer,integer,text)','0cc6eb68a31a7d92f68b0e8da911bc70')
 ) AS expected(signature,body_hash) LOOP
  SELECT p.*,md5(pg_get_functiondef(p.oid)) AS body_hash INTO f FROM pg_proc p WHERE p.oid=to_regprocedure(signature);
  IF NOT FOUND OR f.body_hash<>expected_hash OR f.proowner<>'postgres'::regrole
   OR f.proacl IS DISTINCT FROM '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]
  THEN RAISE EXCEPTION 'explore_global_rank_prerequisite_changed'; END IF;
 END LOOP;
 IF md5(pg_get_functiondef('zoi.geo_country_canon(text)'::regprocedure))<>'a4610e0eee4af255cbc37d228b248be9'
  OR to_regclass('zoi.listings_public_global_rank_idx') IS NOT NULL
 THEN RAISE EXCEPTION 'explore_global_rank_prerequisite_changed'; END IF;
END
$guard$;
CREATE INDEX listings_public_global_rank_idx ON zoi.listings (
 lower(trim(coalesce(name,''))),
 lower(trim(coalesce(city,''))),
 lower(trim(coalesce(zoi.geo_country_canon(country),''))),
 (verification_status='verified') DESC,
 trust_score DESC NULLS LAST,
 (CASE entity_type WHEN 'creator' THEN 0 WHEN 'artist' THEN 1 WHEN 'business' THEN 2 ELSE 3 END),
 name,
 id
)
INCLUDE (verification_status,entity_type,city,country)
WHERE publish_status='published'
 AND moderation_status IN ('clean','cleared')
 AND coalesce(marketplace_status,'')<>'hidden';
COMMIT;

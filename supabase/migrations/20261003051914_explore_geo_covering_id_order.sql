-- Exact installed reader, view and authority prerequisites; index only.
-- No coordinates, row projection, visibility, function, ACL or API timeout changes.
BEGIN;
SET LOCAL lock_timeout='3s';
DO $guard$
DECLARE f record; signature text; expected_hash text;
BEGIN
 FOR signature,expected_hash IN SELECT * FROM (VALUES
  ('public.explore_geo(integer,integer)','1abb7e538894bedf71984134d22c3701'),
  ('public.explore_geo(text,text,text,text,integer)','c332bbe56099a438028cfb1ff25c50d3')
 ) AS expected(signature,body_hash) LOOP
  SELECT p.* INTO f FROM pg_proc p WHERE p.oid=to_regprocedure(signature);
  IF NOT FOUND OR md5(f.prosrc)<>expected_hash OR f.proowner<>'postgres'::regrole
   OR NOT f.prosecdef OR f.provolatile<>'s'
   OR f.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
   OR f.proacl IS DISTINCT FROM '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]
  THEN RAISE EXCEPTION 'explore_geo_order_prerequisite_changed'; END IF;
 END LOOP;
 IF md5(pg_get_viewdef('zoi.v_public_listings'::regclass,true)) IS DISTINCT FROM '2b46539e1df515c212845c391a322f74'
  OR md5((SELECT prosrc FROM pg_proc WHERE oid='zoi.geo_country_canon(text)'::regprocedure)) IS DISTINCT FROM '2ca13a82ac61d8a3a6871cc379c6cd59'
  OR md5((SELECT prosrc FROM pg_proc WHERE oid='zoi.geo_precision_canon(text)'::regprocedure)) IS DISTINCT FROM '1934851677c4e3d563c36af010375044'
  OR to_regclass('zoi.listings_public_geo_order_idx') IS NOT NULL
 THEN RAISE EXCEPTION 'explore_geo_order_prerequisite_changed'; END IF;
END
$guard$;
CREATE INDEX listings_public_geo_order_idx ON zoi.listings(id)
INCLUDE (slug,entity_type,name,city,country,primary_category_id,latitude,longitude)
WHERE publish_status='published'
 AND moderation_status IN ('clean','cleared')
 AND duplicate_status<>'confirmed_duplicate'
 AND latitude IS NOT NULL AND longitude IS NOT NULL;
COMMIT;

-- Compute each normalized identity field once per row, rather than expanding
-- nested SQL expressions repeatedly in DISTINCT and sorting.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE OR REPLACE FUNCTION zoi.seo_name(p_name text,p_city text)
RETURNS text LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
DECLARE n text:=zoi.seo_text(p_name); c text:=zoi.seo_text(p_city);
BEGIN
 IF c<>'' AND length(n)>length(c)+1 AND right(n,length(c)+1)=' '||c THEN
  RETURN left(n,length(n)-length(c)-1);
 END IF;
 RETURN n;
END;
$$;
CREATE OR REPLACE FUNCTION zoi.seo_canonical_rows()
RETURNS TABLE(slug text,entity_type text,updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH candidates AS MATERIALIZED (
  SELECT l.slug,l.entity_type,coalesce(l.updated_at,l.created_at) updated_at,
   zoi.seo_name(l.name,l.city) nname,zoi.seo_text(l.city) city_key,zoi.seo_text(l.region) region_key,
   zoi.seo_text(l.country) country_key,zoi.seo_text(l.address) address_key,
   (((l.address IS NOT NULL)::int)+((l.phone IS NOT NULL)::int)+((l.website IS NOT NULL)::int)+((l.latitude IS NOT NULL)::int)+((l.description IS NOT NULL)::int)) completeness,
   (l.slug ~ '-[0-9a-f]{6}$')::int ugly
  FROM zoi.listings l
  WHERE l.publish_status='published' AND coalesce(l.marketplace_status,'')<>'hidden'
   AND nullif(btrim(l.slug),'') IS NOT NULL AND nullif(btrim(l.name),'') IS NOT NULL
   AND (l.city IS NOT NULL OR l.address IS NOT NULL OR l.website IS NOT NULL)
 ), canonical AS (
  SELECT DISTINCT ON(nname,city_key,region_key,country_key,address_key,entity_type) slug,entity_type,updated_at
  FROM candidates ORDER BY nname,city_key,region_key,country_key,address_key,entity_type,completeness DESC,ugly,updated_at DESC,slug
 ) SELECT slug,entity_type,updated_at FROM canonical;
$$;
REVOKE ALL ON FUNCTION zoi.seo_canonical_rows() FROM PUBLIC,anon,authenticated;
COMMIT;

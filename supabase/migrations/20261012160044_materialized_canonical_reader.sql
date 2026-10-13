BEGIN;
SET LOCAL lock_timeout='3s';
DO $$ BEGIN IF md5(pg_get_functiondef('zoi.seo_canonical_rows()'::regprocedure)) <> '9ac79967c585ef53253367e06134f883' THEN RAISE EXCEPTION 'Canonical reader changed'; END IF; END $$;
CREATE OR REPLACE FUNCTION zoi.seo_canonical_rows()
 RETURNS TABLE(slug text, entity_type text, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET work_mem TO '16MB'
AS $function$
#variable_conflict use_column
BEGIN
 RETURN QUERY
 WITH candidates AS MATERIALIZED (
  SELECT l.slug,l.entity_type,coalesce(l.updated_at,l.created_at) updated_at,
   k.name_key nname,k.city_key,k.region_key,k.country_key,k.address_key,
   (((l.address IS NOT NULL)::int)+((l.phone IS NOT NULL)::int)+((l.website IS NOT NULL)::int)+((l.latitude IS NOT NULL)::int)+((l.description IS NOT NULL)::int)) completeness,
   (l.slug ~ '-[0-9a-f]{6}$')::int ugly
  FROM zoi.listings l JOIN zoi.seo_identity_keys k ON k.listing_id=l.id
  WHERE l.publish_status='published' AND l.moderation_status IN ('clean','cleared')
   AND coalesce(l.marketplace_status,'')<>'hidden'
   AND nullif(btrim(l.slug),'') IS NOT NULL AND nullif(btrim(l.name),'') IS NOT NULL
   AND (l.city IS NOT NULL OR l.address IS NOT NULL OR l.website IS NOT NULL)
 ), canonical AS (
  SELECT DISTINCT ON(nname,city_key,region_key,country_key,address_key,entity_type) slug,entity_type,updated_at
  FROM candidates ORDER BY nname,city_key,region_key,country_key,address_key,entity_type,completeness DESC,ugly,updated_at DESC,slug
 ) SELECT slug,entity_type,updated_at FROM canonical;
END;
$function$;

COMMIT;


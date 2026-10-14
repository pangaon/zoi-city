CREATE OR REPLACE FUNCTION public.explore_geo(p_limit integer DEFAULT 5000, p_offset integer DEFAULT 0)
 RETURNS TABLE(slug text, entity_type text, name text, city text, country text, category_slug text, lat double precision, lng double precision, geo_precision text, address text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT e.slug::text,e.entity_type::text,e.name::text,e.city::text,zoi.geo_country_canon(e.country)::text,e.category_slug::text,e.latitude::double precision,e.longitude::double precision,zoi.geo_precision_canon(COALESCE(NULLIF(l.geo_precision::text,'none'),l.profile->'_geo'->>'precision'))::text,l.address::text
 FROM zoi.v_public_listings e JOIN zoi.listings l ON l.id=e.id
 WHERE e.latitude IS NOT NULL AND e.longitude IS NOT NULL AND l.publish_status='published' AND COALESCE(l.marketplace_status,'')<>'hidden'
 ORDER BY e.id LIMIT LEAST(GREATEST(COALESCE(p_limit,5000),1),5000) OFFSET GREATEST(COALESCE(p_offset,0),0)
$function$
;

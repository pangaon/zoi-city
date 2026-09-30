-- Both live overloads reviewed 2026-09-30. Do not change the shared public view.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE OR REPLACE FUNCTION public.explore_geo(p_limit integer DEFAULT 5000,p_offset integer DEFAULT 0)
RETURNS TABLE(slug text,entity_type text,name text,city text,country text,category_slug text,lat double precision,lng double precision,geo_precision text,address text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT e.slug::text,e.entity_type::text,e.name::text,e.city::text,zoi.geo_country_canon(e.country)::text,e.category_slug::text,e.latitude::double precision,e.longitude::double precision,zoi.geo_precision_canon(COALESCE(NULLIF(l.geo_precision::text,'none'),l.profile->'_geo'->>'precision'))::text,l.address::text
 FROM zoi.v_public_listings e JOIN zoi.listings l ON l.id=e.id
 WHERE e.latitude IS NOT NULL AND e.longitude IS NOT NULL AND l.publish_status='published' AND COALESCE(l.marketplace_status,'')<>'hidden'
 ORDER BY e.id LIMIT LEAST(GREATEST(COALESCE(p_limit,5000),1),5000) OFFSET GREATEST(COALESCE(p_offset,0),0)
$$;
CREATE OR REPLACE FUNCTION public.explore_geo(p_q text DEFAULT NULL,p_type text DEFAULT NULL,p_city text DEFAULT NULL,p_country text DEFAULT NULL,p_limit integer DEFAULT 600)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(jsonb_agg(to_jsonb(r)),'[]'::jsonb) FROM(
 SELECT l.id,l.name,COALESCE(l.canonical_path,'/p/'||l.slug) AS path,l.latitude AS lat,l.longitude AS lng,l.entity_type,l.city,(l.verification_status='verified') AS verified
 FROM zoi.listings l WHERE l.publish_status='published' AND COALESCE(l.marketplace_status,'')<>'hidden' AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL
 AND(p_type IS NULL OR l.entity_type=p_type) AND(p_city IS NULL OR l.city ILIKE p_city) AND(p_country IS NULL OR l.country ILIKE p_country)
 AND(p_q IS NULL OR l.name ILIKE '%'||p_q||'%' OR l.search_tsv @@ pg_catalog.plainto_tsquery('pg_catalog.simple',p_q))
 ORDER BY(l.verification_status='verified') DESC,l.trust_score DESC NULLS LAST,l.id
 LIMIT LEAST(GREATEST(p_limit,1),1200))r
$$;
COMMIT;

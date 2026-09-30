BEGIN;
SET LOCAL lock_timeout='5s';
CREATE OR REPLACE FUNCTION public.seo_related(p_slug text,p_limit integer DEFAULT 8)
RETURNS TABLE(slug text,name text,city text,entity_type text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH me AS (
  SELECT id,primary_category_id,city,region_id,place_id FROM zoi.listings
  WHERE slug=p_slug AND publish_status='published' AND coalesce(marketplace_status,'')<>'hidden' LIMIT 1
 )
 SELECT l.slug,l.name,l.city,l.entity_type FROM zoi.listings l,me
 WHERE l.id<>me.id AND nullif(btrim(l.slug),'') IS NOT NULL AND nullif(btrim(l.name),'') IS NOT NULL
  AND l.publish_status='published' AND coalesce(l.marketplace_status,'')<>'hidden'
  AND (l.primary_category_id=me.primary_category_id OR l.city=me.city OR l.region_id=me.region_id OR l.place_id=me.place_id)
 ORDER BY (l.primary_category_id=me.primary_category_id AND l.city=me.city) DESC NULLS LAST,
  (l.city=me.city) DESC NULLS LAST,(l.primary_category_id=me.primary_category_id) DESC NULLS LAST,
  l.trust_score DESC NULLS LAST,l.slug
 LIMIT greatest(1,least(coalesce(p_limit,8),20));
$$;
CREATE OR REPLACE FUNCTION public.listing_completeness(p_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT zoi.profile_completeness(l.id) FROM zoi.listings l
 WHERE l.slug=p_slug AND l.publish_status='published' AND coalesce(l.marketplace_status,'')<>'hidden';
$$;
REVOKE ALL ON FUNCTION public.seo_related(text,integer),public.listing_completeness(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seo_related(text,integer),public.listing_completeness(text) TO anon,authenticated,service_role;
COMMIT;

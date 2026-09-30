-- Only published organizations are discoverable. Preserve Greek names and
-- distinct geographic branches when choosing canonical pages.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE OR REPLACE FUNCTION zoi.seo_text(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
 SELECT btrim(regexp_replace(lower(coalesce(p_value,'')), '[^[:alnum:]]+', ' ', 'g'));
$$;
CREATE OR REPLACE FUNCTION zoi.seo_name(p_name text,p_city text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
 WITH v AS (SELECT zoi.seo_text(p_name) n,zoi.seo_text(p_city) c)
 SELECT CASE WHEN c<>'' AND length(n)>length(c)+1 AND right(n,length(c)+1)=' '||c THEN left(n,length(n)-length(c)-1) ELSE n END FROM v;
$$;
REVOKE ALL ON FUNCTION zoi.seo_text(text),zoi.seo_name(text,text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION zoi.seo_canonical_rows()
RETURNS TABLE(slug text,entity_type text,updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH candidates AS (
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
CREATE OR REPLACE FUNCTION public.seo_index(p_limit integer DEFAULT 50000,p_offset integer DEFAULT 0)
RETURNS TABLE(slug text,entity_type text,updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT * FROM zoi.seo_canonical_rows() ORDER BY entity_type,slug
 LIMIT greatest(1,least(coalesce(p_limit,50000),50000)) OFFSET greatest(0,coalesce(p_offset,0));
$$;
CREATE OR REPLACE FUNCTION public.seo_sitemap_stats()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('count',count(*),'lastmod',max(updated_at)) FROM zoi.seo_canonical_rows();
$$;
CREATE OR REPLACE FUNCTION public.seo_entity(p_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH me AS (
  SELECT l.* FROM zoi.listings l WHERE l.slug=p_slug AND l.publish_status='published'
   AND coalesce(l.marketplace_status,'')<>'hidden' LIMIT 1
 ), canon AS (
  SELECT l2.slug FROM zoi.listings l2,me
  WHERE l2.publish_status='published' AND coalesce(l2.marketplace_status,'')<>'hidden' AND nullif(btrim(l2.slug),'') IS NOT NULL
   AND l2.entity_type=me.entity_type AND zoi.seo_name(l2.name,l2.city)=zoi.seo_name(me.name,me.city)
   AND zoi.seo_text(l2.city)=zoi.seo_text(me.city) AND zoi.seo_text(l2.region)=zoi.seo_text(me.region)
   AND zoi.seo_text(l2.country)=zoi.seo_text(me.country) AND zoi.seo_text(l2.address)=zoi.seo_text(me.address)
  ORDER BY (((l2.address IS NOT NULL)::int)+((l2.phone IS NOT NULL)::int)+((l2.website IS NOT NULL)::int)+((l2.latitude IS NOT NULL)::int)+((l2.description IS NOT NULL)::int)) DESC,
   (l2.slug ~ '-[0-9a-f]{6}$')::int,coalesce(l2.updated_at,l2.created_at) DESC,l2.slug LIMIT 1
 )
 SELECT jsonb_build_object('id',me.id,'name',me.name,'entity_type',me.entity_type,'slug',me.slug,
  'canonical_slug',(SELECT slug FROM canon),'city',me.city,'country',me.country,'address',me.address,'phone',me.phone,
  'website',me.website,'description',me.description,'latitude',me.latitude,'longitude',me.longitude,
  'rating',me.rating,'rating_count',me.rating_count,'price_range',me.price_range,'meta_title',me.meta_title,'meta_description',me.meta_description,
  'social_links',me.social_links,'profile',me.profile,'category_slug',(SELECT c.slug FROM zoi.categories c WHERE c.id=me.primary_category_id),
  'place_path',CASE WHEN me.place_id IS NOT NULL THEN zoi.place_path(me.place_id) ELSE NULL END,'updated_at',coalesce(me.updated_at,me.created_at)) FROM me;
$$;
REVOKE ALL ON FUNCTION public.seo_index(integer,integer),public.seo_sitemap_stats(),public.seo_entity(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.seo_index(integer,integer),public.seo_sitemap_stats(),public.seo_entity(text) TO anon,authenticated,service_role;
COMMIT;

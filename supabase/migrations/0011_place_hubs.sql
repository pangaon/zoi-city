-- Data for the place hubs.
--
-- /explore ships zero listing links in its server HTML, and there is no page for
-- "Greek bakeries in North Carolina" — which is what people type. So 8,787
-- listing pages are orphans: the sitemap points at them and nothing on the site
-- links to them. These are the aggregates the hub pages need, one call each.

BEGIN;

-- Countries, with how much is in them.
CREATE OR REPLACE FUNCTION public.explore_countries()
RETURNS TABLE(country text, listings bigint, regions bigint, cities bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'zoi','public'
AS $$
  SELECT l.country, count(*), count(DISTINCT l.region), count(DISTINCT l.city)
    FROM zoi.listings l
   WHERE l.publish_status='published' AND l.country IS NOT NULL AND l.country <> ''
   GROUP BY l.country ORDER BY count(*) DESC;
$$;

-- Cities within a region (or a whole country).
-- NOTE: renamed to explore_region_cities in 0014 — a pre-existing
-- explore_cities(p_limit integer) already existed with a different shape, and
-- two same-named functions returning different things is a PGRST203 waiting to
-- happen. Kept here for history; the live name is explore_region_cities.
CREATE OR REPLACE FUNCTION public.explore_cities(p_country text DEFAULT NULL, p_region text DEFAULT NULL)
RETURNS TABLE(country text, region text, city text, listings bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'zoi','public'
AS $$
  SELECT l.country, l.region, l.city, count(*)
    FROM zoi.listings l
   WHERE l.publish_status='published' AND l.city IS NOT NULL AND l.city <> ''
     AND (p_country IS NULL OR p_country='' OR l.country ILIKE p_country)
     AND (p_region  IS NULL OR p_region=''  OR l.region ILIKE p_region
          OR l.region_native ILIKE p_region OR upper(l.region_code)=upper(p_region))
   GROUP BY l.country, l.region, l.city ORDER BY count(*) DESC;
$$;

-- Categories, optionally within a place. This is what makes
-- "bakeries in North Carolina" a page rather than a search.
CREATE OR REPLACE FUNCTION public.explore_categories(
  p_country text DEFAULT NULL, p_region text DEFAULT NULL, p_city text DEFAULT NULL)
RETURNS TABLE(category_slug text, label text, entity_type text, listings bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'zoi','public'
AS $$
  SELECT c.slug, coalesce(c.label_en, c.slug), max(l.entity_type), count(*)
    FROM zoi.listings l
    JOIN zoi.categories c ON c.id = l.primary_category_id
   WHERE l.publish_status='published'
     AND (p_country IS NULL OR p_country='' OR l.country ILIKE p_country)
     AND (p_region  IS NULL OR p_region=''  OR l.region ILIKE p_region
          OR l.region_native ILIKE p_region OR upper(l.region_code)=upper(p_region))
     AND (p_city    IS NULL OR p_city=''    OR l.city ILIKE p_city)
   GROUP BY c.slug, c.label_en ORDER BY count(*) DESC;
$$;

-- Listings for a hub page. Paged, so a hub with 900 entries is a real page and
-- not a truncated tease.
CREATE OR REPLACE FUNCTION public.explore_place_listings(
  p_country text DEFAULT NULL, p_region text DEFAULT NULL, p_city text DEFAULT NULL,
  p_category text DEFAULT NULL, p_limit integer DEFAULT 60, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'zoi','public'
AS $$
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM zoi.listings l
               LEFT JOIN zoi.categories c ON c.id=l.primary_category_id
              WHERE l.publish_status='published'
                AND (p_country  IS NULL OR p_country=''  OR l.country ILIKE p_country)
                AND (p_region   IS NULL OR p_region=''   OR l.region ILIKE p_region
                     OR l.region_native ILIKE p_region OR upper(l.region_code)=upper(p_region))
                AND (p_city     IS NULL OR p_city=''     OR l.city ILIKE p_city)
                AND (p_category IS NULL OR p_category='' OR c.slug = p_category)),
    'rows', COALESCE((
      SELECT jsonb_agg(to_jsonb(r)) FROM (
        SELECT l.slug, l.name, l.entity_type, l.city, l.region, l.country,
               c.slug AS category_slug, coalesce(c.label_en,c.slug) AS category,
               left(coalesce(l.description,''),150) AS description,
               l.latitude, l.longitude,
               (l.profile->'_enrich'->>'photo_url') AS photo,
               l.verification_status
          FROM zoi.listings l
          LEFT JOIN zoi.categories c ON c.id=l.primary_category_id
         WHERE l.publish_status='published'
           AND (p_country  IS NULL OR p_country=''  OR l.country ILIKE p_country)
           AND (p_region   IS NULL OR p_region=''   OR l.region ILIKE p_region
                OR l.region_native ILIKE p_region OR upper(l.region_code)=upper(p_region))
           AND (p_city     IS NULL OR p_city=''     OR l.city ILIKE p_city)
           AND (p_category IS NULL OR p_category='' OR c.slug = p_category)
         ORDER BY (l.verification_status='verified') DESC,
                  (l.profile->'_enrich'->>'photo_url') IS NOT NULL DESC,
                  l.trust_score DESC NULLS LAST, l.name
         LIMIT LEAST(GREATEST(p_limit,1),120) OFFSET GREATEST(p_offset,0)
      ) r), '[]'::jsonb));
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.explore_countries()',
    'public.explore_cities(text,text)',
    'public.explore_categories(text,text,text)',
    'public.explore_place_listings(text,text,text,text,integer,integer)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', f);
  END LOOP;
END $$;

COMMIT;

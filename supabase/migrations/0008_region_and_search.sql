-- Give the directory a geography, and teach search to use it.
--
-- THE PROBLEM
-- Every listing has a city and a country and nothing in between. region, state
-- and postal_code are null on all 11,829 rows. So "Charlotte" finds things,
-- because that is a city value, and "North Carolina" finds three, because it is
-- only matching stray text. There is no hierarchy to walk, no way to filter by
-- state, and no page that can target "Greek bakery North Carolina" — which is
-- what people actually type.
--
-- THE FIX
-- A listing's state is a property of its city, so it is resolved once per city
-- and applied to every listing in it: ~1,900 lookups instead of ~7,800, same
-- answer. Source is OpenStreetMap's administrative hierarchy.

BEGIN;

ALTER TABLE zoi.listings ADD COLUMN IF NOT EXISTS region      text;
ALTER TABLE zoi.listings ADD COLUMN IF NOT EXISTS region_code text;

COMMENT ON COLUMN zoi.listings.region IS
  'State / province / prefecture, resolved from the city via OpenStreetMap. Not owner-supplied.';
COMMENT ON COLUMN zoi.listings.region_code IS
  'ISO 3166-2 subdivision code without the country prefix, e.g. NC, ON, NSW.';

-- Lookups are "everything in this state", so index the lowered value.
CREATE INDEX IF NOT EXISTS idx_listings_region
  ON zoi.listings (lower(region)) WHERE region IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_region_code
  ON zoi.listings (upper(region_code)) WHERE region_code IS NOT NULL;

-- Search: region added as both a match and a filter.
--
-- p_region is appended LAST with a default so every existing caller keeps
-- working untouched.
--
-- Also fixed here: path fell back to '/p/'||slug, and /p/ is a 301 redirect to
-- the real URL. Every search result was therefore costing a visitor an extra
-- round trip, and handing search engines a redirect instead of a page. It now
-- falls back to the real typed path.
CREATE OR REPLACE FUNCTION public.explore_search(
  p_q       text    DEFAULT NULL::text,
  p_type    text    DEFAULT NULL::text,
  p_city    text    DEFAULT NULL::text,
  p_country text    DEFAULT NULL::text,
  p_limit   integer DEFAULT 24,
  p_offset  integer DEFAULT 0,
  p_region  text    DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'zoi', 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(to_jsonb(r)),'[]'::jsonb) FROM (
    SELECT l.id, l.slug, l.name,
      left(COALESCE(l.description,''),170) AS description,
      c.label_en AS category, l.entity_type, l.city, l.country,
      l.region, l.region_code,
      COALESCE(
        l.canonical_path,
        '/' || replace(l.entity_type,'travel_place','travel-place') || '/' || l.slug
      ) AS path,
      l.verification_status, l.rating, l.photo_url,
      (l.owner_workspace_id IS NULL AND COALESCE(l.claim_status,'unclaimed') NOT IN ('claimed','approved')) AS claimable
    FROM zoi.listings l
    LEFT JOIN zoi.categories c ON c.id=l.primary_category_id
    WHERE l.publish_status='published'
      AND (p_q IS NULL OR p_q='' OR l.search_tsv @@ plainto_tsquery('simple', p_q)
           OR l.name ILIKE '%'||p_q||'%'
           -- "north carolina" now means the state, not a text coincidence
           OR l.region ILIKE '%'||p_q||'%')
      AND (p_type    IS NULL OR p_type=''    OR l.entity_type=p_type)
      AND (p_city    IS NULL OR p_city=''    OR l.city ILIKE p_city)
      AND (p_country IS NULL OR p_country='' OR l.country ILIKE p_country)
      AND (p_region  IS NULL OR p_region=''  OR l.region ILIKE p_region
           OR upper(l.region_code)=upper(p_region))
    ORDER BY (l.verification_status='verified') DESC, l.trust_score DESC NULLS LAST, l.name
    LIMIT LEAST(GREATEST(p_limit,1),48) OFFSET GREATEST(p_offset,0)
  ) r;
$function$;

-- Regions, for building the landing pages: which states have how much in them.
CREATE OR REPLACE FUNCTION public.explore_regions(p_country text DEFAULT NULL)
RETURNS TABLE(country text, region text, region_code text, listings bigint, cities bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'zoi', 'public'
AS $function$
  SELECT l.country, l.region, max(l.region_code) AS region_code,
         count(*) AS listings, count(DISTINCT l.city) AS cities
    FROM zoi.listings l
   WHERE l.publish_status='published'
     AND l.region IS NOT NULL
     AND (p_country IS NULL OR p_country='' OR l.country ILIKE p_country)
   GROUP BY l.country, l.region
   ORDER BY count(*) DESC;
$function$;

REVOKE ALL ON FUNCTION public.explore_regions(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.explore_regions(text) TO anon, authenticated, service_role;

COMMIT;

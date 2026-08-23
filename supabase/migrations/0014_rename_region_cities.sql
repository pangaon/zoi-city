-- There was already a public.explore_cities(p_limit integer) returning
-- {n, city, country} — used by /explore for its city filter. Migration 0011
-- added explore_cities(p_country, p_region) returning {country, region, city,
-- listings}: same name, different shape, so PostgREST cannot resolve a call that
-- does not name its arguments (PGRST203). Both live callers happen to pass names,
-- so nothing broke, but two functions called the same thing returning different
-- things is a trap. The new one is renamed; the original is untouched.
CREATE OR REPLACE FUNCTION public.explore_region_cities(p_country text DEFAULT NULL, p_region text DEFAULT NULL)
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
REVOKE ALL ON FUNCTION public.explore_region_cities(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.explore_region_cities(text,text) TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.explore_cities(text, text);

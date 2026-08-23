-- One query for every region-by-category pair.
--
-- The sitemap builds "bakeries in Ontario" style hubs, and it was doing that with
-- one explore_categories() call per region — an N+1 that made the whole sitemap
-- take six seconds and forced a cap of 6 countries x 8 regions. That cap is why
-- only 585 hubs are listed when 152 regions and 108 categories exist.
CREATE OR REPLACE FUNCTION public.explore_region_categories(p_min int DEFAULT 3)
RETURNS TABLE(country text, region text, category_slug text, listings bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'zoi','public'
AS $$
  SELECT l.country, l.region, c.slug, count(*)
    FROM zoi.listings l
    JOIN zoi.categories c ON c.id = l.primary_category_id
   WHERE l.publish_status = 'published'
     AND l.region IS NOT NULL AND l.country IS NOT NULL
   GROUP BY l.country, l.region, c.slug
  HAVING count(*) >= greatest(p_min, 1)
   ORDER BY count(*) DESC;
$$;
REVOKE ALL ON FUNCTION public.explore_region_categories(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.explore_region_categories(int) TO anon, authenticated, service_role;

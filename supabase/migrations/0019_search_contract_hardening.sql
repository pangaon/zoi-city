-- Restore one unambiguous public contract for directory search.
--
-- Production acquired an eight-argument overload with a defaulted p_sort
-- parameter outside this repository's migration history. PostgREST cannot
-- choose between that overload and the canonical seven-argument function when
-- callers omit p_region/p_sort, which broke every directory search.

BEGIN;

DROP FUNCTION IF EXISTS public.explore_search(
  text, text, text, text, integer, integer, text, text
);

CREATE OR REPLACE FUNCTION public.explore_search(
  p_q text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0,
  p_region text DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'zoi','public'
AS $function$
  SELECT COALESCE(jsonb_agg(to_jsonb(r)),'[]'::jsonb) FROM (
    SELECT l.id, l.slug, l.name,
      left(COALESCE(l.description,''),170) AS description,
      c.label_en AS category, l.entity_type, l.city, l.country,
      l.region, l.region_code, l.region_native,
      COALESCE(l.canonical_path,
               '/' || replace(l.entity_type,'travel_place','travel-place') || '/' || l.slug) AS path,
      l.verification_status, l.rating, l.photo_url,
      (l.owner_workspace_id IS NULL AND COALESCE(l.claim_status,'unclaimed') NOT IN ('claimed','approved')) AS claimable
    FROM zoi.listings l
    LEFT JOIN zoi.categories c ON c.id=l.primary_category_id
    WHERE l.publish_status='published'
      AND (p_q IS NULL OR p_q='' OR l.search_tsv @@ plainto_tsquery('simple', p_q)
           OR l.name ILIKE '%'||p_q||'%'
           OR l.region ILIKE '%'||p_q||'%'
           OR l.region_native ILIKE '%'||p_q||'%')
      AND (p_type    IS NULL OR p_type=''    OR l.entity_type=p_type)
      AND (p_city    IS NULL OR p_city=''    OR l.city ILIKE p_city)
      AND (p_country IS NULL OR p_country='' OR l.country ILIKE p_country)
      AND (p_region  IS NULL OR p_region=''  OR l.region ILIKE p_region
           OR l.region_native ILIKE p_region OR upper(l.region_code)=upper(p_region))
    ORDER BY (l.verification_status='verified') DESC, l.trust_score DESC NULLS LAST, l.name
    LIMIT LEAST(GREATEST(p_limit,1),48) OFFSET GREATEST(p_offset,0)
  ) r;
$function$;

REVOKE ALL ON FUNCTION public.explore_search(text,text,text,text,integer,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.explore_search(text,text,text,text,integer,integer,text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.explore_search(text,text,text,text,integer,integer,text) IS
  'Canonical public directory search contract. Keep this function name free of defaulted overloads.';

COMMIT;

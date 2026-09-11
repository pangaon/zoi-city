-- Prioritize verified listings in the website enrichment queue. The worker still
-- crawls all registered public websites, but verified records get the first pass.
CREATE OR REPLACE FUNCTION zoi.enrich_queue(p_limit int DEFAULT 40, p_max_age_days int DEFAULT 30)
RETURNS TABLE(slug text, website text)
LANGUAGE sql SECURITY DEFINER
SET search_path = zoi, public
AS $$
  SELECT l.slug, l.website
    FROM zoi.listings l
   WHERE l.website IS NOT NULL
     AND l.website <> ''
     AND l.website ~* '^https?://'
     AND coalesce(l.profile -> '_enrich' ->> 'blocked', '') <> 'true'
     AND (
          l.profile -> '_enrich' ->> 'checked_at' IS NULL
       OR (l.profile -> '_enrich' ->> 'checked_at')::date
            < (current_date - make_interval(days => greatest(p_max_age_days, 1)))
     )
   ORDER BY (l.verification_status IN ('verified', 'owner_verified', 'source_verified')) DESC,
            (l.profile -> '_enrich' ->> 'checked_at') NULLS FIRST,
            l.id
   LIMIT greatest(least(p_limit, 200), 1);
$$;

REVOKE ALL ON FUNCTION zoi.enrich_queue(int, int) FROM public;
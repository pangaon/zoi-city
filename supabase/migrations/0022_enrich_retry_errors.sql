-- Failed crawls must remain visible and retryable without making successful
-- listings churn more often than the normal freshness window.
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
       OR (
            coalesce(l.profile -> '_enrich' ->> 'crawl_status', '') = 'error'
        AND (l.profile -> '_enrich' ->> 'checked_at')::date
              <= (current_date - 1)
          )
     )
   ORDER BY (l.verification_status IN ('verified', 'owner_verified', 'source_verified')) DESC,
            (l.profile -> '_enrich' ->> 'checked_at') NULLS FIRST,
            l.id
   LIMIT greatest(least(p_limit, 200), 1);
$$;

REVOKE ALL ON FUNCTION zoi.enrich_queue(int, int) FROM public;

COMMENT ON FUNCTION zoi.enrich_queue(int, int) IS
  'Returns due listing websites, retrying recorded crawl errors after a one-day cooldown.';
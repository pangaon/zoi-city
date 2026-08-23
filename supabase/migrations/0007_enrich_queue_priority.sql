-- Point the enrichment worker at the listings where it converts something.
--
-- The directory holds 11,829 listings of which only 8,081 are published. The
-- other 3,748 are not missing because nobody found them — the crawlers found
-- them fine. They are unpublished because they are thin: of 2,822 drafts, 1,774
-- have a website but only 161 have a description. The publish gate scores on
-- completeness, so they sit there forever.
--
-- Those are exactly the rows enrichment fixes, and it already has what it needs:
-- their own website. Reading it fills description, photo, socials and contact,
-- completeness rises, and the existing triage job can publish them on its own.
--
-- So: work the rescuable rows first. Roughly 2,100 listings that are one fetch
-- away from being publishable, ahead of the published ones that already look
-- fine. Same worker, same politeness, different order.

BEGIN;

CREATE OR REPLACE FUNCTION zoi.enrich_queue(p_limit int DEFAULT 40, p_max_age_days int DEFAULT 30)
RETURNS TABLE(slug text, website text)
LANGUAGE sql
SECURITY DEFINER
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
   ORDER BY
     -- 1. unpublished and thin: enrichment is what unblocks these
     (CASE WHEN l.publish_status IN ('draft','pending_review')
            AND (l.description IS NULL OR length(l.description) < 40) THEN 0
           WHEN l.publish_status IN ('draft','pending_review')        THEN 1
           -- 2. published but with nothing to look at
           WHEN l.photo_url IS NULL
            AND coalesce(l.social_links,'{}'::jsonb) = '{}'::jsonb    THEN 2
           ELSE 3 END),
     -- then least-recently-checked, so coverage still spreads and no host is
     -- hammered twice in a row
     (l.profile -> '_enrich' ->> 'checked_at') NULLS FIRST,
     l.id
   LIMIT greatest(least(p_limit, 200), 1);
$$;

COMMIT;

-- What the worker will pick up next, by priority band:
--   SELECT count(*) FROM zoi.enrich_queue(200, 30);

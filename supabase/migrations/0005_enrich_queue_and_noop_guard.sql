-- Two things: a queue for the enrichment worker, and an end to the heap churn.

BEGIN;

-- ── 1. the enrichment queue ─────────────────────────────────────────────────
-- The worker must never be handed a URL from a request body — that is the SSRF
-- surface that got intake-audit stubbed. It asks the database which listings to
-- look at, and the database answers with each listing's own registered website.
-- Service role only.
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
     -- never re-fetch a host that told us no, and never re-fetch something
     -- checked recently
     AND coalesce(l.profile -> '_enrich' ->> 'blocked', '') <> 'true'
     AND (
          l.profile -> '_enrich' ->> 'checked_at' IS NULL
       OR (l.profile -> '_enrich' ->> 'checked_at')::date
            < (current_date - make_interval(days => greatest(p_max_age_days, 1)))
     )
   -- least-recently-checked first, so coverage spreads instead of hammering
   -- the same hosts
   ORDER BY (l.profile -> '_enrich' ->> 'checked_at') NULLS FIRST, l.id
   LIMIT greatest(least(p_limit, 200), 1);
$$;

REVOKE ALL ON FUNCTION zoi.enrich_queue(int, int) FROM public;
COMMENT ON FUNCTION zoi.enrich_queue(int, int) IS
  'Listings due for website enrichment, least-recently-checked first. Returns '
  'each listing''s own registered website so the worker never accepts a URL '
  'from a caller. Service role only.';

-- Make the queue lookup cheap rather than a full scan of a fat heap.
CREATE INDEX IF NOT EXISTS idx_listings_enrich_due
  ON zoi.listings ((profile -> '_enrich' ->> 'checked_at'))
  WHERE website IS NOT NULL AND website <> '';

-- ── 2. stop the hourly heap churn ───────────────────────────────────────────
-- The maintenance job rewrites all ~11,788 rows every hour whether anything
-- changed or not. In Postgres an UPDATE is always a new row version, so a no-op
-- rewrite is a real write: hence 136 MB of heap for 11,788 logically-small rows,
-- and hence every aggregation reading eight times more pages than it needs to.
--
-- This suppresses writes that would change nothing but `updated_at`. It is
-- deliberately body-agnostic — it fixes the churn without anyone having to
-- rewrite run_maintenance(), and it keeps working if that function changes.
--
-- There is a second, quieter benefit. sitemap lastmod comes from updated_at,
-- so right now every one of the ~8,851 indexed URLs claims to have changed
-- every hour. That trains search engines to stop trusting the signal, on a site
-- whose whole SEO case rests on freshness. After this, lastmod means something.
CREATE OR REPLACE FUNCTION zoi.skip_noop_listing_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = zoi, public
AS $$
BEGIN
  -- Compare everything except the bookkeeping column. If the row is otherwise
  -- identical, drop the write: RETURN NULL in a BEFORE ... FOR EACH ROW trigger
  -- skips this row's update without erroring the statement.
  IF (to_jsonb(NEW) - 'updated_at') = (to_jsonb(OLD) - 'updated_at') THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION zoi.skip_noop_listing_update() IS
  'Suppresses UPDATEs that would only move updated_at. Stops the hourly '
  'maintenance job from bloating the heap, and stops sitemap lastmod from '
  'claiming every page changed every hour. Drop the trigger to revert.';

DROP TRIGGER IF EXISTS listings_skip_noop ON zoi.listings;
CREATE TRIGGER listings_skip_noop
  BEFORE UPDATE ON zoi.listings
  FOR EACH ROW
  EXECUTE FUNCTION zoi.skip_noop_listing_update();

COMMIT;

-- ── after committing ────────────────────────────────────────────────────────
-- The trigger stops new bloat; it cannot reclaim what already exists. One
-- compaction is still needed, in a quiet window, and it takes an ACCESS
-- EXCLUSIVE lock for its duration:
--
--   VACUUM (FULL, ANALYZE) zoi.listings;
--
-- If you would rather not take that lock, pg_repack does the same online.
-- Either way, confirm the trigger is doing its job first — run the hourly
-- maintenance job once and check that n_tup_upd barely moves:
--
--   SELECT n_tup_upd, n_tup_hot_upd, n_dead_tup,
--          pg_size_pretty(pg_total_relation_size('zoi.listings')) AS size
--     FROM pg_stat_user_tables WHERE relname = 'listings';
--
-- ROLLBACK PLAN: DROP TRIGGER listings_skip_noop ON zoi.listings;
--
-- ONE THING TO CHECK FIRST: if any job deliberately "touches" a row to bump
-- updated_at with no other change — to force a re-index or a downstream sync —
-- this trigger will stop that touch working. Nothing in the repo does it, but
-- you know the Cowork tasks better than I do.

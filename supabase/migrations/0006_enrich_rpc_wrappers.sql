-- Expose the enrichment RPCs to the worker.
--
-- 0003 and 0005 created zoi.enrich_apply and zoi.enrich_queue and revoked them
-- from PUBLIC, which was right — but PostgREST can only call functions in an
-- exposed schema, so the worker got:
--
--   PGRST202: Searched for the function public.enrich_queue ... no matches
--
-- These are thin SECURITY DEFINER wrappers in public, granted to service_role
-- and nobody else. anon and authenticated still cannot reach either one: a
-- visitor must never be able to make the site crawl, and machine-derived claims
-- must never be writable by a logged-in user.

BEGIN;

CREATE OR REPLACE FUNCTION public.enrich_queue(p_limit int DEFAULT 40, p_max_age_days int DEFAULT 30)
RETURNS TABLE(slug text, website text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = zoi, public
AS $$ SELECT * FROM zoi.enrich_queue(p_limit, p_max_age_days); $$;

REVOKE ALL ON FUNCTION public.enrich_queue(int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enrich_queue(int, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enrich_queue(int, int) TO service_role;

CREATE OR REPLACE FUNCTION public.enrich_apply(p_batch jsonb)
RETURNS TABLE(slug text, applied boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = zoi, public
AS $$ SELECT * FROM zoi.enrich_apply(p_batch); $$;

REVOKE ALL ON FUNCTION public.enrich_apply(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enrich_apply(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enrich_apply(jsonb) TO service_role;

COMMENT ON FUNCTION public.enrich_queue(int, int) IS
  'Worker-facing wrapper. service_role only.';
COMMENT ON FUNCTION public.enrich_apply(jsonb) IS
  'Worker-facing wrapper. service_role only — enrichment is never user-writable.';

COMMIT;

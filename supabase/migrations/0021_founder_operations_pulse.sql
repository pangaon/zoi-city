-- Founder-only operational visibility for enrichment and ingestion health.
-- Existing admin dashboard RPCs remain service-role-only.
CREATE OR REPLACE FUNCTION public.zoi_founder_ops()
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = zoi, public, pg_temp
AS $$
DECLARE result json;
BEGIN
  IF NOT zoi.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;
  SELECT json_build_object(
    'generated_at', now(),
    'enrichment', json_build_object(
      'websites', (SELECT count(*) FROM zoi.listings WHERE website IS NOT NULL AND website <> ''),
      'verified_websites', (SELECT count(*) FROM zoi.listings WHERE website IS NOT NULL AND website <> '' AND verification_status IN ('verified','owner_verified','source_verified')),
      'due', (SELECT count(*) FROM zoi.enrich_queue(200, 30)),
      'checked_today', (SELECT count(*) FROM zoi.listings WHERE profile -> '_enrich' ->> 'checked_at' = current_date::text),
      'success_today', (SELECT count(*) FROM zoi.listings WHERE profile -> '_enrich' ->> 'checked_at' = current_date::text AND coalesce(profile -> '_enrich' ->> 'crawl_status','') NOT IN ('error','checked_no_data')),
      'errors_today', (SELECT count(*) FROM zoi.listings WHERE profile -> '_enrich' ->> 'checked_at' = current_date::text AND profile -> '_enrich' ->> 'crawl_status' = 'error'),
      'empty_today', (SELECT count(*) FROM zoi.listings WHERE profile -> '_enrich' ->> 'checked_at' = current_date::text AND profile -> '_enrich' ->> 'crawl_status' = 'checked_no_data'),
      'recent_errors', coalesce((SELECT json_agg(x) FROM (SELECT name, slug, website, profile -> '_enrich' ->> 'last_error' AS error FROM zoi.listings WHERE profile -> '_enrich' ->> 'crawl_status' = 'error' ORDER BY (profile -> '_enrich' ->> 'checked_at') DESC NULLS LAST LIMIT 8) x), '[]'::json)
    ),
    'ingestion', json_build_object(
      'listings', (SELECT count(*) FROM zoi.listings),
      'published', (SELECT count(*) FROM zoi.listings WHERE publish_status = 'published'),
      'pending_review', (SELECT count(*) FROM zoi.listings WHERE publish_status = 'pending_review'),
      'sources', (SELECT count(*) FROM zoi.sources),
      'recent_runs', coalesce((SELECT json_agg(x) FROM (SELECT source, status, started_at, items_fetched, items_new, errors FROM zoi.v_ingestion_health ORDER BY started_at DESC LIMIT 8) x), '[]'::json)
    )
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.zoi_founder_ops() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.zoi_founder_ops() TO authenticated, service_role;

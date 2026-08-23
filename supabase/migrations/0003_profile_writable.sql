-- Make `profile` writable, and give machine enrichment its own namespace.
--
-- WHY THIS IS THE BLOCKER
-- api/_verticals.js renders 26 purpose-built listing types — a parish knows
-- about sacraments and patronal feasts, a restaurant about menus and
-- reservations, a law practice about admissions and its regulator. All of it
-- reads from listings.profile. seo_entity returns that column, and nothing in
-- the RPC layer can write it: bizpage_save takes description/phone/email/
-- website/hours/price_range/photo_url/social and no profile. So the schema
-- exists, the renderer exists, and the data has no way in. That is why a
-- claimed listing still renders as a name, a category and a city.
--
-- DESIGN
-- Two separate writers, because owner-typed facts and machine-derived guesses
-- are not the same kind of claim and must never silently overwrite each other:
--
--   profile.<key>          owner-supplied. Authoritative. Only the owner writes.
--   profile._enrich.<key>  machine-derived from the business's own website.
--                          Carries provenance and a date. Never overwrites the
--                          owner's version of the same key.
--
-- The renderer prefers profile.<key>, falls back to profile._enrich.<key>, and
-- can honestly label the second: "from their website, checked 12 June".
--
-- Additive only. bizpage_save is left exactly as it is — it works, and blind
-- rewriting of a SECURITY DEFINER function that already guards a permission
-- check is how you introduce a hole.

BEGIN;

-- ── 1. keys no writer may ever set ──────────────────────────────────────────
-- An unverifiable rating injected through a JSON blob would end up in JSON-LD
-- and in Google. api/_verticals.js already strips these when rendering; this
-- makes it impossible to store them in the first place.
CREATE OR REPLACE FUNCTION zoi.profile_strip(p jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = zoi, public
AS $$
  SELECT coalesce(
    (SELECT jsonb_object_agg(k, v)
       FROM jsonb_each(coalesce(p, '{}'::jsonb)) AS t(k, v)
      WHERE k NOT IN ('rating','rating_count','review','reviews','reviewCount',
                      'aggregateRating','score','stars','ranking','provider_stats',
                      '_enrich','_geo')
        AND k NOT LIKE 'rating%'
        AND k NOT LIKE 'review%'),
    '{}'::jsonb);
$$;

COMMENT ON FUNCTION zoi.profile_strip(jsonb) IS
  'Removes rating/review/score keys and the reserved _enrich/_geo namespaces. '
  'Owners may describe themselves; they may not assign themselves a rating.';

-- ── 2. owner writer ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION zoi.bizpage_save_profile(
  p_workspace uuid,
  p_listing   uuid,
  p_profile   jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = zoi, public
AS $$
DECLARE
  v_clean jsonb;
BEGIN
  -- Same two guards bizpage_save uses, in the same order.
  PERFORM zoi.assert_ws(p_workspace);
  IF NOT zoi.bizpage_can_edit(p_workspace, p_listing) THEN
    RAISE EXCEPTION 'not permitted to edit this listing';
  END IF;

  IF p_profile IS NULL OR jsonb_typeof(p_profile) <> 'object' THEN
    RAISE EXCEPTION 'profile must be a JSON object';
  END IF;
  IF pg_column_size(p_profile) > 262144 THEN
    RAISE EXCEPTION 'profile too large (limit 256KB)';
  END IF;

  v_clean := zoi.profile_strip(p_profile);

  -- Merge at the top level so a partial save cannot wipe unrelated sections,
  -- and preserve the reserved namespaces the owner is not allowed to touch.
  UPDATE zoi.listings l
     SET profile = coalesce(l.profile, '{}'::jsonb)
                   || v_clean
                   || jsonb_strip_nulls(jsonb_build_object(
                        '_enrich', l.profile -> '_enrich',
                        '_geo',    l.profile -> '_geo'))
                   || jsonb_build_object('_meta', jsonb_build_object(
                        'updated_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
                        'updated_by', 'owner')),
         updated_at = now()
   WHERE l.id = p_listing;

  RETURN found;
END;
$$;

REVOKE ALL ON FUNCTION zoi.bizpage_save_profile(uuid, uuid, jsonb) FROM public;

CREATE OR REPLACE FUNCTION public.bizpage_save_profile(
  p_workspace uuid, p_listing uuid, p_profile jsonb
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = zoi, public
AS $$ SELECT zoi.bizpage_save_profile(p_workspace, p_listing, p_profile); $$;

REVOKE ALL ON FUNCTION public.bizpage_save_profile(uuid, uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.bizpage_save_profile(uuid, uuid, jsonb) TO authenticated;

-- ── 3. enrichment writer ────────────────────────────────────────────────────
-- Service role only. Takes a batch so the hourly pipeline is one round trip.
-- Input: [{"slug":"…","profile":{…},"provenance":{"phone":"jsonld", …}}, …]
CREATE OR REPLACE FUNCTION zoi.enrich_apply(p_batch jsonb)
RETURNS TABLE(slug text, applied boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = zoi, public
AS $$
DECLARE
  r jsonb;
BEGIN
  IF p_batch IS NULL OR jsonb_typeof(p_batch) <> 'array' THEN
    RAISE EXCEPTION 'batch must be a JSON array';
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_batch) LOOP
    RETURN QUERY
    UPDATE zoi.listings l
       SET profile = coalesce(l.profile, '{}'::jsonb) || jsonb_build_object(
             '_enrich',
             coalesce(l.profile -> '_enrich', '{}'::jsonb)
             || zoi.profile_strip(coalesce(r -> 'profile', '{}'::jsonb))
             || jsonb_build_object(
                  'provenance', coalesce(r -> 'provenance', '{}'::jsonb),
                  'source_url', r ->> 'website',
                  'checked_at', to_char(now(), 'YYYY-MM-DD'))),
           updated_at = now()
     WHERE l.slug = (r ->> 'slug')
    RETURNING l.slug, true;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION zoi.enrich_apply(jsonb) FROM public;
-- Deliberately NOT granted to anon or authenticated. The enrichment worker uses
-- the service role; nobody else should be able to write machine claims.

COMMENT ON FUNCTION zoi.enrich_apply(jsonb) IS
  'Applies website-derived enrichment into profile._enrich with provenance. '
  'Never touches owner-supplied keys. Service role only.';

COMMIT;

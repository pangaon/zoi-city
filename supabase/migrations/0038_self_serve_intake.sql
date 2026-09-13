-- Self-serve intake: a business that is not in the directory submits its own
-- website and gets a prefilled draft back.
--
-- THE SAFETY ARGUMENT
--   zoi-enrich exists because intake-audit was stubbed for fetching a URL handed
--   to it by a caller. Its defining property, stated at the top of that worker,
--   is "NO URL IS EVER ACCEPTED FROM A CALLER" — it asks zoi.enrich_queue which
--   listings are due and the database answers with each listing's own website.
--
--   This feature does not weaken that by one line. The submitted URL is written
--   to zoi.listings first, as an unverified draft. From that moment it is a
--   database-owned website exactly like every other row, and the worker picks it
--   up through the existing queue with the existing vetting: scheme, port and
--   credential checks, no IP literals, no reserved names, DNS resolution with
--   every returned address checked against the private, loopback, link-local,
--   CGNAT, multicast and cloud-metadata ranges, manual redirects re-vetted per
--   hop, 8s timeout, 1.5MB cap, robots.txt.
--
--   The worker is not modified. There is no new fetch surface. What changes is
--   only who may put a row in front of it, which is why the checks below are
--   about abuse rather than about SSRF:
--
--     * Authentication required. An anonymous endpoint that makes a server
--       fetch an arbitrary host is a crawl amplifier pointed at third parties.
--     * Five submissions per account per day.
--     * One listing per registrable domain, so intake cannot be used to
--       duplicate or shadow an existing business.
--
--   The URL shape checks here are defence in depth and deliberately duplicate
--   the worker's. They are not the control — the control is _ssrf.ts at fetch
--   time, because only that runs immediately before the socket opens.
--
-- WHAT THIS DOES NOT DO
--   Verify anybody. A page that fetches successfully proves a website exists. It
--   does not prove the submitter owns the business, so intake rows land
--   unverified and unpublished and stay there until a human acts. Ownership is a
--   separate proof — an address at the domain, or a DNS record — and is not
--   granted here.

BEGIN;

-- Pre-flight. The INSERT below was written against column names read from the
-- other migrations rather than from the live schema, so check them up front and
-- fail with a readable message instead of part-way through.
DO $preflight$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(c, ', ')
    INTO missing
    FROM unnest(ARRAY['slug','name','website','city','country','entity_type',
                      'publish_status','verification_status','claim_status','profile']) AS c
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'zoi' AND table_name = 'listings' AND column_name = c);

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION
      'zoi.listings is missing: %. Adjust the INSERT in this migration to match the real schema.', missing;
  END IF;
END
$preflight$;

-- Registrable-ish host for duplicate detection. Not a public-suffix parser: it
-- keeps the last two labels, plus three for the common second-level TLDs the
-- diaspora actually uses (.co.uk, .com.au, .com.gr). Good enough to stop the
-- obvious duplicate; the uniqueness check is advisory, not a security control.
CREATE OR REPLACE FUNCTION zoi.registrable_host(p_url text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $function$
  WITH h AS (
    SELECT lower(regexp_replace(
      regexp_replace(coalesce(p_url, ''), '^[a-z]+://', '', 'i'),
      '[/?#].*$', '')) AS host
  ), clean AS (
    SELECT regexp_replace(regexp_replace(host, ':\d+$', ''), '^www\.', '') AS host FROM h
  ), parts AS (
    SELECT host, string_to_array(host, '.') AS a FROM clean
  )
  SELECT CASE
    WHEN array_length(a, 1) IS NULL OR array_length(a, 1) < 2 THEN NULL
    WHEN array_length(a, 1) >= 3
     AND a[array_length(a,1)-1] IN ('co','com','net','org','ac','gov')
      THEN array_to_string(a[array_length(a,1)-2:array_length(a,1)], '.')
    ELSE array_to_string(a[array_length(a,1)-1:array_length(a,1)], '.')
  END
  FROM parts;
$function$;

COMMENT ON FUNCTION zoi.registrable_host(text) IS
  'Best-effort registrable domain, for duplicate detection only. Not a security control.';


CREATE OR REPLACE FUNCTION public.intake_submit(
  p_website text,
  p_name    text DEFAULT NULL,
  p_city    text DEFAULT NULL,
  p_country text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, zoi, pg_temp
AS $function$
DECLARE
  v_uid     uuid := auth.uid();
  v_url     text;
  v_host    text;
  v_reg     text;
  v_name    text;
  v_slug    text;
  v_base    text;
  v_existing record;
  v_recent  int;
  v_id      uuid;
BEGIN
  -- An anonymous caller here would turn the crawler into an open relay that
  -- fetches whatever host a stranger names.
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
  END IF;

  v_url := btrim(coalesce(p_website, ''));
  IF v_url = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'website_required');
  END IF;
  IF v_url !~* '^https?://' THEN
    v_url := 'https://' || v_url;
  END IF;

  -- Shape checks, mirroring _ssrf.ts. The authoritative check runs at fetch time.
  IF v_url ~* '^https?://[^/@]*@' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'credentials_in_url');
  END IF;

  v_host := lower(regexp_replace(regexp_replace(v_url, '^https?://', '', 'i'), '[/?#].*$', ''));
  v_host := regexp_replace(v_host, ':\d+$', '');

  IF v_host = '' OR position('.' in v_host) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_host');
  END IF;
  IF v_host ~ '^\d{1,3}(\.\d{1,3}){3}$' OR position(':' in v_host) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ip_literal');
  END IF;
  IF v_host ~* '(^|\.)(localhost|metadata|internal|intranet|lan|home|corp|private|test|example|invalid|onion|local)$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reserved_host');
  END IF;

  v_reg := zoi.registrable_host(v_url);
  IF v_reg IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_host');
  END IF;

  -- Already in the directory: send them to claim it rather than creating a
  -- second row for the same business.
  SELECT l.slug, l.name, l.claim_status
    INTO v_existing
    FROM zoi.listings l
   WHERE l.website IS NOT NULL
     AND zoi.registrable_host(l.website) = v_reg
   ORDER BY l.id
   LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true, 'status', 'already_listed',
      'slug', v_existing.slug, 'name', v_existing.name,
      'claim_status', v_existing.claim_status);
  END IF;

  SELECT count(*) INTO v_recent
    FROM zoi.listings l
   WHERE l.profile -> '_intake' ->> 'submitted_by' = v_uid::text
     AND (l.profile -> '_intake' ->> 'submitted_at')::timestamptz > now() - interval '1 day';

  IF v_recent >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited',
      'detail', 'Five submissions a day. This is to stop the crawler being pointed at third parties in bulk.');
  END IF;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  IF v_name IS NULL THEN
    v_name := split_part(v_reg, '.', 1);
  END IF;

  v_base := regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g');
  v_base := btrim(regexp_replace(v_base, '(^-+|-+$)', '', 'g'), '-');
  IF v_base = '' THEN v_base := 'listing'; END IF;
  v_slug := v_base || '-' || substr(md5(v_reg), 1, 6);

  INSERT INTO zoi.listings (slug, name, website, city, country,
                            entity_type, publish_status, verification_status, claim_status, profile)
  VALUES (
    v_slug,
    v_name,
    v_url,
    nullif(btrim(coalesce(p_city, '')), ''),
    nullif(btrim(coalesce(p_country, '')), ''),
    'business',
    'draft',        -- nothing self-submitted goes public unreviewed
    'unverified',   -- a successful crawl is not proof of ownership
    'unclaimed',
    jsonb_build_object('_intake', jsonb_build_object(
      'submitted_by', v_uid::text,
      'submitted_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
      'source', 'self_serve',
      'submitted_website', v_url,
      'registrable_host', v_reg))
  )
  RETURNING id INTO v_id;

  -- No checked_at, so zoi.enrich_queue's "NULLS FIRST" ordering puts this row at
  -- the head of the next run without any change to the worker.
  RETURN jsonb_build_object(
    'ok', true, 'status', 'queued', 'slug', v_slug, 'name', v_name,
    'website', v_url, 'registrable_host', v_reg);
END;
$function$;

REVOKE ALL ON FUNCTION public.intake_submit(text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.intake_submit(text, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.intake_submit(text, text, text, text) IS
  'Self-serve intake. Writes an unverified draft listing so the existing enrich '
  'worker can read the website from the database instead of from a caller. '
  'Authenticated only, five per account per day, one listing per domain. '
  'Never publishes and never verifies.';


-- Read back what enrichment found, for the confirmation screen. Only the
-- submitter sees their own draft; this is not a public read.
--
-- Returns a fixed, length-capped projection rather than profile->'_enrich'
-- wholesale. Self-serve intake lets a stranger choose which host the crawler
-- visits, and the crawler's accepted residual risk is DNS rebinding. If a
-- rebind ever lands us on an internal page that happens to serve HTML, this
-- function is the only way the submitter could read the result back — so it
-- returns a known set of business fields and nothing else. Whatever else the
-- crawler stored stays server-side.
CREATE OR REPLACE FUNCTION public.intake_status(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, zoi, pg_temp
AS $function$
  WITH row AS (
    SELECT l.slug, l.name, l.website, l.publish_status, l.verification_status,
           coalesce(l.profile -> '_enrich', '{}'::jsonb) AS en
      FROM zoi.listings l
     WHERE l.slug = p_slug
       AND l.profile -> '_intake' ->> 'submitted_by' = auth.uid()::text
     LIMIT 1
  ), picked AS (
    SELECT r.*,
      (SELECT jsonb_object_agg(k, left(r.en -> 'fields' ->> k, 400))
         FROM unnest(ARRAY[
           'name','tagline','description','phone','email',
           'street','city','region','postal','country','hours','logo'
         ]) AS k
        WHERE r.en -> 'fields' ? k) AS fields,
      (SELECT jsonb_object_agg(k, r.en -> 'provenance' -> k)
         FROM unnest(ARRAY[
           'name','tagline','description','phone','email',
           'street','city','region','postal','country','hours','logo'
         ]) AS k
        WHERE r.en -> 'provenance' ? k) AS provenance
      FROM row r
  )
  SELECT jsonb_build_object(
    'ok', true,
    'slug', p.slug,
    'name', p.name,
    'website', p.website,
    'publish_status', p.publish_status,
    'verification_status', p.verification_status,
    'enrich', jsonb_build_object(
      -- crawl outcome is reported so a refusal is visible, never the body
      'checked_at', p.en ->> 'checked_at',
      'status',     p.en ->> 'status',
      'error',      left(p.en ->> 'error', 200),
      'source_url', p.en ->> 'source_url',
      'fields',     coalesce(p.fields, '{}'::jsonb),
      'provenance', coalesce(p.provenance, '{}'::jsonb)))
    FROM picked p;
$function$;

REVOKE ALL ON FUNCTION public.intake_status(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.intake_status(text) TO authenticated;

COMMENT ON FUNCTION public.intake_status(text) IS
  'Enrichment result for a draft the caller submitted. Submitter-scoped.';

COMMIT;

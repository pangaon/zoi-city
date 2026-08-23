-- Let the composer publish to Zoi's own feed.
--
-- WHY
-- The suite's flagship job is publishing, and it is switched off: all six
-- external networks report available:false because no developer app has been
-- registered with Meta, X or TikTok. Meanwhile /community is a working feed with
-- real posting, real likes and real comments — and the composer cannot post to
-- it. The one channel that works is the one channel the publishing tool ignores.
--
-- The obstacle was authorship. feed_post() resolves the author from
-- zoi.ensure_profile(), i.e. from the caller's own session. That is correct for
-- someone posting live, and it makes scheduled posting impossible: an hourly
-- worker has no session, so it cannot post as anybody.
--
-- zoi.social_posts already records author_profile, so a scheduled post already
-- knows who wrote it. These functions let a worker act on that.

BEGIN;

-- ── the author-explicit insert ──────────────────────────────────────────────
-- A faithful copy of public.feed_post with the author passed in instead of
-- resolved from the session. Same validation, same media whitelist (storage
-- URLs on this project only, four maximum), same listing resolution.
--
-- service_role ONLY, and never granted to anon or authenticated: a function that
-- posts as an arbitrary user is exactly what you do not want reachable from a
-- browser. A signed-in person posting live still goes through feed_post(), which
-- can only ever post as themselves.
CREATE OR REPLACE FUNCTION zoi.feed_post_as(
  p_profile uuid,
  p_body    text,
  p_listing uuid  DEFAULT NULL,
  p_nameday text  DEFAULT NULL,
  p_media   jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'zoi', 'public'
AS $function$
DECLARE ln text; ls text; v zoi.feed_posts; m jsonb := '[]'::jsonb; el text;
BEGIN
  IF p_profile IS NULL THEN RAISE EXCEPTION 'no_author'; END IF;
  IF NOT EXISTS (SELECT 1 FROM zoi.profiles WHERE id = p_profile) THEN
    RAISE EXCEPTION 'unknown_author';
  END IF;
  IF COALESCE(btrim(p_body),'') = '' THEN RAISE EXCEPTION 'write_something'; END IF;

  IF jsonb_typeof(COALESCE(p_media,'[]'::jsonb)) = 'array' THEN
    FOR el IN SELECT jsonb_array_elements_text(p_media) LIMIT 4 LOOP
      IF el LIKE 'https://csebihpaychdkanjjsmz.supabase.co/storage/v1/object/public/media/%' THEN
        m := m || to_jsonb(el);
      END IF;
    END LOOP;
  END IF;

  IF p_listing IS NOT NULL THEN
    SELECT name, slug INTO ln, ls FROM zoi.listings WHERE id = p_listing AND publish_status = 'published';
  END IF;

  INSERT INTO zoi.feed_posts(profile_id, body, listing_id, listing_name, listing_slug, nameday_ref, media)
  VALUES (p_profile, btrim(p_body), p_listing, ln, ls, NULLIF(btrim(p_nameday),''), m)
  RETURNING * INTO v;
  RETURN jsonb_build_object('ok', true, 'id', v.id);
END;
$function$;

REVOKE ALL ON FUNCTION zoi.feed_post_as(uuid,text,uuid,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION zoi.feed_post_as(uuid,text,uuid,text,jsonb) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.feed_post_as(
  p_profile uuid, p_body text, p_listing uuid DEFAULT NULL,
  p_nameday text DEFAULT NULL, p_media jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path TO 'zoi','public'
AS $$ SELECT zoi.feed_post_as(p_profile, p_body, p_listing, p_nameday, p_media); $$;

REVOKE ALL ON FUNCTION public.feed_post_as(uuid,text,uuid,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.feed_post_as(uuid,text,uuid,text,jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.feed_post_as(uuid,text,uuid,text,jsonb) TO service_role;

-- ── the queue the worker reads ──────────────────────────────────────────────
-- Scheduled posts whose channel list includes the community feed and whose time
-- has come. 'zoi' and 'community' are both accepted so a channel rename cannot
-- silently strand a queue of posts.
CREATE OR REPLACE FUNCTION public.feed_due_community_posts(p_limit int DEFAULT 50)
RETURNS TABLE(id uuid, author_profile uuid, body text, media jsonb, nameday_ref text, scheduled_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'zoi','public'
AS $$
  SELECT p.id, p.author_profile, p.body, COALESCE(p.media,'[]'::jsonb), p.nameday_ref, p.scheduled_at
    FROM zoi.social_posts p
   WHERE p.status = 'scheduled'
     AND p.scheduled_at IS NOT NULL
     AND p.scheduled_at <= now()
     AND p.author_profile IS NOT NULL
     AND (p.channels && ARRAY['zoi','community']::text[])
     -- Idempotency: a "publish now" targeting the feed AND an external network is
     -- saved as scheduled so the external publisher picks it up, which would
     -- otherwise leave it visible here too and post it to the feed twice.
     AND NOT (COALESCE(p.meta,'{}'::jsonb) ? 'community')
   ORDER BY p.scheduled_at
   LIMIT greatest(least(p_limit, 200), 1);
$$;

REVOKE ALL ON FUNCTION public.feed_due_community_posts(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.feed_due_community_posts(int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.feed_due_community_posts(int) TO service_role;

-- Record the outcome. A failure is written down rather than retried forever:
-- a post that cannot be published should be visible in the calendar as failed,
-- not silently stuck as scheduled.
CREATE OR REPLACE FUNCTION public.feed_mark_published(p_id uuid, p_ok boolean, p_note text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'zoi','public'
AS $$
BEGIN
  UPDATE zoi.social_posts
     SET status       = CASE WHEN p_ok THEN 'published' ELSE 'failed' END,
         published_at = CASE WHEN p_ok THEN now() ELSE published_at END,
         meta         = COALESCE(meta,'{}'::jsonb) || jsonb_build_object(
                          'community', jsonb_build_object(
                            'ok', p_ok,
                            'at', to_char(now(),'YYYY-MM-DD"T"HH24:MI:SSOF'),
                            'note', COALESCE(p_note,''))),
         updated_at   = now()
   WHERE id = p_id;
  RETURN found;
END;
$$;

REVOKE ALL ON FUNCTION public.feed_mark_published(uuid, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.feed_mark_published(uuid, boolean, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.feed_mark_published(uuid, boolean, text) TO service_role;

COMMIT;

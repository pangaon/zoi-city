-- Atomic, idempotent community delivery from a saved social post.
-- Live functions, membership helper, columns, constraints and indexes reviewed
-- read-only on 2026-09-30. Existing RPC signatures remain available.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE INDEX IF NOT EXISTS feed_posts_profile_created_idx ON zoi.feed_posts(profile_id,created_at DESC);

-- Keep delivery identity outside editable post.meta. Editing a scheduled post
-- currently replaces meta wholesale, so meta cannot enforce idempotency.
CREATE TABLE zoi.community_post_deliveries (
  social_post_id uuid PRIMARY KEY REFERENCES zoi.social_posts(id) ON DELETE CASCADE,
  feed_post_id uuid NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE zoi.community_post_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.community_post_deliveries FROM PUBLIC, anon, authenticated;

CREATE FUNCTION zoi.publish_social_to_community(p_id uuid, p_worker boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  post zoi.social_posts;
  prior zoi.community_post_deliveries;
  author_id uuid;
  feed_id uuid;
  post_body text;
  element jsonb;
  media_url text;
  media_urls jsonb := '[]'::jsonb;
  external_pending boolean;
BEGIN
  -- Concurrent browser retries and workers serialize on the same saved post.
  SELECT * INTO post FROM zoi.social_posts WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'post_not_found'; END IF;
  IF NOT p_worker THEN
    IF auth.uid() IS NULL OR NOT COALESCE(zoi.is_ws_member(post.workspace_id),false) THEN
      RAISE EXCEPTION 'not_authorized';
    END IF;
    SELECT id INTO author_id FROM zoi.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1;
    IF author_id IS NULL OR author_id IS DISTINCT FROM post.author_profile THEN
      RAISE EXCEPTION 'not_post_author';
    END IF;
  END IF;
  IF NOT COALESCE(post.channels && ARRAY['zoi','community']::text[], false) THEN
    RAISE EXCEPTION 'community_not_selected';
  END IF;

  SELECT EXISTS(SELECT 1 FROM unnest(post.channels) c WHERE c NOT IN ('zoi','community')) INTO external_pending;
  SELECT * INTO prior FROM zoi.community_post_deliveries WHERE social_post_id = p_id;
  IF FOUND THEN
    UPDATE zoi.social_posts SET
      status = CASE WHEN external_pending THEN status ELSE 'published' END,
      published_at = CASE WHEN external_pending THEN published_at ELSE prior.published_at END,
      meta = COALESCE(meta,'{}'::jsonb) || jsonb_build_object('community',jsonb_build_object('ok',true,'id',prior.feed_post_id,'at',prior.published_at)),
      updated_at = now()
    WHERE id = p_id;
    RETURN jsonb_build_object('ok',true,'id',prior.feed_post_id,'already_published',true);
  END IF;
  -- Legacy receipts without a ledger must never be republished automatically.
  IF COALESCE(post.meta->'community'->>'ok','false') = 'true' THEN
    RAISE EXCEPTION 'legacy_delivery_requires_review';
  END IF;
  IF post.status <> 'scheduled' OR post.scheduled_at IS NULL OR post.scheduled_at > now() THEN
    RAISE EXCEPTION 'post_not_due';
  END IF;
  IF post.author_profile IS NULL OR NOT EXISTS (
    SELECT 1 FROM zoi.user_profiles WHERE id = post.author_profile
  ) THEN RAISE EXCEPTION 'unknown_author'; END IF;

  IF COALESCE(post.meta->>'first_comment','') <> '' OR (jsonb_typeof(post.meta->'thread')='array' AND jsonb_array_length(post.meta->'thread') > 0) THEN
    RAISE EXCEPTION 'first_comment_or_thread_delivery_not_supported';
  END IF;

  post_body := COALESCE(NULLIF(post.meta->'per_network_overrides'->'zoi'->>'body',''),post.body);
  post_body := btrim(post_body);
  IF post_body IS NULL OR char_length(post_body) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'community_body_requires_1_to_1000_characters';
  END IF;
  IF jsonb_typeof(COALESCE(post.media,'[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'invalid_community_media';
  END IF;
  IF jsonb_array_length(COALESCE(post.media,'[]'::jsonb)) > 4 THEN
    RAISE EXCEPTION 'community_media_limit';
  END IF;
  FOR element IN SELECT value FROM jsonb_array_elements(COALESCE(post.media,'[]'::jsonb)) LOOP
    media_url := CASE WHEN jsonb_typeof(element) = 'string' THEN element #>> '{}' ELSE element->>'url' END;
    IF media_url IS NULL OR media_url NOT LIKE 'https://csebihpaychdkanjjsmz.supabase.co/storage/v1/object/public/media/%' THEN
      RAISE EXCEPTION 'upload_images_before_community_publishing';
    END IF;
    media_urls := media_urls || jsonb_build_array(media_url);
  END LOOP;

  -- Serialize this RPC's rate-limit check per author across different posts.
  PERFORM pg_advisory_xact_lock(hashtextextended(post.author_profile::text,0));
  IF (SELECT count(*) FROM zoi.feed_posts WHERE profile_id=post.author_profile AND created_at > now()-interval '1 minute') >= 5
    OR (SELECT count(*) FROM zoi.feed_posts WHERE profile_id=post.author_profile AND created_at > now()-interval '1 day') >= 100 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  INSERT INTO zoi.feed_posts(profile_id,body,nameday_ref,media)
  VALUES(post.author_profile,post_body,NULLIF(btrim(post.nameday_ref),''),media_urls)
  RETURNING id INTO feed_id;
  INSERT INTO zoi.community_post_deliveries(social_post_id,feed_post_id) VALUES(p_id,feed_id);
  SELECT EXISTS(SELECT 1 FROM unnest(post.channels) c WHERE c NOT IN ('zoi','community')) INTO external_pending;
  UPDATE zoi.social_posts SET
    status = CASE WHEN external_pending THEN 'scheduled' ELSE 'published' END,
    published_at = CASE WHEN external_pending THEN published_at ELSE now() END,
    meta = COALESCE(meta,'{}'::jsonb) || jsonb_build_object('community',jsonb_build_object('ok',true,'id',feed_id,'at',now())),
    updated_at = now()
  WHERE id = p_id;
  RETURN jsonb_build_object('ok',true,'id',feed_id,'already_published',false,'external_pending',external_pending);
END;
$function$;
REVOKE ALL ON FUNCTION zoi.publish_social_to_community(uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.feed_publish_social_post(p_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$ SELECT zoi.publish_social_to_community(p_id,false); $$;
REVOKE ALL ON FUNCTION public.feed_publish_social_post(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.feed_publish_social_post(uuid) TO authenticated;

CREATE FUNCTION public.feed_publish_scheduled_post(p_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$ SELECT zoi.publish_social_to_community(p_id,true); $$;
REVOKE ALL ON FUNCTION public.feed_publish_scheduled_post(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.feed_publish_scheduled_post(uuid) TO service_role;

-- A narrow worker queue that consults the immutable ledger even when an editor
-- overwrote meta. Keep the old queue RPC for compatibility during rollout.
CREATE FUNCTION public.feed_due_community_post_ids(p_limit integer DEFAULT 50)
RETURNS TABLE(id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  SELECT p.id FROM zoi.social_posts p
  WHERE p.status='scheduled' AND p.scheduled_at <= now()
    AND p.author_profile IS NOT NULL
    AND p.channels && ARRAY['zoi','community']::text[]
    AND NOT (COALESCE(p.meta,'{}'::jsonb) ? 'community')
    AND NOT EXISTS (SELECT 1 FROM zoi.community_post_deliveries d WHERE d.social_post_id=p.id)
  ORDER BY p.scheduled_at
  LIMIT greatest(least(p_limit,200),1);
$$;
REVOKE ALL ON FUNCTION public.feed_due_community_post_ids(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.feed_due_community_post_ids(integer) TO service_role;

COMMIT;

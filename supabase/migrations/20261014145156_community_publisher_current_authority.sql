-- Current authority and source freshness before an atomic Community side effect.
-- Existing canonical posts, private context and immutable receipts are retained.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$BEGIN
 IF (SELECT md5(prosrc)FROM pg_proc WHERE oid='public.social_due_posts()'::regprocedure)IS DISTINCT FROM'd3d6abe1d4c8b2f9dbafc9277883f4b8'OR(SELECT proowner::regrole::text FROM pg_proc WHERE oid='public.social_due_posts()'::regprocedure)IS DISTINCT FROM'postgres'OR(SELECT proacl::text FROM pg_proc WHERE oid='public.social_due_posts()'::regprocedure)IS DISTINCT FROM'{postgres=X/postgres,service_role=X/postgres}'THEN RAISE EXCEPTION 'legacy_social_due_definition_or_acl_changed';END IF;
 IF (SELECT md5(prosrc)FROM pg_proc WHERE oid='zoi.publish_social_to_community(uuid,boolean)'::regprocedure)IS DISTINCT FROM'8c46585e8d9eeba1f354e4e9fd81055c'OR(SELECT proowner::regrole::text FROM pg_proc WHERE oid='zoi.publish_social_to_community(uuid,boolean)'::regprocedure)IS DISTINCT FROM'postgres'OR(SELECT proacl::text FROM pg_proc WHERE oid='zoi.publish_social_to_community(uuid,boolean)'::regprocedure)IS DISTINCT FROM'{postgres=X/postgres}'THEN RAISE EXCEPTION 'community_publisher_definition_changed';END IF;
END$$;
CREATE FUNCTION zoi.social_delivery_payload_hash(p zoi.social_posts)RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT md5(jsonb_build_object('workspace',p.workspace_id,'author',p.author_profile,'body',p.body,'media',p.media,'channels',p.channels,'scheduled_at',p.scheduled_at,'nameday',p.nameday_ref,'meta',coalesce(p.meta,'{}'::jsonb)-'community')::text)
$$;
-- Workspace is always first. Worker authority uses the existing canonical author,
-- never fabricated auth claims or a supposed historical approver.
CREATE FUNCTION zoi.social_delivery_actor(p_workspace uuid,p_author uuid,p_worker boolean)RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id uuid;role_value text;account uuid;
BEGIN
 SELECT owner_profile_id INTO owner_id FROM zoi.workspaces WHERE id=p_workspace FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'no_access_to_workspace' USING ERRCODE='42501';END IF;
 IF NOT p_worker THEN PERFORM zoi.assert_workspace_write(p_workspace);END IF;
 SELECT role INTO role_value FROM zoi.workspace_members WHERE workspace_id=p_workspace AND profile_id=p_author FOR SHARE;
 IF NOT FOUND AND owner_id=p_author THEN role_value:='owner';END IF;
 IF role_value='owner'AND owner_id IS DISTINCT FROM p_author THEN role_value:='viewer';END IF;
 IF coalesce(role_value,'')NOT IN('owner','admin','editor')THEN RAISE EXCEPTION 'social_author_no_current_authority' USING ERRCODE='42501';END IF;
 SELECT auth_user_id INTO account FROM zoi.user_profiles WHERE id=p_author FOR SHARE;
 IF NOT FOUND OR account IS NULL THEN RAISE EXCEPTION 'unknown_author';END IF;
 IF NOT p_worker AND account IS DISTINCT FROM auth.uid()THEN RAISE EXCEPTION 'not_post_author' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM auth.users WHERE id=account AND deleted_at IS NULL AND NOT coalesce(is_anonymous,false)AND(banned_until IS NULL OR banned_until<=clock_timestamp())FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'social_author_inactive' USING ERRCODE='42501';END IF;
 IF NOT p_worker THEN PERFORM zoi.suite_lock_session();END IF;
END$$;
CREATE FUNCTION zoi.social_delivery_source(p zoi.social_posts)RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a zoi.ai_generation_draft_links;e zoi.editorial_draft_links;r zoi.editorial_sources;ctx jsonb;client uuid;owner_ws uuid;
BEGIN
 SELECT *INTO a FROM zoi.ai_generation_draft_links WHERE post_id=p.id FOR SHARE;
 SELECT *INTO e FROM zoi.editorial_draft_links WHERE post_id=p.id FOR SHARE;
 IF a.id IS NOT NULL AND e.id IS NOT NULL THEN RAISE EXCEPTION 'ambiguous_social_source';END IF;
 IF a.id IS NOT NULL THEN IF a.workspace_id IS DISTINCT FROM p.workspace_id THEN RAISE EXCEPTION 'ai_post_scope_changed';END IF;ctx:=a.context;END IF;
 IF e.id IS NOT NULL THEN IF e.workspace_id IS DISTINCT FROM p.workspace_id THEN RAISE EXCEPTION 'editorial_post_scope_changed';END IF;ctx:=e.context;END IF;
 IF ctx IS NOT NULL THEN
  IF nullif(p.meta->>'client_listing_id','')IS DISTINCT FROM ctx->>'listing'THEN RAISE EXCEPTION 'linked_draft_client_context_changed';END IF;
  IF ctx?'campaign'AND p.meta->>'campaign'IS DISTINCT FROM ctx->>'campaign'THEN RAISE EXCEPTION 'linked_draft_campaign_context_changed';END IF;
 END IF;
 -- Nonlinked legacy client labels receive the same current client check; private
 -- source context, where present, is authoritative and cannot be relabelled.
 client:=nullif(coalesce(ctx->>'listing',p.meta->>'client_listing_id'),'')::uuid;
 IF client IS NOT NULL THEN
  PERFORM 1 FROM zoi.workspace_members WHERE workspace_id=p.workspace_id AND profile_id=p.author_profile AND role IN('owner','admin','editor')FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'social_client_authority_revoked' USING ERRCODE='42501';END IF;
  SELECT owner_workspace_id INTO owner_ws FROM zoi.listings WHERE id=client FOR UPDATE;
  IF NOT FOUND OR(owner_ws IS NOT NULL AND owner_ws<>p.workspace_id)THEN RAISE EXCEPTION 'no_access_to_listing' USING ERRCODE='42501';END IF;
  IF owner_ws IS NULL THEN PERFORM 1 FROM zoi.listing_claims WHERE listing_id=client AND workspace_id=p.workspace_id AND claim_status IN('approved','verified')FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'no_access_to_listing' USING ERRCODE='42501';END IF;END IF;
 END IF;
 IF e.id IS NOT NULL THEN
  SELECT *INTO r FROM zoi.editorial_sources WHERE id=e.source_id FOR SHARE;
  IF r.id IS NULL OR NOT r.active OR r.revision<>e.source_revision OR r.record<>e.source_snapshot THEN RAISE EXCEPTION 'editorial_source_changed';END IF;
  IF p.scheduled_at IS NULL OR(p.scheduled_at AT TIME ZONE e.time_zone)::date<>e.occurrence_date THEN RAISE EXCEPTION 'editorial_schedule_occurrence_mismatch';END IF;
  IF r.record->>'review'IS DISTINCT FROM'reviewed'OR coalesce(r.record->'conflicts','[null]'::jsonb)<>'[]'::jsonb OR jsonb_typeof(r.record->'evidence')IS DISTINCT FROM'array'OR jsonb_array_length(r.record->'evidence')=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(r.record->'evidence')v WHERE v->>'primary'IS DISTINCT FROM'true'OR coalesce(v->>'url','')!~'^https://[^ /]+/'OR v->>'checked_at'IS NULL OR(v->>'checked_at')::date>current_date OR(v->>'checked_at')::date<current_date-180)THEN RAISE EXCEPTION 'editorial_source_review_required';END IF;
  IF r.record->>'jurisdiction'IS DISTINCT FROM e.jurisdiction THEN RAISE EXCEPTION 'editorial_jurisdiction_or_release_review_required';END IF;
 END IF;
END$$;
CREATE FUNCTION zoi.social_delivery_snapshot(p_id uuid,p_worker boolean,p_expected_hash text DEFAULT NULL,p_scope uuid DEFAULT NULL)RETURNS zoi.social_posts LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE initial zoi.social_posts;locked zoi.social_posts;
BEGIN
 SELECT *INTO initial FROM zoi.social_posts WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'post_not_found';END IF;
 IF p_scope IS NOT NULL AND initial.workspace_id IS DISTINCT FROM p_scope THEN RAISE EXCEPTION 'social_delivery_snapshot_changed';END IF;
 PERFORM zoi.social_delivery_actor(initial.workspace_id,initial.author_profile,p_worker);
 PERFORM zoi.social_delivery_source(initial);
 SELECT *INTO locked FROM zoi.social_posts WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR locked IS DISTINCT FROM initial THEN RAISE EXCEPTION 'social_delivery_snapshot_changed';END IF;
 IF p_expected_hash IS NOT NULL AND zoi.social_delivery_payload_hash(locked)IS DISTINCT FROM p_expected_hash THEN RAISE EXCEPTION 'social_delivery_snapshot_changed';END IF;
 IF locked.status<>'scheduled'OR locked.scheduled_at IS NULL OR locked.scheduled_at>clock_timestamp()THEN RAISE EXCEPTION 'post_not_due';END IF;
 RETURN locked;
END$$;
CREATE OR REPLACE FUNCTION zoi.publish_social_to_community(p_id uuid, p_worker boolean DEFAULT false)
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
  -- Discover scope without a post lock; workspace always precedes the post.
  SELECT * INTO post FROM zoi.social_posts WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'post_not_found';END IF;
  PERFORM 1 FROM zoi.workspaces WHERE id=post.workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_access_to_workspace';END IF;
  -- Existing immutable ledger recovery has no new side effect and never rewrites
  -- the canonical post. Human recovery still requires current private access and
  -- the same author; service recovery may report a prior delivery after revocation.
  SELECT *INTO prior FROM zoi.community_post_deliveries WHERE social_post_id=p_id;
  IF FOUND THEN
    IF NOT p_worker THEN
      PERFORM zoi.workspace_locked_role(post.workspace_id);
      SELECT id INTO author_id FROM zoi.user_profiles WHERE auth_user_id=auth.uid()FOR SHARE;
      IF author_id IS DISTINCT FROM post.author_profile THEN RAISE EXCEPTION 'not_post_author';END IF;
    END IF;
    PERFORM 1 FROM zoi.social_posts WHERE id=p_id AND workspace_id=post.workspace_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'social_delivery_snapshot_changed';END IF;
    RETURN jsonb_build_object('ok',true,'id',prior.feed_post_id,'already_published',true);
  END IF;
  post:=zoi.social_delivery_snapshot(p_id,p_worker,NULL,post.workspace_id);
  IF NOT coalesce(post.channels&&ARRAY['zoi','community']::text[],false)THEN RAISE EXCEPTION 'community_not_selected';END IF;

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

-- Old workers fail closed during schema→Edge rollout; no automatic regrant.
REVOKE ALL ON FUNCTION public.social_due_posts()FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.social_due_posts_current(p_limit integer DEFAULT 50)RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb)FROM(SELECT id,workspace_id,author_profile,body,media,channels,meta,scheduled_at,nameday_ref FROM zoi.social_posts WHERE status='scheduled'AND scheduled_at IS NOT NULL AND scheduled_at<=now()AND NOT EXISTS(SELECT 1 FROM zoi.social_post_targets t WHERE t.post_id=zoi.social_posts.id AND t.status IN('published','unknown'))ORDER BY scheduled_at,id LIMIT greatest(1,least(coalesce(p_limit,50),50)))p
$$;
CREATE FUNCTION public.social_delivery_snapshot(p_id uuid,p_expected_hash text DEFAULT NULL,p_channel bigint DEFAULT NULL)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p zoi.social_posts;c zoi.social_channels;channel jsonb;
BEGIN
 IF EXISTS(SELECT 1 FROM zoi.social_post_targets WHERE post_id=p_id AND status IN('published','unknown')AND((p_channel IS NULL AND p_expected_hash IS NULL)OR channel_id=p_channel))THEN RAISE EXCEPTION 'social_delivery_requires_reconciliation';END IF;
 p:=zoi.social_delivery_snapshot(p_id,true,p_expected_hash);
 IF p_channel IS NOT NULL THEN
  SELECT *INTO c FROM zoi.social_channels WHERE id=p_channel AND workspace_id=p.workspace_id AND connected IS TRUE AND status='connected'AND nullif(btrim(access_token),'')IS NOT NULL AND nullif(btrim(external_id),'')IS NOT NULL AND(token_expires_at IS NULL OR token_expires_at>clock_timestamp())FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'social_channel_not_publishable';END IF;
  IF NOT EXISTS(SELECT 1 FROM unnest(p.channels)v WHERE v=c.id::text OR(CASE v WHEN'fb'THEN'facebook'WHEN'ig'THEN'instagram'WHEN'li'THEN'linkedin'WHEN'tt'THEN'tiktok'WHEN'yt'THEN'youtube'WHEN'x'THEN'twitter'ELSE v END)=c.platform)THEN RAISE EXCEPTION 'social_channel_not_selected';END IF;
  channel:=jsonb_build_object('id',c.id,'platform',c.platform,'external_id',c.external_id,'access_token',c.access_token,'token_expires_at',c.token_expires_at,'meta',c.meta);
 END IF;
 RETURN jsonb_build_object('ok',true,'post',to_jsonb(p),'payload_hash',zoi.social_delivery_payload_hash(p),'channel',channel);
END$$;
REVOKE ALL ON FUNCTION zoi.social_delivery_payload_hash(zoi.social_posts),zoi.social_delivery_actor(uuid,uuid,boolean),zoi.social_delivery_source(zoi.social_posts),zoi.social_delivery_snapshot(uuid,boolean,text,uuid)FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.social_due_posts_current(integer),public.social_delivery_snapshot(uuid,text,bigint)FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.social_due_posts_current(integer),public.social_delivery_snapshot(uuid,text,bigint)TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;

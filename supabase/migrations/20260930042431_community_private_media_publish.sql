BEGIN;
SET LOCAL lock_timeout='5s';
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('community-private','community-private',false,33554432,ARRAY['image/jpeg','image/png','image/webp','video/mp4']);
-- Restrictive fence prevents pre-existing broad Storage policies granting client writes/read.
CREATE POLICY community_private_service_only ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated USING(bucket_id<>'community-private') WITH CHECK(bucket_id<>'community-private');
CREATE TABLE zoi.community_media_assets(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), profile_id uuid NOT NULL REFERENCES zoi.user_profiles(id),request_id uuid NOT NULL,
 purpose text NOT NULL CHECK(purpose IN('post','avatar')),mime_type text NOT NULL CHECK(mime_type IN('image/jpeg','image/png','image/webp','video/mp4')),
 size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 16 AND 33554432),sha256 text NOT NULL CHECK(sha256~'^[0-9a-f]{64}$'),
 metadata jsonb NOT NULL,state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','ready','discarded')),
 created_at timestamptz NOT NULL DEFAULT now(),storage_deleted_at timestamptz,finalized_at timestamptz, UNIQUE(profile_id,request_id)
);
ALTER TABLE zoi.community_media_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.community_media_assets FROM PUBLIC,anon,authenticated;
CREATE TABLE zoi.community_publish_requests(profile_id uuid NOT NULL REFERENCES zoi.user_profiles(id),request_id uuid NOT NULL,payload jsonb NOT NULL,post_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(profile_id,request_id));
ALTER TABLE zoi.community_publish_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.community_publish_requests FROM PUBLIC,anon,authenticated;
CREATE INDEX community_media_cleanup ON zoi.community_media_assets(created_at) WHERE state='pending';
CREATE FUNCTION zoi.community_media_url(p_id uuid) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT 'https://csebihpaychdkanjjsmz.supabase.co/functions/v1/community-media?asset='||p_id::text $$;
CREATE FUNCTION zoi.community_media_projection(p_asset zoi.community_media_assets) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$ SELECT jsonb_build_object('id',p_asset.id,'type',CASE WHEN p_asset.mime_type='video/mp4' THEN 'video' ELSE 'image' END,'url',zoi.community_media_url(p_asset.id),'poster_url',NULL,'mime_type',p_asset.mime_type,'width',p_asset.metadata->'width','height',p_asset.metadata->'height','duration_seconds',p_asset.metadata->'duration_seconds','alt','') $$;
CREATE FUNCTION public.community_media_begin(p_request uuid,p_purpose text,p_mime text,p_size integer,p_sha256 text,p_metadata jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=zoi.community_actor();a zoi.community_media_assets;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'sign_in_required'; END IF;
 PERFORM 1 FROM zoi.user_profiles WHERE id=actor FOR UPDATE;
 IF p_request IS NULL OR p_purpose NOT IN('post','avatar') OR p_mime NOT IN('image/jpeg','image/png','image/webp','video/mp4') OR p_size IS NULL OR p_size<16 OR p_size>(CASE WHEN p_mime='video/mp4' THEN 33554432 ELSE 8388608 END) OR (p_purpose='avatar' AND p_mime='video/mp4') OR p_sha256 IS NULL OR p_sha256!~'^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid_media_metadata'; END IF;
 IF jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' OR octet_length(p_metadata::text)>1000 THEN RAISE EXCEPTION 'invalid_media_metadata';END IF;
 SELECT * INTO a FROM zoi.community_media_assets WHERE profile_id=actor AND request_id=p_request;
 IF FOUND THEN
  IF (a.purpose,a.mime_type,a.size_bytes,a.sha256,a.metadata) IS DISTINCT FROM (p_purpose,p_mime,p_size,p_sha256,p_metadata) THEN RAISE EXCEPTION 'request_payload_changed'; END IF;
 ELSE
  IF (SELECT count(*) FROM zoi.community_media_assets WHERE profile_id=actor AND created_at>now()-interval '1 day')>=50 THEN RAISE EXCEPTION 'media_rate_limited'; END IF;
  INSERT INTO zoi.community_media_assets(profile_id,request_id,purpose,mime_type,size_bytes,sha256,metadata) VALUES(actor,p_request,p_purpose,p_mime,p_size,p_sha256,p_metadata) RETURNING * INTO a;
 END IF;
 IF a.state='pending' AND a.created_at<now()-interval '23 hours' THEN RAISE EXCEPTION 'media_request_expired';END IF;
 RETURN jsonb_build_object('ok',true,'id',a.id,'path',a.profile_id::text||'/'||a.id::text,'state',a.state,'asset',CASE WHEN a.state='ready' THEN zoi.community_media_projection(a) ELSE NULL END);
END $$;
-- Only the validating edge worker can mark immutable stored bytes ready.
CREATE FUNCTION public.community_media_finish(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a zoi.community_media_assets;
BEGIN
 SELECT * INTO a FROM zoi.community_media_assets WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR a.state='discarded' THEN RAISE EXCEPTION 'media_unavailable'; END IF;
 UPDATE zoi.community_media_assets SET state='ready',finalized_at=coalesce(finalized_at,now()) WHERE id=p_id RETURNING * INTO a;
 RETURN jsonb_build_object('ok',true,'asset',zoi.community_media_projection(a));
END $$;
CREATE FUNCTION zoi.community_media_avatar(p_actor uuid,p_asset uuid) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.community_media_assets WHERE id=p_asset AND profile_id=p_actor AND state='ready' AND mime_type LIKE 'image/%') THEN RAISE EXCEPTION 'invalid_avatar_media'; END IF;
 RETURN zoi.community_media_url(p_asset);
END $$;
CREATE FUNCTION public.community_publish(p_request uuid,p_body text,p_media uuid[] DEFAULT '{}',p_listing uuid DEFAULT NULL,p_context jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=zoi.community_actor(); payload jsonb; old zoi.community_publish_requests;mid uuid;a zoi.community_media_assets;media jsonb:='[]'; post uuid;ln text;ls text;videos integer:=0;alts jsonb:=coalesce(p_context->'media_alts','{}');
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'sign_in_required'; END IF;
 PERFORM 1 FROM zoi.user_profiles WHERE id=actor FOR UPDATE;
 IF p_request IS NULL OR coalesce(length(btrim(p_body)),0) NOT BETWEEN 1 AND 1000 OR p_media IS NULL OR cardinality(p_media)>4 OR array_position(p_media,NULL) IS NOT NULL OR cardinality(p_media)<>(SELECT count(DISTINCT x) FROM unnest(p_media)x) THEN RAISE EXCEPTION 'invalid_post'; END IF;
 IF octet_length(p_context::text)>16000 THEN RAISE EXCEPTION 'invalid_post_context';END IF;
 IF jsonb_typeof(alts) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_each(alts) e WHERE NOT(e.key=ANY(p_media::text[])) OR jsonb_typeof(e.value)<>'string' OR length(e.value#>>'{}')>500) THEN RAISE EXCEPTION 'invalid_media_alt';END IF;
 payload:=jsonb_build_object('body',btrim(p_body),'media',p_media,'listing',p_listing,'context',p_context);
 SELECT * INTO old FROM zoi.community_publish_requests WHERE profile_id=actor AND request_id=p_request;
 IF FOUND THEN IF old.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_payload_changed'; END IF;RETURN jsonb_build_object('ok',true,'id',old.post_id,'request_id',p_request);END IF;
 IF (SELECT count(*) FROM zoi.feed_posts WHERE profile_id=actor AND created_at>now()-interval '1 minute')>=5 OR (SELECT count(*) FROM zoi.feed_posts WHERE profile_id=actor AND created_at>now()-interval '1 day')>=100 THEN RAISE EXCEPTION 'rate_limited'; END IF;
 FOREACH mid IN ARRAY p_media LOOP
  SELECT * INTO a FROM zoi.community_media_assets WHERE id=mid FOR UPDATE;
  IF NOT FOUND OR a.profile_id<>actor OR a.state<>'ready' OR a.purpose<>'post' THEN RAISE EXCEPTION 'invalid_post_media';END IF;
  IF a.mime_type='video/mp4' THEN videos:=videos+1;END IF;
  media:=media||jsonb_build_array(zoi.community_media_projection(a)||jsonb_build_object('alt',coalesce(alts->>mid::text,'')));
 END LOOP;
 IF videos>0 AND cardinality(p_media)<>1 THEN RAISE EXCEPTION 'one_video_or_four_images'; END IF;
 IF p_listing IS NOT NULL THEN SELECT name,slug INTO ln,ls FROM zoi.listings WHERE id=p_listing AND publish_status='published' AND coalesce(marketplace_status,'')<>'hidden';IF NOT FOUND THEN RAISE EXCEPTION 'listing_unavailable';END IF;END IF;
 INSERT INTO zoi.feed_posts(profile_id,body,listing_id,listing_name,listing_slug,media) VALUES(actor,btrim(p_body),p_listing,ln,ls,media) RETURNING id INTO post;
 PERFORM zoi.community_context_set(actor,post,p_context);
 INSERT INTO zoi.community_publish_requests(profile_id,request_id,payload,post_id) VALUES(actor,p_request,payload,post);
 RETURN jsonb_build_object('ok',true,'id',post,'request_id',p_request);
END $$;
CREATE OR REPLACE FUNCTION zoi.community_media_avatar(p_actor uuid,p_asset uuid) RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM zoi.community_media_assets WHERE id=p_asset AND profile_id=p_actor AND state='ready' AND mime_type LIKE 'image/%' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_avatar_media';END IF;RETURN zoi.community_media_url(p_asset);
END $$;
CREATE OR REPLACE FUNCTION zoi.community_media_for_post(p_post uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(value ORDER BY ordinal),'[]') FROM (
 SELECT e.ordinality ordinal,CASE WHEN jsonb_typeof(e.item)='string' AND e.item#>>'{}' LIKE 'https://csebihpaychdkanjjsmz.supabase.co/storage/v1/object/public/media/%' THEN jsonb_build_object('id',null,'type','image','url',e.item#>>'{}','poster_url',null,'mime_type',null,'width',null,'height',null,'duration_seconds',null,'alt','') ELSE zoi.community_media_projection(a)||jsonb_build_object('alt',coalesce(e.item->>'alt','')) END value
 FROM zoi.feed_posts p CROSS JOIN LATERAL jsonb_array_elements(p.media) WITH ORDINALITY e(item,ordinality)
 LEFT JOIN zoi.community_media_assets a ON a.id::text=e.item->>'id' AND a.profile_id=p.profile_id AND a.state='ready'
 WHERE p.id=p_post AND (a.id IS NOT NULL OR (jsonb_typeof(e.item)='string' AND e.item#>>'{}' LIKE 'https://csebihpaychdkanjjsmz.supabase.co/storage/v1/object/public/media/%'))
 )q $$;
CREATE FUNCTION public.community_media_read(p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a zoi.community_media_assets;
BEGIN
 SELECT * INTO a FROM zoi.community_media_assets WHERE id=p_id AND state='ready';
 IF NOT FOUND OR NOT (EXISTS(SELECT 1 FROM zoi.community_profiles WHERE avatar_media_id=p_id) OR EXISTS(SELECT 1 FROM zoi.feed_posts p WHERE p.profile_id=a.profile_id AND p.status='visible' AND p.media @> jsonb_build_array(jsonb_build_object('id',p_id)))) THEN RAISE EXCEPTION 'media_unavailable'; END IF;
 RETURN jsonb_build_object('ok',true,'path',a.profile_id::text||'/'||a.id::text,'mime_type',a.mime_type);
END $$;
CREATE FUNCTION public.community_media_discard(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=zoi.community_viewer();a zoi.community_media_assets;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'sign_in_required';END IF;
 PERFORM 1 FROM zoi.user_profiles WHERE id=actor FOR UPDATE;
 SELECT * INTO a FROM zoi.community_media_assets WHERE id=p_id AND profile_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'media_unavailable';END IF;
 IF EXISTS(SELECT 1 FROM zoi.community_profiles WHERE avatar_media_id=p_id) OR EXISTS(SELECT 1 FROM zoi.feed_posts p WHERE p.media @> jsonb_build_array(jsonb_build_object('id',p_id))) THEN RAISE EXCEPTION 'media_in_use';END IF;
 UPDATE zoi.community_media_assets SET state='discarded' WHERE id=p_id;
 RETURN jsonb_build_object('ok',true,'id',p_id,'path',a.profile_id::text||'/'||a.id::text);
END $$;
-- Cleanup closes abandoned assets before object deletion; no expiry can delete attached media.
CREATE FUNCTION public.community_media_cleanup() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a zoi.community_media_assets;paths jsonb:='[]';
BEGIN
 FOR a IN SELECT * FROM zoi.community_media_assets m WHERE storage_deleted_at IS NULL AND (state='discarded' OR created_at<now()-interval '24 hours') AND NOT EXISTS(SELECT 1 FROM zoi.community_profiles WHERE avatar_media_id=m.id) AND NOT EXISTS(SELECT 1 FROM zoi.feed_posts p WHERE p.media @> jsonb_build_array(jsonb_build_object('id',m.id))) ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
  IF EXISTS(SELECT 1 FROM zoi.community_profiles WHERE avatar_media_id=a.id) OR EXISTS(SELECT 1 FROM zoi.feed_posts p WHERE p.media @> jsonb_build_array(jsonb_build_object('id',a.id))) THEN CONTINUE; END IF;
  UPDATE zoi.community_media_assets SET state='discarded' WHERE id=a.id;
  paths:=paths||jsonb_build_array(a.profile_id::text||'/'||a.id::text);
 END LOOP;
 RETURN jsonb_build_object('ok',true,'paths',paths);
END $$;
CREATE FUNCTION public.community_media_cleanup_finish(p_paths text[]) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ UPDATE zoi.community_media_assets SET storage_deleted_at=now() WHERE state='discarded' AND profile_id::text||'/'||id::text=ANY(p_paths) $$;
REVOKE ALL ON FUNCTION public.community_media_cleanup_finish(text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.community_media_cleanup_finish(text[]) TO service_role;
-- Keep legacy text clients callable; raw URLs cannot impersonate validated attachments.
CREATE OR REPLACE FUNCTION public.feed_post(p_body text,p_listing uuid DEFAULT NULL,p_nameday text DEFAULT NULL,p_media jsonb DEFAULT '[]') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE receipt jsonb;
BEGIN
 IF jsonb_typeof(coalesce(p_media,'[]'))<>'array' OR coalesce(p_media,'[]')<>'[]'::jsonb THEN RAISE EXCEPTION 'verified_media_required';END IF;
 IF length(coalesce(p_nameday,''))>100 THEN RAISE EXCEPTION 'invalid_nameday';END IF;
 receipt:=public.community_publish(gen_random_uuid(),p_body,'{}',p_listing,'{}');
 IF nullif(btrim(p_nameday),'') IS NOT NULL THEN UPDATE zoi.feed_posts SET nameday_ref=btrim(p_nameday) WHERE id=(receipt->>'id')::uuid;END IF;
 RETURN jsonb_build_object('ok',true,'id',receipt->'id');
END $$;
REVOKE ALL ON FUNCTION public.feed_post(text,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.feed_post(text,uuid,text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION zoi.community_media_url(uuid),zoi.community_media_projection(zoi.community_media_assets),zoi.community_media_avatar(uuid,uuid),zoi.community_media_for_post(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.community_media_begin(uuid,text,text,integer,text,jsonb),public.community_media_finish(uuid),public.community_publish(uuid,text,uuid[],uuid,jsonb),public.community_media_read(uuid),public.community_media_discard(uuid),public.community_media_cleanup() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.community_media_begin(uuid,text,text,integer,text,jsonb),public.community_publish(uuid,text,uuid[],uuid,jsonb),public.community_media_discard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_media_finish(uuid),public.community_media_read(uuid),public.community_media_cleanup() TO service_role;
COMMIT;

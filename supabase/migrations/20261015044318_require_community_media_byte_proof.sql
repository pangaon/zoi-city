BEGIN;SET LOCAL lock_timeout='2s';SET LOCAL statement_timeout='15s';
DO $guard$BEGIN
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.community_media_finish(uuid)'::regprocedure AND md5(prosrc)='83501ab0e655d6b9283ffe67d41c454a' AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=""'] AND proacl::text='{postgres=X/postgres,service_role=X/postgres}')THEN RAISE EXCEPTION 'community_media_dependency_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.community_publish(uuid, text, uuid[], uuid, jsonb)'::regprocedure AND md5(prosrc)='25155ddd03f059dfb1a224265800f513' AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=""'] AND proacl::text='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}')THEN RAISE EXCEPTION 'community_media_dependency_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.community_member_payload(uuid, jsonb)'::regprocedure AND md5(prosrc)='a44c3b071fb1a658724a59dda8f5977b' AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=""'] AND proacl::text='{postgres=X/postgres}')THEN RAISE EXCEPTION 'community_media_dependency_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.community_media_avatar(uuid,uuid)'::regprocedure AND md5(prosrc)='9586ee3179661513783cb3d765ee49e2' AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=""'] AND proacl::text='{postgres=X/postgres}')THEN RAISE EXCEPTION 'community_media_dependency_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.community_profile_save(integer,jsonb)'::regprocedure AND md5(prosrc)='a8aff03041e92a620caf4460967c2195' AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=""'] AND proacl::text='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}')THEN RAISE EXCEPTION 'community_media_dependency_changed';END IF;
END$guard$;
DO $guard$BEGIN IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.community_media_finish_verified(uuid,text,text,integer,jsonb)'::regprocedure AND md5(prosrc)='57b52990f898c756309497f78b6b95e1'AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=""']AND proacl::text='{postgres=X/postgres,service_role=X/postgres}')THEN RAISE EXCEPTION 'community_media_foundation_changed';END IF;END$guard$;
DO $guard$BEGIN IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.community_media_grant(zoi.community_media_assets)'::regprocedure AND md5(prosrc)='f912688df47258910cad5be128291380'AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=""']AND proacl::text='{postgres=X/postgres}')THEN RAISE EXCEPTION 'community_media_foundation_changed';END IF;END$guard$;
DO $guard$BEGIN IF to_regclass('zoi.community_media_byte_proofs')IS NULL OR to_regprocedure('public.community_media_finish_verified(uuid,text,text,integer,jsonb)')IS NULL THEN RAISE EXCEPTION 'community_media_foundation_missing';END IF;END$guard$;
CREATE OR REPLACE FUNCTION public.community_media_finish(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a zoi.community_media_assets;
BEGIN
 SELECT * INTO a FROM zoi.community_media_assets WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR a.state='discarded' THEN RAISE EXCEPTION 'media_unavailable'; END IF;
 IF a.state<>'ready'OR NOT EXISTS(SELECT 1 FROM zoi.community_media_byte_proofs WHERE asset_id=a.id)THEN RAISE EXCEPTION 'media_byte_proof_required';END IF;
 RETURN jsonb_build_object('ok',true,'asset',zoi.community_media_projection(a));
END $function$
;
CREATE OR REPLACE FUNCTION public.community_publish(p_request uuid, p_body text, p_media uuid[] DEFAULT '{}'::uuid[], p_listing uuid DEFAULT NULL::uuid, p_context jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor uuid:=zoi.community_member_actor(); payload jsonb; old zoi.community_publish_requests;mid uuid;a zoi.community_media_assets;media jsonb:='[]'; post uuid;ln text;ls text;videos integer:=0;alts jsonb:=coalesce(p_context->'media_alts','{}');
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'sign_in_required'; END IF;
 PERFORM 1 FROM zoi.user_profiles WHERE id=actor FOR UPDATE;
 IF p_request IS NULL OR coalesce(length(btrim(p_body)),0) NOT BETWEEN 1 AND 1000 OR p_media IS NULL OR cardinality(p_media)>4 OR array_position(p_media,NULL) IS NOT NULL OR cardinality(p_media)<>(SELECT count(DISTINCT x) FROM unnest(p_media)x) THEN RAISE EXCEPTION 'invalid_post'; END IF;
 IF octet_length(p_context::text)>16000 THEN RAISE EXCEPTION 'invalid_post_context';END IF;
 IF jsonb_typeof(alts) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_each(alts) e WHERE NOT(e.key=ANY(p_media::text[])) OR jsonb_typeof(e.value)<>'string' OR length(e.value#>>'{}')>500) THEN RAISE EXCEPTION 'invalid_media_alt';END IF;
 payload:=jsonb_build_object('body',btrim(p_body),'media',p_media,'listing',p_listing,'context',p_context);
 SELECT * INTO old FROM zoi.community_publish_requests WHERE profile_id=actor AND request_id=p_request;
 IF FOUND THEN IF old.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_payload_changed'; END IF;PERFORM zoi.suite_current_session(); RETURN jsonb_build_object('ok',true,'id',old.post_id,'request_id',p_request);END IF;
 IF (SELECT count(*) FROM zoi.feed_posts WHERE profile_id=actor AND created_at>now()-interval '1 minute')>=5 OR (SELECT count(*) FROM zoi.feed_posts WHERE profile_id=actor AND created_at>now()-interval '1 day')>=100 THEN RAISE EXCEPTION 'rate_limited'; END IF;
 FOREACH mid IN ARRAY p_media LOOP
  SELECT * INTO a FROM zoi.community_media_assets WHERE id=mid FOR UPDATE;
  IF NOT FOUND OR a.profile_id<>actor OR a.state<>'ready' OR a.purpose<>'post' THEN RAISE EXCEPTION 'invalid_post_media';END IF;
  IF NOT EXISTS(SELECT 1 FROM zoi.community_media_byte_proofs WHERE asset_id=a.id AND(sha256,mime_type,size_bytes,metadata)IS NOT DISTINCT FROM(a.sha256,a.mime_type,a.size_bytes,a.metadata))THEN RAISE EXCEPTION 'media_byte_proof_required';END IF;
 IF a.mime_type='video/mp4' THEN videos:=videos+1;END IF;
  media:=media||jsonb_build_array(zoi.community_media_projection(a)||jsonb_build_object('alt',coalesce(alts->>mid::text,'')));
 END LOOP;
 IF videos>0 AND cardinality(p_media)<>1 THEN RAISE EXCEPTION 'one_video_or_four_images'; END IF;
 IF p_listing IS NOT NULL THEN SELECT name,slug INTO ln,ls FROM zoi.listings WHERE id=p_listing AND publish_status='published' AND coalesce(marketplace_status,'')<>'hidden';IF NOT FOUND THEN RAISE EXCEPTION 'listing_unavailable';END IF;END IF;
 INSERT INTO zoi.feed_posts(profile_id,body,listing_id,listing_name,listing_slug,media) VALUES(actor,btrim(p_body),p_listing,ln,ls,media) RETURNING id INTO post;
 PERFORM zoi.community_context_set(actor,post,p_context);
 INSERT INTO zoi.community_publish_requests(profile_id,request_id,payload,post_id) VALUES(actor,p_request,payload,post);
 PERFORM zoi.suite_current_session(); RETURN jsonb_build_object('ok',true,'id',post,'request_id',p_request);
END $function$
;
CREATE OR REPLACE FUNCTION zoi.community_member_payload(p_actor uuid, p_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE mid uuid;a zoi.community_media_assets; videos integer:=0;media uuid[];ctx jsonb:=p_data->'context';alts jsonb:=ctx->'media_alts';
BEGIN
 IF jsonb_typeof(p_data)IS DISTINCT FROM'object'OR octet_length(p_data::text)>20000 OR p_data-ARRAY['body','media','listing','context']<>'{}'::jsonb
 OR jsonb_typeof(p_data->'body')IS DISTINCT FROM'string'OR length(p_data->>'body')>1000
 OR jsonb_typeof(p_data->'media')IS DISTINCT FROM'array'OR jsonb_array_length(p_data->'media')>4
 OR jsonb_typeof(ctx)IS DISTINCT FROM'object'OR ctx-ARRAY['intent','topics','city','country','media_alts']<>'{}'::jsonb
 OR coalesce(ctx->>'intent','')NOT IN('moment','question','recommendation','event')
 OR length(coalesce(ctx->>'city',''))>120 OR length(coalesce(ctx->>'country',''))>120
 OR jsonb_typeof(alts)IS DISTINCT FROM'object'
 THEN RAISE EXCEPTION 'invalid_community_draft';END IF;
 PERFORM zoi.community_topic_array(ctx->'topics',5);
 SELECT coalesce(array_agg(x::uuid),'{}')INTO media FROM jsonb_array_elements_text(p_data->'media')x;
 IF cardinality(media)<>(SELECT count(DISTINCT x)FROM unnest(media)x)OR array_position(media,NULL)IS NOT NULL
 OR EXISTS(SELECT 1 FROM jsonb_each(alts)e WHERE NOT(e.key=ANY(media::text[]))OR jsonb_typeof(e.value)<>'string'OR length(e.value#>>'{}')>500)THEN RAISE EXCEPTION 'invalid_community_draft_media';END IF;
 FOREACH mid IN ARRAY media LOOP
 SELECT * INTO a FROM zoi.community_media_assets WHERE id=mid FOR UPDATE;
 IF NOT FOUND OR a.profile_id<>p_actor OR a.state<>'ready'OR a.purpose<>'post'THEN RAISE EXCEPTION 'invalid_post_media';END IF;
 IF NOT EXISTS(SELECT 1 FROM zoi.community_media_byte_proofs WHERE asset_id=a.id AND(sha256,mime_type,size_bytes,metadata)IS NOT DISTINCT FROM(a.sha256,a.mime_type,a.size_bytes,a.metadata))THEN RAISE EXCEPTION 'media_byte_proof_required';END IF;
 IF a.mime_type='video/mp4' THEN videos:=videos+1;END IF;
 END LOOP;
 IF videos>0 AND cardinality(media)<>1 THEN RAISE EXCEPTION 'one_video_or_four_images';END IF;
 IF p_data->>'listing'IS NOT NULL AND NOT EXISTS(SELECT 1 FROM zoi.listings WHERE id=(p_data->>'listing')::uuid AND publish_status='published'AND coalesce(marketplace_status,'')<>'hidden')THEN RAISE EXCEPTION 'listing_unavailable';END IF;
END$function$
;
CREATE OR REPLACE FUNCTION zoi.community_media_avatar(p_actor uuid, p_asset uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF p_actor IS DISTINCT FROM zoi.community_member_actor()THEN RAISE EXCEPTION 'invalid_avatar_media';END IF;
 IF NOT EXISTS(SELECT 1 FROM zoi.community_profiles WHERE profile_id=p_actor AND avatar_media_id=p_asset)AND NOT EXISTS(SELECT 1 FROM zoi.community_media_byte_proofs WHERE asset_id=p_asset)THEN RAISE EXCEPTION 'media_byte_proof_required';END IF;
 PERFORM 1 FROM zoi.community_media_assets WHERE id=p_asset AND profile_id=p_actor AND state='ready' AND mime_type LIKE 'image/%' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_avatar_media';END IF;RETURN zoi.community_media_url(p_asset);
END $function$
;
CREATE OR REPLACE FUNCTION public.community_profile_save(p_expected_version integer, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare actor uuid;p zoi.community_profiles;prior zoi.community_profiles;topics text[];avatar uuid;v_url text;v_handle text;begin
 actor:=zoi.community_member_actor();perform 1 from zoi.user_profiles where id=actor for update;select * into prior from zoi.community_profiles where profile_id=actor for update;
 if prior.profile_id is not null and p_expected_version=0 then if prior.initial_data is distinct from p_data then raise exception 'community_version_conflict';end if;return jsonb_build_object('ok',true,'profile',zoi.community_profile(actor,actor)||jsonb_build_object('avatar_media_id',prior.avatar_media_id));end if;
 v_handle:=lower(btrim(p_data->>'handle'));if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>12000 or coalesce(v_handle,'') !~ '^[a-z0-9_]{3,30}$' or v_handle in('admin','administrator','support','zoi','buygreek','moderator','official') or length(btrim(coalesce(p_data->>'display_name',''))) not between 1 and 80 or length(coalesce(p_data->>'bio',''))>400 or length(coalesce(p_data->>'city',''))>120 or length(coalesce(p_data->>'country',''))>120 then raise exception 'community_invalid_profile';end if;
 topics:=zoi.community_topic_array(coalesce(p_data->'interests','[]'),8);avatar:=nullif(p_data->>'avatar_media_id','')::uuid;v_url:=zoi.community_avatar_url(actor,avatar);
 if exists(select 1 from zoi.community_profiles where community_profiles.handle=v_handle and profile_id<>actor) then raise exception 'community_handle_taken';end if;
 if prior.profile_id is null then if p_expected_version is distinct from 0 then raise exception 'community_version_conflict';end if;
 insert into zoi.community_profiles(profile_id,handle,display_name,bio,city,country,interests,avatar_media_id,avatar_url,initial_data) values(actor,v_handle,btrim(p_data->>'display_name'),coalesce(p_data->>'bio',''),nullif(btrim(p_data->>'city'),''),nullif(btrim(p_data->>'country'),''),topics,avatar,v_url,p_data) returning * into p;
 else if prior.version is distinct from p_expected_version then raise exception 'community_version_conflict';end if;
 update zoi.community_profiles set handle=v_handle,display_name=btrim(p_data->>'display_name'),bio=coalesce(p_data->>'bio',''),city=nullif(btrim(p_data->>'city'),''),country=nullif(btrim(p_data->>'country'),''),interests=topics,avatar_media_id=avatar,avatar_url=v_url,version=version+1,updated_at=clock_timestamp() where profile_id=actor returning * into p;end if;
 return jsonb_build_object('ok',true,'profile',zoi.community_profile(actor,actor)||jsonb_build_object('avatar_media_id',p.avatar_media_id));end $function$
;
COMMIT;

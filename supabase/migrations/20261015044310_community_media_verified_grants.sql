BEGIN;SET LOCAL lock_timeout='2s';SET LOCAL statement_timeout='15s';
DO $guard$BEGIN
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.community_media_begin(uuid, text, text, integer, text, jsonb)'::regprocedure AND md5(prosrc)='06fda786010e1cd39a371dd798857d5c' AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=""'] AND proacl::text='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}')THEN RAISE EXCEPTION 'community_media_dependency_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.community_media_finish(uuid)'::regprocedure AND md5(prosrc)='83501ab0e655d6b9283ffe67d41c454a' AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=""'] AND proacl::text='{postgres=X/postgres,service_role=X/postgres}')THEN RAISE EXCEPTION 'community_media_dependency_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.community_member_actor()'::regprocedure AND md5(prosrc)='5e9d91d496c61e25be634223b0afdb29' AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=""'] AND proacl::text='{postgres=X/postgres}')THEN RAISE EXCEPTION 'community_media_dependency_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.suite_lock_session()'::regprocedure AND md5(prosrc)='ab5f8703ced5f96c0ac69257281ffe00' AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=""'] AND proacl::text='{postgres=X/postgres}')THEN RAISE EXCEPTION 'community_media_dependency_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.suite_current_session()'::regprocedure AND md5(prosrc)='70cb927f126f251f229c450bf9f792e8' AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=""'] AND proacl::text='{postgres=X/postgres}')THEN RAISE EXCEPTION 'community_media_dependency_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.community_publish(uuid, text, uuid[], uuid, jsonb)'::regprocedure AND md5(prosrc)='25155ddd03f059dfb1a224265800f513' AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=""'] AND proacl::text='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}')THEN RAISE EXCEPTION 'community_media_dependency_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.community_member_payload(uuid, jsonb)'::regprocedure AND md5(prosrc)='a44c3b071fb1a658724a59dda8f5977b' AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=""'] AND proacl::text='{postgres=X/postgres}')THEN RAISE EXCEPTION 'community_media_dependency_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.community_member_draft_projection(zoi.community_member_drafts)'::regprocedure AND md5(prosrc)='aa7bcac33ec3728587d25577b5233cad' AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=""'] AND proacl::text='{postgres=X/postgres}')THEN RAISE EXCEPTION 'community_media_dependency_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.community_media_avatar(uuid,uuid)'::regprocedure AND md5(prosrc)='9586ee3179661513783cb3d765ee49e2' AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=""'] AND proacl::text='{postgres=X/postgres}')THEN RAISE EXCEPTION 'community_media_dependency_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.community_profile_save(integer,jsonb)'::regprocedure AND md5(prosrc)='a8aff03041e92a620caf4460967c2195' AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=""'] AND proacl::text='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}')THEN RAISE EXCEPTION 'community_media_dependency_changed';END IF;
END$guard$;
CREATE TABLE zoi.community_media_upload_grants(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),asset_id uuid NOT NULL REFERENCES zoi.community_media_assets(id),account_id uuid NOT NULL,profile_id uuid NOT NULL,session_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '15 minutes');
CREATE INDEX community_media_upload_grants_asset ON zoi.community_media_upload_grants(asset_id,account_id,session_id,created_at DESC);
CREATE TABLE zoi.community_media_byte_proofs(asset_id uuid PRIMARY KEY REFERENCES zoi.community_media_assets(id),sha256 text NOT NULL CHECK(sha256~'^[0-9a-f]{64}$'),mime_type text NOT NULL,size_bytes integer NOT NULL,metadata jsonb NOT NULL,verified_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE zoi.community_media_upload_grants ENABLE ROW LEVEL SECURITY;ALTER TABLE zoi.community_media_byte_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.community_media_upload_grants,zoi.community_media_byte_proofs FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION zoi.community_media_immutable()RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN RAISE EXCEPTION 'media_immutable_evidence';END$$;
CREATE TRIGGER community_media_grant_immutable BEFORE UPDATE OR DELETE ON zoi.community_media_upload_grants FOR EACH ROW EXECUTE FUNCTION zoi.community_media_immutable();
CREATE TRIGGER community_media_proof_immutable BEFORE UPDATE OR DELETE ON zoi.community_media_byte_proofs FOR EACH ROW EXECUTE FUNCTION zoi.community_media_immutable();
CREATE FUNCTION zoi.community_media_grant(a zoi.community_media_assets)RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE g uuid;BEGIN
 IF a.profile_id IS DISTINCT FROM zoi.community_member_actor()OR a.state NOT IN('pending','ready')THEN RAISE EXCEPTION 'media_unavailable';END IF;
 SELECT id INTO g FROM zoi.community_media_upload_grants WHERE asset_id=a.id AND account_id=auth.uid()AND profile_id=a.profile_id AND session_id=(auth.jwt()->>'session_id')::uuid AND expires_at>clock_timestamp()+interval '1 minute' ORDER BY created_at DESC LIMIT 1;
 IF g IS NULL THEN
 IF(SELECT count(*)FROM zoi.community_media_upload_grants WHERE account_id=auth.uid()AND created_at>clock_timestamp()-interval '1 day')>=200 THEN RAISE EXCEPTION 'media_rate_limited';END IF;
 INSERT INTO zoi.community_media_upload_grants(asset_id,account_id,profile_id,session_id)VALUES(a.id,auth.uid(),a.profile_id,(auth.jwt()->>'session_id')::uuid)RETURNING id INTO g;END IF;
 PERFORM zoi.suite_current_session();RETURN g;END$$;
CREATE FUNCTION public.community_media_reverify(p_id uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE actor uuid:=zoi.community_member_actor();a zoi.community_media_assets;g uuid;BEGIN
 SELECT * INTO a FROM zoi.community_media_assets WHERE id=p_id AND profile_id=actor AND state='ready' FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'media_unavailable';END IF;
 g:=zoi.community_media_grant(a);PERFORM zoi.suite_current_session();RETURN jsonb_build_object('ok',true,'id',a.id,'path',actor::text||'/'||a.id::text,'grant_id',g,'purpose',a.purpose,'mime_type',a.mime_type,'size_bytes',a.size_bytes,'sha256',a.sha256,'metadata',a.metadata);END$$;
CREATE FUNCTION public.community_media_finish_verified(p_grant uuid,p_sha256 text,p_mime text,p_size integer,p_metadata jsonb)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE g zoi.community_media_upload_grants;a zoi.community_media_assets;BEGIN
 SELECT * INTO g FROM zoi.community_media_upload_grants WHERE id=p_grant;IF NOT FOUND THEN RAISE EXCEPTION 'media_grant_unavailable';END IF;
 -- Same account/session/profile order as community_member_actor. Recheck after every lock wait.
 PERFORM pg_advisory_xact_lock(hashtextextended('community_auth:'||g.account_id::text,0));
 PERFORM 1 FROM auth.users WHERE id=g.account_id AND deleted_at IS NULL AND coalesce(is_anonymous,false)=false AND(banned_until IS NULL OR banned_until<=clock_timestamp())FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'media_grant_unavailable';END IF;
 PERFORM 1 FROM auth.sessions WHERE id=g.session_id AND user_id=g.account_id AND(not_after IS NULL OR not_after>clock_timestamp())FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'media_grant_unavailable';END IF;
 PERFORM 1 FROM zoi.user_profiles WHERE id=g.profile_id AND auth_user_id=g.account_id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'media_grant_unavailable';END IF;
 SELECT * INTO a FROM zoi.community_media_assets WHERE id=g.asset_id FOR UPDATE;
 IF NOT FOUND OR a.profile_id<>g.profile_id OR a.state NOT IN('pending','ready')OR a.created_at<clock_timestamp()-interval '23 hours'AND a.state='pending'OR g.expires_at<=clock_timestamp()THEN RAISE EXCEPTION 'media_grant_unavailable';END IF;
 IF(a.sha256,a.mime_type,a.size_bytes,a.metadata)IS DISTINCT FROM(p_sha256,p_mime,p_size,p_metadata)THEN RAISE EXCEPTION 'media_byte_proof_mismatch';END IF;
 IF g.expires_at<=clock_timestamp()OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=g.account_id AND deleted_at IS NULL AND coalesce(is_anonymous,false)=false AND(banned_until IS NULL OR banned_until<=clock_timestamp()))OR NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id=g.session_id AND user_id=g.account_id AND(not_after IS NULL OR not_after>clock_timestamp()))THEN RAISE EXCEPTION 'media_grant_unavailable';END IF;
 INSERT INTO zoi.community_media_byte_proofs(asset_id,sha256,mime_type,size_bytes,metadata)VALUES(a.id,p_sha256,p_mime,p_size,p_metadata)ON CONFLICT(asset_id)DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM zoi.community_media_byte_proofs WHERE asset_id=a.id AND(sha256,mime_type,size_bytes,metadata)IS NOT DISTINCT FROM(p_sha256,p_mime,p_size,p_metadata))THEN RAISE EXCEPTION 'media_byte_proof_mismatch';END IF;
 UPDATE zoi.community_media_assets SET state='ready',finalized_at=coalesce(finalized_at,clock_timestamp())WHERE id=a.id RETURNING * INTO a;
 RETURN jsonb_build_object('ok',true,'asset',zoi.community_media_projection(a)||jsonb_build_object('content_verified',true));END$$;
CREATE OR REPLACE FUNCTION public.community_media_begin(p_request uuid, p_purpose text, p_mime text, p_size integer, p_sha256 text, p_metadata jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor uuid:=zoi.community_member_actor();a zoi.community_media_assets;
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
 PERFORM zoi.suite_current_session(); RETURN jsonb_build_object('ok',true,'id',a.id,'path',a.profile_id::text||'/'||a.id::text,'state',a.state,'grant_id',zoi.community_media_grant(a),'content_verified',EXISTS(SELECT 1 FROM zoi.community_media_byte_proofs WHERE asset_id=a.id),'asset',CASE WHEN a.state='ready' THEN zoi.community_media_projection(a) ELSE NULL END);
END $function$
;
CREATE OR REPLACE FUNCTION zoi.community_member_draft_projection(d zoi.community_member_drafts)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$SELECT jsonb_build_object('id',d.id,'version',d.version,'state',d.state,'payload',d.payload,'post_id',d.post_id,'updated_at',d.updated_at,'media_assets',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'content_verified',EXISTS(SELECT 1 FROM zoi.community_media_byte_proofs WHERE asset_id=a.id),'type',CASE WHEN a.mime_type='video/mp4'THEN'video'ELSE'image'END,'mime_type',a.mime_type,'width',a.metadata->'width','height',a.metadata->'height','duration_seconds',a.metadata->'duration_seconds'))FROM zoi.community_media_assets a WHERE a.profile_id=d.profile_id AND d.payload->'media' @> to_jsonb(ARRAY[a.id::text])),'[]'))$function$
;
ALTER FUNCTION zoi.community_media_immutable()OWNER TO postgres;REVOKE ALL ON FUNCTION zoi.community_media_immutable()FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION zoi.community_media_grant(zoi.community_media_assets)OWNER TO postgres;REVOKE ALL ON FUNCTION zoi.community_media_grant(zoi.community_media_assets)FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION public.community_media_reverify(uuid)OWNER TO postgres;REVOKE ALL ON FUNCTION public.community_media_reverify(uuid)FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.community_media_reverify(uuid)TO authenticated,service_role;
ALTER FUNCTION public.community_media_finish_verified(uuid,text,text,integer,jsonb)OWNER TO postgres;REVOKE ALL ON FUNCTION public.community_media_finish_verified(uuid,text,text,integer,jsonb)FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.community_media_finish_verified(uuid,text,text,integer,jsonb)TO service_role;
COMMIT;

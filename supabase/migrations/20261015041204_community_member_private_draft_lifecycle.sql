BEGIN;
SET LOCAL lock_timeout='5s';
-- Ordinary members need no business workspace. Private drafts are an adjunct to
-- the existing Community feed and verified media ledger, never a second feed.
DO $guard$
DECLARE r record; p regprocedure;
BEGIN
 FOR r IN SELECT * FROM (VALUES
 ('public.community_publish(uuid,text,uuid[],uuid,jsonb)','1ff4f0304fd38b068471c6ed4cebf836','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
 ('public.feed_delete(uuid)','bb7ab94744a5f6563d28af869d4cb12f','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
 ('public.community_media_begin(uuid,text,text,integer,text,jsonb)','6d96e799810b4105e32e03893b00f258','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
 ('public.community_media_discard(uuid)','f43cac3da8ac29a43cced61675cc3398','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
 ('public.community_media_cleanup()','2143f856f94eb2a8b3c7163f87c82190','{postgres=X/postgres,service_role=X/postgres}'),
 ('zoi.suite_lock_session()','ab5f8703ced5f96c0ac69257281ffe00','{postgres=X/postgres}'),
 ('zoi.suite_current_session()','70cb927f126f251f229c450bf9f792e8','{postgres=X/postgres}')
 )v(signature,hash,acl) LOOP
 p:=to_regprocedure(r.signature);
 IF p IS NULL OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=p AND md5(prosrc)=r.hash AND proowner::regrole::text='postgres' AND proacl::text=r.acl AND proconfig=ARRAY['search_path=""'])THEN RAISE EXCEPTION 'community_member_dependency_changed: %',r.signature;END IF;
 END LOOP;
END $guard$;
CREATE TABLE zoi.community_member_drafts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),profile_id uuid NOT NULL REFERENCES zoi.user_profiles(id),account_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0),state text NOT NULL CHECK(state IN('draft','published','discarded')),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),post_id uuid,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX community_member_one_active_draft ON zoi.community_member_drafts(profile_id,account_id)WHERE state='draft';
CREATE INDEX community_member_draft_media_hold ON zoi.community_member_drafts USING gin((payload->'media'))WHERE state='draft';
CREATE INDEX community_member_draft_history_list ON zoi.community_member_drafts(profile_id,account_id,updated_at DESC,id);
CREATE TABLE zoi.community_member_draft_versions(
 draft_id uuid NOT NULL REFERENCES zoi.community_member_drafts(id),version integer NOT NULL,profile_id uuid NOT NULL,account_id uuid NOT NULL,
 state text NOT NULL,payload jsonb NOT NULL,post_id uuid,at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(draft_id,version)
);
CREATE TABLE zoi.community_member_requests(
 account_id uuid NOT NULL,profile_id uuid NOT NULL,request_id uuid NOT NULL,action text NOT NULL,
 payload jsonb NOT NULL,receipt jsonb NOT NULL,at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(account_id,profile_id,request_id)
);
ALTER TABLE zoi.community_member_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoi.community_member_draft_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoi.community_member_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.community_member_drafts,zoi.community_member_draft_versions,zoi.community_member_requests FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION zoi.community_member_immutable()RETURNS trigger LANGUAGE plpgsql SET search_path=''AS $$BEGIN RAISE EXCEPTION 'community_member_receipt_immutable';END$$;
CREATE TRIGGER community_member_versions_immutable BEFORE UPDATE OR DELETE ON zoi.community_member_draft_versions FOR EACH ROW EXECUTE FUNCTION zoi.community_member_immutable();
CREATE TRIGGER community_member_requests_immutable BEFORE UPDATE OR DELETE ON zoi.community_member_requests FOR EACH ROW EXECUTE FUNCTION zoi.community_member_immutable();
CREATE FUNCTION zoi.community_member_actor()RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE actor uuid;
BEGIN
 IF auth.uid()IS NULL THEN RAISE EXCEPTION 'community_sign_in_required' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('community_auth:'||auth.uid()::text,0));
 PERFORM zoi.suite_lock_session();
 SELECT id INTO actor FROM zoi.user_profiles WHERE auth_user_id=auth.uid() FOR UPDATE;
 IF actor IS NULL THEN RAISE EXCEPTION 'community_profile_required' USING ERRCODE='42501';END IF;
 PERFORM zoi.suite_current_session();RETURN actor;
END$$;
CREATE FUNCTION zoi.community_member_payload(p_actor uuid,p_data jsonb)RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
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
 IF a.mime_type='video/mp4' THEN videos:=videos+1;END IF;
 END LOOP;
 IF videos>0 AND cardinality(media)<>1 THEN RAISE EXCEPTION 'one_video_or_four_images';END IF;
 IF p_data->>'listing'IS NOT NULL AND NOT EXISTS(SELECT 1 FROM zoi.listings WHERE id=(p_data->>'listing')::uuid AND publish_status='published'AND coalesce(marketplace_status,'')<>'hidden')THEN RAISE EXCEPTION 'listing_unavailable';END IF;
END$$;
CREATE FUNCTION zoi.community_member_draft_projection(d zoi.community_member_drafts)RETURNS jsonb LANGUAGE sql STABLE SET search_path=''AS $$SELECT jsonb_build_object('id',d.id,'version',d.version,'state',d.state,'payload',d.payload,'post_id',d.post_id,'updated_at',d.updated_at,'media_assets',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'type',CASE WHEN a.mime_type='video/mp4'THEN'video'ELSE'image'END,'mime_type',a.mime_type,'width',a.metadata->'width','height',a.metadata->'height','duration_seconds',a.metadata->'duration_seconds'))FROM zoi.community_media_assets a WHERE a.profile_id=d.profile_id AND d.payload->'media' @> to_jsonb(ARRAY[a.id::text])),'[]'))$$;
CREATE FUNCTION public.community_draft_get(p_draft uuid DEFAULT NULL)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE actor uuid:=zoi.community_member_actor();d zoi.community_member_drafts;
BEGIN
 SELECT * INTO d FROM zoi.community_member_drafts WHERE profile_id=actor AND account_id=auth.uid()AND((p_draft IS NULL AND state='draft')OR id=p_draft)ORDER BY updated_at DESC LIMIT 1;
 IF p_draft IS NOT NULL AND d.id IS NULL THEN RAISE EXCEPTION 'community_draft_unavailable' USING ERRCODE='42501';END IF;
 PERFORM zoi.suite_current_session();RETURN jsonb_build_object('ok',true,'schema_version',1,'draft',CASE WHEN d.id IS NULL THEN NULL ELSE zoi.community_member_draft_projection(d)END);
END$$;
CREATE FUNCTION public.community_draft_media_preview(p_draft uuid,p_asset uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE actor uuid:=zoi.community_member_actor();a zoi.community_media_assets;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.community_member_drafts WHERE id=p_draft AND profile_id=actor AND account_id=auth.uid()AND state='draft'AND payload->'media' @> to_jsonb(ARRAY[p_asset::text]))THEN RAISE EXCEPTION 'community_draft_unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO a FROM zoi.community_media_assets WHERE id=p_asset AND profile_id=actor AND state='ready'AND purpose='post'AND mime_type IN('image/jpeg','image/png','image/webp')FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'media_unavailable' USING ERRCODE='42501';END IF;
 PERFORM zoi.suite_current_session();RETURN jsonb_build_object('ok',true,'schema_version',1,'path',actor::text||'/'||a.id::text,'mime_type',a.mime_type,'size_bytes',a.size_bytes);
END$$;
CREATE FUNCTION public.community_draft_history(p_draft uuid,p_before integer DEFAULT NULL)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE actor uuid:=zoi.community_member_actor();items jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.community_member_drafts WHERE id=p_draft AND profile_id=actor AND account_id=auth.uid())THEN RAISE EXCEPTION 'community_draft_unavailable' USING ERRCODE='42501';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(v)-ARRAY['profile_id','account_id']ORDER BY version DESC),'[]')INTO items FROM(SELECT * FROM zoi.community_member_draft_versions WHERE draft_id=p_draft AND(p_before IS NULL OR version<p_before)ORDER BY version DESC LIMIT 20)v;
 PERFORM zoi.suite_current_session();RETURN jsonb_build_object('ok',true,'schema_version',1,'versions',items);
END$$;
CREATE FUNCTION public.community_draft_request(p_request uuid,p_cancel_if_missing boolean DEFAULT false)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE actor uuid:=zoi.community_member_actor();r zoi.community_member_requests;result jsonb;
BEGIN
 IF p_request IS NULL THEN RAISE EXCEPTION 'invalid_community_request';END IF;
 SELECT * INTO r FROM zoi.community_member_requests WHERE account_id=auth.uid()AND profile_id=actor AND request_id=p_request;
 IF FOUND THEN result:=r.receipt;
 ELSIF p_cancel_if_missing THEN result:=jsonb_build_object('ok',true,'schema_version',1,'state','cancelled','request_id',p_request);INSERT INTO zoi.community_member_requests VALUES(auth.uid(),actor,p_request,'cancel','{}',result,clock_timestamp());
 ELSE result:=jsonb_build_object('ok',true,'schema_version',1,'state','missing','request_id',p_request);END IF;
 PERFORM zoi.suite_current_session();RETURN result;
END$$;
CREATE FUNCTION public.community_draft_mutate(p_request uuid,p_action text,p_draft uuid,p_expected_version integer,p_payload jsonb DEFAULT NULL)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE actor uuid:=zoi.community_member_actor();d zoi.community_member_drafts;r zoi.community_member_requests;args jsonb;receipt jsonb;post jsonb;media uuid[];
BEGIN
 IF p_request IS NULL OR p_action NOT IN('save','discard','publish')OR p_expected_version IS NULL OR p_expected_version<0 THEN RAISE EXCEPTION 'invalid_community_request';END IF;
 args:=jsonb_build_object('draft',p_draft,'expected_version',p_expected_version,'payload',p_payload);
 SELECT * INTO r FROM zoi.community_member_requests WHERE account_id=auth.uid()AND profile_id=actor AND request_id=p_request;
 IF FOUND THEN IF r.action<>p_action OR r.payload IS DISTINCT FROM args THEN RAISE EXCEPTION 'community_request_conflict';END IF;PERFORM zoi.suite_current_session();RETURN r.receipt;END IF;
 IF p_draft IS NULL THEN
 IF p_action<>'save'OR p_expected_version<>0 THEN RAISE EXCEPTION 'community_draft_unavailable';END IF;
 IF EXISTS(SELECT 1 FROM zoi.community_member_drafts WHERE profile_id=actor AND account_id=auth.uid()AND state='draft')THEN RAISE EXCEPTION 'community_draft_version_conflict';END IF;
 ELSE SELECT * INTO d FROM zoi.community_member_drafts WHERE id=p_draft AND profile_id=actor AND account_id=auth.uid()FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'community_draft_unavailable' USING ERRCODE='42501';END IF;
 IF d.version<>p_expected_version OR d.state<>'draft'THEN RAISE EXCEPTION 'community_draft_version_conflict';END IF;
 END IF;
 IF p_action='save'THEN
 PERFORM zoi.community_member_payload(actor,p_payload);
 IF d.id IS NULL THEN INSERT INTO zoi.community_member_drafts(profile_id,account_id,version,state,payload)VALUES(actor,auth.uid(),1,'draft',p_payload)RETURNING * INTO d;
 ELSE UPDATE zoi.community_member_drafts SET payload=p_payload,version=version+1,updated_at=clock_timestamp()WHERE id=d.id RETURNING * INTO d;END IF;
 ELSE
 IF p_payload IS NOT NULL THEN RAISE EXCEPTION 'invalid_community_request';END IF;
 IF p_action='publish'THEN
 PERFORM zoi.community_member_payload(actor,d.payload);
 SELECT coalesce(array_agg(x::uuid),'{}')INTO media FROM jsonb_array_elements_text(d.payload->'media')x;
 post:=public.community_publish(p_request,d.payload->>'body',media,(d.payload->>'listing')::uuid,d.payload->'context');
 END IF;
 UPDATE zoi.community_member_drafts SET state=CASE WHEN p_action='publish'THEN'published'ELSE'discarded'END,post_id=CASE WHEN p_action='publish'THEN(post->>'id')::uuid ELSE NULL END,version=version+1,updated_at=clock_timestamp()WHERE id=d.id RETURNING * INTO d;
 END IF;
 INSERT INTO zoi.community_member_draft_versions(draft_id,version,profile_id,account_id,state,payload,post_id)VALUES(d.id,d.version,actor,auth.uid(),d.state,d.payload,d.post_id);
 receipt:=jsonb_build_object('ok',true,'schema_version',1,'state','saved','request_id',p_request,'draft',zoi.community_member_draft_projection(d));
 PERFORM zoi.suite_current_session();INSERT INTO zoi.community_member_requests VALUES(auth.uid(),actor,p_request,p_action,args,receipt,clock_timestamp());RETURN receipt;
END$$;
CREATE FUNCTION public.community_delete_post(p_request uuid,p_post uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE actor uuid:=zoi.community_member_actor();r zoi.community_member_requests;args jsonb:=jsonb_build_object('post',p_post);result jsonb;
BEGIN
 IF p_request IS NULL OR p_post IS NULL THEN RAISE EXCEPTION 'invalid_community_request';END IF;
 SELECT * INTO r FROM zoi.community_member_requests WHERE account_id=auth.uid()AND profile_id=actor AND request_id=p_request;
 IF FOUND THEN IF r.action<>'delete'OR r.payload IS DISTINCT FROM args THEN RAISE EXCEPTION 'community_request_conflict';END IF;RETURN r.receipt;END IF;
 IF NOT public.feed_delete(p_post)THEN RAISE EXCEPTION 'community_post_unavailable' USING ERRCODE='42501';END IF;
 result:=jsonb_build_object('ok',true,'schema_version',1,'state','deleted','request_id',p_request,'post_id',p_post);
 PERFORM zoi.suite_current_session();INSERT INTO zoi.community_member_requests VALUES(auth.uid(),actor,p_request,'delete',args,result,clock_timestamp());RETURN result;
END$$;
-- Patch only the admitted public entry points; global community_actor and the
-- other Community profile/relationship functions retain their current contract.
DO $patch$
DECLARE p regprocedure;ddl text;old text;new text;
BEGIN
 FOREACH p IN ARRAY ARRAY['public.community_publish(uuid,text,uuid[],uuid,jsonb)'::regprocedure,'public.feed_delete(uuid)'::regprocedure,'public.community_media_begin(uuid,text,text,integer,text,jsonb)'::regprocedure,'public.community_media_discard(uuid)'::regprocedure]LOOP
 ddl:=pg_get_functiondef(p);
 IF position('zoi.community_actor()'IN ddl)>0 THEN ddl:=replace(ddl,'zoi.community_actor()','zoi.community_member_actor()');
 ELSIF position('zoi.community_viewer()'IN ddl)>0 THEN ddl:=replace(ddl,'zoi.community_viewer()','zoi.community_member_actor()');
 ELSE RAISE EXCEPTION 'community_member_patch_missing';END IF;
 IF p='public.community_media_discard(uuid)'::regprocedure THEN
 old:='IF EXISTS(SELECT 1 FROM zoi.community_profiles WHERE avatar_media_id=p_id) OR EXISTS(SELECT 1 FROM zoi.feed_posts p WHERE p.media @> jsonb_build_array(jsonb_build_object(''id'',p_id))) THEN';
 new:='IF EXISTS(SELECT 1 FROM zoi.community_member_drafts d WHERE d.state=''draft'' AND d.payload->''media'' @> to_jsonb(ARRAY[p_id::text])) OR EXISTS(SELECT 1 FROM zoi.community_profiles WHERE avatar_media_id=p_id) OR EXISTS(SELECT 1 FROM zoi.feed_posts p WHERE p.media @> jsonb_build_array(jsonb_build_object(''id'',p_id))) THEN';
 IF position(old IN ddl)=0 THEN RAISE EXCEPTION 'community_discard_patch_missing';END IF;ddl:=replace(ddl,old,new);
 END IF;
 IF p='public.feed_delete(uuid)'::regprocedure THEN ddl:=replace(ddl,'return found;','if found then perform zoi.suite_current_session();return true;end if;perform zoi.suite_current_session();return false;');
 ELSE ddl:=replace(ddl,'RETURN jsonb_build_object(','PERFORM zoi.suite_current_session(); RETURN jsonb_build_object(');END IF;
 EXECUTE ddl;
 END LOOP;
 ddl:=pg_get_functiondef('public.community_media_cleanup()'::regprocedure);
 old:='NOT EXISTS(SELECT 1 FROM zoi.community_profiles WHERE avatar_media_id=m.id)';
 new:='NOT EXISTS(SELECT 1 FROM zoi.community_member_drafts d WHERE d.state=''draft'' AND d.payload->''media'' @> to_jsonb(ARRAY[m.id::text])) AND '||old;
 IF position(old IN ddl)=0 THEN RAISE EXCEPTION 'community_cleanup_patch_missing';END IF;ddl:=replace(ddl,old,new);
 old:='IF EXISTS(SELECT 1 FROM zoi.community_profiles WHERE avatar_media_id=a.id)';
 new:='IF EXISTS(SELECT 1 FROM zoi.community_member_drafts d WHERE d.state=''draft'' AND d.payload->''media'' @> to_jsonb(ARRAY[a.id::text])) OR EXISTS(SELECT 1 FROM zoi.community_profiles WHERE avatar_media_id=a.id)';
 IF position(old IN ddl)=0 THEN RAISE EXCEPTION 'community_cleanup_recheck_missing';END IF;ddl:=replace(ddl,old,new);EXECUTE ddl;
END $patch$;
REVOKE ALL ON FUNCTION zoi.community_member_immutable(),zoi.community_member_actor(),zoi.community_member_payload(uuid,jsonb),zoi.community_member_draft_projection(zoi.community_member_drafts)FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.community_draft_media_preview(uuid,uuid),public.community_draft_get(uuid),public.community_draft_history(uuid,integer),public.community_draft_request(uuid,boolean),public.community_draft_mutate(uuid,text,uuid,integer,jsonb),public.community_delete_post(uuid,uuid)FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.community_draft_media_preview(uuid,uuid),public.community_draft_get(uuid),public.community_draft_history(uuid,integer),public.community_draft_request(uuid,boolean),public.community_draft_mutate(uuid,text,uuid,integer,jsonb),public.community_delete_post(uuid,uuid)TO authenticated;
COMMIT;

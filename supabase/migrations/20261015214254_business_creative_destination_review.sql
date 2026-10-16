BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='5s';
DO $guard$ BEGIN IF current_user<>'postgres' THEN RAISE EXCEPTION 'business_destination_postgres_required';END IF; END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.social_save_post(uuid,text,text[],timestamp with time zone,text,jsonb,text,jsonb,uuid)') AND md5(prosrc)='62569b74f0831a60bf2d2688f0e48ac5' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=zoi, public']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_destination_dependency_changed: public.social_save_post(uuid,text,text[],timestamp with time zone,text,jsonb,text,jsonb,uuid)';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.canonical_draft_context(uuid,uuid)') AND md5(prosrc)='bef2d5f9c0ca14096273b408dd5677a3' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_destination_dependency_changed: public.canonical_draft_context(uuid,uuid)';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.business_creative_source(jsonb)') AND md5(prosrc)='555c138eb4f29e2ee0a533ba5e573004' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=false AND provolatile='i')THEN RAISE EXCEPTION 'business_destination_dependency_changed: zoi.business_creative_source(jsonb)';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.business_creative_receipt(uuid,uuid,uuid)') AND md5(prosrc)='80e289240781b9512829cfac8d1ac85f' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_destination_dependency_changed: zoi.business_creative_receipt(uuid,uuid,uuid)';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.business_creative_draft_get(uuid,uuid)') AND md5(prosrc)='cbf00cb8b9000e19bcde4383eea8d023' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_destination_dependency_changed: public.business_creative_draft_get(uuid,uuid)';END IF;END $guard$;
DO $guard$ DECLARE acl text;v integer:=current_setting('server_version_num')::integer;BEGIN IF v>=170000 AND v<180000 THEN acl:='{postgres=arwdDxtm/postgres}';ELSIF v>=160000 AND v<170000 THEN acl:='{postgres=arwdDxt/postgres}';ELSE RAISE EXCEPTION 'business_destination_unsupported_server';END IF;IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='zoi.business_creative_requests'::regclass AND relowner='postgres'::regrole AND relacl::text IS NOT DISTINCT FROM acl AND relrowsecurity AND NOT relforcerowsecurity)OR EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='zoi'AND tablename='business_creative_requests')THEN RAISE EXCEPTION 'business_destination_journal_changed';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='zoi.business_creative_requests'::regclass AND tgname='business_creative_receipt_immutable' AND tgenabled='O' AND pg_get_triggerdef(oid)='CREATE TRIGGER business_creative_receipt_immutable BEFORE DELETE OR UPDATE ON zoi.business_creative_requests FOR EACH ROW EXECUTE FUNCTION zoi.business_creative_receipt_immutable()' AND tgfoid=to_regprocedure('zoi.business_creative_receipt_immutable()') AND NOT tgisinternal)THEN RAISE EXCEPTION 'business_destination_journal_trigger_changed';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='zoi.business_creative_requests'::regclass AND tgname='studio_media_receipt_context' AND tgenabled='O' AND pg_get_triggerdef(oid)='CREATE TRIGGER studio_media_receipt_context BEFORE INSERT ON zoi.business_creative_requests FOR EACH ROW EXECUTE FUNCTION zoi.studio_media_receipt_guard()' AND tgfoid=to_regprocedure('zoi.studio_media_receipt_guard()') AND NOT tgisinternal)THEN RAISE EXCEPTION 'business_destination_journal_trigger_changed';END IF;END $guard$;
DO $guard$ BEGIN IF(SELECT count(*)FROM pg_trigger WHERE tgrelid='zoi.business_creative_requests'::regclass AND NOT tgisinternal)<>2 THEN RAISE EXCEPTION 'business_destination_journal_trigger_count';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='zoi.business_creative_requests'::regclass AND conname='business_creative_requests_check' AND pg_get_constraintdef(oid)='CHECK ((((state = ''saved''::text) AND (payload IS NOT NULL) AND (post_id IS NOT NULL) AND (post_snapshot IS NOT NULL)) OR ((state = ''cancelled''::text) AND (payload IS NULL) AND (post_id IS NULL) AND (post_snapshot IS NULL))))')THEN RAISE EXCEPTION 'business_destination_journal_constraint_changed';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='zoi.business_creative_requests'::regclass AND conname='business_creative_requests_pkey' AND pg_get_constraintdef(oid)='PRIMARY KEY (request_id)')THEN RAISE EXCEPTION 'business_destination_journal_constraint_changed';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='zoi.business_creative_requests'::regclass AND conname='business_creative_requests_state_check' AND pg_get_constraintdef(oid)='CHECK ((state = ANY (ARRAY[''saved''::text, ''cancelled''::text])))')THEN RAISE EXCEPTION 'business_destination_journal_constraint_changed';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.studio_media_receipt_guard()') AND md5(prosrc)='693d1e44c0c2337d9398bc1f55e599cc' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_destination_dependency_changed: zoi.studio_media_receipt_guard()';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.studio_storage_path(text)') AND md5(prosrc)='279d854d86065688c43df0c2b86322a9' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=false AND provolatile='i')THEN RAISE EXCEPTION 'business_destination_dependency_changed: zoi.studio_storage_path(text)';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.studio_object(text,boolean)') AND md5(prosrc)='ef8f4f02631b156ebf802f2e696e071f' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_destination_dependency_changed: zoi.studio_object(text,boolean)';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.assert_workspace_write(uuid,text[])') AND md5(prosrc)='0a1b64d6adee0e63726bab3c08b0be53' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_destination_dependency_changed: zoi.assert_workspace_write(uuid,text[])';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.home_content_authorize(uuid,uuid)') AND md5(prosrc)='d5e39d01982e0a8103e71d2e296d28cd' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_destination_dependency_changed: zoi.home_content_authorize(uuid,uuid)';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.suite_current_session()') AND md5(prosrc)='70cb927f126f251f229c450bf9f792e8' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=true AND provolatile='s')THEN RAISE EXCEPTION 'business_destination_dependency_changed: zoi.suite_current_session()';END IF;END $guard$;
DO $guard$ BEGIN IF(SELECT count(*)FROM pg_attribute WHERE attrelid='zoi.business_creative_requests'::regclass AND attnum>0 AND NOT attisdropped)<>9 THEN RAISE EXCEPTION 'business_destination_journal_columns';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='zoi.business_creative_requests'::regclass AND a.attname='request_id' AND NOT a.attisdropped AND format_type(a.atttypid,a.atttypmod)='uuid' AND a.attnotnull=true AND pg_get_expr(d.adbin,d.adrelid)IS NOT DISTINCT FROM NULL)THEN RAISE EXCEPTION 'business_destination_journal_column_changed';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='zoi.business_creative_requests'::regclass AND a.attname='actor_auth' AND NOT a.attisdropped AND format_type(a.atttypid,a.atttypmod)='uuid' AND a.attnotnull=true AND pg_get_expr(d.adbin,d.adrelid)IS NOT DISTINCT FROM NULL)THEN RAISE EXCEPTION 'business_destination_journal_column_changed';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='zoi.business_creative_requests'::regclass AND a.attname='workspace_id' AND NOT a.attisdropped AND format_type(a.atttypid,a.atttypmod)='uuid' AND a.attnotnull=true AND pg_get_expr(d.adbin,d.adrelid)IS NOT DISTINCT FROM NULL)THEN RAISE EXCEPTION 'business_destination_journal_column_changed';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='zoi.business_creative_requests'::regclass AND a.attname='listing_id' AND NOT a.attisdropped AND format_type(a.atttypid,a.atttypmod)='uuid' AND a.attnotnull=true AND pg_get_expr(d.adbin,d.adrelid)IS NOT DISTINCT FROM NULL)THEN RAISE EXCEPTION 'business_destination_journal_column_changed';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='zoi.business_creative_requests'::regclass AND a.attname='state' AND NOT a.attisdropped AND format_type(a.atttypid,a.atttypmod)='text' AND a.attnotnull=true AND pg_get_expr(d.adbin,d.adrelid)IS NOT DISTINCT FROM NULL)THEN RAISE EXCEPTION 'business_destination_journal_column_changed';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='zoi.business_creative_requests'::regclass AND a.attname='payload' AND NOT a.attisdropped AND format_type(a.atttypid,a.atttypmod)='jsonb' AND a.attnotnull=false AND pg_get_expr(d.adbin,d.adrelid)IS NOT DISTINCT FROM NULL)THEN RAISE EXCEPTION 'business_destination_journal_column_changed';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='zoi.business_creative_requests'::regclass AND a.attname='post_id' AND NOT a.attisdropped AND format_type(a.atttypid,a.atttypmod)='uuid' AND a.attnotnull=false AND pg_get_expr(d.adbin,d.adrelid)IS NOT DISTINCT FROM NULL)THEN RAISE EXCEPTION 'business_destination_journal_column_changed';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='zoi.business_creative_requests'::regclass AND a.attname='post_snapshot' AND NOT a.attisdropped AND format_type(a.atttypid,a.atttypmod)='jsonb' AND a.attnotnull=false AND pg_get_expr(d.adbin,d.adrelid)IS NOT DISTINCT FROM NULL)THEN RAISE EXCEPTION 'business_destination_journal_column_changed';END IF;END $guard$;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='zoi.business_creative_requests'::regclass AND a.attname='created_at' AND NOT a.attisdropped AND format_type(a.atttypid,a.atttypmod)='timestamp with time zone' AND a.attnotnull=true AND pg_get_expr(d.adbin,d.adrelid)IS NOT DISTINCT FROM 'clock_timestamp()')THEN RAISE EXCEPTION 'business_destination_journal_column_changed';END IF;END $guard$;

-- Existing listing-first authority serializes source/owner changes before the
-- post lock. A preparation nonce uses the established journal lock namespace.
CREATE FUNCTION zoi.business_creative_destination_context(p_workspace uuid,p_post uuid,p_request uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE p zoi.social_posts;r zoi.business_creative_requests;review zoi.business_creative_requests;source jsonb;slug text;marker jsonb;
BEGIN
 PERFORM zoi.assert_workspace_write(p_workspace);
 SELECT r0.*INTO r FROM zoi.business_creative_requests r0 JOIN zoi.social_posts p0 ON p0.id=r0.post_id AND p0.workspace_id=r0.workspace_id
 WHERE p0.id=p_post AND p0.workspace_id=p_workspace AND r0.state='saved'AND r0.request_id::text=p0.meta->'business_creative'->>'request';
 IF r.request_id IS NULL THEN RAISE EXCEPTION 'business_destination_context_invalid';END IF;
 PERFORM zoi.home_content_authorize(p_workspace,r.listing_id);
 IF p_request IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('business-creative:'||p_request::text,0));END IF;
 SELECT *INTO p FROM zoi.social_posts WHERE id=p_post AND workspace_id=p_workspace FOR UPDATE;
 PERFORM zoi.assert_workspace_write(p_workspace);PERFORM zoi.home_content_authorize(p_workspace,r.listing_id);
 IF p.id IS NOT NULL AND octet_length(to_jsonb(p)::text)>300000 THEN RAISE EXCEPTION 'business_destination_invalid_payload';END IF;
 IF p.id IS NULL OR p.meta->>'client_listing_id'IS DISTINCT FROM r.listing_id::text OR p.meta->'business_creative'IS DISTINCT FROM r.post_snapshot->'meta'->'business_creative'
 OR p.meta->'business_creative'->>'source_hash'IS DISTINCT FROM encode(sha256(convert_to((r.payload->'source')::text,'UTF8')),'hex') THEN RAISE EXCEPTION 'business_destination_context_invalid';END IF;
 SELECT l.slug INTO slug FROM zoi.listings l WHERE l.id=r.listing_id AND l.owner_workspace_id=p_workspace;
 IF slug IS NULL THEN RAISE EXCEPTION 'business_destination_context_invalid';END IF;
 source:=zoi.business_creative_source(public.home_entity(slug));
 IF p.meta?'destination_review'THEN
  marker:=p.meta->'destination_review';
  SELECT *INTO review FROM zoi.business_creative_requests WHERE request_id::text=marker->>'request'AND workspace_id=p_workspace AND listing_id=r.listing_id AND post_id=p.id AND state='saved';
  IF review.request_id IS NULL OR review.payload->>'kind'IS DISTINCT FROM'community_destination_draft'OR review.payload->>'source_request'IS DISTINCT FROM r.request_id::text
  OR review.payload->'source'IS DISTINCT FROM r.payload->'source'OR marker IS DISTINCT FROM review.post_snapshot->'meta'->'destination_review'
  OR marker->>'kind'IS DISTINCT FROM'reviewed_community_draft'OR marker->>'source_request'IS DISTINCT FROM r.request_id::text OR marker->>'listing'IS DISTINCT FROM r.listing_id::text
  OR review.post_snapshot->>'id'IS DISTINCT FROM p.id::text OR review.post_snapshot->>'status'IS DISTINCT FROM'draft'OR review.post_snapshot->'channels'IS DISTINCT FROM'["zoi"]'::jsonb OR review.post_snapshot->'scheduled_at'IS DISTINCT FROM'null'::jsonb THEN RAISE EXCEPTION 'business_destination_context_invalid';END IF;
 ELSE
  IF p.status IS DISTINCT FROM'draft'OR p.scheduled_at IS NOT NULL OR p.channels IS DISTINCT FROM ARRAY[]::text[]THEN RAISE EXCEPTION 'business_destination_not_private';END IF;
 END IF;
 PERFORM zoi.suite_current_session();
 RETURN jsonb_build_object('ok',true,'workspace',p_workspace,'post_id',p.id,'listing',r.listing_id,'stage',CASE WHEN marker IS NULL THEN'private'ELSE'reviewed'END,'source',r.payload->'source','source_request',r.request_id,'source_current',source IS NOT DISTINCT FROM r.payload->'source','post',to_jsonb(p));
END$$;

CREATE FUNCTION public.business_creative_destinations_context(p_workspace uuid,p_post uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=''AS $$SELECT zoi.business_creative_destination_context(p_workspace,p_post,NULL)$$;

-- Recovery attests the immutable original preparation separately from the
-- current post; a later edit/removal never becomes an automatic replay.
CREATE FUNCTION public.business_creative_destinations_recover(p_workspace uuid,p_post uuid,p_request uuid,p_cancel_if_missing boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE r zoi.business_creative_requests;original zoi.business_creative_requests;p zoi.social_posts;source jsonb;slug text;
BEGIN
 PERFORM zoi.assert_workspace_write(p_workspace);
 IF p_request IS NULL OR p_post IS NULL THEN RAISE EXCEPTION 'business_destination_request_conflict';END IF;
 SELECT *INTO r FROM zoi.business_creative_requests WHERE request_id=p_request;
 IF r.request_id IS NULL AND p_cancel_if_missing THEN
  SELECT *INTO original FROM zoi.business_creative_requests WHERE post_id=p_post AND workspace_id=p_workspace AND state='saved'AND post_snapshot->'meta'->'business_creative'->>'request'=request_id::text ORDER BY created_at DESC,request_id LIMIT 1;
  IF original.request_id IS NULL THEN RAISE EXCEPTION 'business_destination_context_invalid';END IF;
  PERFORM zoi.home_content_authorize(p_workspace,original.listing_id);
  PERFORM pg_advisory_xact_lock(hashtextextended('business-creative:'||p_request::text,0));
  SELECT *INTO r FROM zoi.business_creative_requests WHERE request_id=p_request;
  IF r.request_id IS NULL THEN
   IF(SELECT count(*)FROM zoi.business_creative_requests WHERE actor_auth=auth.uid()AND created_at>clock_timestamp()-interval'24 hours')>=100 THEN RAISE EXCEPTION 'business_destination_request_limit';END IF;
   INSERT INTO zoi.business_creative_requests(request_id,actor_auth,workspace_id,listing_id,state)VALUES(p_request,auth.uid(),p_workspace,original.listing_id,'cancelled')RETURNING *INTO r;
  END IF;
 END IF;
 IF r.request_id IS NULL THEN RETURN jsonb_build_object('ok',true,'actor',auth.uid(),'workspace',p_workspace,'post_id',p_post,'request',p_request,'state','missing');END IF;
 IF r.state='cancelled'THEN
  IF r.actor_auth IS DISTINCT FROM auth.uid()OR r.workspace_id IS DISTINCT FROM p_workspace THEN RAISE EXCEPTION 'business_destination_request_conflict';END IF;
  PERFORM zoi.home_content_authorize(p_workspace,r.listing_id);PERFORM zoi.suite_current_session();
  RETURN jsonb_build_object('ok',true,'actor',auth.uid(),'workspace',p_workspace,'post_id',p_post,'request',p_request,'state','cancelled');
 END IF;
 IF r.actor_auth IS DISTINCT FROM auth.uid()OR r.workspace_id IS DISTINCT FROM p_workspace OR r.post_id IS DISTINCT FROM p_post OR coalesce(r.payload->>'kind','')NOT IN('community_destination_draft','reviewed_community_draft_edit')THEN RAISE EXCEPTION 'business_destination_request_conflict';END IF;
 PERFORM zoi.home_content_authorize(p_workspace,r.listing_id);
 SELECT *INTO p FROM zoi.social_posts WHERE id=p_post AND workspace_id=p_workspace FOR SHARE;
 SELECT l.slug INTO slug FROM zoi.listings l WHERE l.id=r.listing_id AND l.owner_workspace_id=p_workspace;
 IF slug IS NULL THEN RAISE EXCEPTION 'business_destination_context_invalid';END IF;
 source:=zoi.business_creative_source(public.home_entity(slug));
 PERFORM zoi.assert_workspace_write(p_workspace);PERFORM zoi.home_content_authorize(p_workspace,r.listing_id);PERFORM zoi.suite_current_session();
 RETURN jsonb_build_object('ok',true,'actor',auth.uid(),'workspace',p_workspace,'post_id',p_post,'request',p_request,'state',CASE WHEN p.id IS NULL THEN'removed'ELSE'saved'END,'operation_kind',r.payload->>'kind','snapshot',r.post_snapshot,'current_post',CASE WHEN p.id IS NULL THEN NULL ELSE to_jsonb(p)END,'current_matches_snapshot',p.id IS NOT NULL AND to_jsonb(p)=r.post_snapshot,'source_current',source IS NOT DISTINCT FROM r.payload->'source');
END$$;

CREATE FUNCTION zoi.business_creative_destination_media(p_workspace uuid,p zoi.social_posts,p_original uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE original zoi.business_creative_requests;proof zoi.studio_media_events;asset zoi.assets;listing uuid;part jsonb;name text;
BEGIN
 SELECT *INTO original FROM zoi.business_creative_requests WHERE request_id=p_original AND post_id=p.id AND workspace_id=p_workspace AND state='saved';
 IF original.request_id IS NULL THEN RAISE EXCEPTION 'business_destination_context_invalid';END IF;listing:=original.listing_id;
 IF p.media IS DISTINCT FROM original.post_snapshot->'media'OR jsonb_typeof(p.media)IS DISTINCT FROM'array'THEN RAISE EXCEPTION 'business_destination_media_review_required';END IF;
 IF jsonb_array_length(p.media)>0 THEN
  IF jsonb_array_length(p.media)<>1 OR jsonb_typeof(original.payload->'render')IS DISTINCT FROM'object'OR p.meta->'creative_composition'->>'schema'IS DISTINCT FROM'1'
  OR p.media->0->>'url'IS DISTINCT FROM p.meta->'creative_composition'->'output'->>'url' THEN RAISE EXCEPTION 'business_destination_media_review_required';END IF;
  FOREACH name IN ARRAY ARRAY['original','output']LOOP
   part:=p.meta->'creative_composition'->name;
   SELECT *INTO proof FROM zoi.studio_media_events WHERE grant_id::text=part->>'proof'AND phase='proof'AND request_id=original.request_id;
   SELECT *INTO asset FROM zoi.assets WHERE id::text=part->>'asset_id'AND workspace_id=p_workspace FOR SHARE;
   IF proof.id IS NULL OR asset.id IS NULL OR proof.actor_auth IS DISTINCT FROM original.actor_auth OR proof.workspace_id IS DISTINCT FROM p_workspace OR proof.listing_id IS DISTINCT FROM listing
   OR proof.context_hash IS DISTINCT FROM encode(sha256(convert_to(original.payload::text,'UTF8')),'hex')
   OR asset.url IS DISTINCT FROM part->>'url'OR zoi.studio_storage_path(asset.url)IS DISTINCT FROM proof.data->>'path'
   OR zoi.studio_object(proof.data->>'path',true)IS DISTINCT FROM proof.data->'object'
   OR part->>'sha256'IS DISTINCT FROM original.payload->'render'->name->>'sha256'
   OR part->>'size_bytes'IS DISTINCT FROM original.payload->'render'->name->>'size_bytes'
   OR part->>'width'IS DISTINCT FROM original.payload->'render'->name->>'width'OR part->>'height'IS DISTINCT FROM original.payload->'render'->name->>'height'
   THEN RAISE EXCEPTION 'business_destination_media_review_required';END IF;
  END LOOP;
 END IF;
END$$;

CREATE FUNCTION public.business_creative_destinations_prepare(p_workspace uuid,p_post uuid,p_request uuid,p_expected_updated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE ctx jsonb;prior zoi.business_creative_requests;original zoi.business_creative_requests;p zoi.social_posts;saved zoi.social_posts;proof zoi.studio_media_events;asset zoi.assets;part jsonb;name text;marker jsonb;payload jsonb;listing uuid;
BEGIN
 PERFORM zoi.assert_workspace_write(p_workspace);
 IF p_request IS NULL OR p_post IS NULL OR p_expected_updated_at IS NULL THEN RAISE EXCEPTION 'business_destination_request_conflict';END IF;
 SELECT *INTO prior FROM zoi.business_creative_requests WHERE request_id=p_request;
 IF prior.request_id IS NOT NULL THEN
  IF prior.state='cancelled'THEN RAISE EXCEPTION 'business_destination_request_cancelled';END IF;
  IF prior.payload->>'kind'IS DISTINCT FROM'community_destination_draft'OR (prior.payload->>'expected_updated_at')::timestamptz IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'business_destination_request_conflict';END IF;
  RETURN public.business_creative_destinations_recover(p_workspace,p_post,p_request);
 END IF;
 ctx:=zoi.business_creative_destination_context(p_workspace,p_post,p_request);listing:=(ctx->>'listing')::uuid;
 -- A waiting same-nonce request may have committed while authority locks waited.
 SELECT *INTO prior FROM zoi.business_creative_requests WHERE request_id=p_request;
 IF prior.request_id IS NOT NULL THEN
  IF prior.state='cancelled'THEN RAISE EXCEPTION 'business_destination_request_cancelled';END IF;
  IF prior.payload->>'kind'IS DISTINCT FROM'community_destination_draft'OR (prior.payload->>'expected_updated_at')::timestamptz IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'business_destination_request_conflict';END IF;
  RETURN public.business_creative_destinations_recover(p_workspace,p_post,p_request);
 END IF;
 IF ctx->>'stage'IS DISTINCT FROM'private'THEN RAISE EXCEPTION 'business_destination_not_private';END IF;
 IF ctx->'source_current'IS DISTINCT FROM'true'::jsonb THEN RAISE EXCEPTION 'business_destination_source_changed';END IF;
 SELECT *INTO p FROM zoi.social_posts WHERE id=p_post AND workspace_id=p_workspace FOR UPDATE;
 IF p.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'business_destination_version_conflict';END IF;
 IF(SELECT count(*)FROM zoi.business_creative_requests WHERE actor_auth=auth.uid()AND created_at>clock_timestamp()-interval'24 hours')>=100 THEN RAISE EXCEPTION 'business_destination_request_limit';END IF;
 SELECT *INTO original FROM zoi.business_creative_requests WHERE request_id=(ctx->>'source_request')::uuid;
 PERFORM zoi.business_creative_destination_media(p_workspace,p,original.request_id);
 marker:=jsonb_build_object('kind','reviewed_community_draft','request',p_request,'listing',listing,'source_request',original.request_id);
 payload:=jsonb_build_object('kind','community_destination_draft','source_request',original.request_id,'source',ctx->'source','expected_updated_at',p_expected_updated_at::text);
 SELECT *INTO saved FROM public.social_save_post(p_workspace,p.body,ARRAY['zoi']::text[],NULL,'draft',p.media,p.nameday_ref,p.meta||jsonb_build_object('destination_review',marker),p.id);
 IF(to_jsonb(saved)-ARRAY['channels','meta','updated_at']::text[])IS DISTINCT FROM(to_jsonb(p)-ARRAY['channels','meta','updated_at']::text[])OR saved.id IS DISTINCT FROM p.id OR saved.workspace_id IS DISTINCT FROM p.workspace_id OR saved.author_profile IS DISTINCT FROM p.author_profile OR saved.body IS DISTINCT FROM p.body OR saved.media IS DISTINCT FROM p.media OR saved.nameday_ref IS DISTINCT FROM p.nameday_ref
 OR saved.meta IS DISTINCT FROM p.meta||jsonb_build_object('destination_review',marker)OR saved.channels IS DISTINCT FROM ARRAY['zoi']::text[]OR saved.status IS DISTINCT FROM'draft'OR saved.scheduled_at IS NOT NULL THEN RAISE EXCEPTION 'business_destination_save_unconfirmed';END IF;
 PERFORM zoi.assert_workspace_write(p_workspace);PERFORM zoi.home_content_authorize(p_workspace,listing);PERFORM zoi.suite_current_session();
 INSERT INTO zoi.business_creative_requests(request_id,actor_auth,workspace_id,listing_id,state,payload,post_id,post_snapshot)VALUES(p_request,auth.uid(),p_workspace,listing,'saved',payload,saved.id,to_jsonb(saved));
 RETURN public.business_creative_destinations_recover(p_workspace,p_post,p_request);
END$$;

CREATE FUNCTION public.business_creative_destinations_save(p_workspace uuid,p_post uuid,p_request uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE prior zoi.business_creative_requests;ctx jsonb;p zoi.social_posts;saved zoi.social_posts;candidate zoi.social_posts;meta jsonb;payload jsonb;expected timestamptz;listing uuid;
BEGIN
 PERFORM zoi.assert_workspace_write(p_workspace);
 IF p_request IS NULL OR p_post IS NULL OR jsonb_typeof(p_payload)IS DISTINCT FROM'object'OR octet_length(p_payload::text)>150000
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload)k WHERE k NOT IN('body','media','meta','expected_updated_at'))
 OR jsonb_typeof(p_payload->'body')IS DISTINCT FROM'string'OR char_length(p_payload->>'body')>20000
 OR jsonb_typeof(p_payload->'media')IS DISTINCT FROM'array'OR jsonb_array_length(p_payload->'media')>1
 OR jsonb_typeof(p_payload->'meta')IS DISTINCT FROM'object'OR octet_length((p_payload->'meta')::text)>100000
 OR jsonb_typeof(p_payload->'expected_updated_at')IS DISTINCT FROM'string'THEN RAISE EXCEPTION 'business_destination_invalid_payload';END IF;
 expected:=(p_payload->>'expected_updated_at')::timestamptz;
 SELECT *INTO prior FROM zoi.business_creative_requests WHERE request_id=p_request;
 IF prior.request_id IS NOT NULL THEN
  IF prior.payload->>'kind'IS DISTINCT FROM'reviewed_community_draft_edit'OR prior.payload->'input'IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'business_destination_request_conflict';END IF;
  RETURN public.business_creative_destinations_recover(p_workspace,p_post,p_request);
 END IF;
 ctx:=zoi.business_creative_destination_context(p_workspace,p_post,p_request);listing:=(ctx->>'listing')::uuid;
 SELECT *INTO prior FROM zoi.business_creative_requests WHERE request_id=p_request;
 IF prior.request_id IS NOT NULL THEN
  IF prior.payload->>'kind'IS DISTINCT FROM'reviewed_community_draft_edit'OR prior.payload->'input'IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'business_destination_request_conflict';END IF;
  RETURN public.business_creative_destinations_recover(p_workspace,p_post,p_request);
 END IF;
 IF ctx->>'stage'IS DISTINCT FROM'reviewed'THEN RAISE EXCEPTION 'business_destination_context_invalid';END IF;
 IF ctx->'source_current'IS DISTINCT FROM'true'::jsonb THEN RAISE EXCEPTION 'business_destination_source_changed';END IF;
 SELECT *INTO p FROM zoi.social_posts WHERE id=p_post AND workspace_id=p_workspace FOR UPDATE;
 IF p.status IS DISTINCT FROM'draft'OR p.scheduled_at IS NOT NULL OR p.channels IS DISTINCT FROM ARRAY['zoi']::text[]THEN RAISE EXCEPTION 'business_destination_not_private';END IF;
 IF p.updated_at IS DISTINCT FROM expected THEN RAISE EXCEPTION 'business_destination_version_conflict';END IF;
 IF(SELECT count(*)FROM zoi.business_creative_requests WHERE actor_auth=auth.uid()AND created_at>clock_timestamp()-interval'24 hours')>=100 THEN RAISE EXCEPTION 'business_destination_request_limit';END IF;
 meta:=p_payload->'meta';
 IF meta->'business_creative'IS DISTINCT FROM p.meta->'business_creative'OR meta->'client_listing_id'IS DISTINCT FROM p.meta->'client_listing_id'OR meta->'destination_review'IS DISTINCT FROM p.meta->'destination_review'THEN RAISE EXCEPTION 'business_destination_context_invalid';END IF;
 candidate:=p;candidate.media:=p_payload->'media';
 IF jsonb_array_length(candidate.media)>0 THEN
  -- Owner can retain or restore the original proved composition, never replace
  -- it with an arbitrary URL/asset. Explicit removal remains supported.
  SELECT post_snapshot->'meta'->'creative_composition'INTO candidate.meta FROM zoi.business_creative_requests WHERE request_id=(ctx->>'source_request')::uuid;
  candidate.meta:=p.meta||jsonb_build_object('creative_composition',candidate.meta);
  PERFORM zoi.business_creative_destination_media(p_workspace,candidate,(ctx->>'source_request')::uuid);
  meta:=meta||jsonb_build_object('creative_composition',candidate.meta->'creative_composition');
 ELSE meta:=meta-'creative_composition';END IF;
 SELECT *INTO saved FROM public.social_save_post(p_workspace,p_payload->>'body',ARRAY['zoi']::text[],NULL,'draft',candidate.media,p.nameday_ref,meta,p.id);
 IF(to_jsonb(saved)-ARRAY['body','media','meta','updated_at']::text[])IS DISTINCT FROM(to_jsonb(p)-ARRAY['body','media','meta','updated_at']::text[])OR saved.id IS DISTINCT FROM p.id OR saved.workspace_id IS DISTINCT FROM p.workspace_id OR saved.author_profile IS DISTINCT FROM p.author_profile
 OR saved.body IS DISTINCT FROM p_payload->>'body'OR saved.media IS DISTINCT FROM candidate.media OR saved.meta IS DISTINCT FROM meta
 OR saved.channels IS DISTINCT FROM ARRAY['zoi']::text[]OR saved.scheduled_at IS NOT NULL OR saved.status IS DISTINCT FROM'draft'THEN RAISE EXCEPTION 'business_destination_save_unconfirmed';END IF;
 PERFORM zoi.assert_workspace_write(p_workspace);PERFORM zoi.home_content_authorize(p_workspace,listing);PERFORM zoi.suite_current_session();
 payload:=jsonb_build_object('kind','reviewed_community_draft_edit','source_request',ctx->>'source_request','source',ctx->'source','input',p_payload);
 INSERT INTO zoi.business_creative_requests(request_id,actor_auth,workspace_id,listing_id,state,payload,post_id,post_snapshot)VALUES(p_request,auth.uid(),p_workspace,listing,'saved',payload,saved.id,to_jsonb(saved));
 RETURN public.business_creative_destinations_recover(p_workspace,p_post,p_request);
END$$;

ALTER FUNCTION zoi.business_creative_destination_media(uuid,zoi.social_posts,uuid)OWNER TO postgres;
ALTER FUNCTION public.business_creative_destinations_save(uuid,uuid,uuid,jsonb)OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.business_creative_destination_media(uuid,zoi.social_posts,uuid)FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.business_creative_destinations_save(uuid,uuid,uuid,jsonb)FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.business_creative_destinations_save(uuid,uuid,uuid,jsonb)TO authenticated;

ALTER FUNCTION zoi.business_creative_destination_context(uuid,uuid,uuid)OWNER TO postgres;
ALTER FUNCTION public.business_creative_destinations_context(uuid,uuid)OWNER TO postgres;
ALTER FUNCTION public.business_creative_destinations_prepare(uuid,uuid,uuid,timestamptz)OWNER TO postgres;
ALTER FUNCTION public.business_creative_destinations_recover(uuid,uuid,uuid,boolean)OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.business_creative_destination_context(uuid,uuid,uuid)FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.business_creative_destinations_context(uuid,uuid),public.business_creative_destinations_prepare(uuid,uuid,uuid,timestamptz),public.business_creative_destinations_recover(uuid,uuid,uuid,boolean)FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.business_creative_destinations_context(uuid,uuid),public.business_creative_destinations_prepare(uuid,uuid,uuid,timestamptz),public.business_creative_destinations_recover(uuid,uuid,uuid,boolean)TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

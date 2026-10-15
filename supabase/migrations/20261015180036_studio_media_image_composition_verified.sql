BEGIN;
SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='30s';
-- Current actual asset contracts plus the independently accepted first Studio prerequisite.
DO $guard$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.asset_delete(uuid,uuid)')AND md5(pg_get_functiondef(oid))='6b97dbab0f8faad5364fc6bd7f7b73d3'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=zoi, public']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'studio_media_dependency_changed: public.asset_delete(uuid,uuid)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.asset_list(uuid)')AND md5(pg_get_functiondef(oid))='a6cb1e6f97286993f9f542a418d82a19'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=zoi, public']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'studio_media_dependency_changed: public.asset_list(uuid)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.asset_save(uuid,text,text,text,integer,integer,integer)')AND md5(pg_get_functiondef(oid))='b94771236d87bb2fabde45aa5ba5dd6d'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=zoi, public']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'studio_media_dependency_changed: public.asset_save(uuid,text,text,text,integer,integer,integer)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.assert_audience_asset_write(uuid)')AND md5(pg_get_functiondef(oid))='a63444caac55e6dddae7de70ae756af5'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'studio_media_dependency_changed: zoi.assert_audience_asset_write(uuid)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.assert_ws(uuid)')AND md5(pg_get_functiondef(oid))='7813c61a30a77c170c624bc3bcf983da'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM NULL AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'studio_media_dependency_changed: zoi.assert_ws(uuid)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.audience_asset_role(uuid,boolean)')AND md5(pg_get_functiondef(oid))='494b025d262568e0c8ec679c4d48e4a0'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'studio_media_dependency_changed: zoi.audience_asset_role(uuid,boolean)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.current_profile()')AND md5(pg_get_functiondef(oid))='fe40400e9935270cfef46a9f81478eef'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM NULL AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=zoi, public']::text[] AND prosecdef=true AND provolatile='s')THEN RAISE EXCEPTION 'studio_media_dependency_changed: zoi.current_profile()';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.business_creative_draft_get(uuid,uuid)')AND md5(prosrc)='cbf00cb8b9000e19bcde4383eea8d023'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'studio_media_prerequisite_changed: business_creative_draft_get(uuid,uuid)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.business_creative_draft_recover(uuid,uuid,uuid,boolean)')AND md5(prosrc)='7f7ff39cf9bda34c23104ae31da9d6d8'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'studio_media_prerequisite_changed: business_creative_draft_recover(uuid,uuid,uuid,boolean)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.business_creative_draft_save(uuid,uuid,uuid,jsonb)')AND md5(prosrc)='a5f3876eab8bef31c7e6b13fad9d2549'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'studio_media_prerequisite_changed: business_creative_draft_save(uuid,uuid,uuid,jsonb)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.business_creative_project_layer(jsonb,text)')AND md5(prosrc)='c438476d91320c02a2fc32e0f4dbedc1'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=false AND provolatile='i')THEN RAISE EXCEPTION 'studio_media_prerequisite_changed: zoi.business_creative_project_layer(jsonb,text)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.business_creative_receipt_immutable()')AND md5(prosrc)='dcf7fdfa14eb4b258697d9e852a442c8'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=false AND provolatile='v')THEN RAISE EXCEPTION 'studio_media_prerequisite_changed: zoi.business_creative_receipt_immutable()';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.business_creative_receipt(uuid,uuid,uuid)')AND md5(prosrc)='80e289240781b9512829cfac8d1ac85f'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'studio_media_prerequisite_changed: zoi.business_creative_receipt(uuid,uuid,uuid)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.business_creative_source(jsonb)')AND md5(prosrc)='555c138eb4f29e2ee0a533ba5e573004'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=false AND provolatile='i')THEN RAISE EXCEPTION 'studio_media_prerequisite_changed: zoi.business_creative_source(jsonb)';END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='media'AND public AND file_size_limit=5242880 AND allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','image/gif']::text[])THEN RAISE EXCEPTION 'studio_media_bucket_changed';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage'AND tablename='objects'AND policyname='media_auth_upload_own'AND permissive='PERMISSIVE'AND roles=ARRAY['authenticated']::name[] AND cmd='INSERT'AND qual IS NULL AND with_check=$expr$((bucket_id = 'media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))$expr$)OR NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage'AND tablename='objects'AND policyname='media_owner_delete'AND permissive='PERMISSIVE'AND roles=ARRAY['authenticated']::name[]AND cmd='DELETE'AND qual=$expr$((bucket_id = 'media'::text) AND (owner = auth.uid()))$expr$)OR NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage'AND tablename='objects'AND policyname='media_public_read'AND permissive='PERMISSIVE'AND roles=ARRAY['public']::name[]AND cmd='SELECT'AND qual=$expr$(bucket_id = 'media'::text)$expr$)THEN RAISE EXCEPTION 'studio_media_storage_policy_changed';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.workspace_current_role(uuid)')AND md5(prosrc)='679f6c2a69d0c084ea6b71b7efaf6dfc'AND proowner='postgres'::regrole AND proacl::text='{postgres=X/postgres}'AND proconfig=ARRAY['search_path=""']::text[]AND prosecdef AND provolatile='s')THEN RAISE EXCEPTION 'studio_media_dependency_changed: zoi.workspace_current_role(uuid)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.home_entity(text)') AND md5(prosrc)='663211d51b2cf63c8c457e2a52e48781' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres,anon=X/postgres,authenticated=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=true AND provolatile='s')THEN RAISE EXCEPTION 'studio_media_dependency_changed: public.home_entity(text)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.social_save_post(uuid,text,text[],timestamp with time zone,text,jsonb,text,jsonb,uuid)') AND md5(prosrc)='62569b74f0831a60bf2d2688f0e48ac5' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=zoi, public']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'studio_media_dependency_changed: public.social_save_post(uuid,text,text[],timestamp with time zone,text,jsonb,text,jsonb,uuid)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.assert_workspace_write(uuid,text[])') AND md5(prosrc)='0a1b64d6adee0e63726bab3c08b0be53' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'studio_media_dependency_changed: zoi.assert_workspace_write(uuid,text[])';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.home_content_authorize(uuid,uuid)') AND md5(prosrc)='d5e39d01982e0a8103e71d2e296d28cd' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'studio_media_dependency_changed: zoi.home_content_authorize(uuid,uuid)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.suite_current_session()') AND md5(prosrc)='70cb927f126f251f229c450bf9f792e8' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=true AND provolatile='s')THEN RAISE EXCEPTION 'studio_media_dependency_changed: zoi.suite_current_session()';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='zoi.social_posts'::regclass AND a.attname='updated_at'AND NOT a.attisdropped AND a.atttypid='timestamptz'::regtype AND NOT a.attnotnull AND pg_get_expr(d.adbin,d.adrelid)='now()')THEN RAISE EXCEPTION 'studio_media_dependency_changed: social_posts.updated_at';END IF;
 IF EXISTS(SELECT 1 FROM(VALUES
  ('zoi.assets','id','uuid',true,'gen_random_uuid()'),
  ('zoi.assets','workspace_id','uuid',true,NULL),
  ('zoi.assets','profile_id','uuid',false,NULL),
  ('zoi.assets','url','text',true,NULL),
  ('zoi.assets','kind','text',false,'''image''::text'),
  ('zoi.assets','alt','text',false,NULL),
  ('zoi.assets','bytes','integer',false,NULL),
  ('zoi.assets','width','integer',false,NULL),
  ('zoi.assets','height','integer',false,NULL),
  ('zoi.assets','created_at','timestamp with time zone',true,'now()'),
  ('storage.objects','id','uuid',true,'gen_random_uuid()'),
  ('storage.objects','bucket_id','text',false,NULL),
  ('storage.objects','name','text',false,NULL),
  ('storage.objects','owner','uuid',false,NULL),
  ('storage.objects','created_at','timestamp with time zone',false,'now()'),
  ('storage.objects','updated_at','timestamp with time zone',false,'now()'),
  ('storage.objects','metadata','jsonb',false,NULL),
  ('storage.objects','version','text',false,NULL),
  ('storage.objects','owner_id','text',false,NULL),
  ('storage.objects','archived_at','timestamp with time zone',false,NULL),
  ('storage.objects','is_delete_marker','boolean',true,'false'))expected(relation,name,type,required,default_expression)LEFT JOIN pg_attribute a ON a.attrelid=to_regclass(expected.relation)AND a.attname=expected.name AND NOT a.attisdropped LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attnum IS NULL OR format_type(a.atttypid,a.atttypmod)IS DISTINCT FROM expected.type OR a.attnotnull IS DISTINCT FROM expected.required OR pg_get_expr(d.adbin,d.adrelid)IS DISTINCT FROM expected.default_expression)THEN RAISE EXCEPTION 'studio_media_storage_asset_columns_changed';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity)THEN RAISE EXCEPTION 'studio_media_storage_rls_changed';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='zoi.business_creative_requests'::regclass AND relrowsecurity AND relowner='postgres'::regrole)OR EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role'])role WHERE has_table_privilege(role,'zoi.business_creative_requests','SELECT,INSERT,UPDATE,DELETE'))OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='zoi.business_creative_requests'::regclass AND tgname='business_creative_receipt_immutable'AND NOT tgisinternal AND tgfoid='zoi.business_creative_receipt_immutable()'::regprocedure AND tgtype=27 AND tgenabled='O')THEN RAISE EXCEPTION 'studio_media_receipt_table_contract_changed';END IF;
END$guard$;
-- Security evidence only. No editable composition, asset or campaign store.
CREATE TABLE zoi.studio_media_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),grant_id uuid NOT NULL,
 phase text NOT NULL CHECK(phase IN('grant','proof','deleted')),
 request_id uuid NOT NULL,workspace_id uuid NOT NULL,listing_id uuid NOT NULL,
 actor_auth uuid NOT NULL,session_id uuid NOT NULL,purpose text NOT NULL CHECK(purpose IN('original','output')),
 context_hash text NOT NULL CHECK(context_hash~'^[a-f0-9]{64}$'),data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'AND octet_length(data::text)<=16000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL,
 UNIQUE(grant_id,phase)
);
CREATE UNIQUE INDEX studio_media_grant_once ON zoi.studio_media_events(request_id,purpose)WHERE phase='grant';
CREATE INDEX studio_media_request ON zoi.studio_media_events(request_id,phase);
CREATE INDEX studio_media_expired ON zoi.studio_media_events(expires_at,request_id)WHERE phase='grant'AND data->>'asset_id'IS NULL;
ALTER TABLE zoi.studio_media_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.studio_media_events FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER studio_media_immutable BEFORE UPDATE OR DELETE ON zoi.studio_media_events FOR EACH ROW EXECUTE FUNCTION zoi.business_creative_receipt_immutable();

-- All existing canonical save/recover callers and new grant/cleanup paths take
-- this same nonce lock. The trigger only reads immutable grants; it never waits
-- on workspace/listing/Storage locks or rewrites the established writers.
CREATE FUNCTION zoi.studio_media_receipt_guard()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE g zoi.studio_media_events;
BEGIN
 IF NOT pg_try_advisory_xact_lock(hashtextextended('business-creative:'||NEW.request_id::text,0))THEN RAISE EXCEPTION 'studio_media_request_busy';END IF;
 FOR g IN SELECT *FROM zoi.studio_media_events WHERE request_id=NEW.request_id AND phase='grant'LOOP
  IF NEW.actor_auth IS DISTINCT FROM g.actor_auth OR NEW.workspace_id IS DISTINCT FROM g.workspace_id OR NEW.listing_id IS DISTINCT FROM g.listing_id THEN RAISE EXCEPTION 'studio_media_receipt_scope_conflict';END IF;
  IF NEW.state='saved'AND encode(sha256(convert_to(NEW.payload::text,'UTF8')),'hex')IS DISTINCT FROM g.context_hash THEN RAISE EXCEPTION 'studio_media_receipt_payload_conflict';END IF;
 END LOOP;
 RETURN NEW;
END$$;
REVOKE ALL ON FUNCTION zoi.studio_media_receipt_guard()FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER studio_media_receipt_context BEFORE INSERT ON zoi.business_creative_requests FOR EACH ROW EXECUTE FUNCTION zoi.studio_media_receipt_guard();

CREATE FUNCTION zoi.studio_exact_keys(value jsonb,keys text[])RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=''AS $$
 SELECT jsonb_typeof(value)='object'AND value?&keys AND NOT EXISTS(SELECT 1 FROM jsonb_object_keys(value)k WHERE NOT k=ANY(keys))
$$;
REVOKE ALL ON FUNCTION zoi.studio_exact_keys(jsonb,text[])FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION zoi.studio_storage_path(value text)RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=''AS $$
DECLARE prefix constant text:='https://csebihpaychdkanjjsmz.supabase.co/storage/v1/object/public/media/';raw text;bytes bytea:=''::bytea;i integer:=1;c text;path text;
BEGIN
 IF value IS NULL OR left(value,length(prefix))<>prefix THEN RAISE EXCEPTION 'studio_media_invalid_source_path';END IF;
 raw:=substr(value,length(prefix)+1);
 IF length(raw)>6000 OR raw~'[?#]'THEN RAISE EXCEPTION 'studio_media_invalid_source_path';END IF;
 WHILE i<=length(raw)LOOP c:=substr(raw,i,1);IF c='%'THEN IF substr(raw,i+1,2)!~'^[a-fA-F0-9]{2}$'THEN RAISE EXCEPTION 'studio_media_invalid_source_path';END IF;bytes:=bytes||decode(substr(raw,i+1,2),'hex');i:=i+3;ELSE bytes:=bytes||convert_to(c,'UTF8');i:=i+1;END IF;END LOOP;
 path:=convert_from(bytes,'UTF8');
 IF length(path)NOT BETWEEN 1 AND 1800 OR path~'(^/|/$|//|(^|/)\.\.?(/|$)|[[:cntrl:]\\])'THEN RAISE EXCEPTION 'studio_media_invalid_source_path';END IF;
 RETURN path;
END$$;
REVOKE ALL ON FUNCTION zoi.studio_storage_path(text)FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION zoi.studio_object(path text,locked boolean DEFAULT false)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE r record;result jsonb;count integer:=0;
BEGIN
 IF locked THEN
  FOR r IN SELECT *FROM storage.objects WHERE bucket_id='media'AND name=path AND archived_at IS NULL AND NOT is_delete_marker FOR SHARE LOOP
   count:=count+1;result:=jsonb_build_object('id',r.id,'version',r.version,'updated_at',r.updated_at,'created_at',r.created_at,'metadata',r.metadata,'owner',r.owner,'owner_id',r.owner_id);
  END LOOP;
 ELSE
  FOR r IN SELECT *FROM storage.objects WHERE bucket_id='media'AND name=path AND archived_at IS NULL AND NOT is_delete_marker LOOP
   count:=count+1;result:=jsonb_build_object('id',r.id,'version',r.version,'updated_at',r.updated_at,'created_at',r.created_at,'metadata',r.metadata,'owner',r.owner,'owner_id',r.owner_id);
  END LOOP;
 END IF;
 IF count>1 THEN RAISE EXCEPTION 'studio_media_ambiguous_object';END IF;RETURN result;
END$$;
REVOKE ALL ON FUNCTION zoi.studio_object(text,boolean)FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION zoi.studio_render_context(ws uuid,listing uuid,request uuid,payload jsonb)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE prior zoi.business_creative_requests;render jsonb;recipe jsonb;part jsonb;name text;k text;source jsonb;slug text;target uuid;expected_at timestamptz;
BEGIN
 PERFORM zoi.assert_workspace_write(ws);PERFORM zoi.home_content_authorize(ws,listing);
 IF request IS NULL THEN RAISE EXCEPTION 'studio_media_request_required';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('business-creative:'||request::text,0));
 PERFORM zoi.assert_workspace_write(ws);PERFORM zoi.home_content_authorize(ws,listing);
 SELECT *INTO prior FROM zoi.business_creative_requests WHERE request_id=request;
 IF FOUND THEN
  IF prior.actor_auth IS DISTINCT FROM auth.uid()OR prior.workspace_id IS DISTINCT FROM ws OR prior.listing_id IS DISTINCT FROM listing THEN RAISE EXCEPTION 'business_creative_request_scope_conflict';END IF;
  IF prior.state='saved'AND prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'business_creative_request_payload_conflict';END IF;
  RETURN jsonb_build_object('receipt',zoi.business_creative_receipt(ws,listing,request));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM zoi.studio_media_events WHERE request_id=request AND phase='grant')AND(SELECT count(DISTINCT request_id)FROM(SELECT request_id FROM zoi.studio_media_events WHERE actor_auth=auth.uid()AND phase='grant'AND created_at>clock_timestamp()-interval'24hours'UNION SELECT request_id FROM zoi.business_creative_requests WHERE actor_auth=auth.uid()AND created_at>clock_timestamp()-interval'24hours')s)>=100 THEN RAISE EXCEPTION 'business_creative_request_limit';END IF;
 IF NOT zoi.studio_exact_keys(payload,ARRAY['source','body','meta','rights_confirmed','id','expected_updated_at','render'])OR octet_length(payload::text)>100000 OR payload->'rights_confirmed'IS DISTINCT FROM'true'::jsonb OR jsonb_typeof(payload->'body')IS DISTINCT FROM'string'OR length(payload->>'body')>20000 OR jsonb_typeof(payload->'meta')IS DISTINCT FROM'object'OR octet_length((payload->'meta')::text)>32000 OR(payload->'meta')?|ARRAY['ai_generation_id','editorial','business_creative','client_listing_id','creative_composition']THEN RAISE EXCEPTION 'studio_media_invalid_payload';END IF;
 IF jsonb_typeof(payload->'meta'->'campaign')IS DISTINCT FROM'string'OR length(btrim(payload->'meta'->>'campaign'))NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'business_creative_campaign_required';END IF;
 IF jsonb_typeof(payload->'id')NOT IN('null','string')OR jsonb_typeof(payload->'expected_updated_at')NOT IN('null','string')THEN RAISE EXCEPTION 'studio_media_invalid_payload';END IF;
 BEGIN target:=(payload->>'id')::uuid;expected_at:=(payload->>'expected_updated_at')::timestamptz;EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'studio_media_invalid_payload';END;
 IF(target IS NULL)IS DISTINCT FROM(expected_at IS NULL)THEN RAISE EXCEPTION 'business_creative_revision_required';END IF;
 render:=payload->'render';recipe:=render->'recipe';
 IF NOT zoi.studio_exact_keys(render,ARRAY['schema','recipe','original','output','alt'])OR render->'schema'IS DISTINCT FROM'1'::jsonb OR jsonb_typeof(render->'alt')IS DISTINCT FROM'string'OR length(btrim(render->>'alt'))NOT BETWEEN 1 AND 1000 OR NOT zoi.studio_exact_keys(recipe,ARRAY['schema','width','height','layout','fit','crop','brand','title','body','background','foreground','accent','textScale'])OR recipe->'schema'IS DISTINCT FROM'1'::jsonb OR jsonb_typeof(recipe->'layout')IS DISTINCT FROM'string'OR jsonb_typeof(recipe->'fit')IS DISTINCT FROM'string'OR recipe->>'layout'NOT IN('split','overlay')OR recipe->>'fit'NOT IN('cover','contain')OR NOT zoi.studio_exact_keys(recipe->'crop',ARRAY['x','y','zoom'])THEN RAISE EXCEPTION 'studio_media_invalid_recipe';END IF;
 FOR k IN SELECT unnest(ARRAY['width','height'])LOOP IF jsonb_typeof(recipe->k)IS DISTINCT FROM'number'OR(recipe->>k)::numeric<>trunc((recipe->>k)::numeric)OR(recipe->>k)::numeric NOT BETWEEN 320 AND 2048 THEN RAISE EXCEPTION 'studio_media_invalid_recipe';END IF;END LOOP;
 FOR k IN SELECT unnest(ARRAY['x','y','zoom'])LOOP IF jsonb_typeof(recipe->'crop'->k)IS DISTINCT FROM'number'OR(recipe->'crop'->>k)::numeric NOT BETWEEN (CASE WHEN k='zoom'THEN 1 ELSE 0 END) AND (CASE WHEN k='zoom'THEN 4 ELSE 1 END) THEN RAISE EXCEPTION 'studio_media_invalid_recipe';END IF;END LOOP;
 IF jsonb_typeof(recipe->'textScale')IS DISTINCT FROM'number'OR(recipe->>'textScale')::numeric NOT BETWEEN .7 AND 1.5 THEN RAISE EXCEPTION 'studio_media_invalid_recipe';END IF;
 FOREACH k IN ARRAY ARRAY['brand','title','body']LOOP IF jsonb_typeof(recipe->k)IS DISTINCT FROM'string'OR length(recipe->>k)>(CASE k WHEN'brand'THEN 120 WHEN'title'THEN 180 ELSE 600 END) THEN RAISE EXCEPTION 'studio_media_invalid_recipe';END IF;END LOOP;
 FOREACH k IN ARRAY ARRAY['background','foreground','accent']LOOP IF jsonb_typeof(recipe->k)IS DISTINCT FROM'string'OR(recipe->>k)!~'^#[a-fA-F0-9]{6}$'THEN RAISE EXCEPTION 'studio_media_invalid_recipe';END IF;END LOOP;
 FOREACH name IN ARRAY ARRAY['original','output']LOOP part:=render->name;
  IF NOT zoi.studio_exact_keys(part,ARRAY['asset_id','mime_type','sha256','size_bytes','width','height'])OR jsonb_typeof(part->'asset_id')NOT IN('null','string')OR jsonb_typeof(part->'sha256')IS DISTINCT FROM'string'OR(part->>'sha256')!~'^[a-f0-9]{64}$'OR jsonb_typeof(part->'mime_type')IS DISTINCT FROM'string'OR part->>'mime_type'NOT IN('image/png','image/jpeg','image/webp')OR(name='output'AND part->>'mime_type'<>'image/png')THEN RAISE EXCEPTION 'studio_media_invalid_image';END IF;
  FOREACH k IN ARRAY ARRAY['size_bytes','width','height']LOOP IF jsonb_typeof(part->k)IS DISTINCT FROM'number'OR(part->>k)::numeric<>trunc((part->>k)::numeric)OR(part->>k)::numeric NOT BETWEEN (CASE WHEN k='size_bytes'THEN 16 ELSE 1 END) AND (CASE WHEN k='size_bytes'THEN 5242880 ELSE 8192 END) THEN RAISE EXCEPTION 'studio_media_invalid_image';END IF;END LOOP;
  IF(part->>'width')::bigint*(part->>'height')::bigint>40000000 THEN RAISE EXCEPTION 'studio_media_invalid_image';END IF;
  IF part->>'asset_id'IS NOT NULL THEN BEGIN PERFORM(part->>'asset_id')::uuid;EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'studio_media_invalid_image';END;END IF;
 END LOOP;
 IF render->'output'->'width'IS DISTINCT FROM recipe->'width'OR render->'output'->'height'IS DISTINCT FROM recipe->'height'THEN RAISE EXCEPTION 'studio_media_invalid_image';END IF;
 IF render->'output'->>'asset_id'IS NOT NULL AND target IS NULL THEN RAISE EXCEPTION 'studio_media_new_export_required';END IF;
 SELECT l.slug INTO slug FROM zoi.listings l WHERE id=listing AND owner_workspace_id=ws;
 IF slug IS NULL THEN RAISE EXCEPTION 'business_creative_listing_unavailable';END IF;
 source:=zoi.business_creative_source(public.home_entity(slug));
 IF source IS NULL OR source->>'id'IS DISTINCT FROM listing::text OR source IS DISTINCT FROM payload->'source'OR octet_length(source::text)>64000 THEN RAISE EXCEPTION 'business_creative_source_changed';END IF;
 RETURN jsonb_build_object('actor',auth.uid(),'session',(auth.jwt()->>'session_id')::uuid,'hash',encode(sha256(convert_to(payload::text,'UTF8')),'hex'),'source_hash',encode(sha256(convert_to(source::text,'UTF8')),'hex'));
END$$;
REVOKE ALL ON FUNCTION zoi.studio_render_context(uuid,uuid,uuid,jsonb)FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.studio_media_prepare(p_workspace uuid,p_listing uuid,p_request uuid,p_payload jsonb,p_purpose text)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE context jsonb;part jsonb;g zoi.studio_media_events;asset zoi.assets;post zoi.social_posts;path text;data jsonb;object jsonb;extension text;
BEGIN
 context:=zoi.studio_render_context(p_workspace,p_listing,p_request,p_payload);
 IF context?'receipt'THEN RETURN jsonb_build_object('ok',true,'receipt',context->'receipt');END IF;
 IF p_purpose NOT IN('original','output')OR p_purpose IS NULL THEN RAISE EXCEPTION 'studio_media_invalid_purpose';END IF;
 part:=p_payload->'render'->p_purpose;
 IF p_payload->>'id'IS NOT NULL THEN
  SELECT *INTO post FROM zoi.social_posts WHERE id=(p_payload->>'id')::uuid AND workspace_id=p_workspace FOR SHARE;
  PERFORM zoi.assert_workspace_write(p_workspace);PERFORM zoi.home_content_authorize(p_workspace,p_listing);
  IF post.id IS NULL THEN RAISE EXCEPTION 'business_creative_post_removed';END IF;
  IF post.status IS DISTINCT FROM'draft'OR post.channels IS DISTINCT FROM ARRAY[]::text[]OR post.scheduled_at IS NOT NULL THEN RAISE EXCEPTION 'business_creative_post_not_private_draft';END IF;
 END IF;
 IF part->>'asset_id'IS NOT NULL THEN
  IF p_purpose='output'AND(post.meta->'creative_composition'->'recipe'IS DISTINCT FROM p_payload->'render'->'recipe'OR post.meta->'creative_composition'->'output'->>'asset_id'IS DISTINCT FROM part->>'asset_id'OR post.meta->'creative_composition'->'original'->>'asset_id'IS DISTINCT FROM p_payload->'render'->'original'->>'asset_id')THEN RAISE EXCEPTION 'studio_media_new_export_required';END IF;
  SELECT *INTO asset FROM zoi.assets WHERE id=(part->>'asset_id')::uuid AND workspace_id=p_workspace FOR SHARE;
  IF asset.id IS NULL OR asset.kind IS DISTINCT FROM'image'THEN RAISE EXCEPTION 'studio_media_source_asset_unavailable';END IF;
  path:=zoi.studio_storage_path(asset.url);
 ELSE
  extension:=CASE part->>'mime_type'WHEN'image/png'THEN'png'WHEN'image/jpeg'THEN'jpg'ELSE'webp'END;
  path:=auth.uid()::text||'/studio-v1/'||p_request::text||'/'||p_purpose||'-'||(part->>'sha256')||'.'||extension;
 END IF;
 data:=(part-'asset_id')||jsonb_build_object('asset_id',asset.id,'path',path,'source_hash',context->>'source_hash');
 SELECT *INTO g FROM zoi.studio_media_events WHERE request_id=p_request AND purpose=p_purpose AND phase='grant';
 IF g.id IS NOT NULL THEN
  IF g.actor_auth IS DISTINCT FROM auth.uid()OR g.session_id::text IS DISTINCT FROM context->>'session'OR g.workspace_id IS DISTINCT FROM p_workspace OR g.listing_id IS DISTINCT FROM p_listing OR g.context_hash IS DISTINCT FROM context->>'hash'OR g.data IS DISTINCT FROM data THEN RAISE EXCEPTION 'business_creative_request_payload_conflict';END IF;
  IF g.expires_at<=clock_timestamp()THEN RAISE EXCEPTION 'studio_media_grant_expired';END IF;
 ELSE
  IF asset.id IS NULL AND zoi.studio_object(path)IS NOT NULL THEN RAISE EXCEPTION 'studio_media_path_collision';END IF;
  INSERT INTO zoi.studio_media_events(grant_id,phase,request_id,workspace_id,listing_id,actor_auth,session_id,purpose,context_hash,data,expires_at)
  VALUES(gen_random_uuid(),'grant',p_request,p_workspace,p_listing,auth.uid(),(context->>'session')::uuid,p_purpose,context->>'hash',data,clock_timestamp()+interval'30minutes')RETURNING *INTO g;
 END IF;
 object:=zoi.studio_object(path);
 PERFORM zoi.suite_current_session();
 RETURN jsonb_build_object('ok',true,'grant',g.grant_id,'request',p_request,'purpose',p_purpose,'path',path,'expected',g.data,'object',object,'existing_asset',asset.id,'expires_at',g.expires_at);
END$$;
REVOKE ALL ON FUNCTION public.studio_media_prepare(uuid,uuid,uuid,jsonb,text)FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.studio_media_prepare(uuid,uuid,uuid,jsonb,text)TO authenticated;

-- Recovery exposes only this actor's grant identifiers after the unchanged
-- current workspace/listing/session checks. It never returns another actor's
-- pending upload, and a newer session may cancel but cannot consume old grants.
CREATE FUNCTION public.studio_media_request(p_workspace uuid,p_listing uuid,p_request uuid,p_cancel_if_missing boolean DEFAULT false)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE receipt jsonb;g zoi.studio_media_events;grants jsonb:='[]';
BEGIN
 receipt:=public.business_creative_draft_recover(p_workspace,p_listing,p_request,p_cancel_if_missing);
 FOR g IN SELECT *FROM zoi.studio_media_events WHERE request_id=p_request AND phase='grant'ORDER BY purpose LOOP
  IF g.actor_auth IS DISTINCT FROM auth.uid()OR g.workspace_id IS DISTINCT FROM p_workspace OR g.listing_id IS DISTINCT FROM p_listing THEN RAISE EXCEPTION 'studio_media_receipt_scope_conflict';END IF;
  grants:=grants||jsonb_build_array(g.grant_id);
 END LOOP;
 PERFORM zoi.suite_current_session();
 RETURN jsonb_build_object('ok',true,'receipt',receipt,'grants',grants);
END$$;
REVOKE ALL ON FUNCTION public.studio_media_request(uuid,uuid,uuid,boolean)FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.studio_media_request(uuid,uuid,uuid,boolean)TO authenticated;

-- RLS executes inside a Storage statement. It never waits for workspace or nonce
-- locks while Storage may hold an object row. A busy nonce fails closed/retry.
CREATE FUNCTION zoi.studio_media_insert_allowed(bucket text,path text)RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE g zoi.studio_media_events;slug text;source jsonb;
BEGIN
 IF bucket IS DISTINCT FROM'media'OR split_part(path,'/',2)IS DISTINCT FROM'studio-v1'THEN RETURN true;END IF;
 IF path!~'^[a-f0-9-]{36}/studio-v1/[a-f0-9-]{36}/(original|output)-[a-f0-9]{64}\.(png|jpg|webp)$'THEN RETURN false;END IF;
 PERFORM zoi.suite_current_session();
 SELECT *INTO g FROM zoi.studio_media_events WHERE phase='grant'AND data->>'path'=path AND actor_auth=auth.uid()AND session_id=(auth.jwt()->>'session_id')::uuid AND request_id=split_part(path,'/',3)::uuid AND data->>'asset_id'IS NULL;
 IF g.id IS NULL OR g.expires_at<=clock_timestamp()OR split_part(path,'/',1)IS DISTINCT FROM auth.uid()::text THEN RETURN false;END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended('business-creative:'||g.request_id::text,0))THEN RETURN false;END IF;
 IF EXISTS(SELECT 1 FROM zoi.business_creative_requests WHERE request_id=g.request_id)OR EXISTS(SELECT 1 FROM zoi.studio_media_events WHERE grant_id=g.grant_id AND phase IN('proof','deleted'))THEN RETURN false;END IF;
 IF zoi.workspace_current_role(g.workspace_id)NOT IN('owner','admin','editor')THEN RETURN false;END IF;
 SELECT l.slug INTO slug FROM zoi.listings l WHERE id=g.listing_id AND owner_workspace_id=g.workspace_id;
 IF slug IS NULL THEN RETURN false;END IF;
 source:=zoi.business_creative_source(public.home_entity(slug));
 RETURN encode(sha256(convert_to(source::text,'UTF8')),'hex')IS NOT DISTINCT FROM g.data->>'source_hash';
EXCEPTION WHEN OTHERS THEN RETURN false;
END$$;
REVOKE ALL ON FUNCTION zoi.studio_media_insert_allowed(text,text)FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION zoi.studio_media_insert_allowed(text,text)TO authenticated;
CREATE FUNCTION zoi.studio_media_delete_allowed(bucket text,path text)RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE g zoi.studio_media_events;
BEGIN
 IF bucket IS DISTINCT FROM'media'OR path!~'^[a-f0-9-]{36}/studio-v1/[a-f0-9-]{36}/(original|output)-[a-f0-9]{64}\.(png|jpg|webp)$'THEN RETURN true;END IF;
 FOR g IN SELECT *FROM zoi.studio_media_events WHERE phase='grant'AND request_id=split_part(path,'/',3)::uuid AND data->>'path'=path AND data->>'asset_id'IS NULL LOOP
  IF NOT pg_try_advisory_xact_lock(hashtextextended('business-creative:'||g.request_id::text,0))THEN RETURN false;END IF;
  IF NOT EXISTS(SELECT 1 FROM zoi.business_creative_requests WHERE request_id=g.request_id AND state='saved')AND NOT EXISTS(SELECT 1 FROM zoi.studio_media_events WHERE grant_id=g.grant_id AND phase='deleted')THEN RETURN false;END IF;
 END LOOP;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END$$;
REVOKE ALL ON FUNCTION zoi.studio_media_delete_allowed(text,text)FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION zoi.studio_media_delete_allowed(text,text)TO authenticated;
CREATE POLICY studio_media_granted_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(zoi.studio_media_insert_allowed(bucket_id,name));
CREATE POLICY studio_media_unresolved_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(zoi.studio_media_delete_allowed(bucket_id,name));

CREATE FUNCTION public.studio_media_prove(p_grant uuid,p_object jsonb,p_sha256 text,p_mime text,p_size integer,p_metadata jsonb)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE g zoi.studio_media_events;prior zoi.studio_media_events;object jsonb;data jsonb;
BEGIN
 SELECT *INTO g FROM zoi.studio_media_events WHERE grant_id=p_grant AND phase='grant';
 IF g.id IS NULL THEN RAISE EXCEPTION 'studio_media_grant_unavailable';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('business-creative:'||g.request_id::text,0));
 IF g.expires_at<=clock_timestamp()OR EXISTS(SELECT 1 FROM zoi.business_creative_requests WHERE request_id=g.request_id AND state='cancelled')THEN RAISE EXCEPTION 'studio_media_request_closed';END IF;
 -- A proof is not authority to register. This further refusal check cannot grant
 -- access; the final user-JWT save repeats all current canonical authorizers.
 IF NOT EXISTS(SELECT 1 FROM auth.sessions s JOIN auth.users u ON u.id=s.user_id WHERE s.id=g.session_id AND s.user_id=g.actor_auth AND(s.not_after IS NULL OR s.not_after>clock_timestamp())AND u.deleted_at IS NULL AND NOT coalesce(u.is_anonymous,false)AND(u.banned_until IS NULL OR u.banned_until<=clock_timestamp()))THEN RAISE EXCEPTION 'studio_media_session_unavailable';END IF;
 object:=zoi.studio_object(g.data->>'path',true);
 IF object IS NULL OR object IS DISTINCT FROM p_object OR p_sha256 IS DISTINCT FROM g.data->>'sha256'OR p_mime IS DISTINCT FROM g.data->>'mime_type'OR p_size IS DISTINCT FROM(g.data->>'size_bytes')::integer OR p_metadata->>'mime_type'IS DISTINCT FROM p_mime OR p_metadata->>'type'IS DISTINCT FROM'image'OR p_metadata->'width'IS DISTINCT FROM g.data->'width'OR p_metadata->'height'IS DISTINCT FROM g.data->'height'OR lower(split_part(object->'metadata'->>'mimetype',';',1))IS DISTINCT FROM p_mime OR object->'metadata'->>'size'IS DISTINCT FROM p_size::text THEN RAISE EXCEPTION 'studio_media_byte_proof_mismatch';END IF;
 IF g.data->>'asset_id'IS NULL AND((object->>'created_at')::timestamptz<g.created_at OR(object->>'owner'IS DISTINCT FROM g.actor_auth::text AND object->>'owner_id'IS DISTINCT FROM g.actor_auth::text))THEN RAISE EXCEPTION 'studio_media_object_identity_changed';END IF;
 data:=g.data||jsonb_build_object('object',object);
 SELECT *INTO prior FROM zoi.studio_media_events WHERE grant_id=p_grant AND phase='proof';
 IF prior.id IS NOT NULL THEN IF prior.data IS DISTINCT FROM data THEN RAISE EXCEPTION 'studio_media_byte_proof_mismatch';END IF;
 ELSE INSERT INTO zoi.studio_media_events(grant_id,phase,request_id,workspace_id,listing_id,actor_auth,session_id,purpose,context_hash,data,expires_at)VALUES(g.grant_id,'proof',g.request_id,g.workspace_id,g.listing_id,g.actor_auth,g.session_id,g.purpose,g.context_hash,data,g.expires_at);END IF;
 RETURN jsonb_build_object('ok',true,'grant',p_grant,'verified',true);
END$$;
REVOKE ALL ON FUNCTION public.studio_media_prove(uuid,jsonb,text,text,integer,jsonb)FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.studio_media_prove(uuid,jsonb,text,text,integer,jsonb)TO service_role;
CREATE FUNCTION public.business_creative_render_save(p_workspace uuid,p_listing uuid,p_request uuid,p_payload jsonb)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE context jsonb;prior zoi.social_posts;saved zoi.social_posts;part jsonb;prepared jsonb;proof zoi.studio_media_events;name text;asset_id uuid;asset_url text;parts jsonb:='{}';media jsonb;meta jsonb;target uuid;
BEGIN
 context:=zoi.studio_render_context(p_workspace,p_listing,p_request,p_payload);
 IF context?'receipt'THEN RETURN context->'receipt';END IF;
 target:=(p_payload->>'id')::uuid;
 IF target IS NOT NULL THEN
  SELECT *INTO prior FROM zoi.social_posts WHERE id=target AND workspace_id=p_workspace FOR UPDATE;
  PERFORM zoi.assert_workspace_write(p_workspace);PERFORM zoi.home_content_authorize(p_workspace,p_listing);
  IF prior.id IS NULL THEN RAISE EXCEPTION 'business_creative_post_removed';END IF;
  IF prior.status IS DISTINCT FROM'draft'OR prior.scheduled_at IS NOT NULL OR prior.channels IS DISTINCT FROM ARRAY[]::text[]THEN RAISE EXCEPTION 'business_creative_post_not_private_draft';END IF;
  IF prior.updated_at IS DISTINCT FROM(p_payload->>'expected_updated_at')::timestamptz THEN RAISE EXCEPTION 'business_creative_version_conflict';END IF;
  IF prior.meta->>'client_listing_id'IS DISTINCT FROM p_listing::text OR prior.meta->'business_creative'->>'listing'IS DISTINCT FROM p_listing::text OR NOT EXISTS(SELECT 1 FROM zoi.business_creative_requests r WHERE r.post_id=target AND r.workspace_id=p_workspace AND r.listing_id=p_listing AND r.state='saved'AND r.request_id::text=prior.meta->'business_creative'->>'request'AND encode(sha256(convert_to((r.payload->'source')::text,'UTF8')),'hex')=prior.meta->'business_creative'->>'source_hash')THEN RAISE EXCEPTION 'business_creative_context_changed';END IF;
 END IF;
 FOREACH name IN ARRAY ARRAY['original','output']LOOP
  prepared:=public.studio_media_prepare(p_workspace,p_listing,p_request,p_payload,name);
  SELECT *INTO proof FROM zoi.studio_media_events WHERE grant_id=(prepared->>'grant')::uuid AND phase='proof'FOR SHARE;
  IF proof.id IS NULL OR proof.actor_auth IS DISTINCT FROM auth.uid()OR proof.session_id::text IS DISTINCT FROM context->>'session'OR proof.context_hash IS DISTINCT FROM context->>'hash'OR proof.expires_at<=clock_timestamp()OR zoi.studio_object(proof.data->>'path',true)IS DISTINCT FROM proof.data->'object'THEN RAISE EXCEPTION 'studio_media_current_byte_proof_required';END IF;
  part:=p_payload->'render'->name;asset_id:=(part->>'asset_id')::uuid;
  IF asset_id IS NULL THEN
   asset_url:='https://csebihpaychdkanjjsmz.supabase.co/storage/v1/object/public/media/'||(proof.data->>'path');
   IF EXISTS(SELECT 1 FROM zoi.assets WHERE zoi.assets.url=asset_url)THEN RAISE EXCEPTION 'studio_media_asset_path_collision';END IF;
   asset_id:=public.asset_save(p_workspace,asset_url,'image',CASE name WHEN'original'THEN'Original image'ELSE p_payload->'render'->>'alt'END,(part->>'size_bytes')::integer,(part->>'width')::integer,(part->>'height')::integer);
  ELSE SELECT a.url INTO asset_url FROM zoi.assets a WHERE id=asset_id AND workspace_id=p_workspace FOR SHARE;IF asset_url IS NULL THEN RAISE EXCEPTION 'studio_media_source_asset_unavailable';END IF;END IF;
  parts:=parts||jsonb_build_object(name,part||jsonb_build_object('asset_id',asset_id,'url',asset_url,'proof',proof.grant_id));
 END LOOP;
 media:=jsonb_build_array(jsonb_build_object('type','image','url',parts->'output'->>'url','order',0,'alt',p_payload->'render'->>'alt'));
 meta:=(p_payload->'meta')||jsonb_build_object('client_listing_id',p_listing,'business_creative',jsonb_build_object('kind','published_business_image_composition','listing',p_listing,'request',p_request,'source_hash',context->>'source_hash','rights_confirmed',true),'creative_composition',parts||jsonb_build_object('schema',1,'recipe',p_payload->'render'->'recipe','rights_confirmed',true));
 SELECT *INTO saved FROM public.social_save_post(p_workspace,p_payload->>'body',ARRAY[]::text[],NULL,'draft',media,NULL,meta,target);
 PERFORM zoi.assert_workspace_write(p_workspace);PERFORM zoi.home_content_authorize(p_workspace,p_listing);
 IF saved.id IS NULL OR saved.workspace_id IS DISTINCT FROM p_workspace OR saved.status IS DISTINCT FROM'draft'OR saved.scheduled_at IS NOT NULL OR saved.channels IS DISTINCT FROM ARRAY[]::text[]OR saved.body IS DISTINCT FROM p_payload->>'body'OR saved.media IS DISTINCT FROM media OR saved.meta IS DISTINCT FROM meta THEN RAISE EXCEPTION 'business_creative_save_unconfirmed';END IF;
 INSERT INTO zoi.business_creative_requests(request_id,actor_auth,workspace_id,listing_id,state,payload,post_id,post_snapshot)VALUES(p_request,auth.uid(),p_workspace,p_listing,'saved',p_payload,saved.id,to_jsonb(saved));
 RETURN zoi.business_creative_receipt(p_workspace,p_listing,p_request);
END$$;
REVOKE ALL ON FUNCTION public.business_creative_render_save(uuid,uuid,uuid,jsonb)FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.business_creative_render_save(uuid,uuid,uuid,jsonb)TO authenticated;

-- This service boundary only closes a previously authorized upload nonce and
-- proposes exact unattached paths. It cannot register assets or write posts.
CREATE FUNCTION public.studio_media_cleanup_plan(p_grant uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE g zoi.studio_media_events;r zoi.business_creative_requests;item zoi.studio_media_events;object jsonb;paths jsonb:='[]';asset_url text;
BEGIN
 SELECT *INTO g FROM zoi.studio_media_events WHERE grant_id=p_grant AND phase='grant';
 IF g.id IS NULL THEN RAISE EXCEPTION 'studio_media_grant_unavailable';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('business-creative:'||g.request_id::text,0));
 SELECT *INTO r FROM zoi.business_creative_requests WHERE request_id=g.request_id;
 IF r.request_id IS NOT NULL AND(r.actor_auth IS DISTINCT FROM g.actor_auth OR r.workspace_id IS DISTINCT FROM g.workspace_id OR r.listing_id IS DISTINCT FROM g.listing_id)THEN RAISE EXCEPTION 'studio_media_cleanup_scope_conflict';END IF;
 IF r.state='saved'THEN RETURN jsonb_build_object('ok',true,'state','saved','paths','[]'::jsonb);END IF;
 IF r.request_id IS NULL THEN INSERT INTO zoi.business_creative_requests(request_id,actor_auth,workspace_id,listing_id,state)VALUES(g.request_id,g.actor_auth,g.workspace_id,g.listing_id,'cancelled');END IF;
 FOR item IN SELECT *FROM zoi.studio_media_events WHERE request_id=g.request_id AND phase='grant'ORDER BY purpose LOOP
  IF item.data->>'asset_id'IS NOT NULL OR EXISTS(SELECT 1 FROM zoi.studio_media_events WHERE grant_id=item.grant_id AND phase='deleted')THEN CONTINUE;END IF;
  object:=zoi.studio_object(item.data->>'path',true);
  IF object IS NOT NULL THEN
   asset_url:='https://csebihpaychdkanjjsmz.supabase.co/storage/v1/object/public/media/'||(item.data->>'path');
   IF EXISTS(SELECT 1 FROM zoi.assets WHERE zoi.assets.url=asset_url)THEN RAISE EXCEPTION 'studio_media_cleanup_asset_referenced';END IF;
   IF(object->>'created_at')::timestamptz<item.created_at OR(object->>'owner'IS DISTINCT FROM item.actor_auth::text AND object->>'owner_id'IS DISTINCT FROM item.actor_auth::text)THEN RAISE EXCEPTION 'studio_media_cleanup_object_changed';END IF;
  END IF;
  paths:=paths||jsonb_build_array(jsonb_build_object('grant',item.grant_id,'path',item.data->>'path','object',object));
 END LOOP;
 RETURN jsonb_build_object('ok',true,'state','cancelled','paths',paths);
END$$;
REVOKE ALL ON FUNCTION public.studio_media_cleanup_plan(uuid)FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.studio_media_cleanup_plan(uuid)TO service_role;
CREATE FUNCTION public.studio_media_cleanup_finish(p_grant uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE g zoi.studio_media_events;
BEGIN
 SELECT *INTO g FROM zoi.studio_media_events WHERE grant_id=p_grant AND phase='grant';IF g.id IS NULL THEN RAISE EXCEPTION 'studio_media_grant_unavailable';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('business-creative:'||g.request_id::text,0));
 IF NOT EXISTS(SELECT 1 FROM zoi.business_creative_requests WHERE request_id=g.request_id AND state='cancelled')OR g.data->>'asset_id'IS NOT NULL OR zoi.studio_object(g.data->>'path',true)IS NOT NULL THEN RAISE EXCEPTION 'studio_media_cleanup_unconfirmed';END IF;
 IF NOT EXISTS(SELECT 1 FROM zoi.studio_media_events WHERE grant_id=p_grant AND phase='deleted')THEN INSERT INTO zoi.studio_media_events(grant_id,phase,request_id,workspace_id,listing_id,actor_auth,session_id,purpose,context_hash,data,expires_at)VALUES(g.grant_id,'deleted',g.request_id,g.workspace_id,g.listing_id,g.actor_auth,g.session_id,g.purpose,g.context_hash,g.data,g.expires_at);END IF;
 RETURN jsonb_build_object('ok',true,'grant',p_grant,'deleted',true);
END$$;
REVOKE ALL ON FUNCTION public.studio_media_cleanup_finish(uuid)FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.studio_media_cleanup_finish(uuid)TO service_role;
CREATE FUNCTION public.studio_media_cleanup_candidates()RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=''AS $$
 SELECT coalesce(jsonb_agg(grant_id),'[]'::jsonb)FROM(SELECT DISTINCT ON(request_id)grant_id FROM zoi.studio_media_events g WHERE phase='grant'AND data->>'asset_id'IS NULL AND expires_at<clock_timestamp()AND NOT EXISTS(SELECT 1 FROM zoi.business_creative_requests r WHERE r.request_id=g.request_id AND r.state='saved')AND NOT EXISTS(SELECT 1 FROM zoi.studio_media_events d WHERE d.grant_id=g.grant_id AND d.phase='deleted')ORDER BY request_id LIMIT 20)s
$$;
REVOKE ALL ON FUNCTION public.studio_media_cleanup_candidates()FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.studio_media_cleanup_candidates()TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;

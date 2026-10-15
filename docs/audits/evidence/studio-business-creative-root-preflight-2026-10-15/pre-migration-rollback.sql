BEGIN;

SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='20s';
-- Captured current contracts; no canonical writer/authority body or ACL changes.
DO $guard$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.home_entity(text)') AND md5(prosrc)='663211d51b2cf63c8c457e2a52e48781' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres,anon=X/postgres,authenticated=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=true AND provolatile='s')THEN RAISE EXCEPTION 'business_creative_dependency_changed: public.home_entity(text)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.social_save_post(uuid,text,text[],timestamp with time zone,text,jsonb,text,jsonb,uuid)') AND md5(prosrc)='62569b74f0831a60bf2d2688f0e48ac5' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=zoi, public']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_creative_dependency_changed: public.social_save_post(uuid,text,text[],timestamp with time zone,text,jsonb,text,jsonb,uuid)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.assert_workspace_write(uuid,text[])') AND md5(prosrc)='0a1b64d6adee0e63726bab3c08b0be53' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_creative_dependency_changed: zoi.assert_workspace_write(uuid,text[])';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.home_content_authorize(uuid,uuid)') AND md5(prosrc)='d5e39d01982e0a8103e71d2e296d28cd' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_creative_dependency_changed: zoi.home_content_authorize(uuid,uuid)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.suite_current_session()') AND md5(prosrc)='70cb927f126f251f229c450bf9f792e8' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND prosecdef=true AND provolatile='s')THEN RAISE EXCEPTION 'business_creative_dependency_changed: zoi.suite_current_session()';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='zoi.social_posts'::regclass AND a.attname='updated_at'AND NOT a.attisdropped AND a.atttypid='timestamptz'::regtype AND NOT a.attnotnull AND pg_get_expr(d.adbin,d.adrelid)='now()')THEN RAISE EXCEPTION 'business_creative_dependency_changed: social_posts.updated_at';END IF;
END$guard$;
-- Projection schema1 binds copy/media inputs and their authority/hold context.
-- Presence is preserved, including explicit JSON null; menus, contact channels,
-- design, crawler timestamps and leases are deliberately not part of this copy.
CREATE FUNCTION zoi.business_creative_project_layer(p_value jsonb,p_kind text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE value jsonb:='{}';keys text[];k text;
BEGIN
 IF jsonb_typeof(p_value)IS DISTINCT FROM'object'THEN RETURN p_value;END IF;
 keys:=CASE p_kind WHEN 'top'THEN ARRAY['id','name','slug','entity_type','category_slug','primary_category_id','owner_user_id','owner_workspace_id','claim_status','reviewed_food_receipt_current','address','city','country','publish_status','moderation_status','marketplace_status','description','biography','bio','excerpt','photo_url','hero_url','photo','photo_urls','photos','gallery','logo_url','logo','brand','website','hero_kind']::text[] WHEN 'enrich'THEN ARRAY['description','biography','bio','excerpt','photo_url','hero_url','photo','photo_urls','photos','gallery','logo_url','logo','brand','website','hero_kind','source_url','source_identity','source_kind','identity_scope','source_scope_mismatch','source_challenge','challenge','scope_review_required','organization_identity_quarantine','blocked','blocked_reason','crawl_status','status','last_error','source_affiliation','member','association_member','publisher_source_evidence','photo_roles']::text[] WHEN 'provenance'THEN ARRAY['description','biography','bio','excerpt','photo_url','hero_url','photo','photo_urls','photos','gallery','logo_url','logo','brand','website','hero_kind','source_identity']::text[] ELSE ARRAY['description','biography','bio','excerpt','photo_url','hero_url','photo','photo_urls','photos','gallery','logo_url','logo','brand','website','hero_kind']::text[] END;
 FOREACH k IN ARRAY keys LOOP IF p_value?k THEN value:=value||jsonb_build_object(k,p_value->k);END IF;END LOOP;
 IF p_kind IN('top','owner')AND p_value?'profile'THEN value:=value||jsonb_build_object('profile',zoi.business_creative_project_layer(p_value->'profile','layer'));END IF;
 IF p_kind='top'AND p_value?'owner_content'THEN value:=value||jsonb_build_object('owner_content',zoi.business_creative_project_layer(p_value->'owner_content','owner'));END IF;
 IF p_kind='layer'AND p_value?'_enrich'THEN value:=value||jsonb_build_object('_enrich',zoi.business_creative_project_layer(p_value->'_enrich','enrich'));END IF;
 IF p_kind='enrich'THEN
  IF p_value?'fields'THEN value:=value||jsonb_build_object('fields',zoi.business_creative_project_layer(p_value->'fields','content'));END IF;
  IF p_value?'provenance'THEN value:=value||jsonb_build_object('provenance',zoi.business_creative_project_layer(p_value->'provenance','provenance'));END IF;
 END IF;
 RETURN value;
END$$;
REVOKE ALL ON FUNCTION zoi.business_creative_project_layer(jsonb,text)FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION zoi.business_creative_source(p_entity jsonb)RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN jsonb_typeof(p_entity)='object'THEN jsonb_build_object('schema',1)||zoi.business_creative_project_layer(p_entity,'top')ELSE NULL END
$$;
REVOKE ALL ON FUNCTION zoi.business_creative_source(jsonb)FROM PUBLIC,anon,authenticated,service_role;

-- Existing request tables are tied to email campaigns, AI generations, reviewed
-- occurrences, Operations records or creator campaigns. This is only an immutable
-- manual-social receipt/tombstone; social_posts remains the sole editable object.
CREATE TABLE zoi.business_creative_requests(
 request_id uuid PRIMARY KEY,actor_auth uuid NOT NULL,workspace_id uuid NOT NULL,
 listing_id uuid NOT NULL,state text NOT NULL CHECK(state IN('saved','cancelled')),
 payload jsonb,post_id uuid,post_snapshot jsonb,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((state='saved'AND payload IS NOT NULL AND post_id IS NOT NULL AND post_snapshot IS NOT NULL)
 OR(state='cancelled'AND payload IS NULL AND post_id IS NULL AND post_snapshot IS NULL))
);
CREATE INDEX business_creative_request_history ON zoi.business_creative_requests(actor_auth,workspace_id,created_at);
ALTER TABLE zoi.business_creative_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.business_creative_requests FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION zoi.business_creative_receipt_immutable()RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'business_creative_receipt_immutable';END$$;
REVOKE ALL ON FUNCTION zoi.business_creative_receipt_immutable()FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER business_creative_receipt_immutable BEFORE UPDATE OR DELETE ON zoi.business_creative_requests FOR EACH ROW EXECUTE FUNCTION zoi.business_creative_receipt_immutable();

CREATE FUNCTION zoi.business_creative_receipt(p_workspace uuid,p_listing uuid,p_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r zoi.business_creative_requests;p jsonb;slug text;source jsonb;
BEGIN
 SELECT *INTO r FROM zoi.business_creative_requests WHERE request_id=p_request;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'actor',auth.uid(),'workspace',p_workspace,'listing',p_listing,'request',p_request,'state','missing');END IF;
 IF r.actor_auth IS DISTINCT FROM auth.uid()OR r.workspace_id IS DISTINCT FROM p_workspace OR r.listing_id IS DISTINCT FROM p_listing THEN RAISE EXCEPTION 'business_creative_request_scope_conflict';END IF;
 IF r.post_id IS NOT NULL THEN SELECT to_jsonb(s)INTO p FROM zoi.social_posts s WHERE id=r.post_id AND workspace_id=p_workspace;END IF;
 IF p IS NOT NULL THEN
  IF p->>'status'IS DISTINCT FROM'draft'OR p->'scheduled_at'IS DISTINCT FROM'null'::jsonb OR p->'channels'IS DISTINCT FROM'[]'::jsonb THEN RAISE EXCEPTION 'business_creative_post_not_private_draft';END IF;
  IF p->'meta'->>'client_listing_id'IS DISTINCT FROM p_listing::text OR p->'meta'->'business_creative'->>'listing'IS DISTINCT FROM p_listing::text OR NOT EXISTS(SELECT 1 FROM zoi.business_creative_requests r2 WHERE r2.post_id=r.post_id AND r2.workspace_id=p_workspace AND r2.listing_id=p_listing AND r2.state='saved'AND r2.request_id::text=p->'meta'->'business_creative'->>'request'AND encode(sha256(convert_to((r2.payload->'source')::text,'UTF8')),'hex')=p->'meta'->'business_creative'->>'source_hash')THEN RAISE EXCEPTION 'business_creative_context_changed';END IF;
 END IF;
 SELECT l.slug INTO slug FROM zoi.listings l WHERE id=p_listing AND owner_workspace_id=p_workspace;
 IF slug IS NOT NULL THEN source:=zoi.business_creative_source(public.home_entity(slug));END IF;
 PERFORM zoi.suite_current_session();
 RETURN jsonb_build_object('ok',true,'actor',auth.uid(),'workspace',p_workspace,'listing',p_listing,'request',p_request,
 'state',CASE WHEN r.state='saved'AND p IS NULL THEN 'removed'ELSE r.state END,
 'post_id',r.post_id,'snapshot',r.post_snapshot,'post',p,'source_current',source IS NOT DISTINCT FROM r.payload->'source');
END$$;
REVOKE ALL ON FUNCTION zoi.business_creative_receipt(uuid,uuid,uuid)FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.business_creative_draft_save(p_workspace uuid,p_listing uuid,p_request uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE prior zoi.business_creative_requests;slug text;source jsonb;post zoi.social_posts;prior_post zoi.social_posts;target uuid;expected_at timestamptz;k text;m jsonb;url text;meta jsonb;
BEGIN
 -- Match existing canonical workspace/member/session lock order before listing.
 PERFORM zoi.assert_workspace_write(p_workspace);
 PERFORM zoi.home_content_authorize(p_workspace,p_listing);
 IF p_request IS NULL THEN RAISE EXCEPTION 'business_creative_request_required';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('business-creative:'||p_request::text,0));
 PERFORM zoi.assert_workspace_write(p_workspace);
 PERFORM zoi.home_content_authorize(p_workspace,p_listing);
 SELECT *INTO prior FROM zoi.business_creative_requests WHERE request_id=p_request;
 IF FOUND THEN
  IF prior.actor_auth IS DISTINCT FROM auth.uid()OR prior.workspace_id IS DISTINCT FROM p_workspace OR prior.listing_id IS DISTINCT FROM p_listing THEN RAISE EXCEPTION 'business_creative_request_scope_conflict';END IF;
  IF prior.state='cancelled'THEN RAISE EXCEPTION 'business_creative_request_cancelled';END IF;
  IF prior.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'business_creative_request_payload_conflict';END IF;
  RETURN zoi.business_creative_receipt(p_workspace,p_listing,p_request);
 END IF;
 IF jsonb_typeof(p_payload)IS DISTINCT FROM'object'OR octet_length(p_payload::text)>100000 OR NOT(p_payload ?& ARRAY['source','body','media','meta','rights_confirmed','id','expected_updated_at'])THEN RAISE EXCEPTION 'business_creative_invalid_payload';END IF;
 FOR k IN SELECT jsonb_object_keys(p_payload)LOOP IF k NOT IN('source','body','media','meta','rights_confirmed','id','expected_updated_at')THEN RAISE EXCEPTION 'business_creative_invalid_payload';END IF;END LOOP;
 IF jsonb_typeof(p_payload->'source')IS DISTINCT FROM'object'OR p_payload->'source'->'schema'IS DISTINCT FROM'1'::jsonb OR octet_length((p_payload->'source')::text)>64000 OR jsonb_typeof(p_payload->'body')IS DISTINCT FROM'string'OR length(p_payload->>'body')>20000 OR jsonb_typeof(p_payload->'media')IS DISTINCT FROM'array'OR jsonb_array_length(p_payload->'media')>4 OR jsonb_typeof(p_payload->'meta')IS DISTINCT FROM'object'OR octet_length((p_payload->'meta')::text)>32000 OR p_payload->'rights_confirmed'IS DISTINCT FROM'true'::jsonb THEN RAISE EXCEPTION 'business_creative_invalid_payload';END IF;
 IF length(btrim(p_payload->>'body'))=0 AND jsonb_array_length(p_payload->'media')=0 THEN RAISE EXCEPTION 'business_creative_content_required';END IF;
 IF jsonb_typeof(p_payload->'meta'->'campaign')IS DISTINCT FROM'string'OR length(btrim(p_payload->'meta'->>'campaign'))NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'business_creative_campaign_required';END IF;
 IF(p_payload->'meta') ?| ARRAY['ai_generation_id','editorial','business_creative','client_listing_id']THEN RAISE EXCEPTION 'business_creative_invalid_payload';END IF;
 IF jsonb_typeof(p_payload->'id')NOT IN('string','null')OR jsonb_typeof(p_payload->'expected_updated_at')NOT IN('string','null')THEN RAISE EXCEPTION 'business_creative_invalid_payload';END IF;
 BEGIN target:=(p_payload->>'id')::uuid;expected_at:=(p_payload->>'expected_updated_at')::timestamptz;EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'business_creative_invalid_payload';END;
 IF(target IS NULL)IS DISTINCT FROM(expected_at IS NULL)THEN RAISE EXCEPTION 'business_creative_revision_required';END IF;
 IF target IS NOT NULL THEN
  SELECT *INTO prior_post FROM zoi.social_posts WHERE id=target AND workspace_id=p_workspace FOR UPDATE;
  -- Recheck current authority after the actual canonical row wait.
  PERFORM zoi.assert_workspace_write(p_workspace);PERFORM zoi.home_content_authorize(p_workspace,p_listing);
  IF prior_post.id IS NULL THEN RAISE EXCEPTION 'business_creative_post_removed';END IF;
  IF prior_post.status IS DISTINCT FROM'draft'OR prior_post.scheduled_at IS NOT NULL OR prior_post.channels IS DISTINCT FROM ARRAY[]::text[] THEN RAISE EXCEPTION 'business_creative_post_not_private_draft';END IF;
  IF prior_post.updated_at IS DISTINCT FROM expected_at THEN RAISE EXCEPTION 'business_creative_version_conflict';END IF;
  IF prior_post.meta->>'client_listing_id'IS DISTINCT FROM p_listing::text OR prior_post.meta->'business_creative'->>'listing'IS DISTINCT FROM p_listing::text OR NOT EXISTS(SELECT 1 FROM zoi.business_creative_requests r WHERE r.post_id=target AND r.workspace_id=p_workspace AND r.listing_id=p_listing AND r.state='saved'AND r.request_id::text=prior_post.meta->'business_creative'->>'request'AND encode(sha256(convert_to((r.payload->'source')::text,'UTF8')),'hex')=prior_post.meta->'business_creative'->>'source_hash')THEN RAISE EXCEPTION 'business_creative_context_changed';END IF;
 END IF;
 SELECT l.slug INTO slug FROM zoi.listings l WHERE id=p_listing AND owner_workspace_id=p_workspace;
 IF slug IS NULL THEN RAISE EXCEPTION 'business_creative_listing_unavailable';END IF;
 source:=zoi.business_creative_source(public.home_entity(slug));
 IF source IS NULL OR source->>'id'IS DISTINCT FROM p_listing::text OR source IS DISTINCT FROM p_payload->'source' THEN RAISE EXCEPTION 'business_creative_source_changed';END IF;
 FOR m IN SELECT value FROM jsonb_array_elements(p_payload->'media')LOOP
  IF jsonb_typeof(m)IS DISTINCT FROM'object'OR m->>'type'IS DISTINCT FROM'image'OR jsonb_typeof(m->'url')IS DISTINCT FROM'string'OR length(m->>'url')>3000 OR(m->>'url')!~'^https://[^/?#@[:space:]]+([/?#]|$)'THEN RAISE EXCEPTION 'business_creative_invalid_media';END IF;
  FOR k IN SELECT jsonb_object_keys(m)LOOP IF k NOT IN('type','url','order','alt')THEN RAISE EXCEPTION 'business_creative_invalid_media';END IF;END LOOP;
  IF m?'alt'AND(jsonb_typeof(m->'alt')IS DISTINCT FROM'string'OR length(m->>'alt')>1000)THEN RAISE EXCEPTION 'business_creative_invalid_media';END IF;
  url:=m->>'url';
  -- This binds the user's reviewed reference, not copyright or visual identity.
  -- Shared public media policy chooses the options; explicit rights confirmation
  -- is required. This does not turn source presence into a verified asset claim.
  IF NOT jsonb_path_exists(source,'$.** ? (@ == $url)',jsonb_build_object('url',url))THEN RAISE EXCEPTION 'business_creative_media_not_in_source';END IF;
 END LOOP;
 IF(SELECT count(*)FROM zoi.business_creative_requests WHERE actor_auth=auth.uid()AND created_at>clock_timestamp()-interval'24 hours')>=100 THEN RAISE EXCEPTION 'business_creative_request_limit';END IF;
 meta:=(p_payload->'meta')||jsonb_build_object('client_listing_id',p_listing,'business_creative',jsonb_build_object('kind','published_business_reference','listing',p_listing,'request',p_request,'source_hash',encode(sha256(convert_to(source::text,'UTF8')),'hex'),'rights_confirmed',true));
 SELECT *INTO post FROM public.social_save_post(p_workspace,p_payload->>'body',ARRAY[]::text[],NULL,'draft',p_payload->'media',NULL,meta,target);
 PERFORM zoi.assert_workspace_write(p_workspace);
 PERFORM zoi.home_content_authorize(p_workspace,p_listing);
 IF post.id IS NULL OR post.workspace_id IS DISTINCT FROM p_workspace OR post.status IS DISTINCT FROM'draft'OR post.scheduled_at IS NOT NULL OR post.body IS DISTINCT FROM p_payload->>'body'OR post.media IS DISTINCT FROM p_payload->'media'OR post.meta IS DISTINCT FROM meta OR post.channels IS DISTINCT FROM ARRAY[]::text[] THEN RAISE EXCEPTION 'business_creative_save_unconfirmed';END IF;
 INSERT INTO zoi.business_creative_requests(request_id,actor_auth,workspace_id,listing_id,state,payload,post_id,post_snapshot)VALUES(p_request,auth.uid(),p_workspace,p_listing,'saved',p_payload,post.id,to_jsonb(post));
 RETURN zoi.business_creative_receipt(p_workspace,p_listing,p_request);
END$$;
REVOKE ALL ON FUNCTION public.business_creative_draft_save(uuid,uuid,uuid,jsonb)FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.business_creative_draft_save(uuid,uuid,uuid,jsonb)TO authenticated;

CREATE FUNCTION public.business_creative_draft_recover(p_workspace uuid,p_listing uuid,p_request uuid,p_cancel_if_missing boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb;
BEGIN
 PERFORM zoi.assert_workspace_write(p_workspace);PERFORM zoi.home_content_authorize(p_workspace,p_listing);
 IF p_request IS NULL THEN RAISE EXCEPTION 'business_creative_request_required';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('business-creative:'||p_request::text,0));
 PERFORM zoi.assert_workspace_write(p_workspace);PERFORM zoi.home_content_authorize(p_workspace,p_listing);
 r:=zoi.business_creative_receipt(p_workspace,p_listing,p_request);
 IF r->>'state'='missing'AND p_cancel_if_missing THEN
  IF(SELECT count(*)FROM zoi.business_creative_requests WHERE actor_auth=auth.uid()AND created_at>clock_timestamp()-interval'24 hours')>=100 THEN RAISE EXCEPTION 'business_creative_request_limit';END IF;
  INSERT INTO zoi.business_creative_requests(request_id,actor_auth,workspace_id,listing_id,state)VALUES(p_request,auth.uid(),p_workspace,p_listing,'cancelled');
  RETURN zoi.business_creative_receipt(p_workspace,p_listing,p_request);
 END IF;
 RETURN r;
END$$;
REVOKE ALL ON FUNCTION public.business_creative_draft_recover(uuid,uuid,uuid,boolean)FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.business_creative_draft_recover(uuid,uuid,uuid,boolean)TO authenticated;
-- Authorized team members can reopen the canonical object, not another
-- actor's request receipt. Original/current references contain public fields only.
CREATE FUNCTION public.business_creative_draft_get(p_workspace uuid,p_post uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p zoi.social_posts;r zoi.business_creative_requests;original jsonb;source jsonb;slug text;
BEGIN
 PERFORM zoi.assert_workspace_write(p_workspace);
 -- Resolve the listing without taking the post lock, then follow the same
 -- workspace/member/profile -> listing -> post order as draft_save.
 SELECT r0.*INTO r FROM zoi.business_creative_requests r0 JOIN zoi.social_posts p0 ON p0.id=r0.post_id AND p0.workspace_id=r0.workspace_id
 WHERE p0.id=p_post AND p0.workspace_id=p_workspace AND r0.state='saved'AND r0.request_id::text=p0.meta->'business_creative'->>'request';
 IF r.request_id IS NULL THEN RAISE EXCEPTION 'business_creative_post_removed';END IF;
 PERFORM zoi.home_content_authorize(p_workspace,r.listing_id);
 SELECT *INTO p FROM zoi.social_posts WHERE id=p_post AND workspace_id=p_workspace FOR SHARE;
 PERFORM zoi.assert_workspace_write(p_workspace);PERFORM zoi.home_content_authorize(p_workspace,r.listing_id);
 IF p.id IS NULL THEN RAISE EXCEPTION 'business_creative_post_removed';END IF;
 SELECT *INTO r FROM zoi.business_creative_requests WHERE post_id=p_post AND workspace_id=p_workspace AND state='saved'AND request_id::text=p.meta->'business_creative'->>'request';
 IF r.request_id IS NULL OR p.meta->>'client_listing_id'IS DISTINCT FROM r.listing_id::text OR p.meta->'business_creative'->>'listing'IS DISTINCT FROM r.listing_id::text OR encode(sha256(convert_to((r.payload->'source')::text,'UTF8')),'hex')IS DISTINCT FROM p.meta->'business_creative'->>'source_hash'THEN RAISE EXCEPTION 'business_creative_context_changed';END IF;
 PERFORM zoi.home_content_authorize(p_workspace,r.listing_id);PERFORM zoi.assert_workspace_write(p_workspace);
 IF p.status IS DISTINCT FROM'draft'OR p.scheduled_at IS NOT NULL OR p.channels IS DISTINCT FROM ARRAY[]::text[] THEN RAISE EXCEPTION 'business_creative_post_not_private_draft';END IF;
 SELECT l.slug INTO slug FROM zoi.listings l WHERE id=r.listing_id AND owner_workspace_id=p_workspace;
 IF slug IS NULL THEN RAISE EXCEPTION 'business_creative_listing_unavailable';END IF;
 source:=zoi.business_creative_source(public.home_entity(slug));
 SELECT payload->'source'INTO original FROM zoi.business_creative_requests WHERE post_id=p_post AND workspace_id=p_workspace AND listing_id=r.listing_id AND state='saved'ORDER BY created_at,request_id LIMIT 1;
 PERFORM zoi.suite_current_session();
 RETURN jsonb_build_object('ok',true,'workspace',p_workspace,'listing',r.listing_id,'post',to_jsonb(p),'source',r.payload->'source','original_source',original,'source_current',source IS NOT DISTINCT FROM r.payload->'source');
END$$;
REVOKE ALL ON FUNCTION public.business_creative_draft_get(uuid,uuid)FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.business_creative_draft_get(uuid,uuid)TO authenticated;
NOTIFY pgrst,'reload schema';

-- Root-only post-migration catalog and no-session probe; no fabricated claims,
-- fixture contacts/listings/posts, provider calls or durable writes. Always rollback.

SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='20s';
CREATE TEMP TABLE qa_business_creative_before ON COMMIT DROP AS SELECT count(*)AS rows FROM zoi.business_creative_requests;
DO $catalog$
DECLARE sig text;public_api boolean;
BEGIN
 FOREACH sig IN ARRAY ARRAY[
 'zoi.business_creative_project_layer(jsonb,text)',
 'zoi.business_creative_source(jsonb)',
 'zoi.business_creative_receipt_immutable()',
 'zoi.business_creative_receipt(uuid,uuid,uuid)',
 'public.business_creative_draft_save(uuid,uuid,uuid,jsonb)',
 'public.business_creative_draft_recover(uuid,uuid,uuid,boolean)',
 'public.business_creative_draft_get(uuid,uuid)']LOOP
  public_api:=sig LIKE 'public.%';
  IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure(sig)AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=""']::text[] AND prosecdef=(public_api OR sig LIKE 'zoi.business_creative_receipt(%'))THEN RAISE EXCEPTION 'business_creative_probe_catalog:%',sig;END IF;
  IF has_function_privilege('anon',sig,'execute')OR has_function_privilege('service_role',sig,'execute')OR has_function_privilege('authenticated',sig,'execute')IS DISTINCT FROM public_api THEN RAISE EXCEPTION 'business_creative_probe_acl:%',sig;END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='zoi.business_creative_requests'::regclass AND relrowsecurity)OR EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='zoi'AND tablename='business_creative_requests')OR has_table_privilege('anon','zoi.business_creative_requests','select,insert,update,delete')OR has_table_privilege('authenticated','zoi.business_creative_requests','select,insert,update,delete')OR has_table_privilege('service_role','zoi.business_creative_requests','select,insert,update,delete')THEN RAISE EXCEPTION 'business_creative_probe_private_ledger';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='zoi.business_creative_requests'::regclass AND tgname='business_creative_receipt_immutable'AND NOT tgisinternal AND tgenabled='O')THEN RAISE EXCEPTION 'business_creative_probe_immutable_trigger';END IF;
END$catalog$;
SET LOCAL request.jwt.claims='{}';
SET LOCAL ROLE authenticated;
DO $no_session$
DECLARE n integer:=0;
BEGIN
 BEGIN PERFORM public.business_creative_draft_save('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','{}');EXCEPTION WHEN OTHERS THEN IF SQLSTATE='42501'OR SQLERRM~'suite_session_unavailable|not_authorized|not_signed_in|insufficient_permission'THEN n:=n+1;ELSE RAISE;END IF;END;
 BEGIN PERFORM public.business_creative_draft_recover('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003',true);EXCEPTION WHEN OTHERS THEN IF SQLSTATE='42501'OR SQLERRM~'suite_session_unavailable|not_authorized|not_signed_in|insufficient_permission'THEN n:=n+1;ELSE RAISE;END IF;END;
 BEGIN PERFORM public.business_creative_draft_get('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004');EXCEPTION WHEN OTHERS THEN IF SQLSTATE='42501'OR SQLERRM~'suite_session_unavailable|not_authorized|not_signed_in|insufficient_permission'THEN n:=n+1;ELSE RAISE;END IF;END;
 IF n<>3 THEN RAISE EXCEPTION 'business_creative_probe_missing_session_not_refused';END IF;
END$no_session$;
RESET ROLE;
DO $unchanged$BEGIN IF(SELECT rows FROM qa_business_creative_before)IS DISTINCT FROM(SELECT count(*)FROM zoi.business_creative_requests)THEN RAISE EXCEPTION 'business_creative_probe_unexpected_receipt';END IF;END$unchanged$;
SELECT 'business_creative_catalog_and_no_session_probe_passed'AS result;

ROLLBACK;
SELECT jsonb_build_object('new_ledger_absent',to_regclass('zoi.business_creative_requests')IS NULL,'new_save_absent',to_regprocedure('public.business_creative_draft_save(uuid,uuid,uuid,jsonb)')IS NULL)AS result;

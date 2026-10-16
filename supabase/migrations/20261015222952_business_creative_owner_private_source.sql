BEGIN;
SET LOCAL lock_timeout='1s';SET LOCAL statement_timeout='5s';
DO $guard$ BEGIN IF current_user<>'postgres'THEN RAISE EXCEPTION 'business_private_postgres_required';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.bizpage_get(uuid,uuid)')AND md5(prosrc)='762e9d53fd0808287f467b1beb43b577'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=zoi, public']::text[]AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_private_dependency_changed: public.bizpage_get(uuid,uuid)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.home_content_get(uuid,uuid)')AND md5(prosrc)='45e1ecd88333050e701874d52be24fd9'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_private_dependency_changed: public.home_content_get(uuid,uuid)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.home_revision_baseline(zoi.listings)')AND md5(prosrc)='51700e905fd87e5c95967bd0a044baec'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]AND prosecdef=false AND provolatile='s')THEN RAISE EXCEPTION 'business_private_dependency_changed: zoi.home_revision_baseline(zoi.listings)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.home_revision_get(uuid,uuid)')AND md5(prosrc)='48962afd66063e925d2cee6f357985f5'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_private_dependency_changed: public.home_revision_get(uuid,uuid)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.home_revision_preview_data(uuid,uuid,integer)')AND md5(prosrc)='e16191f11c4e834de43b364ca1256c64'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_private_dependency_changed: public.home_revision_preview_data(uuid,uuid,integer)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.assert_ws(uuid)')AND md5(prosrc)='cdd352da7228d4c2f09be3db3938f6ac'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM NULL AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_private_dependency_changed: zoi.assert_ws(uuid)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.bizpage_can_edit(uuid,uuid)')AND md5(prosrc)='41755c2fefb23b87bba8a6d6ab05209d'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM NULL AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=zoi, public']::text[]AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_private_dependency_changed: zoi.bizpage_can_edit(uuid,uuid)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.home_content_get_before_revision(uuid,uuid)')AND md5(prosrc)='2b9a5b832ee37571131cfadc1a9b8975'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_private_dependency_changed: zoi.home_content_get_before_revision(uuid,uuid)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.home_content_version(zoi.listings)')AND md5(prosrc)='a886a454670dd1b27164734df60b5c1a'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]AND prosecdef=false AND provolatile='s')THEN RAISE EXCEPTION 'business_private_dependency_changed: zoi.home_content_version(zoi.listings)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.public_owner_content(uuid)')AND md5(prosrc)='3e0c2c40cb341e3c72aed3dadf30cfd1'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]AND prosecdef=true AND provolatile='s')THEN RAISE EXCEPTION 'business_private_dependency_changed: zoi.public_owner_content(uuid)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.home_entity(text)')AND md5(prosrc)='663211d51b2cf63c8c457e2a52e48781'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres,anon=X/postgres,authenticated=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]AND prosecdef=true AND provolatile='s')THEN RAISE EXCEPTION 'business_private_dependency_changed: public.home_entity(text)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.assert_workspace_write(uuid,text[])')AND md5(prosrc)='0a1b64d6adee0e63726bab3c08b0be53'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_private_dependency_changed: zoi.assert_workspace_write(uuid,text[])';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.home_content_authorize(uuid,uuid)')AND md5(prosrc)='d5e39d01982e0a8103e71d2e296d28cd'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_private_dependency_changed: zoi.home_content_authorize(uuid,uuid)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.suite_current_session()')AND md5(prosrc)='70cb927f126f251f229c450bf9f792e8'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]AND prosecdef=true AND provolatile='s')THEN RAISE EXCEPTION 'business_private_dependency_changed: zoi.suite_current_session()';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.business_creative_source(jsonb)')AND md5(prosrc)='555c138eb4f29e2ee0a533ba5e573004'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]AND prosecdef=false AND provolatile='i')THEN RAISE EXCEPTION 'business_private_dependency_changed: zoi.business_creative_source(jsonb)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.business_creative_receipt(uuid,uuid,uuid)')AND md5(prosrc)='80e289240781b9512829cfac8d1ac85f'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_private_dependency_changed: zoi.business_creative_receipt(uuid,uuid,uuid)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.business_creative_draft_save(uuid,uuid,uuid,jsonb)')AND md5(prosrc)='a5f3876eab8bef31c7e6b13fad9d2549'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_private_dependency_changed: public.business_creative_draft_save(uuid,uuid,uuid,jsonb)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.business_creative_draft_get(uuid,uuid)')AND md5(prosrc)='cbf00cb8b9000e19bcde4383eea8d023'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_private_dependency_changed: public.business_creative_draft_get(uuid,uuid)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.studio_render_context(uuid,uuid,uuid,jsonb)')AND md5(prosrc)='517d11a3fa2523edf835b5cc6ad78219'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_private_dependency_changed: zoi.studio_render_context(uuid,uuid,uuid,jsonb)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.studio_media_insert_allowed(text,text)')AND md5(prosrc)='09540d69ab8530824f8113bae4dd13dc'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_private_dependency_changed: zoi.studio_media_insert_allowed(text,text)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.business_creative_destination_context(uuid,uuid,uuid)')AND md5(prosrc)='1c9a23964e488e9718d672b4086eb302'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_private_dependency_changed: zoi.business_creative_destination_context(uuid,uuid,uuid)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.business_creative_destinations_recover(uuid,uuid,uuid,boolean)')AND md5(prosrc)='26f32016826bd7673a1287e3bca11646'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_private_dependency_changed: public.business_creative_destinations_recover(uuid,uuid,uuid,boolean)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.business_creative_render_save(uuid,uuid,uuid,jsonb)')AND md5(prosrc)='b2c10be8b6f55c6cf7238e1e0cc47c06'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'business_private_dependency_changed: public.business_creative_render_save(uuid,uuid,uuid,jsonb)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.business_creative_project_layer(jsonb,text)')AND md5(prosrc)='c438476d91320c02a2fc32e0f4dbedc1'AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]AND prosecdef=false AND provolatile='i')THEN RAISE EXCEPTION 'business_private_dependency_changed: zoi.business_creative_project_layer(jsonb,text)';END IF;
END $guard$;
DO $guard$DECLARE acl text;BEGIN acl:=CASE WHEN current_setting('server_version_num')::integer>=170000 AND current_setting('server_version_num')::integer<180000 THEN '{postgres=arwdDxtm/postgres}'WHEN current_setting('server_version_num')::integer>=160000 AND current_setting('server_version_num')::integer<170000 THEN '{postgres=arwdDxt/postgres}'ELSE NULL END;IF acl IS NULL OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='zoi.home_designs'::regclass AND relowner='postgres'::regrole AND relacl::text IS NOT DISTINCT FROM acl AND relrowsecurity)THEN RAISE EXCEPTION 'business_private_revision_catalog_changed';END IF;
IF(SELECT count(*)FROM pg_attribute WHERE attrelid='zoi.home_designs'::regclass AND attnum>0 AND NOT attisdropped)<>12 THEN RAISE EXCEPTION 'business_private_revision_columns_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='zoi.home_designs'::regclass AND attname='listing_id'AND NOT attisdropped AND format_type(atttypid,atttypmod)='uuid'AND attnotnull=true)THEN RAISE EXCEPTION 'business_private_revision_columns_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='zoi.home_designs'::regclass AND attname='workspace_id'AND NOT attisdropped AND format_type(atttypid,atttypmod)='uuid'AND attnotnull=true)THEN RAISE EXCEPTION 'business_private_revision_columns_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='zoi.home_designs'::regclass AND attname='version'AND NOT attisdropped AND format_type(atttypid,atttypmod)='integer'AND attnotnull=true)THEN RAISE EXCEPTION 'business_private_revision_columns_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='zoi.home_designs'::regclass AND attname='draft'AND NOT attisdropped AND format_type(atttypid,atttypmod)='jsonb'AND attnotnull=true)THEN RAISE EXCEPTION 'business_private_revision_columns_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='zoi.home_designs'::regclass AND attname='published'AND NOT attisdropped AND format_type(atttypid,atttypmod)='jsonb'AND attnotnull=false)THEN RAISE EXCEPTION 'business_private_revision_columns_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='zoi.home_designs'::regclass AND attname='published_version'AND NOT attisdropped AND format_type(atttypid,atttypmod)='integer'AND attnotnull=false)THEN RAISE EXCEPTION 'business_private_revision_columns_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='zoi.home_designs'::regclass AND attname='updated_at'AND NOT attisdropped AND format_type(atttypid,atttypmod)='timestamp with time zone'AND attnotnull=true)THEN RAISE EXCEPTION 'business_private_revision_columns_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='zoi.home_designs'::regclass AND attname='staged'AND NOT attisdropped AND format_type(atttypid,atttypmod)='boolean'AND attnotnull=true)THEN RAISE EXCEPTION 'business_private_revision_columns_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='zoi.home_designs'::regclass AND attname='draft_content'AND NOT attisdropped AND format_type(atttypid,atttypmod)='jsonb'AND attnotnull=true)THEN RAISE EXCEPTION 'business_private_revision_columns_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='zoi.home_designs'::regclass AND attname='published_content'AND NOT attisdropped AND format_type(atttypid,atttypmod)='jsonb'AND attnotnull=false)THEN RAISE EXCEPTION 'business_private_revision_columns_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='zoi.home_designs'::regclass AND attname='content_baseline'AND NOT attisdropped AND format_type(atttypid,atttypmod)='text'AND attnotnull=false)THEN RAISE EXCEPTION 'business_private_revision_columns_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='zoi.home_designs'::regclass AND attname='preview_receipt'AND NOT attisdropped AND format_type(atttypid,atttypmod)='jsonb'AND attnotnull=false)THEN RAISE EXCEPTION 'business_private_revision_columns_changed';END IF;
END $guard$;

-- One read-only source assembler, including inside the nonce-first Storage
-- policy. NO row/advisory locks, no owner getter/preview calls, no writes here.
-- Lock-taking entrypoints authorize and lock the listing first; final consume
-- recomputes this same source under that lock. Storage permission alone does not
-- freeze owner edits or make bytes eligible for final canonical consumption.
CREATE FUNCTION zoi.business_creative_current_entity(p_workspace uuid,p_listing uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE l zoi.listings;d zoi.home_designs;e jsonb;p jsonb;owner jsonb;content jsonb;identity jsonb;revision jsonb;
BEGIN
 SELECT *INTO l FROM zoi.listings WHERE id=p_listing AND owner_workspace_id=p_workspace;
 IF l.id IS NULL THEN RETURN NULL;END IF;
 e:=public.home_entity(l.slug);
 IF e IS NOT NULL THEN RETURN e;END IF;
 -- A distinct owner-private branch, never a visibility override or archived
 -- fixture adoption. Other blocked/moderated states stay unavailable.
 IF l.publish_status IS DISTINCT FROM'draft'OR coalesce(l.moderation_status,'')NOT IN('clean','cleared')THEN RETURN NULL;END IF;
 IF current_setting('transaction_isolation')IS DISTINCT FROM'read committed'THEN RAISE EXCEPTION 'business_private_isolation_unsupported';END IF;
 SELECT *INTO d FROM zoi.home_designs WHERE listing_id=p_listing AND workspace_id=p_workspace;
 p:=coalesce(l.profile,'{}')-'_coverage';IF p?'_enrich'THEN p:=jsonb_set(p,'{_enrich}',(p->'_enrich')-'lease');END IF;
 owner:=coalesce(zoi.public_owner_content(l.id),'{}');
 -- Exact canonical bizpage_get base values + current identity. Do not invoke
 -- its locking authorization from Storage INSERT after the nonce lock.
 e:=jsonb_build_object('id',l.id,'name',l.name,'slug',l.slug,'path',coalesce(l.canonical_path,'/p/'||l.slug),'description',l.description,'phone',l.phone,'email',l.email,'website',l.website,'hours',l.hours,'price_range',l.price_range,'photo_url',l.photo_url,'social_links',coalesce(l.social_links,'{}'));
 identity:=jsonb_build_object('id',l.id,'name',l.name,'slug',l.slug,'canonical_slug',l.slug,'address',l.address,'city',l.city,'country',l.country,'entity_type',l.entity_type,'category_slug',(SELECT slug FROM zoi.categories WHERE id=l.primary_category_id),'primary_category_id',l.primary_category_id,'owner_workspace_id',l.owner_workspace_id,'owner_user_id',to_jsonb(l)->'owner_user_id','claim_status',to_jsonb(l)->'claim_status','publish_status',l.publish_status,'moderation_status',l.moderation_status,'marketplace_status',l.marketplace_status);
 IF coalesce(d.staged,false)THEN
  IF d.content_baseline IS DISTINCT FROM zoi.home_revision_baseline(l)THEN RAISE EXCEPTION 'business_private_revision_stale';END IF;
  content:=d.draft_content;
  IF jsonb_typeof(content->'base')IS DISTINCT FROM'object'OR jsonb_typeof(content->'profile')IS DISTINCT FROM'object'THEN RAISE EXCEPTION 'business_private_revision_invalid';END IF;
  -- Same authored null/removal precedence as home_revision_preview_data;
  -- no preview receipt mutation and no synthetic published/visible flags.
  p:=(p-ARRAY(SELECT jsonb_array_elements_text(coalesce(content->'profile_remove','[]'))))||(content->'profile');
  owner:=owner||(content->'base')||jsonb_build_object('profile',(coalesce(owner->'profile','{}')-ARRAY(SELECT jsonb_array_elements_text(coalesce(content->'profile_remove','[]'))))||(content->'profile'));
  e:=e||(content->'base');
  IF content->>'media_remove'='true'THEN p:=p-'owner_media';END IF;
  IF content?'media'THEN p:=jsonb_set(p,'{owner_media}',jsonb_build_object('version',coalesce((l.profile#>>'{owner_media,version}')::integer,0)+1,'items',content->'media'));END IF;
 END IF;
 revision:=jsonb_build_object('type','owner_private_draft','schema',1,'workspace',p_workspace,'listing',l.id,'content_version',zoi.home_content_version(l),'baseline',zoi.home_revision_baseline(l),'staged',coalesce(d.staged,false),'revision',coalesce(d.version,0),'revision_baseline',d.content_baseline);
 e:=e||identity||jsonb_build_object('profile',p,'owner_content',owner,'_creative_source',revision);
 IF octet_length(e::text)>300000 THEN RAISE EXCEPTION 'business_private_source_too_large';END IF;
 RETURN e;
END$$;
CREATE FUNCTION zoi.business_creative_current_source(p_workspace uuid,p_listing uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
BEGIN RETURN zoi.business_creative_source(zoi.business_creative_current_entity(p_workspace,p_listing));
EXCEPTION WHEN raise_exception THEN
 -- A historical immutable receipt remains readable under current owner/Auth
 -- authority even if its current private source is unavailable. Never call it
 -- current, and never mask unknown SQL/authority/isolation errors.
 IF SQLERRM IN('business_private_revision_stale','business_private_revision_invalid','business_private_source_too_large')THEN RETURN NULL;END IF;RAISE;
END$$;
CREATE FUNCTION public.business_creative_source_get(p_workspace uuid,p_listing uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE s jsonb;e jsonb;source jsonb;kind text;
BEGIN
 PERFORM zoi.assert_workspace_write(p_workspace);PERFORM zoi.home_content_authorize(p_workspace,p_listing);PERFORM zoi.suite_current_session();
 s:=public.home_content_get(p_workspace,p_listing);
 e:=zoi.business_creative_current_entity(p_workspace,p_listing);
 IF e IS NULL OR e->>'id'IS DISTINCT FROM p_listing::text THEN RAISE EXCEPTION 'business_creative_listing_unavailable';END IF;
 kind:=CASE WHEN e?'_creative_source'THEN'owner_private_draft'ELSE'published_reference'END;
 IF kind='owner_private_draft'AND e#>>'{_creative_source,content_version}'IS DISTINCT FROM s->>'version'THEN RAISE EXCEPTION 'business_private_source_changed';END IF;
 source:=zoi.business_creative_source(e);
 IF octet_length(source::text)>64000 THEN RAISE EXCEPTION 'business_private_source_too_large';END IF;
 PERFORM zoi.assert_workspace_write(p_workspace);PERFORM zoi.home_content_authorize(p_workspace,p_listing);PERFORM zoi.suite_current_session();
 RETURN jsonb_build_object('ok',true,'workspace_id',p_workspace,'listing_id',p_listing,'source_type',kind,'entity',e,'source',source);
END$$;
REVOKE ALL ON FUNCTION zoi.business_creative_current_entity(uuid,uuid),zoi.business_creative_current_source(uuid,uuid),public.business_creative_source_get(uuid,uuid)FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.business_creative_source_get(uuid,uuid)TO authenticated;

CREATE OR REPLACE FUNCTION zoi.business_creative_project_layer(p_value jsonb,p_kind text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE value jsonb:='{}';keys text[];k text;
BEGIN
 IF jsonb_typeof(p_value)IS DISTINCT FROM'object'THEN RETURN p_value;END IF;
 keys:=CASE p_kind WHEN 'top'THEN ARRAY['_creative_source','id','name','slug','entity_type','category_slug','primary_category_id','owner_user_id','owner_workspace_id','claim_status','reviewed_food_receipt_current','address','city','country','publish_status','moderation_status','marketplace_status','description','biography','bio','excerpt','photo_url','hero_url','photo','photo_urls','photos','gallery','logo_url','logo','brand','website','hero_kind']::text[] WHEN 'enrich'THEN ARRAY['description','biography','bio','excerpt','photo_url','hero_url','photo','photo_urls','photos','gallery','logo_url','logo','brand','website','hero_kind','source_url','source_identity','source_kind','identity_scope','source_scope_mismatch','source_challenge','challenge','scope_review_required','organization_identity_quarantine','blocked','blocked_reason','crawl_status','status','last_error','source_affiliation','member','association_member','publisher_source_evidence','photo_roles']::text[] WHEN 'provenance'THEN ARRAY['description','biography','bio','excerpt','photo_url','hero_url','photo','photo_urls','photos','gallery','logo_url','logo','brand','website','hero_kind','source_identity']::text[] ELSE ARRAY['description','biography','bio','excerpt','photo_url','hero_url','photo','photo_urls','photos','gallery','logo_url','logo','brand','website','hero_kind']::text[] END;
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

CREATE OR REPLACE FUNCTION zoi.business_creative_receipt(p_workspace uuid,p_listing uuid,p_request uuid)
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
 IF slug IS NOT NULL THEN source:=zoi.business_creative_current_source(p_workspace,p_listing);END IF;
 PERFORM zoi.suite_current_session();
 RETURN jsonb_build_object('ok',true,'actor',auth.uid(),'workspace',p_workspace,'listing',p_listing,'request',p_request,
 'state',CASE WHEN r.state='saved'AND p IS NULL THEN 'removed'ELSE r.state END,
 'post_id',r.post_id,'snapshot',r.post_snapshot,'post',p,'source_current',source IS NOT DISTINCT FROM r.payload->'source');
END$$;

CREATE OR REPLACE FUNCTION public.business_creative_draft_save(p_workspace uuid,p_listing uuid,p_request uuid,p_payload jsonb)
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
 source:=zoi.business_creative_current_source(p_workspace,p_listing);
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
 meta:=(p_payload->'meta')||jsonb_build_object('client_listing_id',p_listing,'business_creative',jsonb_build_object('kind',CASE WHEN p_payload#>>'{source,_creative_source,type}'='owner_private_draft'THEN'owner_private_business_reference'ELSE'published_business_reference'END,'listing',p_listing,'request',p_request,'source_hash',encode(sha256(convert_to(source::text,'UTF8')),'hex'),'rights_confirmed',true));
 SELECT *INTO post FROM public.social_save_post(p_workspace,p_payload->>'body',ARRAY[]::text[],NULL,'draft',p_payload->'media',NULL,meta,target);
 PERFORM zoi.assert_workspace_write(p_workspace);
 PERFORM zoi.home_content_authorize(p_workspace,p_listing);
 IF post.id IS NULL OR post.workspace_id IS DISTINCT FROM p_workspace OR post.status IS DISTINCT FROM'draft'OR post.scheduled_at IS NOT NULL OR post.body IS DISTINCT FROM p_payload->>'body'OR post.media IS DISTINCT FROM p_payload->'media'OR post.meta IS DISTINCT FROM meta OR post.channels IS DISTINCT FROM ARRAY[]::text[] THEN RAISE EXCEPTION 'business_creative_save_unconfirmed';END IF;
 INSERT INTO zoi.business_creative_requests(request_id,actor_auth,workspace_id,listing_id,state,payload,post_id,post_snapshot)VALUES(p_request,auth.uid(),p_workspace,p_listing,'saved',p_payload,post.id,to_jsonb(post));
 RETURN zoi.business_creative_receipt(p_workspace,p_listing,p_request);
END$$;

CREATE OR REPLACE FUNCTION public.business_creative_draft_get(p_workspace uuid,p_post uuid)
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
 source:=zoi.business_creative_current_source(p_workspace,r.listing_id);
 SELECT payload->'source'INTO original FROM zoi.business_creative_requests WHERE post_id=p_post AND workspace_id=p_workspace AND listing_id=r.listing_id AND state='saved'ORDER BY created_at,request_id LIMIT 1;
 PERFORM zoi.suite_current_session();
 RETURN jsonb_build_object('ok',true,'workspace',p_workspace,'listing',r.listing_id,'post',to_jsonb(p),'source',r.payload->'source','original_source',original,'source_current',source IS NOT DISTINCT FROM r.payload->'source');
END$$;

CREATE OR REPLACE FUNCTION zoi.studio_render_context(ws uuid,listing uuid,request uuid,payload jsonb)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
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
 source:=zoi.business_creative_current_source(ws,listing);
 IF source IS NULL OR source->>'id'IS DISTINCT FROM listing::text OR source IS DISTINCT FROM payload->'source'OR octet_length(source::text)>64000 THEN RAISE EXCEPTION 'business_creative_source_changed';END IF;
 RETURN jsonb_build_object('actor',auth.uid(),'session',(auth.jwt()->>'session_id')::uuid,'hash',encode(sha256(convert_to(payload::text,'UTF8')),'hex'),'source_hash',encode(sha256(convert_to(source::text,'UTF8')),'hex'));
END$$;

CREATE OR REPLACE FUNCTION zoi.studio_media_insert_allowed(bucket text,path text)RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
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
 source:=zoi.business_creative_current_source(g.workspace_id,g.listing_id);
 RETURN encode(sha256(convert_to(source::text,'UTF8')),'hex')IS NOT DISTINCT FROM g.data->>'source_hash';
EXCEPTION WHEN OTHERS THEN RETURN false;
END$$;

CREATE OR REPLACE FUNCTION zoi.business_creative_destination_context(p_workspace uuid,p_post uuid,p_request uuid DEFAULT NULL)
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
 source:=zoi.business_creative_current_source(p_workspace,r.listing_id);
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

CREATE OR REPLACE FUNCTION public.business_creative_destinations_recover(p_workspace uuid,p_post uuid,p_request uuid,p_cancel_if_missing boolean DEFAULT false)
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
 source:=zoi.business_creative_current_source(p_workspace,r.listing_id);
 PERFORM zoi.assert_workspace_write(p_workspace);PERFORM zoi.home_content_authorize(p_workspace,r.listing_id);PERFORM zoi.suite_current_session();
 RETURN jsonb_build_object('ok',true,'actor',auth.uid(),'workspace',p_workspace,'post_id',p_post,'request',p_request,'state',CASE WHEN p.id IS NULL THEN'removed'ELSE'saved'END,'operation_kind',r.payload->>'kind','snapshot',r.post_snapshot,'current_post',CASE WHEN p.id IS NULL THEN NULL ELSE to_jsonb(p)END,'current_matches_snapshot',p.id IS NOT NULL AND to_jsonb(p)=r.post_snapshot,'source_current',source IS NOT DISTINCT FROM r.payload->'source');
END$$;

CREATE OR REPLACE FUNCTION public.business_creative_render_save(p_workspace uuid,p_listing uuid,p_request uuid,p_payload jsonb)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
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
 meta:=(p_payload->'meta')||jsonb_build_object('client_listing_id',p_listing,'business_creative',jsonb_build_object('kind',CASE WHEN p_payload#>>'{source,_creative_source,type}'='owner_private_draft'THEN'owner_private_business_image_composition'ELSE'published_business_image_composition'END,'listing',p_listing,'request',p_request,'source_hash',context->>'source_hash','rights_confirmed',true),'creative_composition',parts||jsonb_build_object('schema',1,'recipe',p_payload->'render'->'recipe','rights_confirmed',true));
 SELECT *INTO saved FROM public.social_save_post(p_workspace,p_payload->>'body',ARRAY[]::text[],NULL,'draft',media,NULL,meta,target);
 PERFORM zoi.assert_workspace_write(p_workspace);PERFORM zoi.home_content_authorize(p_workspace,p_listing);
 IF saved.id IS NULL OR saved.workspace_id IS DISTINCT FROM p_workspace OR saved.status IS DISTINCT FROM'draft'OR saved.scheduled_at IS NOT NULL OR saved.channels IS DISTINCT FROM ARRAY[]::text[]OR saved.body IS DISTINCT FROM p_payload->>'body'OR saved.media IS DISTINCT FROM media OR saved.meta IS DISTINCT FROM meta THEN RAISE EXCEPTION 'business_creative_save_unconfirmed';END IF;
 INSERT INTO zoi.business_creative_requests(request_id,actor_auth,workspace_id,listing_id,state,payload,post_id,post_snapshot)VALUES(p_request,auth.uid(),p_workspace,p_listing,'saved',p_payload,saved.id,to_jsonb(saved));
 RETURN zoi.business_creative_receipt(p_workspace,p_listing,p_request);
END$$;
NOTIFY pgrst,'reload schema';
COMMIT;

BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
-- Existing design lifecycle is the only private home revision authority.
ALTER TABLE zoi.home_designs ADD COLUMN staged boolean NOT NULL DEFAULT false,
 ADD COLUMN draft_content jsonb NOT NULL DEFAULT '{"base":{},"profile":{}}',
 ADD COLUMN published_content jsonb, ADD COLUMN content_baseline text, ADD COLUMN preview_receipt jsonb;
ALTER TABLE zoi.home_design_history ADD COLUMN content jsonb;
CREATE FUNCTION zoi.home_revision_content_valid(p_base jsonb,p_profile jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE k text;sec jsonb;item jsonb;BEGIN
 IF jsonb_typeof(p_base) IS DISTINCT FROM 'object' OR jsonb_typeof(p_profile) IS DISTINCT FROM 'object' OR octet_length(jsonb_build_object('base',p_base,'profile',p_profile)::text)>200000 THEN RAISE EXCEPTION 'invalid_content';END IF;
 FOR k IN SELECT jsonb_object_keys(p_base)LOOP
 IF k NOT IN('description','phone','email','website','hours','price_range','photo_url','social_links')THEN RAISE EXCEPTION 'unsupported_base_field';END IF;
 IF k<>'social_links' AND p_base->k<>'null'::jsonb AND (jsonb_typeof(p_base->k)<>'string' OR length(p_base->>k)>6000)THEN RAISE EXCEPTION 'invalid_base_value';END IF;
 END LOOP;
 IF p_base?'social_links' AND jsonb_typeof(p_base->'social_links') NOT IN('object','null')THEN RAISE EXCEPTION 'invalid_social_links';END IF;
 PERFORM zoi.assert_hospitality_catalog(p_profile);
 -- Profile keys are limited to actual currently supported vertical form fields.
 FOR k IN SELECT jsonb_object_keys(p_profile)LOOP
 IF k NOT IN('hero_url','logo_url','hero_position','logo_fit','photo_urls','tagline','tagline_el','about','about_el','languages','service_areas','hours','services','patronal_feast','clergy','ministries','sacraments','stewardship_url','festival','cuisine','menu','menu_url','menu_updated','specials','reserve_url','order_url','catering','price_range','practice_areas','registrations','consult','consult_fee','booking_url','programs','enrolment','tuition','exam_prep','enrol_url','origin','founded','membership','membership_url','meetings','scholarships','give_url','spotify_url','apple_music_url','youtube_url','bandcamp_url','soundcloud_url','embeds','releases','tour','booking_name','booking_email','press','press_kit_url','merch','message','featured_content','upcoming','work','rate_card_url','collab_email','spaces','hire_enquiry_url','catering_model','starts','ends','venue_name','tickets_url','lineup','admission','highlights','event_publicity','rooms','dining','venues','amenities') THEN RAISE EXCEPTION 'unsupported_profile_field';END IF;
 END LOOP;
 IF p_profile?'event_publicity' AND NOT zoi.event_publicity_valid(p_profile->'event_publicity') THEN RAISE EXCEPTION 'invalid_event_publicity';END IF;
 IF p_profile?'menu' AND p_profile->'menu'<>'null'::jsonb THEN
 IF jsonb_typeof(p_profile->'menu')<>'array' OR jsonb_array_length(p_profile->'menu')>20 THEN RAISE EXCEPTION 'invalid_menu_sections';END IF;
 FOR sec IN SELECT value FROM jsonb_array_elements(p_profile->'menu')LOOP
 IF jsonb_typeof(sec)<>'object' OR length(coalesce(sec->>'section','')) NOT BETWEEN 1 AND 100 OR jsonb_typeof(sec->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(sec->'items')>100 THEN RAISE EXCEPTION 'invalid_menu_section';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(sec->'items')LOOP
 IF jsonb_typeof(item)<>'object' OR length(coalesce(item->>'name','')) NOT BETWEEN 1 AND 160 OR length(coalesce(item->>'price',''))>100 OR length(coalesce(item->>'note',''))>600 THEN RAISE EXCEPTION 'invalid_menu_item';END IF;
 END LOOP;END LOOP;END IF;
 IF p_profile?'specials' AND p_profile->'specials'<>'null'::jsonb THEN
 IF jsonb_typeof(p_profile->'specials')<>'array' OR jsonb_array_length(p_profile->'specials')>50 THEN RAISE EXCEPTION 'invalid_promotions';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_profile->'specials')LOOP
 IF jsonb_typeof(item)<>'object' OR length(coalesce(item->>'name','')) NOT BETWEEN 1 AND 160 OR length(coalesce(item->>'when',''))>160 OR length(coalesce(item->>'price',''))>100 OR length(coalesce(item->>'note',''))>600 THEN RAISE EXCEPTION 'invalid_promotion';END IF;
 END LOOP;END IF;
 RETURN true; END $$;
REVOKE ALL ON FUNCTION zoi.home_revision_content_valid(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION zoi.home_revision_profile_snapshot(p jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
SELECT coalesce(jsonb_object_agg(k,v),'{}') FROM jsonb_each(coalesce(p,'{}'))x(k,v) WHERE k IN ('hero_url','logo_url','hero_position','logo_fit','photo_urls','tagline','tagline_el','about','about_el','languages','service_areas','hours','services','patronal_feast','clergy','ministries','sacraments','stewardship_url','festival','cuisine','menu','menu_url','menu_updated','specials','reserve_url','order_url','catering','price_range','practice_areas','registrations','consult','consult_fee','booking_url','programs','enrolment','tuition','exam_prep','enrol_url','origin','founded','membership','membership_url','meetings','scholarships','give_url','spotify_url','apple_music_url','youtube_url','bandcamp_url','soundcloud_url','embeds','releases','tour','booking_name','booking_email','press','press_kit_url','merch','message','featured_content','upcoming','work','rate_card_url','collab_email','spaces','hire_enquiry_url','catering_model','starts','ends','venue_name','tickets_url','lineup','admission','highlights','event_publicity','rooms','dining','venues','amenities');
$$;
REVOKE ALL ON FUNCTION zoi.home_revision_profile_snapshot(jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION zoi.home_revision_guard(p_workspace uuid,p_listing uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;BEGIN
 actor:=zoi.home_content_authorize(p_workspace,p_listing);
 IF EXISTS(SELECT 1 FROM zoi.home_designs WHERE workspace_id=p_workspace AND listing_id=p_listing AND staged) THEN RAISE EXCEPTION 'home_revision_required';END IF;
 RETURN actor;
END $$;
REVOKE ALL ON FUNCTION zoi.home_revision_guard(uuid,uuid) FROM PUBLIC,anon,authenticated;
-- Preserve original ACLs/comments on the private originals for reviewed rollback.
DO $backup$
DECLARE f record;meta jsonb;BEGIN
 FOR f IN SELECT p.oid,p.proacl,p.proowner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('home_content_get','home_content_save','home_media_save','home_design_change','bizpage_save','bizpage_save_profile') LOOP
  meta:=jsonb_build_object('previous_comment',obj_description(f.oid,'pg_proc'),'acl',(SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee)END,'privilege',x.privilege_type,'grantable',x.is_grantable))FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))x));
  EXECUTE format('COMMENT ON FUNCTION %s IS %L',f.oid::regprocedure,meta::text);
 END LOOP;
END $backup$;
ALTER FUNCTION public.home_content_save(uuid,uuid,text,uuid,jsonb,jsonb) RENAME TO home_content_save_before_revision;
ALTER FUNCTION public.home_content_save_before_revision(uuid,uuid,text,uuid,jsonb,jsonb) SET SCHEMA zoi;
REVOKE ALL ON FUNCTION zoi.home_content_save_before_revision(uuid,uuid,text,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.home_content_save(p_workspace uuid,p_listing uuid,p_expected_version text,p_request uuid,p_base jsonb DEFAULT '{}',p_profile jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;result jsonb;BEGIN actor:=zoi.home_content_authorize(p_workspace,p_listing);IF NOT EXISTS(SELECT 1 FROM zoi.home_content_requests WHERE actor_id=actor AND request_id=p_request AND workspace_id=p_workspace AND listing_id=p_listing) THEN PERFORM zoi.home_revision_guard(p_workspace,p_listing);END IF;result:=zoi.home_content_save_before_revision(p_workspace,p_listing,p_expected_version,p_request,p_base,p_profile);PERFORM zoi.home_content_authorize(p_workspace,p_listing);RETURN result;END $$;
REVOKE ALL ON FUNCTION public.home_content_save(uuid,uuid,text,uuid,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.home_content_save(uuid,uuid,text,uuid,jsonb,jsonb) TO authenticated;
ALTER FUNCTION public.home_media_save(uuid,uuid,integer,uuid,jsonb) RENAME TO home_media_save_before_revision;
ALTER FUNCTION public.home_media_save_before_revision(uuid,uuid,integer,uuid,jsonb) SET SCHEMA zoi;
REVOKE ALL ON FUNCTION zoi.home_media_save_before_revision(uuid,uuid,integer,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.home_media_save(p_workspace uuid,p_listing uuid,p_expected_version integer,p_request uuid,p_items jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;result jsonb;BEGIN actor:=zoi.home_content_authorize(p_workspace,p_listing);IF NOT EXISTS(SELECT 1 FROM zoi.home_media_requests WHERE actor_id=actor AND request_id=p_request AND workspace_id=p_workspace AND listing_id=p_listing) THEN PERFORM zoi.home_revision_guard(p_workspace,p_listing);END IF;result:=zoi.home_media_save_before_revision(p_workspace,p_listing,p_expected_version,p_request,p_items);PERFORM zoi.home_content_authorize(p_workspace,p_listing);RETURN result;END $$;
REVOKE ALL ON FUNCTION public.home_media_save(uuid,uuid,integer,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.home_media_save(uuid,uuid,integer,uuid,jsonb) TO authenticated;
ALTER FUNCTION public.home_design_change(uuid,uuid,uuid,integer,text,jsonb,integer) RENAME TO home_design_change_before_revision;
ALTER FUNCTION public.home_design_change_before_revision(uuid,uuid,uuid,integer,text,jsonb,integer) SET SCHEMA zoi;
REVOKE ALL ON FUNCTION zoi.home_design_change_before_revision(uuid,uuid,uuid,integer,text,jsonb,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.home_design_change(p_workspace uuid,p_listing uuid,p_request uuid,p_expected_version integer,p_action text,p_design jsonb DEFAULT null,p_restore_version integer DEFAULT null) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;result jsonb;BEGIN actor:=zoi.home_content_authorize(p_workspace,p_listing);IF NOT EXISTS(SELECT 1 FROM zoi.home_design_requests WHERE actor_id=actor AND request_id=p_request AND payload->>'workspace'=p_workspace::text AND payload->>'listing'=p_listing::text) THEN PERFORM zoi.home_revision_guard(p_workspace,p_listing);END IF;result:=zoi.home_design_change_before_revision(p_workspace,p_listing,p_request,p_expected_version,p_action,p_design,p_restore_version);PERFORM zoi.home_content_authorize(p_workspace,p_listing);RETURN result;END $$;
REVOKE ALL ON FUNCTION public.home_design_change(uuid,uuid,uuid,integer,text,jsonb,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.home_design_change(uuid,uuid,uuid,integer,text,jsonb,integer) TO authenticated;
ALTER FUNCTION public.bizpage_save(uuid,uuid,text,text,text,text,text,text,text,jsonb) RENAME TO bizpage_save_before_revision;
ALTER FUNCTION public.bizpage_save_before_revision(uuid,uuid,text,text,text,text,text,text,text,jsonb) SET SCHEMA zoi;
REVOKE ALL ON FUNCTION zoi.bizpage_save_before_revision(uuid,uuid,text,text,text,text,text,text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.bizpage_save(p_workspace uuid,p_listing uuid,p_description text,p_phone text,p_email text,p_website text,p_hours text,p_price_range text,p_photo_url text,p_social jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result boolean;BEGIN PERFORM zoi.home_revision_guard(p_workspace,p_listing);result:=zoi.bizpage_save_before_revision(p_workspace,p_listing,p_description,p_phone,p_email,p_website,p_hours,p_price_range,p_photo_url,p_social);PERFORM zoi.home_content_authorize(p_workspace,p_listing);RETURN result;END $$;
REVOKE ALL ON FUNCTION public.bizpage_save(uuid,uuid,text,text,text,text,text,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bizpage_save(uuid,uuid,text,text,text,text,text,text,text,jsonb) TO authenticated;
ALTER FUNCTION public.bizpage_save_profile(uuid,uuid,jsonb) RENAME TO bizpage_save_profile_before_revision;
ALTER FUNCTION public.bizpage_save_profile_before_revision(uuid,uuid,jsonb) SET SCHEMA zoi;
REVOKE ALL ON FUNCTION zoi.bizpage_save_profile_before_revision(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.bizpage_save_profile(p_workspace uuid,p_listing uuid,p_profile jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result boolean;BEGIN PERFORM zoi.home_revision_guard(p_workspace,p_listing);result:=zoi.bizpage_save_profile_before_revision(p_workspace,p_listing,p_profile);PERFORM zoi.home_content_authorize(p_workspace,p_listing);RETURN result;END $$;
REVOKE ALL ON FUNCTION public.bizpage_save_profile(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bizpage_save_profile(uuid,uuid,jsonb) TO authenticated;
-- Identity changes must invalidate a saved preview without changing legacy CAS.
CREATE FUNCTION zoi.home_revision_baseline(l zoi.listings) RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT md5(jsonb_build_array(zoi.home_content_version(l),to_jsonb(l)->'name',to_jsonb(l)->'entity_type',to_jsonb(l)->'primary_category_id',to_jsonb(l)->'slug',to_jsonb(l)->'canonical_path',to_jsonb(l)->'address',to_jsonb(l)->'city',to_jsonb(l)->'region',to_jsonb(l)->'country',to_jsonb(l)->'place_id',to_jsonb(l)->'latitude',to_jsonb(l)->'longitude',to_jsonb(l)->'publish_status',to_jsonb(l)->'moderation_status',to_jsonb(l)->'marketplace_status')::text);
$$;
REVOKE ALL ON FUNCTION zoi.home_revision_baseline(zoi.listings) FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.home_content_get(uuid,uuid) RENAME TO home_content_get_before_revision;
ALTER FUNCTION public.home_content_get_before_revision(uuid,uuid) SET SCHEMA zoi;
REVOKE ALL ON FUNCTION zoi.home_content_get_before_revision(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.home_content_get(p_workspace uuid,p_listing uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RETURN zoi.home_content_get_before_revision(p_workspace,p_listing)||jsonb_build_object('home_revision_schema',1,'home_revision_staged',EXISTS(SELECT 1 FROM zoi.home_designs WHERE workspace_id=p_workspace AND listing_id=p_listing AND staged));END $$;
REVOKE ALL ON FUNCTION public.home_content_get(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.home_content_get(uuid,uuid) TO authenticated;
-- Keep existing named-role execute grants on compatible public wrappers.
-- PUBLIC/anon stay revoked; every call is independently account/owner scoped.
DO $wrapper_acl$
DECLARE f record;item jsonb;name text;BEGIN
 FOR f IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='zoi'AND p.proname IN('home_content_get_before_revision','home_content_save_before_revision','home_media_save_before_revision','home_design_change_before_revision','bizpage_save_before_revision','bizpage_save_profile_before_revision')LOOP
  name:=replace(f.proname,'_before_revision','');
  FOR item IN SELECT value FROM jsonb_array_elements(obj_description(f.oid,'pg_proc')::jsonb->'acl')LOOP
   IF item->>'grantee' NOT IN('PUBLIC','anon')THEN EXECUTE format('GRANT %s ON FUNCTION public.%I(%s) TO %I%s',item->>'privilege',name,pg_get_function_identity_arguments(f.oid),item->>'grantee',CASE WHEN item->>'grantable'='true' THEN ' WITH GRANT OPTION' ELSE ''END);END IF;
  END LOOP;
 END LOOP;
END $wrapper_acl$;
CREATE FUNCTION public.home_revision_get(p_workspace uuid,p_listing uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;d zoi.home_designs;s jsonb;BEGIN
 actor:=zoi.home_content_authorize(p_workspace,p_listing);s:=public.home_content_get(p_workspace,p_listing);
 SELECT * INTO d FROM zoi.home_designs WHERE workspace_id=p_workspace AND listing_id=p_listing;
 RETURN jsonb_build_object('ok',true,'workspace_id',p_workspace,'listing_id',p_listing,'schema_version',1,'staged',coalesce(d.staged,false),'revision',coalesce(d.version,0),'baseline',d.content_baseline,'snapshot',s,'design',coalesce(d.draft,zoi.home_design_default()),'content',coalesce(d.draft_content,'{"base":{},"profile":{}}'),'items',zoi.home_design_items(p_workspace,p_listing),'can_publish',EXISTS(SELECT 1 FROM zoi.workspace_members WHERE workspace_id=p_workspace AND profile_id=actor AND role IN('owner','admin')),'history',(SELECT coalesce(jsonb_agg(h ORDER BY h.version DESC),'[]') FROM (SELECT version,published_at FROM zoi.home_design_history WHERE workspace_id=p_workspace AND listing_id=p_listing AND content IS NOT NULL ORDER BY version DESC LIMIT 30)h));
END $$;
CREATE FUNCTION public.home_revision_change(p_workspace uuid,p_listing uuid,p_request uuid,p_expected_revision integer,p_action text,p_content jsonb DEFAULT NULL,p_design jsonb DEFAULT NULL,p_restore_revision integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;d zoi.home_designs;l zoi.listings;prior zoi.home_design_requests;payload jsonb;receipt jsonb;value jsonb;design jsonb;baseline text;BEGIN
 actor:=zoi.home_content_authorize(p_workspace,p_listing);
 IF p_request IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0 OR p_action NOT IN('activate','save','restore','rebase') OR p_action IS NULL THEN RAISE EXCEPTION 'invalid_home_revision_request';END IF;
 SELECT * INTO l FROM zoi.listings WHERE id=p_listing;
 IF l.owner_workspace_id IS DISTINCT FROM p_workspace THEN RAISE EXCEPTION 'owned_listing_required';END IF;
 payload:=jsonb_build_object('workspace',p_workspace,'listing',p_listing,'revision',p_expected_revision,'action',p_action,'content',p_content,'design',p_design,'restore',p_restore_revision);
 SELECT * INTO prior FROM zoi.home_design_requests WHERE actor_id=actor AND request_id=p_request;
 IF FOUND THEN IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_payload_conflict';END IF;RETURN prior.receipt;END IF;
 IF (SELECT count(*) FROM zoi.home_design_requests WHERE actor_id=actor AND created_at>clock_timestamp()-interval '1 hour')>=120 THEN RAISE EXCEPTION 'home_revision_rate_limit';END IF;
 INSERT INTO zoi.home_designs(listing_id,workspace_id,draft)VALUES(p_listing,p_workspace,zoi.home_design_default())ON CONFLICT DO NOTHING;
 SELECT * INTO d FROM zoi.home_designs WHERE listing_id=p_listing AND workspace_id=p_workspace FOR UPDATE;
 IF d.version<>p_expected_revision THEN RAISE EXCEPTION 'home_revision_conflict';END IF;
 baseline:=zoi.home_revision_baseline(l);value:=d.draft_content;design:=d.draft;
 IF p_action='activate' THEN
  IF d.staged OR p_content IS NOT NULL OR p_design IS NOT NULL OR p_restore_revision IS NOT NULL THEN RAISE EXCEPTION 'invalid_home_revision_request';END IF;
  IF NOT EXISTS(SELECT 1 FROM zoi.workspace_members WHERE workspace_id=p_workspace AND profile_id=actor AND role IN('owner','admin'))THEN RAISE EXCEPTION 'not_authorized' USING errcode='42501';END IF;
 ELSIF NOT d.staged THEN RAISE EXCEPTION 'home_revision_not_active';
 ELSIF p_action='save' THEN
  IF jsonb_typeof(p_content) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_content)x WHERE x NOT IN('base','profile','media'))THEN RAISE EXCEPTION 'invalid_home_revision_content';END IF;
  value:=jsonb_build_object('base',coalesce(d.draft_content->'base','{}')||coalesce(p_content->'base','{}'),'profile',coalesce(d.draft_content->'profile','{}')||coalesce(p_content->'profile','{}'))||CASE WHEN p_content?'media' THEN jsonb_build_object('media',p_content->'media') WHEN d.draft_content?'media' THEN jsonb_build_object('media',d.draft_content->'media') ELSE '{}'::jsonb END;
  IF d.draft_content?'profile_remove' THEN value:=value||jsonb_build_object('profile_remove',(SELECT coalesce(jsonb_agg(x),'[]')FROM jsonb_array_elements_text(d.draft_content->'profile_remove')x WHERE NOT coalesce(p_content->'profile','{}')?x));END IF;
  IF d.draft_content?'media_remove' AND NOT p_content?'media' THEN value:=value||jsonb_build_object('media_remove',true);END IF;
  design:=coalesce(p_design,d.draft);
 ELSIF p_action='restore' THEN
  IF p_content IS NOT NULL OR p_design IS NOT NULL THEN RAISE EXCEPTION 'invalid_home_revision_request';END IF;
  SELECT content,h.design INTO value,design FROM zoi.home_design_history h WHERE workspace_id=p_workspace AND listing_id=p_listing AND version=p_restore_revision AND content IS NOT NULL;
  IF value IS NULL THEN RAISE EXCEPTION 'home_revision_history_unavailable';END IF;
  value:=value||jsonb_build_object('profile_remove',(SELECT coalesce(jsonb_agg(k),'[]')FROM jsonb_object_keys(zoi.home_revision_profile_snapshot(l.profile))k WHERE NOT (value->'profile')?k));
  IF NOT value?'media' AND l.profile?'owner_media' THEN value:=value||jsonb_build_object('media_remove',true);END IF;
  design:=jsonb_set(design,'{item_order,offerings}',coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(design#>'{item_order,offerings}')x WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(zoi.home_design_items(p_workspace,p_listing))i WHERE i->>'id'=x#>>'{}')),'[]'));
 ELSIF p_content IS NOT NULL OR p_design IS NOT NULL OR p_restore_revision IS NOT NULL THEN RAISE EXCEPTION 'invalid_home_revision_request';END IF;
 IF p_action='save' AND d.content_baseline IS DISTINCT FROM baseline THEN RAISE EXCEPTION 'home_revision_source_conflict';END IF;
 PERFORM zoi.home_revision_content_valid(value->'base',value->'profile');
 IF value?'media' AND NOT zoi.home_media_valid(value->'media') THEN RAISE EXCEPTION 'invalid_media_links';END IF;
 design:=zoi.home_design_validate(design,zoi.home_design_items(p_workspace,p_listing));
 UPDATE zoi.home_designs SET staged=true,draft=design,draft_content=value,content_baseline=baseline,preview_receipt=NULL,version=d.version+1,updated_at=clock_timestamp()WHERE listing_id=p_listing AND workspace_id=p_workspace RETURNING * INTO d;
 receipt:=jsonb_build_object('ok',true,'workspace_id',p_workspace,'listing_id',p_listing,'request_id',p_request,'action',p_action,'revision',d.version,'baseline',baseline);
 INSERT INTO zoi.home_design_requests(actor_id,request_id,payload,receipt)VALUES(actor,p_request,payload,receipt);RETURN receipt;
END $$;
-- Preview receipts bind authenticated workflow state to one saved revision.
-- They are not independent visual acceptance or an authorization boundary.
CREATE FUNCTION public.home_revision_preview_data(p_workspace uuid,p_listing uuid,p_revision integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;d zoi.home_designs;s jsonb;e jsonb;identity jsonb;token uuid:=gen_random_uuid();BEGIN
 actor:=zoi.home_content_authorize(p_workspace,p_listing);
 SELECT * INTO d FROM zoi.home_designs WHERE listing_id=p_listing AND workspace_id=p_workspace FOR UPDATE;
 IF NOT FOUND OR NOT d.staged OR d.version IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'home_revision_conflict';END IF;
 s:=public.home_content_get(p_workspace,p_listing);
 IF d.content_baseline IS DISTINCT FROM (SELECT zoi.home_revision_baseline(l)FROM zoi.listings l WHERE l.id=p_listing) THEN RAISE EXCEPTION 'home_revision_source_conflict';END IF;
 SELECT jsonb_build_object('name',l.name,'slug',l.slug,'canonical_slug',l.slug,'address',l.address,'city',l.city,'country',l.country)INTO identity FROM zoi.listings l WHERE l.id=p_listing;
 e:=(s->'base')||identity||(d.draft_content->'base')||jsonb_build_object('id',p_listing,'publish_status','published','marketplace_status','','profile',((s->'profile')-ARRAY(SELECT jsonb_array_elements_text(coalesce(d.draft_content->'profile_remove','[]'))))||(d.draft_content->'profile'),'entity_type',s->>'entity_type','category_slug',s->>'category_slug','owner_content',coalesce(s->'owner_content','{}')||(d.draft_content->'base')||jsonb_build_object('profile',(coalesce(s#>'{owner_content,profile}','{}')-ARRAY(SELECT jsonb_array_elements_text(coalesce(d.draft_content->'profile_remove','[]'))))||(d.draft_content->'profile')));
 IF d.draft_content->>'media_remove'='true' THEN e:=jsonb_set(e,'{profile}',(e->'profile')-'owner_media');END IF;
 IF d.draft_content?'media' THEN e:=jsonb_set(e,'{profile,owner_media}',jsonb_build_object('version',coalesce((s#>>'{profile,owner_media,version}')::integer,0)+1,'items',d.draft_content->'media'));END IF;
 UPDATE zoi.home_designs SET preview_receipt=jsonb_build_object('id',token,'actor',actor,'revision',p_revision,'baseline',d.content_baseline,'expires_at',clock_timestamp()+interval '30 minutes','renderer','home-revision-v1','ready',false)WHERE workspace_id=p_workspace AND listing_id=p_listing;
 RETURN jsonb_build_object('ok',true,'workspace_id',p_workspace,'listing_id',p_listing,'revision',p_revision,'preview_id',token,'entity',e,'design',d.draft);
END $$;
CREATE FUNCTION public.home_revision_preview_confirm(p_workspace uuid,p_listing uuid,p_revision integer,p_preview uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;BEGIN
 actor:=zoi.home_content_authorize(p_workspace,p_listing);
 UPDATE zoi.home_designs SET preview_receipt=jsonb_set(preview_receipt,'{ready}','true')WHERE workspace_id=p_workspace AND listing_id=p_listing AND staged AND version=p_revision AND preview_receipt->>'actor'=actor::text AND preview_receipt->>'id'=p_preview::text AND content_baseline=(SELECT zoi.home_revision_baseline(l)FROM zoi.listings l WHERE l.id=p_listing) AND (preview_receipt->>'expires_at')::timestamptz>clock_timestamp();
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.home_revision_preview_confirm(uuid,uuid,integer,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.home_revision_preview_confirm(uuid,uuid,integer,uuid) TO authenticated;
CREATE FUNCTION public.home_revision_publish(p_workspace uuid,p_listing uuid,p_request uuid,p_expected_revision integer,p_preview uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;d zoi.home_designs;l zoi.listings;prior zoi.home_design_requests;payload jsonb;receipt jsonb;content jsonb;ignored jsonb;BEGIN
 actor:=zoi.home_content_authorize(p_workspace,p_listing);
 IF NOT EXISTS(SELECT 1 FROM zoi.workspace_members WHERE workspace_id=p_workspace AND profile_id=actor AND role IN('owner','admin'))THEN RAISE EXCEPTION 'not_authorized' USING errcode='42501';END IF;
 IF p_request IS NULL OR p_expected_revision IS NULL OR p_preview IS NULL THEN RAISE EXCEPTION 'invalid_home_revision_request';END IF;
 payload:=jsonb_build_object('workspace',p_workspace,'listing',p_listing,'revision',p_expected_revision,'action','publish_revision','preview',p_preview);
 SELECT * INTO prior FROM zoi.home_design_requests WHERE actor_id=actor AND request_id=p_request;
 IF FOUND THEN IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_payload_conflict';END IF;RETURN prior.receipt;END IF;
 SELECT * INTO d FROM zoi.home_designs WHERE listing_id=p_listing AND workspace_id=p_workspace FOR UPDATE;
 SELECT * INTO l FROM zoi.listings WHERE id=p_listing;
 IF NOT FOUND OR NOT d.staged OR d.version IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'home_revision_conflict';END IF;
 IF l.owner_workspace_id IS DISTINCT FROM p_workspace THEN RAISE EXCEPTION 'owned_listing_required';END IF;
 IF d.content_baseline IS DISTINCT FROM zoi.home_revision_baseline(l) THEN RAISE EXCEPTION 'home_revision_source_conflict';END IF;
 IF d.preview_receipt->>'id' IS DISTINCT FROM p_preview::text OR d.preview_receipt->>'actor' IS DISTINCT FROM actor::text OR d.preview_receipt->>'ready' IS DISTINCT FROM 'true' OR d.preview_receipt->>'renderer' IS DISTINCT FROM 'home-revision-v1' OR (d.preview_receipt->>'expires_at')::timestamptz<=clock_timestamp() THEN RAISE EXCEPTION 'home_revision_preview_required';END IF;
 PERFORM zoi.home_revision_content_valid(d.draft_content->'base',d.draft_content->'profile');PERFORM zoi.home_design_validate(d.draft,zoi.home_design_items(p_workspace,p_listing));
 -- Private transaction-only switch permits existing validated writers; every
 -- legacy wrapper takes the listing lock first, so no outside writer sees it.
 UPDATE zoi.home_designs SET staged=false WHERE workspace_id=p_workspace AND listing_id=p_listing;
 ignored:=zoi.home_content_save_before_revision(p_workspace,p_listing,zoi.home_content_version(l),p_request,d.draft_content->'base',d.draft_content->'profile');
 IF d.draft_content?'media' THEN ignored:=zoi.home_media_save_before_revision(p_workspace,p_listing,coalesce((l.profile#>>'{owner_media,version}')::integer,0),p_request,d.draft_content->'media');END IF;
 IF d.draft_content?'profile_remove' THEN UPDATE zoi.listings SET profile=profile-ARRAY(SELECT jsonb_array_elements_text(d.draft_content->'profile_remove'))WHERE id=p_listing;END IF;
 IF d.draft_content->>'media_remove'='true' THEN UPDATE zoi.listings SET profile=profile-'owner_media'WHERE id=p_listing;END IF;
 SELECT * INTO l FROM zoi.listings WHERE id=p_listing;
 content:=jsonb_build_object('base',jsonb_build_object('description',l.description,'phone',l.phone,'email',l.email,'website',l.website,'hours',l.hours,'price_range',l.price_range,'photo_url',l.photo_url,'social_links',coalesce(l.social_links,'{}')),'profile',zoi.home_revision_profile_snapshot(l.profile))||CASE WHEN l.profile?'owner_media' THEN jsonb_build_object('media',l.profile#>'{owner_media,items}')ELSE '{}'::jsonb END;
 UPDATE zoi.home_designs SET staged=true,published=d.draft,published_version=d.version+1,version=d.version+1,published_content=content,draft_content='{"base":{},"profile":{}}',content_baseline=zoi.home_revision_baseline(l),preview_receipt=NULL,updated_at=clock_timestamp()WHERE listing_id=p_listing AND workspace_id=p_workspace;
 INSERT INTO zoi.home_design_history(listing_id,workspace_id,version,design,actor_id,content)VALUES(p_listing,p_workspace,d.version+1,d.draft,actor,content);
 receipt:=jsonb_build_object('ok',true,'workspace_id',p_workspace,'listing_id',p_listing,'request_id',p_request,'action','publish','revision',d.version+1,'published_revision',d.version+1,'content_version',zoi.home_content_version(l));
 INSERT INTO zoi.home_design_requests(actor_id,request_id,payload,receipt)VALUES(actor,p_request,payload,receipt);RETURN receipt;
END $$;
REVOKE ALL ON FUNCTION public.home_revision_get(uuid,uuid),public.home_revision_change(uuid,uuid,uuid,integer,text,jsonb,jsonb,integer),public.home_revision_preview_data(uuid,uuid,integer),public.home_revision_publish(uuid,uuid,uuid,integer,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.home_revision_get(uuid,uuid),public.home_revision_change(uuid,uuid,uuid,integer,text,jsonb,jsonb,integer),public.home_revision_preview_data(uuid,uuid,integer),public.home_revision_publish(uuid,uuid,uuid,integer,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

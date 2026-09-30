BEGIN;
CREATE TABLE zoi.home_content_requests(actor_id uuid NOT NULL REFERENCES zoi.user_profiles(id),request_id uuid NOT NULL,workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id),listing_id uuid NOT NULL REFERENCES zoi.listings(id),payload jsonb NOT NULL,receipt jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(actor_id,request_id));
ALTER TABLE zoi.home_content_requests ENABLE ROW LEVEL SECURITY;REVOKE ALL ON zoi.home_content_requests FROM PUBLIC,anon,authenticated;
CREATE FUNCTION zoi.home_content_authorize(p_workspace uuid,p_listing uuid)RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=zoi.org_actor();owner_ws uuid;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'not_authorized' USING errcode='42501';END IF;
 PERFORM 1 FROM zoi.user_profiles WHERE id=actor FOR UPDATE;
 PERFORM 1 FROM zoi.workspace_members WHERE workspace_id=p_workspace AND profile_id=actor AND role IN('owner','admin','editor')FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized' USING errcode='42501';END IF;
 SELECT owner_workspace_id INTO owner_ws FROM zoi.listings WHERE id=p_listing FOR UPDATE;
 IF NOT FOUND OR (owner_ws IS NOT NULL AND owner_ws<>p_workspace) OR NOT zoi.bizpage_can_edit(p_workspace,p_listing)THEN RAISE EXCEPTION 'no_access_to_listing' USING errcode='42501';END IF;
 IF owner_ws IS NULL THEN PERFORM 1 FROM zoi.listing_claims WHERE listing_id=p_listing AND workspace_id=p_workspace AND claim_status IN('approved','verified')FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'no_access_to_listing' USING errcode='42501';END IF;END IF;
 RETURN actor;
END $$;
CREATE FUNCTION zoi.home_content_version(l zoi.listings)RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT md5(jsonb_build_array(l.description,l.phone,l.email,l.website,l.hours,l.price_range,l.photo_url,l.social_links,l.owner_workspace_id,(coalesce(l.profile,'{}')-'_coverage'-'_geo'-'_meta'-'_enrich'),coalesce(l.profile->'_enrich','{}')-'lease')::text)
$$;
CREATE FUNCTION public.home_content_get(p_workspace uuid,p_listing uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l zoi.listings;p jsonb;
BEGIN PERFORM zoi.home_content_authorize(p_workspace,p_listing);SELECT * INTO l FROM zoi.listings WHERE id=p_listing;
 p:=coalesce(l.profile,'{}')-'_coverage';IF p?'_enrich' THEN p:=jsonb_set(p,'{_enrich}',(p->'_enrich')-'lease');END IF;
 RETURN jsonb_build_object('ok',true,'workspace_id',p_workspace,'listing_id',p_listing,'version',zoi.home_content_version(l),'base',public.bizpage_get(p_workspace,p_listing),'profile',p,'entity_type',l.entity_type,'category_slug',(SELECT slug FROM zoi.categories WHERE id=l.primary_category_id));
END $$;
CREATE FUNCTION public.home_content_save(p_workspace uuid,p_listing uuid,p_expected_version text,p_request uuid,p_base jsonb DEFAULT '{}',p_profile jsonb DEFAULT '{}')RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;l zoi.listings;prior zoi.home_content_requests;payload jsonb;receipt jsonb;b jsonb;k text;sec jsonb;item jsonb;
BEGIN
 actor:=zoi.home_content_authorize(p_workspace,p_listing);SELECT * INTO l FROM zoi.listings WHERE id=p_listing;
 IF p_request IS NULL THEN RAISE EXCEPTION 'request_required';END IF;
 payload:=jsonb_build_object('workspace',p_workspace,'listing',p_listing,'expected_version',p_expected_version,'base',p_base,'profile',p_profile);
 SELECT * INTO prior FROM zoi.home_content_requests WHERE actor_id=actor AND request_id=p_request;
 IF FOUND THEN IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_payload_conflict';END IF;RETURN prior.receipt;END IF;
 IF p_expected_version IS NULL OR p_expected_version IS DISTINCT FROM zoi.home_content_version(l) THEN RAISE EXCEPTION 'version_conflict';END IF;
 IF jsonb_typeof(p_base) IS DISTINCT FROM 'object' OR jsonb_typeof(p_profile) IS DISTINCT FROM 'object' OR octet_length(payload::text)>200000 THEN RAISE EXCEPTION 'invalid_content';END IF;
 FOR k IN SELECT jsonb_object_keys(p_base)LOOP
 IF k NOT IN('description','phone','email','website','hours','price_range','photo_url','social_links')THEN RAISE EXCEPTION 'unsupported_base_field';END IF;
 IF k<>'social_links' AND p_base->k<>'null'::jsonb AND (jsonb_typeof(p_base->k)<>'string' OR length(p_base->>k)>6000)THEN RAISE EXCEPTION 'invalid_base_value';END IF;
 END LOOP;
 IF p_base?'social_links' AND jsonb_typeof(p_base->'social_links') NOT IN('object','null')THEN RAISE EXCEPTION 'invalid_social_links';END IF;
 -- Profile keys are limited to actual currently supported vertical form fields.
 FOR k IN SELECT jsonb_object_keys(p_profile)LOOP
 IF k NOT IN('hero_url','logo_url','hero_position','logo_fit','photo_urls','tagline','tagline_el','about','about_el','languages','service_areas','hours','services','patronal_feast','clergy','ministries','sacraments','stewardship_url','festival','cuisine','menu','menu_url','menu_updated','specials','reserve_url','order_url','catering','price_range','practice_areas','registrations','consult','consult_fee','booking_url','programs','enrolment','tuition','exam_prep','enrol_url','origin','founded','membership','membership_url','meetings','scholarships','give_url','spotify_url','apple_music_url','youtube_url','bandcamp_url','soundcloud_url','embeds','releases','tour','booking_name','booking_email','press','press_kit_url','merch','message','featured_content','upcoming','work','rate_card_url','collab_email','spaces','hire_enquiry_url','catering_model','starts','ends','venue_name','tickets_url','lineup','admission','highlights') THEN RAISE EXCEPTION 'unsupported_profile_field';END IF;
 END LOOP;
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
 IF (SELECT count(*)FROM zoi.home_content_requests WHERE actor_id=actor AND created_at>now()-interval '1 hour')>=120 THEN RAISE EXCEPTION 'content_save_rate_limit';END IF;
 IF p_base<>'{}'::jsonb THEN
 b:=jsonb_build_object('description',l.description,'phone',l.phone,'email',l.email,'website',l.website,'hours',l.hours,'price_range',l.price_range,'photo_url',l.photo_url,'social_links',l.social_links)||p_base;
 IF public.bizpage_save(p_workspace,p_listing,b->>'description',b->>'phone',b->>'email',b->>'website',b->>'hours',b->>'price_range',b->>'photo_url',CASE WHEN b->'social_links'='null'::jsonb THEN '{}'::jsonb ELSE b->'social_links' END) IS DISTINCT FROM true THEN RAISE EXCEPTION 'base_save_not_confirmed';END IF;END IF;
 IF p_profile<>'{}'::jsonb AND public.bizpage_save_profile(p_workspace,p_listing,p_profile) IS DISTINCT FROM true THEN RAISE EXCEPTION 'profile_save_not_confirmed';END IF;
 SELECT * INTO l FROM zoi.listings WHERE id=p_listing;
 FOR k IN SELECT jsonb_object_keys(p_profile)LOOP IF l.profile->k IS DISTINCT FROM p_profile->k THEN RAISE EXCEPTION 'profile_save_not_confirmed';END IF;END LOOP;
 receipt:=jsonb_build_object('ok',true,'workspace_id',p_workspace,'listing_id',p_listing,'request_id',p_request,'version',zoi.home_content_version(l));
 INSERT INTO zoi.home_content_requests(actor_id,request_id,workspace_id,listing_id,payload,receipt)VALUES(actor,p_request,p_workspace,p_listing,payload,receipt);RETURN receipt;
END $$;
REVOKE ALL ON FUNCTION zoi.home_content_authorize(uuid,uuid),zoi.home_content_version(zoi.listings),public.home_content_get(uuid,uuid),public.home_content_save(uuid,uuid,text,uuid,jsonb,jsonb)FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.home_content_get(uuid,uuid),public.home_content_save(uuid,uuid,text,uuid,jsonb,jsonb)TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

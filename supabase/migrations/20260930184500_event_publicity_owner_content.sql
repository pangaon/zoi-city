BEGIN;
-- Extend the existing authorized/versioned owner content writer; no parallel store.
CREATE OR REPLACE FUNCTION zoi.event_publicity_valid(v jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE s jsonb; item jsonb; k text; a timestamptz; e timestamptz; ids text[]; u text;
BEGIN
 IF v='null'::jsonb THEN RETURN true; END IF;
 IF jsonb_typeof(v) IS DISTINCT FROM 'object' OR octet_length(v::text)>40000 OR jsonb_typeof(v->'event_url') IS DISTINCT FROM 'string' OR coalesce(v->>'event_url','') !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(/[^[:space:]]*)?$' THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(v) x WHERE x NOT IN('event_url','sales','highlights','posts')) THEN RETURN false;END IF;
 s:=v->'sales';IF s IS NOT NULL AND s<>'null'::jsonb THEN
 IF jsonb_typeof(s) IS DISTINCT FROM 'object' OR jsonb_typeof(s->'enabled') IS DISTINCT FROM 'boolean' OR jsonb_typeof(s->'count') IS DISTINCT FROM 'number' OR coalesce(s->>'count','')!~'^[0-9]{1,8}$' OR (s->>'count')::numeric>10000000 OR length(coalesce(s->>'label',''))>100 OR coalesce(s->>'source_url','')!~'^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(/[^[:space:]]*)?$' THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(s) x WHERE x NOT IN('enabled','count','label','source_url','as_of','expires_at')) OR EXISTS(SELECT 1 FROM jsonb_each(s) x(key_name,val) WHERE x.key_name IN('label','source_url','as_of','expires_at') AND jsonb_typeof(val) IS DISTINCT FROM 'string') THEN RETURN false; END IF;
 IF coalesce(s->>'as_of','')!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$' OR coalesce(s->>'expires_at','')!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$' THEN RETURN false; END IF;
 a:=(s->>'as_of')::timestamptz;e:=(s->>'expires_at')::timestamptz;IF e<=a OR e-a>interval '31 days' THEN RETURN false; END IF;
 END IF;
 FOREACH k IN ARRAY ARRAY['highlights','posts'] LOOP
 IF jsonb_typeof(v->k) IS DISTINCT FROM 'array' OR jsonb_array_length(v->k)>12 THEN RETURN false; END IF;ids:=ARRAY[]::text[];
 FOR item IN SELECT value FROM jsonb_array_elements(v->k) LOOP
 IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR coalesce(item->>'id','')!~'^[A-Za-z0-9_-]{1,80}$' OR item->>'id'=ANY(ids) OR length(trim(coalesce(item->>'title',''))) NOT BETWEEN 1 AND 140 OR length(coalesce(item->>'context',''))>240 THEN RETURN false; END IF;ids:=array_append(ids,item->>'id');u:=coalesce(item->>'url','');
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(item) x WHERE x NOT IN('id','title','context','url','poster','image','published_at','kind','provider')) OR EXISTS(SELECT 1 FROM jsonb_each(item) x(key_name,val) WHERE x.key_name IN('id','title','context','url','poster','image','kind','provider') AND jsonb_typeof(val) IS DISTINCT FROM 'string') OR (item?'published_at' AND jsonb_typeof(item->'published_at') NOT IN('string','null')) THEN RETURN false; END IF;
 IF u !~ '^https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}$' AND u !~ '^https://vimeo\.com/[0-9]{1,20}$' AND u !~ '^https://www\.instagram\.com/(p|reel)/[A-Za-z0-9_-]{1,100}$' AND u !~ '^https://www\.facebook\.com/([A-Za-z0-9_.-]{1,100}/(posts|videos)/[A-Za-z0-9_-]{1,100}|reel/[0-9]{1,30})$' AND u !~ '^https://www\.tiktok\.com/@[A-Za-z0-9_.]{1,100}/video/[0-9]{1,30}$' AND u !~ '^https://x\.com/[A-Za-z0-9_]{1,30}/status/[0-9]{1,30}$' THEN RETURN false; END IF;
 IF coalesce(item->>'poster','')<>'' AND item->>'poster'!~'^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(/[^[:space:]]*)?$' THEN RETURN false; END IF;
 IF coalesce(item->>'image','')<>'' AND item->>'image'!~'^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(/[^[:space:]]*)?$' THEN RETURN false; END IF;
 IF coalesce(item->>'published_at','')<>'' THEN IF item->>'published_at'!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$' THEN RETURN false;END IF;PERFORM (item->>'published_at')::timestamptz;END IF;
 END LOOP;END LOOP;RETURN true;
 EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION zoi.event_publicity_valid(jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.home_content_save(p_workspace uuid,p_listing uuid,p_expected_version text,p_request uuid,p_base jsonb DEFAULT '{}',p_profile jsonb DEFAULT '{}')RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
 IF k NOT IN('hero_url','logo_url','hero_position','logo_fit','photo_urls','tagline','tagline_el','about','about_el','languages','service_areas','hours','services','patronal_feast','clergy','ministries','sacraments','stewardship_url','festival','cuisine','menu','menu_url','menu_updated','specials','reserve_url','order_url','catering','price_range','practice_areas','registrations','consult','consult_fee','booking_url','programs','enrolment','tuition','exam_prep','enrol_url','origin','founded','membership','membership_url','meetings','scholarships','give_url','spotify_url','apple_music_url','youtube_url','bandcamp_url','soundcloud_url','embeds','releases','tour','booking_name','booking_email','press','press_kit_url','merch','message','featured_content','upcoming','work','rate_card_url','collab_email','spaces','hire_enquiry_url','catering_model','starts','ends','venue_name','tickets_url','lineup','admission','highlights','event_publicity') THEN RAISE EXCEPTION 'unsupported_profile_field';END IF;
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
CREATE OR REPLACE FUNCTION zoi.bizpage_save_profile(p_workspace uuid, p_listing uuid, p_profile jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
declare v_clean jsonb;
BEGIN
  PERFORM zoi.home_content_authorize(p_workspace,p_listing);
 perform zoi.assert_ws(p_workspace);
 if not zoi.bizpage_can_edit(p_workspace,p_listing) then raise exception 'not permitted to edit this listing';end if;
 if p_profile is null or jsonb_typeof(p_profile)<>'object' then raise exception 'profile must be a JSON object';end if;
 if pg_column_size(p_profile)>262144 then raise exception 'profile too large (limit 256KB)';end if;
 if p_profile?'owner_media' then
  if coalesce(zoi.org_role(p_workspace),'') not in('owner','admin','editor') then raise exception 'not_authorized' using errcode='42501';end if;
  perform 1 from zoi.listings where id=p_listing and owner_workspace_id=p_workspace for update;if not found then raise exception 'owned_listing_required' using errcode='42501';end if;
  if jsonb_typeof(p_profile->'owner_media') is distinct from 'object' or jsonb_typeof(p_profile#>'{owner_media,version}') is distinct from 'number' or coalesce(p_profile#>>'{owner_media,version}','')!~'^[1-9][0-9]{0,7}$' or not zoi.home_media_valid(p_profile#>'{owner_media,items}') then raise exception 'invalid_media_links';end if;
 end if;
 IF p_profile?'event_publicity' AND NOT zoi.event_publicity_valid(p_profile->'event_publicity') THEN RAISE EXCEPTION 'invalid_event_publicity';END IF;
 v_clean:=zoi.profile_strip(p_profile);
 update zoi.listings l set profile=coalesce(l.profile,'{}'::jsonb)||v_clean||jsonb_strip_nulls(jsonb_build_object('_enrich',l.profile->'_enrich','_geo',l.profile->'_geo'))||jsonb_build_object('_meta',jsonb_build_object('updated_at',to_char(now(),'YYYY-MM-DD"T"HH24:MI:SSOF'),'updated_by','owner')),updated_at=now() where l.id=p_listing;
 return found;
end $function$;

CREATE OR REPLACE FUNCTION zoi.public_owner_content(p_listing uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN l.updated_by='suite-bizpage' THEN jsonb_build_object(
 'description',l.description,'phone',l.phone,'email',l.email,
 'photo_url',l.photo_url,'social_links',coalesce(l.social_links,'{}'::jsonb))
 ELSE '{}'::jsonb END
 || CASE WHEN l.profile#>>'{_meta,updated_by}'='owner' THEN jsonb_build_object('profile',
 coalesce((SELECT jsonb_object_agg(k,v) FROM jsonb_each(l.profile) x(k,v)
 WHERE k IN ('photos','bio','spotify_url','apple_music_url','youtube_url','bandcamp_url','soundcloud_url','booking_name','booking_email','press','press_kit_url','merch','embeds','releases','tour','event_publicity')),'{}'::jsonb))
 ELSE '{}'::jsonb END FROM zoi.listings l WHERE l.id=p_listing;
$$;
REVOKE ALL ON FUNCTION zoi.public_owner_content(uuid) FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

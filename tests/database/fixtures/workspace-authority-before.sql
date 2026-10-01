-- Exact live pg_get_functiondef capture 2026-10-01; no customer execution.
CREATE OR REPLACE FUNCTION zoi.assert_ws(p_ws uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
DECLARE ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  SELECT EXISTS(
    SELECT 1 FROM zoi.workspaces w
    LEFT JOIN zoi.user_profiles up ON up.auth_user_id = auth.uid()
    LEFT JOIN zoi.workspace_members m ON m.workspace_id = w.id AND m.profile_id = up.id
    WHERE w.id = p_ws AND (w.created_by_auth = auth.uid() OR w.owner_profile_id = up.id OR m.id IS NOT NULL)
  ) INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'no_access_to_workspace'; END IF;
END;$function$
;
CREATE OR REPLACE FUNCTION zoi.audience_asset_role(p_workspace uuid, p_lock boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_role text; v_creator uuid; v_owner uuid; v_profile uuid;
begin
 if auth.uid() is null then raise exception 'not_signed_in'; end if;
 if p_lock then
  select w.created_by_auth,w.owner_profile_id into v_creator,v_owner from zoi.workspaces w where w.id=p_workspace for update;
 else
  select w.created_by_auth,w.owner_profile_id into v_creator,v_owner from zoi.workspaces w where w.id=p_workspace;
 end if;
 if not found then raise exception 'no_access_to_workspace'; end if;
 select p.id into v_profile from zoi.user_profiles p where p.auth_user_id=auth.uid();
 if p_lock then
  select m.role into v_role from zoi.workspace_members m where m.workspace_id=p_workspace and m.profile_id=v_profile for share;
 else
  select m.role into v_role from zoi.workspace_members m where m.workspace_id=p_workspace and m.profile_id=v_profile;
 end if;
 -- Any explicit membership overrides historical owner/creator authority.
 if found then return coalesce(v_role,''); end if;
 if v_creator=auth.uid() or v_owner=v_profile then return 'owner'; end if;
 raise exception 'no_access_to_workspace';
end; $function$
;
CREATE OR REPLACE FUNCTION zoi.settings_authorize(p_workspace uuid, p_section text, p_write boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare member_role text;legacy_owner boolean;
begin
 if auth.uid() is null then raise exception 'not_authorized' using errcode='42501';end if;
 select zoi.ops_role(p_workspace),exists(select 1 from zoi.workspaces w left join zoi.user_profiles up on up.auth_user_id=auth.uid() where w.id=p_workspace and(w.created_by_auth=auth.uid() or w.owner_profile_id=up.id)) into member_role,legacy_owner;
 if p_section not in('identity','voice') or p_section is null then raise exception 'invalid_settings_section';end if;
 if not p_write then
  if member_role is null and not legacy_owner then raise exception 'not_authorized' using errcode='42501';end if;
 elsif p_section='identity' then
  if coalesce(member_role,'') not in('owner','admin') and not legacy_owner then raise exception 'insufficient_permission' using errcode='42501';end if;
 elsif coalesce(member_role,'') not in('owner','admin','editor') then raise exception 'insufficient_permission' using errcode='42501';end if;
 return coalesce(member_role,case when legacy_owner then 'owner' end);
end $function$
;
CREATE OR REPLACE FUNCTION public.bio_save(p_workspace uuid, p_slug text, p_title text, p_tagline text DEFAULT NULL::text, p_theme text DEFAULT 'dark'::text, p_links jsonb DEFAULT '[]'::jsonb, p_photo text DEFAULT NULL::text, p_published boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
DECLARE slg text; lnk jsonb := '[]'::jsonb; e jsonb; n int := 0;
BEGIN
  PERFORM zoi.assert_ws(p_workspace);
  slg := lower(btrim(p_slug));
  IF slg !~ '^[a-z0-9][a-z0-9-]{2,39}$' THEN RAISE EXCEPTION 'slug_invalid_use_letters_numbers_dashes_3_40'; END IF;
  IF COALESCE(btrim(p_title),'')='' THEN RAISE EXCEPTION 'title_required'; END IF;
  IF jsonb_typeof(COALESCE(p_links,'[]'::jsonb))='array' THEN
    FOR e IN SELECT * FROM jsonb_array_elements(p_links) LOOP
      EXIT WHEN n >= 12;
      IF COALESCE(e->>'label','')<>'' AND (e->>'url' LIKE 'http://%' OR e->>'url' LIKE 'https://%') THEN
        lnk := lnk || jsonb_build_object('label', left(e->>'label',60), 'url', left(e->>'url',500));
        n := n+1;
      END IF;
    END LOOP;
  END IF;
  INSERT INTO zoi.bio_pages(workspace_id, slug, title, tagline, theme, links, photo_url, published, updated_at)
  VALUES (p_workspace, slg, left(btrim(p_title),80), NULLIF(left(btrim(COALESCE(p_tagline,'')),160),''),
    CASE WHEN p_theme IN ('dark','light','gold') THEN p_theme ELSE 'dark' END, lnk, p_photo, COALESCE(p_published,true), now())
  ON CONFLICT (workspace_id) DO UPDATE SET slug=EXCLUDED.slug, title=EXCLUDED.title, tagline=EXCLUDED.tagline,
    theme=EXCLUDED.theme, links=EXCLUDED.links, photo_url=EXCLUDED.photo_url, published=EXCLUDED.published, updated_at=now();
  RETURN jsonb_build_object('ok',true,'slug',slg,'url','https://www.zoi.city/b/'||slg);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'slug_taken';
END;$function$
;
CREATE OR REPLACE FUNCTION public.email_campaign_delete(p_workspace uuid, p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
BEGIN
  PERFORM zoi.assert_ws(p_workspace);
  DELETE FROM zoi.email_campaigns WHERE id=p_id AND workspace_id=p_workspace AND status='draft';
  RETURN FOUND;
END;$function$
;
CREATE OR REPLACE FUNCTION public.email_campaign_duplicate(p_workspace uuid, p_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
DECLARE v uuid;
BEGIN
  PERFORM zoi.assert_ws(p_workspace);
  INSERT INTO zoi.email_campaigns(workspace_id,subject,body,preheader,from_name,audience_tag,status)
  SELECT workspace_id, subject||' (copy)', body, preheader, from_name, audience_tag, 'draft'
  FROM zoi.email_campaigns WHERE id=p_id AND workspace_id=p_workspace
  RETURNING id INTO v;
  RETURN v;
END;$function$
;
CREATE OR REPLACE FUNCTION public.email_campaign_save(p_workspace uuid, p_subject text, p_body text, p_preheader text DEFAULT NULL::text, p_from_name text DEFAULT NULL::text, p_audience_tag text DEFAULT NULL::text, p_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
DECLARE v uuid;
BEGIN
  PERFORM zoi.assert_ws(p_workspace);
  IF p_id IS NOT NULL THEN
    UPDATE zoi.email_campaigns SET subject=COALESCE(p_subject,''), body=COALESCE(p_body,''), preheader=p_preheader,
      from_name=p_from_name, audience_tag=NULLIF(trim(p_audience_tag),''), updated_at=now()
    WHERE id=p_id AND workspace_id=p_workspace AND status='draft' RETURNING id INTO v;
    IF v IS NULL THEN RAISE EXCEPTION 'not_editable'; END IF;
  ELSE
    INSERT INTO zoi.email_campaigns(workspace_id,subject,body,preheader,from_name,audience_tag)
    VALUES(p_workspace,COALESCE(p_subject,''),COALESCE(p_body,''),p_preheader,p_from_name,NULLIF(trim(p_audience_tag),''))
    RETURNING id INTO v;
  END IF;
  RETURN v;
END;$function$
;
CREATE OR REPLACE FUNCTION public.email_campaign_schedule(p_workspace uuid, p_id uuid, p_at timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
BEGIN
  PERFORM zoi.assert_ws(p_workspace);
  IF p_at IS NULL OR p_at < now() THEN RAISE EXCEPTION 'pick_a_future_time'; END IF;
  UPDATE zoi.email_campaigns SET status='scheduled', scheduled_at=p_at, updated_at=now()
  WHERE id=p_id AND workspace_id=p_workspace AND status IN ('draft','scheduled');
  RETURN FOUND;
END;$function$
;
CREATE OR REPLACE FUNCTION public.email_campaign_unschedule(p_workspace uuid, p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
BEGIN
  PERFORM zoi.assert_ws(p_workspace);
  UPDATE zoi.email_campaigns SET status='draft', scheduled_at=NULL, updated_at=now()
  WHERE id=p_id AND workspace_id=p_workspace AND status='scheduled';
  RETURN FOUND;
END;$function$
;
CREATE OR REPLACE FUNCTION public.hashtag_delete(p_workspace uuid, p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
BEGIN PERFORM zoi.assert_ws(p_workspace);
  DELETE FROM zoi.hashtag_sets WHERE id=p_id AND workspace_id=p_workspace;
  RETURN jsonb_build_object('ok',true); END;$function$
;
CREATE OR REPLACE FUNCTION public.hashtag_save(p_workspace uuid, p_name text, p_tags text[], p_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
DECLARE v zoi.hashtag_sets; cleaned text[];
BEGIN
  PERFORM zoi.assert_ws(p_workspace);
  IF COALESCE(btrim(p_name),'')='' THEN RAISE EXCEPTION 'name_required'; END IF;
  SELECT array_agg(DISTINCT CASE WHEN t LIKE '#%' THEN t ELSE '#'||t END)
    INTO cleaned FROM unnest(COALESCE(p_tags,'{}')) t WHERE btrim(t)<>'';
  cleaned := COALESCE(cleaned,'{}');
  IF p_id IS NULL THEN
    INSERT INTO zoi.hashtag_sets(workspace_id,name,tags) VALUES(p_workspace,btrim(p_name),cleaned) RETURNING * INTO v;
  ELSE
    UPDATE zoi.hashtag_sets SET name=btrim(p_name),tags=cleaned,updated_at=now()
    WHERE id=p_id AND workspace_id=p_workspace RETURNING * INTO v;
  END IF;
  RETURN jsonb_build_object('ok',true,'id',v.id);
END;$function$
;
CREATE OR REPLACE FUNCTION public.link_save(p_workspace uuid, p_long_url text, p_label text DEFAULT NULL::text, p_utm jsonb DEFAULT '{}'::jsonb, p_slug text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
DECLARE v zoi.link_items; slg text; final_url text; q text;
BEGIN
  PERFORM zoi.assert_ws(p_workspace);
  IF p_long_url NOT LIKE 'http://%' AND p_long_url NOT LIKE 'https://%' THEN RAISE EXCEPTION 'url_must_be_http'; END IF;
  slg := COALESCE(NULLIF(lower(btrim(p_slug)),''), substr(md5(random()::text||clock_timestamp()::text),1,7));
  IF slg !~ '^[a-z0-9][a-z0-9-]{2,31}$' THEN RAISE EXCEPTION 'slug_invalid'; END IF;
  -- build final url with utm
  q := '';
  IF p_utm ? 'source' AND p_utm->>'source'<>'' THEN q := q||'&utm_source='||replace(p_utm->>'source',' ','%20'); END IF;
  IF p_utm ? 'medium' AND p_utm->>'medium'<>'' THEN q := q||'&utm_medium='||replace(p_utm->>'medium',' ','%20'); END IF;
  IF p_utm ? 'campaign' AND p_utm->>'campaign'<>'' THEN q := q||'&utm_campaign='||replace(p_utm->>'campaign',' ','%20'); END IF;
  final_url := p_long_url || CASE WHEN q='' THEN '' WHEN position('?' in p_long_url)>0 THEN q ELSE '?'||substr(q,2) END;
  INSERT INTO zoi.link_items(workspace_id,slug,label,long_url,utm)
  VALUES(p_workspace,slg,p_label,final_url,COALESCE(p_utm,'{}'::jsonb)) RETURNING * INTO v;
  RETURN jsonb_build_object('ok',true,'id',v.id,'slug',v.slug,'short','https://www.zoi.city/l/'||v.slug,'final_url',final_url);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'slug_taken';
END;$function$
;
CREATE OR REPLACE FUNCTION public.slot_delete(p_workspace uuid, p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
BEGIN PERFORM zoi.assert_ws(p_workspace);
  DELETE FROM zoi.posting_slots WHERE id=p_id AND workspace_id=p_workspace;
  RETURN jsonb_build_object('ok',true); END;$function$
;
CREATE OR REPLACE FUNCTION public.slot_save(p_workspace uuid, p_weekday integer, p_minute integer, p_tz text DEFAULT 'America/Toronto'::text, p_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
DECLARE v zoi.posting_slots;
BEGIN PERFORM zoi.assert_ws(p_workspace);
  IF p_id IS NULL THEN
    INSERT INTO zoi.posting_slots(workspace_id,weekday,minute,tz) VALUES(p_workspace,p_weekday,p_minute,COALESCE(p_tz,'America/Toronto')) RETURNING * INTO v;
  ELSE
    UPDATE zoi.posting_slots SET weekday=p_weekday,minute=p_minute,tz=COALESCE(p_tz,tz) WHERE id=p_id AND workspace_id=p_workspace RETURNING * INTO v;
  END IF;
  RETURN jsonb_build_object('ok',true,'id',v.id); END;$function$
;
CREATE OR REPLACE FUNCTION public.social_post_approve(p_workspace uuid, p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
begin perform zoi.assert_ws(p_workspace);
  if zoi.ws_role(p_workspace) not in ('owner','admin','editor') then raise exception 'not_permitted'; end if;
  update zoi.social_posts set status=case when scheduled_at is not null then 'scheduled' else 'approved' end,
    updated_at=now() where id=p_id and workspace_id=p_workspace and status='pending_approval'; return found; end;$function$
;
CREATE OR REPLACE FUNCTION public.social_post_reject(p_workspace uuid, p_id uuid, p_note text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
begin perform zoi.assert_ws(p_workspace);
  if zoi.ws_role(p_workspace) not in ('owner','admin','editor') then raise exception 'not_permitted'; end if;
  update zoi.social_posts set status='rejected',
    meta=coalesce(meta,'{}'::jsonb)||jsonb_build_object('reject_note',left(coalesce(p_note,''),300)),
    updated_at=now() where id=p_id and workspace_id=p_workspace and status='pending_approval'; return found; end;$function$
;
CREATE OR REPLACE FUNCTION public.social_post_submit(p_workspace uuid, p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
begin perform zoi.assert_ws(p_workspace);
  update zoi.social_posts set status='pending_approval', updated_at=now()
    where id=p_id and workspace_id=p_workspace and status in ('draft','rejected'); return found; end;$function$
;
CREATE OR REPLACE FUNCTION public.template_delete(p_workspace uuid, p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
BEGIN
  PERFORM zoi.assert_ws(p_workspace);
  DELETE FROM zoi.post_templates WHERE id=p_id AND workspace_id=p_workspace;
  RETURN jsonb_build_object('ok',true);
END;$function$
;
CREATE OR REPLACE FUNCTION public.template_save(p_workspace uuid, p_name text, p_body text, p_channels text[] DEFAULT '{}'::text[], p_media jsonb DEFAULT '[]'::jsonb, p_category text DEFAULT NULL::text, p_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
DECLARE v zoi.post_templates;
BEGIN
  PERFORM zoi.assert_ws(p_workspace);
  IF COALESCE(btrim(p_name),'')='' THEN RAISE EXCEPTION 'name_required'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO zoi.post_templates(workspace_id,name,body,channels,media,category)
    VALUES(p_workspace,btrim(p_name),COALESCE(p_body,''),COALESCE(p_channels,'{}'),COALESCE(p_media,'[]'::jsonb),p_category) RETURNING * INTO v;
  ELSE
    UPDATE zoi.post_templates SET name=btrim(p_name),body=COALESCE(p_body,''),channels=COALESCE(p_channels,'{}'),
      media=COALESCE(p_media,'[]'::jsonb),category=p_category,updated_at=now()
    WHERE id=p_id AND workspace_id=p_workspace RETURNING * INTO v;
    IF v.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  END IF;
  RETURN jsonb_build_object('ok',true,'id',v.id);
END;$function$
;
CREATE OR REPLACE FUNCTION public.workspace_settings_save(p_workspace uuid, p_request uuid, p_section text, p_expected_version uuid, p_values jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare receipt zoi.workspace_settings_receipts;input_hash text;current_value jsonb;result_value jsonb;field text;
begin
 perform zoi.settings_authorize(p_workspace,p_section,true);
 if p_request is null or jsonb_typeof(p_values) is distinct from 'object' then raise exception 'invalid_settings_values';end if;
 if p_section='identity' then
  if (select count(*) from jsonb_object_keys(p_values))<>1 or jsonb_typeof(p_values->'name') is distinct from 'string' or length(btrim(p_values->>'name')) not between 1 and 120 or p_values->>'name'<>btrim(p_values->>'name') then raise exception 'invalid_settings_values';end if;
 else
  if (select count(*) from jsonb_object_keys(p_values))<>5 then raise exception 'invalid_settings_values';end if;
  foreach field in array array['business_name','about','tone','languages','sample'] loop
   if jsonb_typeof(p_values->field) is distinct from 'string' or length(p_values->>field)>(case field when 'business_name' then 120 when 'about' then 1500 when 'tone' then 80 when 'languages' then 160 else 2000 end) then raise exception 'invalid_settings_values';end if;
  end loop;
 end if;
 input_hash:=encode(sha256(convert_to(jsonb_build_array(p_workspace,p_section,p_expected_version,p_values)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('settings-actor:'||auth.uid()::text,0));
 perform zoi.settings_authorize(p_workspace,p_section,true);
 select * into receipt from zoi.workspace_settings_receipts where actor=auth.uid() and request_id=p_request;
 if found then
  if receipt.workspace_id<>p_workspace or receipt.section<>p_section then raise exception 'settings_request_conflict';end if;
  if receipt.result->>'error' is distinct from 'request_cancelled' and receipt.input_hash<>input_hash then raise exception 'settings_request_conflict';end if;
  return receipt.result;
 end if;
 if (select count(*) from zoi.workspace_settings_receipts where actor=auth.uid())>=10000 then raise exception 'settings_receipt_capacity';end if;
 if (select count(*) from zoi.workspace_settings_receipts where actor=auth.uid() and created_at>=date_trunc('day',clock_timestamp()))>=500 then raise exception 'settings_request_limit';end if;
 if p_section='identity' then perform 1 from zoi.workspaces where id=p_workspace for update;
 else
  -- Existing profile first, then persistent revision: same order as direct writes.
  perform 1 from zoi.ai_profiles where workspace_id=p_workspace for update;
  perform 1 from zoi.workspace_voice_revisions where workspace_id=p_workspace for update;
 end if;
 perform zoi.settings_authorize(p_workspace,p_section,true);
 current_value:=zoi.settings_section(p_workspace,p_section);
 if (current_value->>'version')::uuid is distinct from p_expected_version then
  result_value:=jsonb_build_object('ok',false,'error','version_conflict','request_id',p_request,'workspace_id',p_workspace,'section',p_section,'current',current_value);
 else
  if p_section='identity' then update zoi.workspaces set name=p_values->>'name' where id=p_workspace;
  else insert into zoi.ai_profiles(workspace_id,business_name,about,tone,languages,sample,updated_at) values(p_workspace,p_values->>'business_name',p_values->>'about',p_values->>'tone',p_values->>'languages',p_values->>'sample',now()) on conflict(workspace_id) do update set business_name=excluded.business_name,about=excluded.about,tone=excluded.tone,languages=excluded.languages,sample=excluded.sample,updated_at=now();end if;
  current_value:=zoi.settings_section(p_workspace,p_section);
  result_value:=jsonb_build_object('ok',true,'request_id',p_request,'workspace_id',p_workspace,'section',p_section,'version',current_value->'version','value',current_value);
 end if;
 insert into zoi.workspace_settings_receipts(actor,request_id,workspace_id,section,input_hash,result) values(auth.uid(),p_request,p_workspace,p_section,input_hash,result_value);
 return result_value;
end $function$
;
CREATE OR REPLACE FUNCTION public.workspace_settings_request(p_workspace uuid, p_request uuid, p_section text, p_cancel_if_missing boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare receipt zoi.workspace_settings_receipts;result_value jsonb;
begin
 perform zoi.settings_authorize(p_workspace,p_section,true);
 if p_request is null then raise exception 'invalid_settings_request';end if;
 perform pg_advisory_xact_lock(hashtextextended('settings-actor:'||auth.uid()::text,0));
 perform zoi.settings_authorize(p_workspace,p_section,true);
 select * into receipt from zoi.workspace_settings_receipts where actor=auth.uid() and request_id=p_request;
 if found then
  if receipt.workspace_id<>p_workspace or receipt.section<>p_section then raise exception 'settings_request_conflict';end if;
  return receipt.result;
 end if;
 if not coalesce(p_cancel_if_missing,false) then return jsonb_build_object('ok',false,'error','request_unknown','workspace_id',p_workspace,'request_id',p_request,'section',p_section);end if;
 if (select count(*) from zoi.workspace_settings_receipts where actor=auth.uid())>=10000 then raise exception 'settings_receipt_capacity';end if;
 if (select count(*) from zoi.workspace_settings_receipts where actor=auth.uid() and created_at>=date_trunc('day',clock_timestamp()))>=500 then raise exception 'settings_request_limit';end if;
 result_value:=jsonb_build_object('ok',false,'error','request_cancelled','workspace_id',p_workspace,'request_id',p_request,'section',p_section);
 insert into zoi.workspace_settings_receipts(actor,request_id,workspace_id,section,input_hash,result) values(auth.uid(),p_request,p_workspace,p_section,'cancelled',result_value);
 return result_value;
end $function$
;

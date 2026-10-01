-- Current workspace authority; no customer ownership or membership mutations.
-- Preserve existing public function ACLs by replacing, never dropping them.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $guard$ begin if md5(pg_get_functiondef('zoi.assert_ws(uuid)'::regprocedure)) <> '0628dc5d72e11364b72fb6634b5fa0e5' then raise exception 'workspace_authority_definition_changed: assert_ws';end if;end $guard$;
do $guard$ begin if md5(pg_get_functiondef('zoi.audience_asset_role(uuid,boolean)'::regprocedure)) <> '6852270e4f781351842c231794cb2621' then raise exception 'workspace_authority_definition_changed: audience_asset_role';end if;end $guard$;
do $guard$ begin if md5(pg_get_functiondef('zoi.settings_authorize(uuid,text,boolean)'::regprocedure)) <> 'cbd0bec78a3b3998c68e1652ad50fc8f' then raise exception 'workspace_authority_definition_changed: settings_authorize';end if;end $guard$;
do $guard$ begin if md5(pg_get_functiondef('public.bio_save(uuid,text,text,text,text,jsonb,text,boolean)'::regprocedure)) <> 'c6264ac71550f2666af9a697b82a58e4' then raise exception 'workspace_authority_definition_changed: bio_save';end if;end $guard$;
do $guard$ begin if md5(pg_get_functiondef('public.email_campaign_delete(uuid,uuid)'::regprocedure)) <> 'd0869c244390277244b759e7097036d3' then raise exception 'workspace_authority_definition_changed: email_campaign_delete';end if;end $guard$;
do $guard$ begin if md5(pg_get_functiondef('public.email_campaign_duplicate(uuid,uuid)'::regprocedure)) <> '48039511b18356dbf5abf04e8f957c9a' then raise exception 'workspace_authority_definition_changed: email_campaign_duplicate';end if;end $guard$;
do $guard$ begin if md5(pg_get_functiondef('public.email_campaign_save(uuid,text,text,text,text,text,uuid)'::regprocedure)) <> 'b300f70d89141abbf5f7fad43e89834d' then raise exception 'workspace_authority_definition_changed: email_campaign_save';end if;end $guard$;
do $guard$ begin if md5(pg_get_functiondef('public.email_campaign_schedule(uuid,uuid,timestamp with time zone)'::regprocedure)) <> '088fbb9dac8dac9472c9bd833ecd4fb0' then raise exception 'workspace_authority_definition_changed: email_campaign_schedule';end if;end $guard$;
do $guard$ begin if md5(pg_get_functiondef('public.email_campaign_unschedule(uuid,uuid)'::regprocedure)) <> '707a8539ae47983c420ec03e3ac445a3' then raise exception 'workspace_authority_definition_changed: email_campaign_unschedule';end if;end $guard$;
do $guard$ begin if md5(pg_get_functiondef('public.hashtag_delete(uuid,bigint)'::regprocedure)) <> 'c664750d5ace81f611f84e0d6614929c' then raise exception 'workspace_authority_definition_changed: hashtag_delete';end if;end $guard$;
do $guard$ begin if md5(pg_get_functiondef('public.hashtag_save(uuid,text,text[],bigint)'::regprocedure)) <> 'b24e8e9f223e53ab7e4824367175d233' then raise exception 'workspace_authority_definition_changed: hashtag_save';end if;end $guard$;
do $guard$ begin if md5(pg_get_functiondef('public.link_save(uuid,text,text,jsonb,text)'::regprocedure)) <> 'f1d6d60f7672a05a2fb01f344d1702f8' then raise exception 'workspace_authority_definition_changed: link_save';end if;end $guard$;
do $guard$ begin if md5(pg_get_functiondef('public.slot_delete(uuid,bigint)'::regprocedure)) <> '13a920219cf64ae593bd5861cc999ae6' then raise exception 'workspace_authority_definition_changed: slot_delete';end if;end $guard$;
do $guard$ begin if md5(pg_get_functiondef('public.slot_save(uuid,integer,integer,text,bigint)'::regprocedure)) <> '98627d867d3bdc72bb239cbd06d6fd7f' then raise exception 'workspace_authority_definition_changed: slot_save';end if;end $guard$;
do $guard$ begin if md5(pg_get_functiondef('public.social_post_approve(uuid,uuid)'::regprocedure)) <> 'cafdf6b7be8e676ec15dbb07070757a9' then raise exception 'workspace_authority_definition_changed: social_post_approve';end if;end $guard$;
do $guard$ begin if md5(pg_get_functiondef('public.social_post_reject(uuid,uuid,text)'::regprocedure)) <> 'b7cdb5eb3ab125ea38fcc9d0682d8959' then raise exception 'workspace_authority_definition_changed: social_post_reject';end if;end $guard$;
do $guard$ begin if md5(pg_get_functiondef('public.social_post_submit(uuid,uuid)'::regprocedure)) <> '415c0112e818b93364abe6dd781969da' then raise exception 'workspace_authority_definition_changed: social_post_submit';end if;end $guard$;
do $guard$ begin if md5(pg_get_functiondef('public.template_delete(uuid,bigint)'::regprocedure)) <> 'a83327b753fe9bee976cfac1ff2e60f5' then raise exception 'workspace_authority_definition_changed: template_delete';end if;end $guard$;
do $guard$ begin if md5(pg_get_functiondef('public.template_save(uuid,text,text,text[],jsonb,text,bigint)'::regprocedure)) <> '6f1eed058228a7d3e4f43976f6786fb7' then raise exception 'workspace_authority_definition_changed: template_save';end if;end $guard$;
do $guard$ begin if md5(pg_get_functiondef('public.workspace_settings_save(uuid,uuid,text,uuid,jsonb)'::regprocedure)) <> 'da24550d737a29384c0e4fad82879c91' then raise exception 'workspace_authority_definition_changed: workspace_settings_save';end if;end $guard$;
do $guard$ begin if md5(pg_get_functiondef('public.workspace_settings_request(uuid,uuid,text,boolean)'::regprocedure)) <> 'd597f6148a755ecde8ce1d0ccd95b8fe' then raise exception 'workspace_authority_definition_changed: workspace_settings_request';end if;end $guard$;

create function zoi.suite_current_session() returns void language plpgsql stable security definer set search_path='' as $$
declare sid text:=auth.jwt()->>'session_id';
begin
 if auth.uid() is null or coalesce(sid,'') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then raise exception 'suite_session_unavailable' using errcode='42501';end if;
 perform 1 from auth.users where id=auth.uid() and deleted_at is null and coalesce(is_anonymous,false)=false and (banned_until is null or banned_until<=clock_timestamp());
 if not found then raise exception 'suite_session_unavailable' using errcode='42501';end if;
 perform 1 from auth.sessions where id=sid::uuid and user_id=auth.uid() and (not_after is null or not_after>clock_timestamp());
 if not found then raise exception 'suite_session_unavailable' using errcode='42501';end if;
end $$;
create function zoi.suite_lock_session() returns void language plpgsql security definer set search_path='' as $$
declare sid text:=auth.jwt()->>'session_id';
begin
 if auth.uid() is null or coalesce(sid,'') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then raise exception 'suite_session_unavailable' using errcode='42501';end if;
 perform 1 from auth.users where id=auth.uid() and deleted_at is null and coalesce(is_anonymous,false)=false and (banned_until is null or banned_until<=clock_timestamp()) for share;
 if not found then raise exception 'suite_session_unavailable' using errcode='42501';end if;
 perform 1 from auth.sessions where id=sid::uuid and user_id=auth.uid() and (not_after is null or not_after>clock_timestamp()) for share;
 if not found then raise exception 'suite_session_unavailable' using errcode='42501';end if;
end $$;
create function zoi.workspace_current_role(p_workspace uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare p uuid; o uuid; r text;
begin
 if auth.uid() is null then raise exception 'not_signed_in' using errcode='42501';end if;
 select id into p from zoi.user_profiles where auth_user_id=auth.uid();
 select owner_profile_id into o from zoi.workspaces where id=p_workspace;
 if not found or p is null then raise exception 'no_access_to_workspace' using errcode='42501';end if;
 select role into r from zoi.workspace_members where workspace_id=p_workspace and profile_id=p;
 if not found and o=p then r:='owner';end if;
 if r='owner' and o is distinct from p then r:='viewer';end if;
 if coalesce(r,'') not in('owner','admin','editor','viewer') then raise exception 'no_access_to_workspace' using errcode='42501';end if;
 perform zoi.suite_current_session();
 return r;
end $$;
create function zoi.workspace_locked_role(p_workspace uuid) returns text
language plpgsql security definer set search_path='' as $$
declare p uuid; o uuid; r text;
begin
 if auth.uid() is null then raise exception 'not_signed_in' using errcode='42501';end if;
 select id into p from zoi.user_profiles where auth_user_id=auth.uid();
 -- Match team writers: workspace first also serializes absent-member inserts.
 select owner_profile_id into o from zoi.workspaces where id=p_workspace for update;
 if not found or p is null then raise exception 'no_access_to_workspace' using errcode='42501';end if;
 select role into r from zoi.workspace_members where workspace_id=p_workspace and profile_id=p for share;
 if not found and o=p then r:='owner';end if;
 if r='owner' and o is distinct from p then r:='viewer';end if;
 if coalesce(r,'') not in('owner','admin','editor','viewer') then raise exception 'no_access_to_workspace' using errcode='42501';end if;
 perform zoi.suite_lock_session();
 return r;
end $$;
create function zoi.assert_workspace_write(p_workspace uuid,p_roles text[] default array['owner','admin','editor']) returns void
language plpgsql security definer set search_path='' as $$
declare r text;
begin r:=zoi.workspace_locked_role(p_workspace);
 if not coalesce(r=any(p_roles),false) then raise exception 'insufficient_permission' using errcode='42501';end if;
end $$;
revoke all on function zoi.suite_current_session(),zoi.suite_lock_session(),zoi.workspace_current_role(uuid),zoi.workspace_locked_role(uuid),zoi.assert_workspace_write(uuid,text[]) from public,anon,authenticated;
create or replace function zoi.assert_ws(p_ws uuid) returns void language plpgsql security definer set search_path='' as $$
begin perform zoi.workspace_current_role(p_ws);end $$;
create or replace function zoi.audience_asset_role(p_workspace uuid,p_lock boolean default false) returns text language plpgsql security definer set search_path='' as $$
begin
 if p_lock then return zoi.workspace_locked_role(p_workspace);end if;
 return zoi.workspace_current_role(p_workspace);
end $$;
create or replace function zoi.settings_authorize(p_workspace uuid,p_section text,p_write boolean) returns text language plpgsql security definer set search_path='' as $$
declare r text;
begin
 r:=zoi.workspace_current_role(p_workspace);
 if p_section is null or p_section not in('identity','voice') then raise exception 'invalid_settings_section';end if;
 if p_write and ((p_section='identity' and r not in('owner','admin')) or (p_section='voice' and r not in('owner','admin','editor'))) then raise exception 'insufficient_permission' using errcode='42501';end if;
 return r;
end $$;
CREATE OR REPLACE FUNCTION public.bio_save(p_workspace uuid, p_slug text, p_title text, p_tagline text DEFAULT NULL::text, p_theme text DEFAULT 'dark'::text, p_links jsonb DEFAULT '[]'::jsonb, p_photo text DEFAULT NULL::text, p_published boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
DECLARE slg text; lnk jsonb := '[]'::jsonb; e jsonb; n int := 0;
BEGIN
  PERFORM zoi.assert_workspace_write(p_workspace);
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
  PERFORM zoi.assert_workspace_write(p_workspace);
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
  PERFORM zoi.assert_workspace_write(p_workspace);
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
  PERFORM zoi.assert_workspace_write(p_workspace);
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
  PERFORM zoi.assert_workspace_write(p_workspace);
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
  PERFORM zoi.assert_workspace_write(p_workspace);
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
BEGIN PERFORM zoi.assert_workspace_write(p_workspace);
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
  PERFORM zoi.assert_workspace_write(p_workspace);
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
  PERFORM zoi.assert_workspace_write(p_workspace);
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
BEGIN PERFORM zoi.assert_workspace_write(p_workspace);
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
BEGIN PERFORM zoi.assert_workspace_write(p_workspace);
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
begin PERFORM zoi.assert_workspace_write(p_workspace);
  update zoi.social_posts set status=case when scheduled_at is not null then 'scheduled' else 'approved' end,
    updated_at=now() where id=p_id and workspace_id=p_workspace and status='pending_approval'; return found; end;$function$
;
CREATE OR REPLACE FUNCTION public.social_post_reject(p_workspace uuid, p_id uuid, p_note text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
begin PERFORM zoi.assert_workspace_write(p_workspace);
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
begin PERFORM zoi.assert_workspace_write(p_workspace);
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
  PERFORM zoi.assert_workspace_write(p_workspace);
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
  PERFORM zoi.assert_workspace_write(p_workspace);
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
 perform zoi.assert_workspace_write(p_workspace,case when p_section='identity' then array['owner','admin'] else array['owner','admin','editor'] end);
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
 perform zoi.assert_workspace_write(p_workspace,case when p_section='identity' then array['owner','admin'] else array['owner','admin','editor'] end);
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
commit;

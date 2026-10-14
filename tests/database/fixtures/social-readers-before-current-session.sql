-- Exact live definitions captured 2026-10-14; fixture only. No authority overrides.
CREATE OR REPLACE FUNCTION public.social_channels_list(p_workspace uuid)
 RETURNS TABLE(id bigint, platform text, handle text, display_name text, external_id text, avatar_url text, status text, connected boolean, expires_at timestamp with time zone, needs_reconnect boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 if auth.uid() is null or not exists(select 1 from zoi.workspace_members m join zoi.user_profiles p on p.id=m.profile_id where m.workspace_id=p_workspace and p.auth_user_id=auth.uid()) then raise exception 'social_workspace_access_denied' using errcode='42501';end if;
 return query select c.id,c.platform,c.handle,c.display_name,c.external_id,c.avatar_url,coalesce(c.status,'pending'),coalesce(c.connected,false),c.token_expires_at,(coalesce(c.connected,false) and c.token_expires_at is not null and c.token_expires_at<statement_timestamp()) from zoi.social_channels c where c.workspace_id=p_workspace order by c.created_at desc nulls last,c.id desc;
end $function$;

CREATE OR REPLACE FUNCTION public.social_list_posts(p_workspace uuid, p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS SETOF zoi.social_posts
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
  SELECT * FROM zoi.social_posts
  WHERE workspace_id = p_workspace AND zoi.is_ws_member(p_workspace)
    AND (p_from IS NULL OR coalesce(scheduled_at, created_at) >= p_from)
    AND (p_to   IS NULL OR coalesce(scheduled_at, created_at) <= p_to)
  ORDER BY coalesce(scheduled_at, created_at) DESC;
$function$;

CREATE OR REPLACE FUNCTION public.social_post_targets_list(p_workspace uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
BEGIN
  PERFORM zoi.assert_ws(p_workspace);
  RETURN COALESCE((SELECT jsonb_object_agg(pid, tg) FROM (
    SELECT t.post_id::text AS pid,
      jsonb_agg(jsonb_build_object('platform',t.platform,'status',t.status,'url',t.external_url,'error',t.error) ORDER BY t.created_at) AS tg
    FROM zoi.social_post_targets t
    JOIN zoi.social_posts p ON p.id=t.post_id
    WHERE p.workspace_id=p_workspace
    GROUP BY t.post_id) s),'{}'::jsonb);
END;$function$;

CREATE OR REPLACE FUNCTION public.social_stats(p_workspace uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(zoi.is_ws_member(p_workspace),false) THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object(
 'scheduled',(SELECT count(*) FROM zoi.social_posts WHERE workspace_id=p_workspace AND status='scheduled'),
 'drafts',(SELECT count(*) FROM zoi.social_posts WHERE workspace_id=p_workspace AND status='draft'),
 'published',(SELECT count(*) FROM zoi.social_posts WHERE workspace_id=p_workspace AND status='published'),
 'channels',(SELECT count(*) FROM zoi.social_channels WHERE workspace_id=p_workspace AND connected IS TRUE),
 'channels_pending',(SELECT count(*) FROM zoi.social_channels WHERE workspace_id=p_workspace AND COALESCE(connected,false)=false));
END; $function$;

CREATE OR REPLACE FUNCTION zoi.assert_ws(p_ws uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin perform zoi.workspace_current_role(p_ws);end $function$;

CREATE OR REPLACE FUNCTION zoi.suite_current_session()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sid text:=auth.jwt()->>'session_id';
begin
 if auth.uid() is null or coalesce(sid,'') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then raise exception 'suite_session_unavailable' using errcode='42501';end if;
 perform 1 from auth.users where id=auth.uid() and deleted_at is null and coalesce(is_anonymous,false)=false and (banned_until is null or banned_until<=clock_timestamp());
 if not found then raise exception 'suite_session_unavailable' using errcode='42501';end if;
 perform 1 from auth.sessions where id=sid::uuid and user_id=auth.uid() and (not_after is null or not_after>clock_timestamp());
 if not found then raise exception 'suite_session_unavailable' using errcode='42501';end if;
end $function$;

CREATE OR REPLACE FUNCTION zoi.workspace_current_role(p_workspace uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;

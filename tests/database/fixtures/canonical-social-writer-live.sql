-- Exact production definitions captured 2026-10-14 before canonical authority correction.
CREATE OR REPLACE FUNCTION zoi.assert_workspace_write(p_workspace uuid, p_roles text[] DEFAULT ARRAY['owner'::text, 'admin'::text, 'editor'::text])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r text;
begin r:=zoi.workspace_locked_role(p_workspace);
 if not coalesce(r=any(p_roles),false) then raise exception 'insufficient_permission' using errcode='42501';end if;
end $function$;

CREATE OR REPLACE FUNCTION zoi.is_ws_member(p_workspace uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM zoi.workspace_members m
    JOIN zoi.user_profiles up ON up.id = m.profile_id
    WHERE m.workspace_id = p_workspace AND up.auth_user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.social_delete_post(p_workspace uuid, p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
BEGIN
  IF NOT zoi.is_ws_member(p_workspace) THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM zoi.social_posts WHERE id=p_id AND workspace_id=p_workspace;
  RETURN true;
END; $function$;

CREATE OR REPLACE FUNCTION public.social_save_post(p_workspace uuid, p_body text, p_channels text[] DEFAULT '{}'::text[], p_scheduled_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_status text DEFAULT 'draft'::text, p_media jsonb DEFAULT '[]'::jsonb, p_nameday text DEFAULT NULL::text, p_meta jsonb DEFAULT '{}'::jsonb, p_id uuid DEFAULT NULL::uuid)
 RETURNS zoi.social_posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
DECLARE r zoi.social_posts; pid uuid;
BEGIN
  IF NOT zoi.is_ws_member(p_workspace) THEN RAISE EXCEPTION 'not authorized for this workspace'; END IF;
  IF p_status NOT IN ('draft','scheduled') THEN p_status := 'draft'; END IF;
  SELECT up.id INTO pid FROM zoi.user_profiles up WHERE up.auth_user_id = auth.uid() LIMIT 1;
  IF p_id IS NOT NULL THEN
    UPDATE zoi.social_posts SET body=p_body, channels=p_channels, scheduled_at=p_scheduled_at, status=p_status,
      media=p_media, nameday_ref=p_nameday, meta=p_meta, updated_at=now()
    WHERE id=p_id AND workspace_id=p_workspace RETURNING * INTO r;
  ELSE
    INSERT INTO zoi.social_posts (workspace_id, author_profile, body, channels, scheduled_at, status, media, nameday_ref, meta)
    VALUES (p_workspace, pid, p_body, p_channels, p_scheduled_at, p_status, p_media, p_nameday, p_meta) RETURNING * INTO r;
  END IF;
  RETURN r;
END; $function$;

CREATE OR REPLACE FUNCTION zoi.suite_lock_session()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sid text:=auth.jwt()->>'session_id';
begin
 if auth.uid() is null or coalesce(sid,'') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then raise exception 'suite_session_unavailable' using errcode='42501';end if;
 perform 1 from auth.users where id=auth.uid() and deleted_at is null and coalesce(is_anonymous,false)=false and (banned_until is null or banned_until<=clock_timestamp()) for share;
 if not found then raise exception 'suite_session_unavailable' using errcode='42501';end if;
 perform 1 from auth.sessions where id=sid::uuid and user_id=auth.uid() and (not_after is null or not_after>clock_timestamp()) for share;
 if not found then raise exception 'suite_session_unavailable' using errcode='42501';end if;
end $function$;

CREATE OR REPLACE FUNCTION zoi.workspace_locked_role(p_workspace uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;

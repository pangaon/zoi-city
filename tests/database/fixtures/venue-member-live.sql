-- Production body/ACL independently checked read-only 2026-10-14.
create function zoi.venue_require_member(p_workspace uuid,p_manage boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; member_role text;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501'; end if;
 actor:=zoi.ensure_profile();
 select role into member_role from zoi.workspace_members where workspace_id=p_workspace and profile_id=actor;
 if member_role is null or (p_manage and member_role not in ('owner','admin')) then
  raise exception 'workspace_permission_denied' using errcode='42501';
 end if;
 return actor;
end $$;
ALTER FUNCTION zoi.venue_require_member(uuid,boolean)OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.venue_require_member(uuid,boolean)FROM PUBLIC,anon,authenticated,service_role;

-- Workspace identity is controlled by its creator/owner or current owner/admin.
-- Preserve the boolean RPC contract; membership alone does not grant rename.
create or replace function public.workspace_rename(p_workspace uuid,p_name text)
returns boolean language plpgsql security definer set search_path='' as $$
declare target_name text:=btrim(p_name);
begin
 if auth.uid() is null then raise exception 'not_authorized' using errcode='42501';end if;
 if not exists (
   select 1 from zoi.workspaces w
   left join zoi.user_profiles up on up.auth_user_id=auth.uid()
   left join zoi.workspace_members m on m.workspace_id=w.id and m.profile_id=up.id
   where w.id=p_workspace and (w.created_by_auth=auth.uid() or w.owner_profile_id=up.id or m.role in ('owner','admin'))
 ) then raise exception 'insufficient_permission' using errcode='42501';end if;
 if coalesce(target_name,'')='' or length(target_name)>120 then raise exception 'invalid_workspace_name';end if;
 update zoi.workspaces set name=target_name where id=p_workspace;
 return found;
end $$;
revoke all on function public.workspace_rename(uuid,text) from public,anon,authenticated;
grant execute on function public.workspace_rename(uuid,text) to authenticated;

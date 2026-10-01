-- SECOND STAGE ONLY: apply after versioned settings UI is deployed and verified.
-- Unversioned calls cannot supply a trustworthy expected revision; do not wrap them.
begin;
create or replace function public.workspace_rename(p_workspace uuid,p_name text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform zoi.settings_authorize(p_workspace,'identity',true);
 raise exception 'client_upgrade_required: refresh Zoi before editing workspace settings';
end $$;
create or replace function public.ai_profile_save(p_workspace uuid,p_business text,p_about text,p_tone text,p_languages text,p_sample text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform zoi.settings_authorize(p_workspace,'voice',true);
 raise exception 'client_upgrade_required: refresh Zoi before editing workspace settings';
end $$;
revoke all on function public.workspace_rename(uuid,text),public.ai_profile_save(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.workspace_rename(uuid,text),public.ai_profile_save(uuid,text,text,text,text,text) to authenticated;
commit;

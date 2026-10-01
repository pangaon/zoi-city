begin;
-- Historical server helper bypasses workspace membership; keep it server-only.
revoke all on function public.ai_profile_read_srv(uuid) from public,anon,authenticated;
grant execute on function public.ai_profile_read_srv(uuid) to service_role;
alter function public.ai_profile_read_srv(uuid) set search_path='';
commit;

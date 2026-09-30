begin;
set local lock_timeout='5s';
-- Credential-bearing worker functions must never be callable by browsers.
revoke all on function public.social_channels_for_publish(uuid,text[]),public.social_channel_upsert(uuid,text,text,text,text,text,text,text,timestamptz,text[],uuid,jsonb),public.social_oauth_state_put(text,uuid,text,uuid,text,text,jsonb),public.social_oauth_state_take(text) from public,anon,authenticated;
grant execute on function public.social_channels_for_publish(uuid,text[]),public.social_channel_upsert(uuid,text,text,text,text,text,text,text,timestamptz,text[],uuid,jsonb),public.social_oauth_state_put(text,uuid,text,uuid,text,text,jsonb),public.social_oauth_state_take(text) to service_role;
-- Scheduler secrets and delivery mutations are also worker-only.
revoke all on function public.social_cron_secret_get(),public.social_due_posts(),public.social_target_record(uuid,bigint,text,text,text,text,text),public.social_post_finalize(uuid,text) from public,anon,authenticated;
grant execute on function public.social_cron_secret_get(),public.social_due_posts(),public.social_target_record(uuid,bigint,text,text,text,text,text),public.social_post_finalize(uuid,text) to service_role;
-- Legacy add returns the full channel row (including credentials on conflict).
-- Legacy remove lacks authorization. Disable both until lifecycle replacements.
revoke all on function public.social_channel_add(uuid,text,text,text),public.social_channel_remove(uuid,bigint) from public,anon,authenticated;
create or replace function public.social_channels_list(p_workspace uuid)
returns table(id bigint,platform text,handle text,display_name text,external_id text,avatar_url text,status text,connected boolean,expires_at timestamptz,needs_reconnect boolean)
language plpgsql stable security definer set search_path='' as $$begin
 if auth.uid() is null or not exists(select 1 from zoi.workspace_members m join zoi.user_profiles p on p.id=m.profile_id where m.workspace_id=p_workspace and p.auth_user_id=auth.uid()) then raise exception 'social_workspace_access_denied' using errcode='42501';end if;
 return query select c.id,c.platform,c.handle,c.display_name,c.external_id,c.avatar_url,coalesce(c.status,'pending'),coalesce(c.connected,false),c.token_expires_at,(coalesce(c.connected,false) and c.token_expires_at is not null and c.token_expires_at<statement_timestamp()) from zoi.social_channels c where c.workspace_id=p_workspace order by c.created_at desc nulls last,c.id desc;
end $$;
revoke all on function public.social_channels_list(uuid) from public,anon;
grant execute on function public.social_channels_list(uuid) to authenticated;
alter table zoi.social_channels enable row level security;
alter table zoi.social_oauth_states enable row level security;
revoke all on zoi.social_channels,zoi.social_oauth_states from public,anon,authenticated;
commit;

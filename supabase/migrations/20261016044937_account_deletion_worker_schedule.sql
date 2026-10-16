-- Separate, initially PAUSED scheduler. Root activates only after deployed Edge,
-- dedicated synthetic erasure, backlog/capacity and deadline admission pass.
begin;
set local lock_timeout='2s';set local statement_timeout='5s';
do $$begin
 if current_user<>'postgres' then raise exception 'account_delete_installer_required';end if;
 if to_regprocedure('zoi.account_delete_schedule()') is not null or exists(select 1 from cron.job where jobname='zoi-account-delete-worker') then raise exception 'account_delete_schedule_already_exists';end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.account_delete_community_step(uuid,uuid)') and proowner='postgres'::regrole and prosecdef and proconfig=array['search_path=""'] and proacl::text='{postgres=X/postgres,service_role=X/postgres}') then raise exception 'account_delete_worker_dependency_drift';end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.account_delete_community_step(uuid,uuid)') and md5(prosrc)='7aa5974150180e5cd4679e9b610cb916' and proowner='postgres'::regrole and prosecdef and proconfig=array['search_path=""'] and proacl::text='{postgres=X/postgres,service_role=X/postgres}') then raise exception 'account_delete_worker_body_drift';end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.account_delete_community_storage_done(uuid,uuid,jsonb)') and md5(prosrc)='57f70f2261ddc7489a6792c1c2056352' and proowner='postgres'::regrole and prosecdef and proconfig=array['search_path=""'] and proacl::text='{postgres=X/postgres,service_role=X/postgres}') then raise exception 'account_delete_worker_body_drift';end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.account_delete_community_retry(uuid,uuid)') and md5(prosrc)='09a0438c331749b24ef7d0c5b9d8629b' and proowner='postgres'::regrole and prosecdef and proconfig=array['search_path=""'] and proacl::text='{postgres=X/postgres,service_role=X/postgres}') then raise exception 'account_delete_worker_body_drift';end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.account_delete_pending()') and md5(prosrc)='bd4efa0869ca52ecd4ad2857041c4cf2' and proowner='postgres'::regrole and prosecdef and proconfig=array['search_path=""'] and proacl::text='{postgres=X/postgres,service_role=X/postgres}') then raise exception 'account_delete_worker_body_drift';end if;
 if (select count(*) from vault.secrets where name='service_role_key')<>1 then raise exception 'account_delete_service_configuration_required';end if;
end $$;
create function zoi.account_delete_schedule() returns bigint language plpgsql security definer set search_path='' as $$
declare credential text;request_id bigint;
begin
 if zoi.account_delete_completion_budget() is null then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('zoi-account-delete-schedule',0)) then return null;end if;
 if not exists(select 1 from zoi.account_deletion_requests where state in('accepted','auth_pending') and (worker_until is null or worker_until<=clock_timestamp()) and (next_retry_at is null or next_retry_at<=clock_timestamp())) then return null;end if;
 if exists(select 1 from net.http_request_queue where url='https://csebihpaychdkanjjsmz.supabase.co/functions/v1/account-delete') then return null;end if;
 select decrypted_secret into strict credential from vault.decrypted_secrets where name='service_role_key';
 if credential is null or length(credential) not between 20 and 4096 or credential~'[[:space:]]' then raise exception 'account_delete_service_configuration_required';end if;
 select net.http_post(url:='https://csebihpaychdkanjjsmz.supabase.co/functions/v1/account-delete',headers:=jsonb_build_object('Content-Type','application/json','apikey',credential,'Authorization','Bearer '||credential),body:='{"action":"process_pending"}'::jsonb,timeout_milliseconds:=55000) into request_id;
 return request_id;
end $$;
alter function zoi.account_delete_schedule() owner to postgres;
revoke all on function zoi.account_delete_schedule() from public,anon,authenticated,service_role;
do $$declare job_id bigint;begin
 select cron.schedule('zoi-account-delete-worker','* * * * *','select zoi.account_delete_schedule();') into job_id;
 perform cron.alter_job(job_id,active:=false);
end $$;
commit;

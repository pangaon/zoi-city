begin;
set local lock_timeout='5s';
set local statement_timeout='15s';
-- Replace the verified publisher job's already-mismatched authentication command.
-- No old or new secret, or existing cron command, leaves this transaction.
revoke all on zoi.app_config from public,anon,authenticated;
do $$declare v_new text;v_job bigint;begin
 perform pg_advisory_xact_lock(hashtextextended('zoi:social_scheduler_rotation',0));
 if (select count(*) from zoi.app_config where key='social_cron_secret')<>1 then raise exception 'social_rotation_config_missing';end if;
 perform 1 from zoi.app_config where key='social_cron_secret' for update;
 select jobid into v_job from cron.job where jobid=8 and jobname='social_publish_worker' and position('social-publish' in command)>0;
 if v_job is null then raise exception 'social_rotation_publisher_reference_changed';end if;
 v_new:=encode(extensions.gen_random_bytes(48),'hex');
 update zoi.app_config set value=v_new,updated_at=clock_timestamp() where key='social_cron_secret';
 perform cron.alter_job(v_job,command:=$command$SELECT net.http_post(url:='https://csebihpaychdkanjjsmz.supabase.co/functions/v1/social-publish',headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',public.social_cron_secret_get()),body:='{}'::jsonb,timeout_milliseconds:=10000);$command$);
 if not exists(select 1 from cron.job where jobid=v_job and position('public.social_cron_secret_get()' in command)>0 and position(v_new in command)=0) then raise exception 'social_rotation_dynamic_reference_failed';end if;
end $$;
commit;

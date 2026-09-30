begin;
set local lock_timeout='5s';
set local statement_timeout='15s';
-- No credential value or scheduler command leaves this transaction.
revoke all on zoi.app_config from public,anon,authenticated;
do $$declare v_old text;v_new text;v_job record;v_count integer:=0;begin
 if (select count(*) from zoi.app_config where key='social_cron_secret')<>1 then raise exception 'social_rotation_config_missing';end if;
 select value into v_old from zoi.app_config where key='social_cron_secret' for update;
 if v_old is null or length(v_old)<16 then raise exception 'social_rotation_invalid_existing_config';end if;
 if not exists(select 1 from cron.job where jobid=8 and jobname='social_publish_worker' and position('social-publish' in command)>0 and position(v_old in command)>0) then raise exception 'social_rotation_publisher_reference_changed';end if;
 v_new:=encode(extensions.gen_random_bytes(48),'hex');
 for v_job in select jobid,command from cron.job where position(v_old in command)>0 order by jobid for update loop
  perform cron.alter_job(v_job.jobid,command:=replace(v_job.command,v_old,v_new));v_count:=v_count+1;
 end loop;
 if v_count<1 or exists(select 1 from cron.job where position(v_old in command)>0) then raise exception 'social_rotation_incomplete';end if;
 update zoi.app_config set value=v_new,updated_at=clock_timestamp() where key='social_cron_secret' and value=v_old;
 if not found then raise exception 'social_rotation_config_conflict';end if;
end $$;
commit;

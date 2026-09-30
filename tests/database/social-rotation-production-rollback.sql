begin;
set local statement_timeout='10s';
do $$begin
 if has_function_privilege('anon','public.social_cron_secret_get()','EXECUTE') or has_function_privilege('authenticated','public.social_cron_secret_get()','EXECUTE') or has_table_privilege('anon','zoi.app_config','SELECT') or has_table_privilege('authenticated','zoi.app_config','SELECT') then raise exception 'scheduler_secret_acl_failed';end if;
 if not exists(select 1 from cron.job j join zoi.app_config c on c.key='social_cron_secret' where j.jobid=8 and j.jobname='social_publish_worker' and length(c.value)=96 and position(c.value in j.command)>0) then raise exception 'scheduler_secret_reference_failed';end if;
end $$;
select jsonb_build_object('rotation_reference_verified',true,'secret_values_returned',0,'credential_rows_returned',0) as result;
rollback;

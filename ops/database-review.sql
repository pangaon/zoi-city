select jsonb_build_object(
 'migration_present',exists(select 1 from supabase_migrations.schema_migrations where name='rotate_social_scheduler_secret'),
 'config_count',(select count(*) from zoi.app_config where key='social_cron_secret'),
 'config_length_valid',(select length(value)>=16 from zoi.app_config where key='social_cron_secret'),
 'publisher_reference_matches',exists(select 1 from cron.job j join zoi.app_config c on c.key='social_cron_secret' where j.jobid=8 and j.jobname='social_publish_worker' and position('social-publish' in j.command)>0 and position(c.value in j.command)>0),
 'matching_job_count',(select count(*) from cron.job j join zoi.app_config c on c.key='social_cron_secret' where position(c.value in j.command)>0),
 'crypto_function',to_regprocedure('extensions.gen_random_bytes(integer)') is not null,
 'cron_alter',(select jsonb_agg(pg_get_function_identity_arguments(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='cron' and p.proname='alter_job'),
 'config_client_read',has_table_privilege('anon','zoi.app_config','SELECT')
) as rotation_guard_review;

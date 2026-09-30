select jsonb_build_object(
 'columns',(select jsonb_agg(x) from(select table_schema,table_name,column_name,data_type,udt_name from information_schema.columns where table_name='app_config')x),
 'constraints',(select jsonb_agg(x) from(select c.relname,con.conname,pg_get_constraintdef(con.oid) as definition from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='zoi' and c.relname in('social_channels','social_oauth_states'))x),
 'indexes',(select jsonb_agg(x) from(select tablename,indexdef from pg_indexes where schemaname='zoi' and tablename in('social_channels','social_oauth_states'))x),
 'cron',(select jsonb_agg(x) from(select jobid,jobname,active,command ilike '%social-publish%' as invokes_social_publisher,command ilike '%social_cron_secret_get%' as uses_secret_get,command ilike '%social_cron_secret%' as refers_secret_key from cron.job)x),
 'configured_channel_counts',(select jsonb_agg(x) from(select platform,count(*) as channels,count(*) filter(where access_token is not null and access_token<>'') as with_access_token,count(*) filter(where refresh_token is not null and refresh_token<>'') as with_refresh_token from zoi.social_channels group by platform)x)
) as social_rotation_review;

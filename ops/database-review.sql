select jsonb_build_object(
 'secret_reference_functions',(select jsonb_agg(x) from(select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,p.proacl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','zoi') and p.prokind='f' and position('social_cron_secret' in pg_get_functiondef(p.oid))>0)x),
 'enrichment_functions',(select jsonb_agg(x) from(select n.nspname,p.proname,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','zoi') and p.proname in('enrich_queue_lease','enrich_apply'))x),
 'enrichment_cron',(select jsonb_agg(x) from(select jobid,jobname,schedule,active from cron.job where jobname ilike '%enrich%')x),
 'enrichment_recent_runs',(select jsonb_agg(x) from(select r.runid,r.jobid,r.status,r.start_time,r.end_time from cron.job_run_details r join cron.job j on j.jobid=r.jobid where j.jobname ilike '%enrich%' order by r.start_time desc limit 10)x)
) as bounded_enrichment_and_rotation;

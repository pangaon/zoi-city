-- Keep the enrichment scheduler in the deployable source of truth.
-- The enrich_token remains in Vault; it is never stored in cron.job text.

do $schedule$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
    and exists (select 1 from vault.decrypted_secrets where name = 'enrich_token') then
    if exists (select 1 from cron.job where jobname = 'zoi-enrich-hourly') then
      perform cron.unschedule('zoi-enrich-hourly');
    end if;
    perform cron.schedule(
      'zoi-enrich-hourly', '45 * * * *', $job$
        select net.http_post(
          url := 'https://csebihpaychdkanjjsmz.supabase.co/functions/v1/zoi-enrich',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
            'x-enrich-token', (select decrypted_secret from vault.decrypted_secrets where name = 'enrich_token')
          ),
          body := '{"limit":40}'::jsonb,
          timeout_milliseconds := 120000
        );
      $job$
    );
  end if;
end;
$schedule$;
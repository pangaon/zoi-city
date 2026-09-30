-- Scores verified against the live database after bounded maintenance repair.
BEGIN;
SELECT cron.alter_job(jobid,active:=false) FROM cron.job
 WHERE jobname IN ('zoi-maintenance-hourly','zoi-enrich-fullblast') AND active;
SELECT cron.schedule('zoi-maintenance-bounded','7,17,27,37,47,57 * * * *',
  $job$SET statement_timeout='8s'; SET lock_timeout='2s'; SELECT zoi.run_maintenance();$job$);
-- Duplicate scanning is separated and bounded so it cannot roll back scores.
SELECT cron.schedule('zoi-duplicate-maintenance-daily','20 6 * * *',
  $job$SET statement_timeout='8s'; SET lock_timeout='2s'; SELECT zoi.run_duplicate_maintenance();$job$);
COMMIT;

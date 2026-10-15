BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='10s';
-- Apply only AFTER the new worker and canonical shared admission are verified.
-- Original job id/command remain intact; disabled fullblast job stays disabled.
DO $schedule$
DECLARE c jsonb;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'enrichment_schedule_requires_postgres';END IF;
 FOR c IN SELECT value FROM jsonb_array_elements($contracts$
[
  {
    "acl": "{postgres=X/postgres,service_role=X/postgres}",
    "owner": "postgres",
    "config": [
      "search_path=\"\""
    ],
    "signature": "enrich_admission_release(text)",
    "volatility": "v",
    "definition_md5": "9251d564b9ae3fe6cf11b8e021d007f6",
    "security_definer": true
  },
  {
    "acl": "{postgres=X/postgres,service_role=X/postgres}",
    "owner": "postgres",
    "config": [
      "search_path=\"\""
    ],
    "signature": "enrich_sample_lease(uuid[])",
    "volatility": "v",
    "definition_md5": "e3b4e4c686b2e1194cf26febd6bee4a5",
    "security_definer": true
  },
  {
    "acl": "{postgres=X/postgres}",
    "owner": "postgres",
    "config": [
      "search_path=\"\""
    ],
    "signature": "zoi.enrich_admission_available()",
    "volatility": "v",
    "definition_md5": "4d487be1714e98354c928c8c04b66db8",
    "security_definer": true
  },
  {
    "acl": "{postgres=X/postgres}",
    "owner": "postgres",
    "config": [
      "search_path=\"\""
    ],
    "signature": "zoi.enrich_admission_reserve(text,integer,integer)",
    "volatility": "v",
    "definition_md5": "229eab4a427b83a7202c7a57f67a7820",
    "security_definer": true
  },
  {
    "acl": "{postgres=X/postgres}",
    "owner": "postgres",
    "config": [
      "search_path=\"\""
    ],
    "signature": "zoi.enrich_apply(jsonb)",
    "volatility": "v",
    "definition_md5": "310678a4bd7d77d5467dbd07604349d9",
    "security_definer": true
  },
  {
    "acl": "{postgres=X/postgres}",
    "owner": "postgres",
    "config": [
      "search_path=\"\""
    ],
    "signature": "zoi.enrich_queue_lease(integer,integer,integer)",
    "volatility": "v",
    "definition_md5": "01b9acf2167e117b40e92d736ff03374",
    "security_definer": true
  }
]
$contracts$::jsonb) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure(c->>'signature') AND md5(pg_get_functiondef(p.oid))=c->>'definition_md5' AND pg_get_userbyid(p.proowner)=c->>'owner' AND p.proacl::text=c->>'acl' AND to_jsonb(p.proconfig)=c->'config' AND p.prosecdef=(c->>'security_definer')::boolean AND p.provolatile::text=c->>'volatility') THEN RAISE EXCEPTION 'enrichment_schedule_installed_function_drift: %',c->>'signature';END IF;
 END LOOP;
 PERFORM zoi.enrich_admission_available();
 IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobid=30 AND jobname='zoi-enrich-hourly' AND NOT active AND schedule='45 * * * *' AND md5(command)='2ade25bb2cc7e9ab304662844ca1acfa' AND octet_length(command)=560)
 OR NOT EXISTS(SELECT 1 FROM cron.job WHERE jobid=10 AND jobname='zoi-enrich-fullblast' AND NOT active AND schedule='*/5 * * * *' AND md5(command)='4b82a985f467b9356a18d248d550483e' AND octet_length(command)=522)
 OR EXISTS(SELECT 1 FROM cron.job WHERE active AND jobid<>30 AND strpos(command,'/functions/v1/zoi-enrich')>0)
 THEN RAISE EXCEPTION 'enrichment_schedule_baseline_drift';END IF;
 IF to_regprocedure('public.enrich_admission_release(text)') IS NULL OR NOT EXISTS(SELECT 1 FROM zoi.delivery_state WHERE key='enrichment_admission_v1' AND value->'version'='1'::jsonb) THEN RAISE EXCEPTION 'enrichment_admission_not_installed';END IF;
 PERFORM cron.alter_job(job_id:=30,schedule:='*/5 * * * *',active:=true);
 IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobid=30 AND schedule='*/5 * * * *' AND active AND md5(command)='2ade25bb2cc7e9ab304662844ca1acfa') OR EXISTS(SELECT 1 FROM cron.job WHERE jobid=10 AND active) THEN RAISE EXCEPTION 'enrichment_schedule_postcondition_failed';END IF;
END $schedule$;
-- Guarded schedule rollback: require the same job30 id/name/command hash and
-- current */5 schedule, then cron.alter_job(job_id:=30,schedule:='45 * * * *').
-- Do not unschedule/recreate, enable job10, refund attempts or reset active flight.

COMMIT;

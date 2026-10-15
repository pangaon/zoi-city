BEGIN;
SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='20s';
-- Read reporting only. The canonical application writer below is a guarded
-- dependency and remains byte-identical; its full-row write CAS is not relaxed.
DO $guard$ DECLARE e jsonb;p pg_proc;BEGIN
 FOR e IN SELECT value FROM jsonb_array_elements($contracts$[
  {
    "acl": "{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
    "owner": "postgres",
    "config": [
      "search_path=\"\""
    ],
    "language": "sql",
    "signature": "public.geography_reviewed_point(uuid)",
    "volatility": "s",
    "definition_md5": "a3320206addf52bd1bf5521ca1ac6cd9",
    "security_definer": true
  },
  {
    "acl": "{postgres=X/postgres,service_role=X/postgres}",
    "owner": "postgres",
    "config": [
      "search_path=\"\""
    ],
    "language": "plpgsql",
    "signature": "public.geography_repair_record_application(uuid,uuid)",
    "volatility": "v",
    "definition_md5": "3f9e0896e6308211fd0366917f2ae68c",
    "security_definer": true
  },
  {
    "acl": "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
    "owner": "postgres",
    "config": [
      "search_path=\"\""
    ],
    "language": "plpgsql",
    "signature": "public.zoi_delivery_records(text,integer,integer,text)",
    "volatility": "s",
    "definition_md5": "9e535bd2ebf49cb4fb11ff5189b2379e",
    "security_definer": true
  },
  {
    "acl": "{postgres=X/postgres}",
    "owner": "postgres",
    "config": [
      "search_path=\"\""
    ],
    "language": "sql",
    "signature": "zoi.delivery_job_status()",
    "volatility": "s",
    "definition_md5": "47989e76146d2659fe57e47d9467e83c",
    "security_definer": true
  }
]$contracts$::jsonb) LOOP
  SELECT * INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure(e->>'signature');
  IF md5(pg_get_functiondef(p.oid)) IS DISTINCT FROM e->>'definition_md5' OR pg_get_userbyid(p.proowner) IS DISTINCT FROM e->>'owner' OR p.proacl::text IS DISTINCT FROM e->>'acl'
   OR to_jsonb(p.proconfig) IS DISTINCT FROM e->'config' OR p.prosecdef IS DISTINCT FROM (e->>'security_definer')::boolean OR p.provolatile::text IS DISTINCT FROM e->>'volatility' THEN RAISE EXCEPTION 'geography_reporting_contract_drift:%',e->>'signature';END IF;
 END LOOP;
END $guard$;
DO $patch$ DECLARE definition text;needle text;replacement text;BEGIN
 SELECT pg_get_functiondef('public.zoi_delivery_records(text,integer,integer,text)'::regprocedure) INTO STRICT definition;
 needle:=$old$CASE WHEN r.after_fingerprint=zoi.geography_fingerprint(l)AND r.reverted_at IS NULL THEN$old$;
 replacement:=$new$CASE WHEN (CASE WHEN p_category='addresses_corrected' THEN (public.geography_reviewed_point(l.id)->>'request_id')=r.request_id::text ELSE r.after_fingerprint=zoi.geography_fingerprint(l) END)AND r.reverted_at IS NULL THEN$new$;
 IF (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'geography_reporting_verification_patch_drift';END IF;
 definition:=replace(definition,needle,replacement);
 needle:=$old$ELSE r.receipt->>'precision'='street'AND r.after_fingerprint=zoi.geography_fingerprint(l)AND($old$;
 replacement:=$new$ELSE r.receipt->>'precision'='street'AND(public.geography_reviewed_point(l.id)->>'request_id')=r.request_id::text AND($new$;
 IF (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'geography_reporting_address_patch_drift';END IF;
 EXECUTE replace(definition,needle,replacement);
 SELECT pg_get_functiondef('zoi.delivery_job_status()'::regprocedure) INTO STRICT definition;
 needle:=$old$r.after_fingerprint=zoi.geography_fingerprint(l)$old$;
 replacement:=$new$((public.geography_reviewed_point(l.id)->>'request_id')=r.request_id::text)$new$;
 IF (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'geography_reporting_job_patch_drift';END IF;
 EXECUTE replace(definition,needle,replacement);
 IF md5(pg_get_functiondef('public.geography_repair_record_application(uuid,uuid)'::regprocedure)) IS DISTINCT FROM '3f9e0896e6308211fd0366917f2ae68c' THEN RAISE EXCEPTION 'geography_application_writer_changed';END IF;
END $patch$;
COMMIT;

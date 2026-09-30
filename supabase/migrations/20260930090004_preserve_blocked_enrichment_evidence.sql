BEGIN;
SET LOCAL lock_timeout='5s';
DO $patch$
DECLARE body text; old_fragment text; new_fragment text;
BEGIN
 body:=pg_get_functiondef('zoi.enrich_apply(jsonb)'::regprocedure);
 old_fragment:=$old$incoming->>'crawl_status'='error'$old$;
 IF (length(body)-length(replace(body,old_fragment,'')))/length(old_fragment)<>3 THEN RAISE EXCEPTION 'enrichment_apply_guard_definition_changed';END IF;
 body:=replace(body,old_fragment,$new$(incoming->>'crawl_status'='error' OR incoming->>'blocked'='true')$new$);
 old_fragment:=$old$'last_attempt_at',clock_timestamp());$old$;
 new_fragment:=$new$'last_attempt_at',clock_timestamp()) || CASE WHEN incoming->>'blocked'='true' THEN jsonb_build_object('blocked','true','blocked_reason',left(coalesce(nullif(incoming->>'blocked_reason',''),'source_blocked'),200)) ELSE '{}'::jsonb END;$new$;
 IF (length(body)-length(replace(body,old_fragment,'')))/length(old_fragment)<>1 THEN RAISE EXCEPTION 'enrichment_apply_error_definition_changed';END IF;
 body:=replace(body,old_fragment,new_fragment);
 -- Blocked sources remain visibly unresolved, never marked fetched.
 body:=replace(body,$old$THEN 'retry' ELSE 'fetched' END$old$,$new$THEN CASE WHEN incoming->>'blocked'='true' THEN 'blocked' ELSE 'retry' END ELSE 'fetched' END$new$);
 EXECUTE body;
END $patch$;
COMMIT;

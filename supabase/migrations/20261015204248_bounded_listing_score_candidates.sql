-- Requires the accepted shared-admission dashboard feed filter first.
-- No cron, formula, publication authority, listing schema or source-policy change.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='5s';
DO $guard$
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'maintenance_candidates_requires_postgres';END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended('zoi.run_maintenance',0)) THEN RAISE EXCEPTION 'maintenance_candidates_busy';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.run_maintenance()') AND md5(pg_get_functiondef(oid))='9d70cd4a53a9707ec4aa0be1ffb87ca6' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,service_role=X/postgres}' AND prosecdef=false AND proconfig=ARRAY['search_path=""'] AND provolatile='v') THEN RAISE EXCEPTION 'maintenance_candidates_dependency_drift: zoi.run_maintenance()';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.maintenance_event_date(text)') AND md5(pg_get_functiondef(oid))='2db348273194c690430a9809a6156f5b' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,service_role=X/postgres}' AND prosecdef=false AND proconfig=ARRAY['search_path=""'] AND provolatile='i') THEN RAISE EXCEPTION 'maintenance_candidates_dependency_drift: zoi.maintenance_event_date(text)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.zoi_delivery_dashboard(timestamp with time zone)') AND md5(pg_get_functiondef(oid))='47af16fd2d7d5e165ffcce23ef89a862' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' AND prosecdef=true AND proconfig=ARRAY['search_path=""'] AND provolatile='s') THEN RAISE EXCEPTION 'maintenance_candidates_dependency_drift: public.zoi_delivery_dashboard(timestamp with time zone)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.zoi_delivery_progress(uuid,text,jsonb)') AND md5(pg_get_functiondef(oid))='e0e5e2a8c2ca5b2c6c88cfef25b0fe38' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,service_role=X/postgres}' AND prosecdef=true AND proconfig=ARRAY['search_path=""'] AND provolatile='v') THEN RAISE EXCEPTION 'maintenance_candidates_dependency_drift: public.zoi_delivery_progress(uuid,text,jsonb)';END IF;
 IF current_setting('server_version_num')::integer NOT BETWEEN 160000 AND 179999 OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='zoi.delivery_state'::regclass AND pg_get_userbyid(relowner)='postgres' AND relacl::text=CASE WHEN current_setting('server_version_num')::integer>=170000 THEN '{postgres=arwdDxtm/postgres}' ELSE '{postgres=arwdDxt/postgres}' END AND relrowsecurity AND NOT relforcerowsecurity) OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='zoi.delivery_state'::regclass) OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='zoi.delivery_state'::regclass AND NOT tgisinternal) THEN RAISE EXCEPTION 'maintenance_candidates_state_contract_drift';END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE conrelid='zoi.delivery_state'::regclass)<>1 OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='zoi.delivery_state'::regclass AND conname='delivery_state_pkey' AND pg_get_constraintdef(oid)='PRIMARY KEY (key)') THEN RAISE EXCEPTION 'maintenance_candidates_state_shape_drift';END IF;
 IF (SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid))ORDER BY a.attnum)FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='zoi.delivery_state'::regclass AND a.attnum>0 AND NOT a.attisdropped) IS DISTINCT FROM '[["key","text",true,null],["value","jsonb",true,null],["updated_at","timestamp with time zone",true,"now()"]]'::jsonb THEN RAISE EXCEPTION 'maintenance_candidates_state_columns_drift';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint c JOIN pg_index i ON i.indexrelid=c.conindid JOIN pg_class idx ON idx.oid=i.indexrelid JOIN pg_am am ON am.oid=idx.relam WHERE c.conrelid='zoi.listings'::regclass AND c.contype='p' AND pg_get_constraintdef(c.oid)='PRIMARY KEY (id)' AND am.amname='btree' AND i.indisvalid AND i.indisready) THEN RAISE EXCEPTION 'maintenance_candidates_listing_primary_key_drift';END IF;
 IF to_regprocedure('zoi.maintenance_candidate_ids()') IS NOT NULL OR EXISTS(SELECT 1 FROM zoi.delivery_state WHERE key='listing_score_cursor_v1') THEN RAISE EXCEPTION 'maintenance_candidates_already_exists';END IF;
 IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobid=31 AND jobname='zoi-maintenance-bounded' AND active AND schedule='7,17,27,37,47,57 * * * *' AND md5(command)='7876d3105fcf6a7917047851f0ba6af9' AND octet_length(command)=80) THEN RAISE EXCEPTION 'maintenance_candidates_job_drift';END IF;
END $guard$;

INSERT INTO zoi.delivery_state(key,value) VALUES('listing_score_cursor_v1','{"version":1,"after_id":null}'::jsonb);

-- This is the only elevated boundary: fixed-key cursor and bounded ID reads.
-- Keep the existing maintenance lock BEFORE the cursor lock for every caller.
CREATE FUNCTION zoi.maintenance_candidate_ids() RETURNS uuid[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE s jsonb;after_id uuid;chosen uuid[];
BEGIN
 IF NOT pg_try_advisory_xact_lock(hashtextextended('zoi.run_maintenance',0)) THEN RETURN ARRAY[]::uuid[];END IF;
 SELECT value INTO s FROM zoi.delivery_state WHERE key='listing_score_cursor_v1' FOR UPDATE;
 IF s IS NULL OR jsonb_typeof(s) IS DISTINCT FROM 'object' OR s->'version' IS DISTINCT FROM '1'::jsonb OR NOT(s?'after_id') OR EXISTS(SELECT 1 FROM jsonb_object_keys(s)k WHERE k NOT IN('version','after_id')) THEN RAISE EXCEPTION 'maintenance_candidates_cursor_invalid';END IF;
 IF s->'after_id' IS DISTINCT FROM 'null'::jsonb THEN
  IF jsonb_typeof(s->'after_id') IS DISTINCT FROM 'string' OR coalesce(s->>'after_id','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'maintenance_candidates_cursor_invalid';END IF;
  after_id:=(s->>'after_id')::uuid;
 END IF;
 -- Two bounded PK seeks; the second runs only when the first found zero IDs.
 -- It is never a second batch: at most 1000 IDs are selected in total.
 IF after_id IS NULL THEN
  SELECT coalesce(array_agg(c.id ORDER BY c.id),ARRAY[]::uuid[]) INTO chosen FROM(SELECT l.id FROM zoi.listings l ORDER BY l.id LIMIT 1000)c;
 ELSE
  SELECT coalesce(array_agg(c.id ORDER BY c.id),ARRAY[]::uuid[]) INTO chosen FROM(SELECT l.id FROM zoi.listings l WHERE l.id>after_id ORDER BY l.id LIMIT 1000)c;
  IF cardinality(chosen)=0 THEN
   SELECT coalesce(array_agg(c.id ORDER BY c.id),ARRAY[]::uuid[]) INTO chosen FROM(SELECT l.id FROM zoi.listings l ORDER BY l.id LIMIT 1000)c;
  END IF;
 END IF;
 IF cardinality(chosen)>0 THEN
  UPDATE zoi.delivery_state SET value=jsonb_build_object('version',1,'after_id',chosen[cardinality(chosen)]::text),updated_at=clock_timestamp() WHERE key='listing_score_cursor_v1';
 END IF;
 RETURN chosen;
END $fn$;
ALTER FUNCTION zoi.maintenance_candidate_ids() OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.maintenance_candidate_ids() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION zoi.maintenance_candidate_ids() TO service_role;

CREATE OR REPLACE FUNCTION zoi.run_maintenance()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE changed integer;candidates uuid[];
BEGIN
  -- A second cron/manual invocation must not compete for the same rows.
  IF NOT pg_try_advisory_xact_lock(hashtextextended('zoi.run_maintenance',0)) THEN RETURN; END IF;
  candidates:=zoi.maintenance_candidate_ids();
  WITH selected AS MATERIALIZED (
    SELECT l.* FROM unnest(candidates) WITH ORDINALITY c(id,ord)
    CROSS JOIN LATERAL (SELECT row.* FROM zoi.listings row WHERE row.id=c.id FOR UPDATE OF row SKIP LOCKED)l
    ORDER BY c.ord
  ), scores AS MATERIALIZED (
    SELECT id,
      round(((CASE WHEN description IS NOT NULL AND length(description)>10 THEN 1 ELSE 0 END)
       +(CASE WHEN website IS NOT NULL THEN 1 ELSE 0 END)
       +(CASE WHEN address IS NOT NULL THEN 1 ELSE 0 END)
       +(CASE WHEN phone IS NOT NULL THEN 1 ELSE 0 END)
       +(CASE WHEN primary_category_id IS NOT NULL THEN 1 ELSE 0 END))::numeric/5,3) AS completeness,
      least(1.0,round((CASE verification_status WHEN 'admin_verified' THEN 0.9 WHEN 'owner_verified' THEN 0.85
        WHEN 'partner_verified' THEN 0.8 WHEN 'source_verified' THEN 0.6 WHEN 'owner_claimed' THEN 0.5 ELSE 0.3 END
        +CASE source_trust_tier WHEN 'official' THEN 0.1 WHEN 'partner' THEN 0.08 WHEN 'public_directory' THEN 0.05 ELSE 0 END)::numeric,3)) AS trust,
      CASE WHEN entity_type='event' AND zoi.maintenance_event_date(profile->>'end_datetime')<current_date THEN 0.2
        WHEN last_seen_at>now()-interval '14 days' THEN 0.95 ELSE 0.6 END AS freshness,
      CASE WHEN entity_type='event' AND zoi.maintenance_event_date(profile->>'end_datetime')<current_date-14
         AND coalesce(profile->>'recurring','')<>'annual' THEN 'archived' ELSE publish_status END AS next_status
    FROM selected
  ), due AS (
    SELECT s.* FROM scores s JOIN zoi.listings l USING(id)
    WHERE ROW(l.completeness_score,l.trust_score,l.freshness_score,l.publish_status)
      IS DISTINCT FROM ROW(s.completeness,s.trust,s.freshness,s.next_status)
    ORDER BY s.id LIMIT 1000
  )
  UPDATE zoi.listings l SET completeness_score=d.completeness,trust_score=d.trust,
    freshness_score=d.freshness,publish_status=d.next_status
  FROM due d WHERE l.id=d.id;
  GET DIAGNOSTICS changed=ROW_COUNT;
  INSERT INTO zoi.audit_log(actor,action,target_type,reason)
    VALUES('cron','run_maintenance','listing',format('Bounded score/freshness/archive maintenance: %s changed rows',changed));
END;
$function$
;
COMMIT;

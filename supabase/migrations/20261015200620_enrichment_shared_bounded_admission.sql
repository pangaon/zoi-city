-- Activation protocol: root first pauses existing job30, drains known worker
-- invocations, proves no active canonical leases, and excludes concurrent legacy
-- service callers. Never reset valid work/leases. Deploy and verify the new worker
-- before applying the separate schedule migration. The default bootstrap flight
-- blocks for60 minutes; service release cannot clear it. Root may withdraw only
-- that exact bootstrap after separately reviewed actual quiescence and Edge proof. First UTC-day count describes
-- POST-ACTIVATION admissions only; historical attempts are not reconstructed.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
-- Shared admission for the existing canonical enrichment lease functions.
-- No source fetch, job creation, writer replacement, credential or schedule changes.
DO $guard$
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'enrichment_admission_requires_postgres';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.enrich_queue_lease(integer,integer,integer)'::regprocedure AND md5(pg_get_functiondef(oid))='950a5ee4f0fad7fa4700805d0ac034ee' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""'] AND provolatile='v') THEN RAISE EXCEPTION 'enrichment_admission_baseline_drift: zoi.enrich_queue_lease(integer,integer,integer)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='enrich_sample_lease(uuid[])'::regprocedure AND md5(pg_get_functiondef(oid))='15626a3b9a0f095af32bb748627e651a' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,service_role=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""'] AND provolatile='v') THEN RAISE EXCEPTION 'enrichment_admission_baseline_drift: enrich_sample_lease(uuid[])';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi_delivery_dashboard(timestamp with time zone)'::regprocedure AND md5(pg_get_functiondef(oid))='99b1122c3779a9795a2ed8eb82f737f9' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""'] AND provolatile='s') THEN RAISE EXCEPTION 'enrichment_admission_baseline_drift: zoi_delivery_dashboard(timestamp with time zone)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi_delivery_progress(uuid,text,jsonb)'::regprocedure AND md5(pg_get_functiondef(oid))='e0e5e2a8c2ca5b2c6c88cfef25b0fe38' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,service_role=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""'] AND provolatile='v') THEN RAISE EXCEPTION 'enrichment_admission_baseline_drift: zoi_delivery_progress(uuid,text,jsonb)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.enrich_apply(jsonb)'::regprocedure AND md5(pg_get_functiondef(oid))='310678a4bd7d77d5467dbd07604349d9' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""'] AND provolatile='v') THEN RAISE EXCEPTION 'enrichment_admission_baseline_drift: zoi.enrich_apply(jsonb)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='zoi.delivery_state'::regclass AND pg_get_userbyid(relowner)='postgres' AND relacl::text=CASE WHEN current_setting('server_version_num')::integer>=170000 THEN '{postgres=arwdDxtm/postgres}' ELSE '{postgres=arwdDxt/postgres}' END AND relrowsecurity AND NOT relforcerowsecurity) OR current_setting('server_version_num')::integer NOT BETWEEN 160000 AND 179999 OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='zoi.delivery_state'::regclass) OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='zoi.delivery_state'::regclass AND NOT tgisinternal) THEN RAISE EXCEPTION 'enrichment_admission_state_contract_drift';END IF;
 IF (SELECT count(*) FROM pg_attribute WHERE attrelid='zoi.delivery_state'::regclass AND attnum>0 AND NOT attisdropped)<>3 OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='zoi.delivery_state'::regclass AND conname='delivery_state_pkey' AND pg_get_constraintdef(oid)='PRIMARY KEY (key)') THEN RAISE EXCEPTION 'enrichment_admission_state_shape_drift';END IF;
 IF (SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid))ORDER BY a.attnum)FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='zoi.delivery_state'::regclass AND a.attnum>0 AND NOT a.attisdropped) IS DISTINCT FROM '[["key","text",true,null],["value","jsonb",true,null],["updated_at","timestamp with time zone",true,"now()"]]'::jsonb THEN RAISE EXCEPTION 'enrichment_admission_state_columns_drift';END IF;
 IF EXISTS(SELECT 1 FROM zoi.delivery_state WHERE key='enrichment_admission_v1') THEN RAISE EXCEPTION 'enrichment_admission_state_already_exists';END IF;
END $guard$;

INSERT INTO zoi.delivery_state(key,value) VALUES('enrichment_admission_v1',jsonb_build_object('version',1,'utc_day',(clock_timestamp() AT TIME ZONE 'UTC')::date::text,'leased_attempts',0,'flight',jsonb_build_object('kind','bootstrap','lease_id',gen_random_uuid()::text,'expires_at',clock_timestamp()+interval'60 minutes')));

-- The row lock is always acquired BEFORE listing row locks. The clock is read
-- AFTER the lock; transaction-start now() is unsuitable after a lock wait.
CREATE FUNCTION zoi.enrich_admission_available() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE s jsonb;t timestamptz;d date;today date;used integer;flight jsonb;expiry timestamptz;
BEGIN
 SELECT value INTO s FROM zoi.delivery_state WHERE key='enrichment_admission_v1' FOR UPDATE;
 t:=clock_timestamp();today:=(t AT TIME ZONE 'UTC')::date;
 IF s IS NULL OR jsonb_typeof(s) IS DISTINCT FROM 'object' OR s->'version' IS DISTINCT FROM '1'::jsonb OR jsonb_typeof(s->'utc_day') IS DISTINCT FROM 'string' OR coalesce(s->>'utc_day','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR jsonb_typeof(s->'leased_attempts') IS DISTINCT FROM 'number' OR coalesce(s->>'leased_attempts','')!~'^[0-9]{1,3}$' OR NOT(s?'flight') OR EXISTS(SELECT 1 FROM jsonb_object_keys(s)k WHERE k NOT IN('version','utc_day','leased_attempts','flight')) THEN RAISE EXCEPTION 'enrichment_admission_state_invalid';END IF;
 BEGIN d:=(s->>'utc_day')::date;EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'enrichment_admission_state_invalid';END;
 used:=(s->>'leased_attempts')::integer;flight:=s->'flight';
 IF d>today OR used>864 OR d::text<>s->>'utc_day' THEN RAISE EXCEPTION 'enrichment_admission_state_invalid';END IF;
 IF flight IS DISTINCT FROM 'null'::jsonb THEN
  IF jsonb_typeof(flight) IS DISTINCT FROM 'object' OR jsonb_typeof(flight->'lease_id') IS DISTINCT FROM 'string' OR coalesce(flight->>'lease_id','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR jsonb_typeof(flight->'expires_at') IS DISTINCT FROM 'string' OR jsonb_typeof(flight->'kind') IS DISTINCT FROM 'string' OR coalesce(flight->>'kind','') NOT IN('bootstrap','run') OR EXISTS(SELECT 1 FROM jsonb_object_keys(flight)k WHERE k NOT IN('kind','lease_id','expires_at')) THEN RAISE EXCEPTION 'enrichment_admission_state_invalid';END IF;
  expiry:=zoi.enrich_timestamp(flight->>'expires_at');
  IF expiry IS NULL OR NOT isfinite(expiry) THEN RAISE EXCEPTION 'enrichment_admission_state_invalid';END IF;
  -- Never clear a prior-day active flight while rolling the daily budget.
  IF expiry>t THEN RETURN 0;END IF;
 END IF;
 RETURN least(3,864-CASE WHEN d=today THEN used ELSE 0 END);
END $fn$;
ALTER FUNCTION zoi.enrich_admission_available() OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.enrich_admission_available() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION zoi.enrich_admission_reserve(p_lease text,p_count integer,p_minutes integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE available integer;s jsonb;t timestamptz;today text;used integer;
BEGIN
 available:=zoi.enrich_admission_available();
 IF p_lease IS NULL OR p_lease!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR p_count IS NULL OR p_count<1 OR p_count>available THEN RAISE EXCEPTION 'enrichment_admission_reservation_refused';END IF;
 SELECT value INTO s FROM zoi.delivery_state WHERE key='enrichment_admission_v1';
 t:=clock_timestamp();today:=(t AT TIME ZONE 'UTC')::date;used:=CASE WHEN s->>'utc_day'=today THEN(s->>'leased_attempts')::integer ELSE 0 END;
 UPDATE zoi.delivery_state SET value=jsonb_build_object('version',1,'utc_day',today,'leased_attempts',used+p_count,'flight',jsonb_build_object('kind','run','lease_id',p_lease,'expires_at',t+make_interval(mins=>greatest(15,least(coalesce(p_minutes,15),60))))),updated_at=t WHERE key='enrichment_admission_v1';
END $fn$;
ALTER FUNCTION zoi.enrich_admission_reserve(text,integer,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.enrich_admission_reserve(text,integer,integer) FROM PUBLIC,anon,authenticated,service_role;

-- Only known completion calls this. Unknown/lost/aborted work keeps its flight
-- and charged attempts until expiry. A stale release cannot clear a successor.
CREATE FUNCTION public.enrich_admission_release(p_lease text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE s jsonb;
BEGIN
 IF p_lease IS NULL OR p_lease!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'invalid_enrichment_admission_lease';END IF;
 PERFORM zoi.enrich_admission_available();
 SELECT value INTO s FROM zoi.delivery_state WHERE key='enrichment_admission_v1';
 IF s#>>'{flight,kind}'='bootstrap' THEN RETURN jsonb_build_object('ok',false,'released',false,'error','bootstrap_barrier');END IF;
 IF s#>>'{flight,lease_id}' IS DISTINCT FROM p_lease THEN RETURN jsonb_build_object('ok',true,'released',false);END IF;
 UPDATE zoi.delivery_state SET value=jsonb_set(value,'{flight}','null'::jsonb),updated_at=clock_timestamp() WHERE key='enrichment_admission_v1';
 RETURN jsonb_build_object('ok',true,'released',true);
END $fn$;
ALTER FUNCTION public.enrich_admission_release(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enrich_admission_release(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enrich_admission_release(text) TO service_role;

CREATE OR REPLACE FUNCTION zoi.enrich_queue_lease(p_limit integer DEFAULT 40, p_max_age_days integer DEFAULT 30, p_lease_minutes integer DEFAULT 15)
 RETURNS TABLE(slug text, website text, lease_id text, listing_id uuid, name text, entity_type text, existing_enrich jsonb, owner_managed boolean, owner_workspace_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE lease text:=gen_random_uuid()::text;n integer:=greatest(least(coalesce(p_limit,3),3),1);admission integer;fresh_quota integer;chosen uuid[]:=ARRAY[]::uuid[];pick uuid;phase integer;bucket integer;needed integer;
BEGIN
 admission:=zoi.enrich_admission_available();n:=least(n,admission);IF n=0 THEN RETURN;END IF;
 fresh_quota:=ceil(n*2.0/3)::integer;
 -- Fresh quota, then retry/fallback, then unused fresh capacity. Each branch
 -- stops at its needed rows, not a window ranking of the whole eligible corpus.
 FOR phase IN 1..3 LOOP
  bucket:=CASE WHEN phase=2 THEN 1 ELSE 0 END;
  needed:=CASE WHEN phase=1 THEN fresh_quota ELSE n-cardinality(chosen) END;
  IF needed<=0 THEN CONTINUE;END IF;
  FOR pick IN
   SELECT l.id FROM zoi.listings l
   WHERE l.publish_status='published' AND l.moderation_status IN('clean','cleared') AND coalesce(l.marketplace_status,'')<>'hidden'
   AND l.website~*'^https?://' AND coalesce(l.profile#>>'{_enrich,blocked}','')<>'true'
   AND (CASE WHEN l.profile#>>'{_enrich,crawl_status}'='error' THEN 1 ELSE 0 END)=bucket
   AND NOT(l.id=ANY(chosen))
   AND (
    zoi.enrich_timestamp(l.profile#>>'{_enrich,checked_at}') IS NULL
    OR zoi.enrich_timestamp(l.profile#>>'{_enrich,checked_at}')<current_date-greatest(coalesce(p_max_age_days,30),1)
    OR l.profile#>>'{_enrich,crawl_status}'='error'
    OR (l.profile#>>'{_enrich,crawl_status}' IS NULL AND l.profile#>>'{_enrich,status}' IS NULL
        AND zoi.enrich_timestamp(l.profile#>>'{_enrich,last_attempt_at}') IS NULL
        AND l.profile#>>'{_coverage,tasks,enrichment,status}' IS NULL)
   )
   AND (l.profile#>>'{_enrich,crawl_status}' IS DISTINCT FROM 'error'
        OR coalesce(zoi.enrich_timestamp(l.profile#>>'{_enrich,last_attempt_at}'),zoi.enrich_timestamp(l.profile#>>'{_enrich,checked_at}'),'-infinity')<=now()-interval '6 hours')
   AND coalesce(zoi.enrich_timestamp(l.profile#>>'{_enrich,lease,expires_at}'),'-infinity')<now()
   ORDER BY (l.verification_status IN('verified','owner_verified','source_verified'))DESC,l.profile#>>'{_enrich,checked_at}' NULLS FIRST,l.id
   LIMIT needed FOR UPDATE OF l SKIP LOCKED
  LOOP chosen:=array_append(chosen,pick);END LOOP;
 END LOOP;
 IF cardinality(chosen)=0 THEN RETURN;END IF;
 PERFORM zoi.enrich_admission_reserve(lease,cardinality(chosen),p_lease_minutes);
 RETURN QUERY WITH leased AS (
 UPDATE zoi.listings l SET profile=coalesce(l.profile,'{}')||jsonb_build_object('_enrich',coalesce(l.profile->'_enrich','{}')||jsonb_build_object('lease',jsonb_build_object('id',lease,'task','enrichment','fingerprint',zoi.listing_quality_fingerprint(l),'source_website',l.website,'authority_version',1,'authority_fingerprint',zoi.enrich_authority_fingerprint(l),'expires_at',clock_timestamp()+make_interval(mins=>greatest(least(coalesce(p_lease_minutes,15),60),1)))))
 WHERE l.id=ANY(chosen) RETURNING l.*
 ) SELECT l.slug,l.website,lease,l.id,l.name,l.entity_type,(coalesce(l.profile->'_enrich','{}')-'lease')||jsonb_build_object('_lease_source_context',jsonb_build_object('city',l.city,'country',l.country,'address',l.address)),l.owner_workspace_id IS NOT NULL,l.owner_workspace_id FROM leased l;
END $function$;

CREATE OR REPLACE FUNCTION public.enrich_sample_lease(p_ids uuid[])
 RETURNS TABLE(slug text, website text, lease_id text, listing_id uuid, name text, entity_type text, existing_enrich jsonb, owner_managed boolean, owner_workspace_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE lease text:=gen_random_uuid()::text;admission integer;chosen uuid[];
BEGIN
 IF p_ids IS NULL OR cardinality(p_ids) NOT BETWEEN 1 AND 3 OR array_position(p_ids,NULL) IS NOT NULL OR cardinality(p_ids)<>(SELECT count(DISTINCT x) FROM unnest(p_ids)x) THEN RAISE EXCEPTION 'invalid_enrichment_sample';END IF;
 admission:=zoi.enrich_admission_available();IF admission=0 THEN RETURN;END IF;
 SELECT coalesce(array_agg(c.id),ARRAY[]::uuid[]) INTO chosen FROM(SELECT l.id FROM zoi.listings l WHERE l.id=ANY(p_ids) AND l.publish_status='published' AND l.moderation_status IN('clean','cleared') AND coalesce(l.marketplace_status,'')<>'hidden' AND l.website~*'^https?://' AND coalesce(l.profile#>>'{_enrich,blocked}','')<>'true' AND coalesce(zoi.enrich_timestamp(l.profile#>>'{_enrich,lease,expires_at}'),'-infinity')<now() ORDER BY l.id LIMIT admission FOR UPDATE SKIP LOCKED)c;
 IF cardinality(chosen)=0 THEN RETURN;END IF;
 PERFORM zoi.enrich_admission_reserve(lease,cardinality(chosen),15);
 RETURN QUERY WITH candidates AS(SELECT unnest(chosen)id),leased AS(
 UPDATE zoi.listings l SET profile=coalesce(l.profile,'{}')||jsonb_build_object('_enrich',coalesce(l.profile->'_enrich','{}')||jsonb_build_object('lease',jsonb_build_object('id',lease,'task','enrichment','fingerprint',zoi.listing_quality_fingerprint(l),'source_website',l.website,'authority_version',1,'authority_fingerprint',zoi.enrich_authority_fingerprint(l),'expires_at',clock_timestamp()+interval '15 minutes')))FROM candidates c WHERE l.id=c.id RETURNING l.*)
 SELECT l.slug,l.website,lease,l.id,l.name,l.entity_type,(coalesce(l.profile->'_enrich','{}')-'lease')||jsonb_build_object('_lease_source_context',jsonb_build_object('city',l.city,'country',l.country,'address',l.address)),l.owner_workspace_id IS NOT NULL,l.owner_workspace_id FROM leased l;
END $function$;


-- Fixed public dashboard feed inventory, excluding internal admission state.
CREATE OR REPLACE FUNCTION public.zoi_delivery_dashboard(p_since timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor uuid;queue jsonb;metrics jsonb;actions jsonb;mobiles jsonb;last_activity timestamptz;ready jsonb;groups jsonb;history jsonb;reports jsonb;feeds jsonb;
BEGIN
 actor:=zoi.delivery_require_founder();
 SELECT value INTO queue FROM zoi.delivery_state WHERE key='queue_sync';
 SELECT value INTO metrics FROM zoi.delivery_state WHERE key='metrics_sync';
 SELECT jsonb_set(coalesce(metrics,'{}'::jsonb),'{metrics}',coalesce((SELECT jsonb_agg(m||jsonb_build_object('records_available',CASE WHEN m->>'key'IN('websites_reviewed','profiles_enriched','homes_visual','customer_actions') THEN (m->'value'<>'null'::jsonb OR EXISTS(SELECT 1 FROM zoi.delivery_record_evidence e WHERE e.category=m->>'key')) ELSE coalesce((m->>'records_available')::boolean,false) END,'value',CASE WHEN m->>'key'IN('websites_reviewed','profiles_enriched','homes_visual','customer_actions')AND(m->'value'<>'null'::jsonb OR EXISTS(SELECT 1 FROM zoi.delivery_record_evidence e WHERE e.category=m->>'key'))THEN to_jsonb((SELECT count(DISTINCT e.listing_id)FROM zoi.delivery_record_evidence e JOIN zoi.listings l ON l.id=e.listing_id WHERE e.category=m->>'key'AND e.record_fingerprint=zoi.geography_fingerprint(l)AND(e.category<>'customer_actions'OR EXISTS(SELECT 1 FROM zoi.delivery_features f WHERE f.state='live and verified'AND f.release->>'id'=e.release->>'id'AND f.proof->'record_ids'@>jsonb_build_array(l.id::text)))))ELSE m->'value'END))FROM jsonb_array_elements(coalesce(metrics->'metrics','[]'::jsonb))m),'[]'::jsonb))INTO metrics;
 SELECT value INTO actions FROM zoi.delivery_state WHERE key='owner_actions_sync';
 SELECT value INTO mobiles FROM zoi.delivery_state WHERE key='mobile_sync';
 SELECT max(created_at)INTO last_activity FROM zoi.delivery_events;
 SELECT coalesce(jsonb_agg(info||jsonb_build_object('id',id,'release',release,'verification',proof,'verified_at',proof->>'verified_at','status',state)ORDER BY updated_at DESC),'[]'::jsonb)INTO ready FROM zoi.delivery_features WHERE state='live and verified';
 SELECT coalesce(jsonb_agg(g||jsonb_build_object('status',CASE WHEN g->>'status'='live and verified' THEN CASE WHEN jsonb_array_length(coalesce(g->'outcomes','[]'::jsonb))>0 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(g->'outcomes','[]'::jsonb))o WHERE NOT EXISTS(SELECT 1 FROM zoi.delivery_features f WHERE f.id=o->>'id'AND f.state='live and verified'))THEN 'live and verified'ELSE 'being tested'END ELSE coalesce(g->>'status','not started')END,'outcomes',coalesce((SELECT jsonb_agg(o||jsonb_build_object('status',CASE WHEN f.state='live and verified'THEN f.state WHEN f.state IS NOT NULL THEN 'being tested'WHEN o->>'status'='live and verified'THEN 'being tested'ELSE coalesce(o->>'status','not started')END))FROM jsonb_array_elements(coalesce(g->'outcomes','[]'::jsonb))o LEFT JOIN zoi.delivery_features f ON f.id=o->>'id'),'[]'::jsonb))),'[]'::jsonb)
 INTO groups FROM jsonb_array_elements(coalesce(queue->'groups','[]'::jsonb))g;
 SELECT coalesce(jsonb_agg(g||jsonb_build_object('status',CASE WHEN EXISTS(SELECT 1 FROM zoi.delivery_reports r WHERE r.queue_group=g->>'id' AND r.state<>'live and verified') THEN 'being tested' ELSE g->>'status' END,'outcomes',coalesce(g->'outcomes','[]'::jsonb)||coalesce((SELECT jsonb_agg(jsonb_build_object('id','problem:'||r.request_id,'title',r.message,'status',r.state,'remaining','Investigate and verify the reported problem with its original profile, feature and release context.','evidence',r.context,'reported_at',r.created_at))FROM zoi.delivery_reports r WHERE r.queue_group=g->>'id'),'[]'::jsonb))),'[]'::jsonb)INTO groups FROM jsonb_array_elements(groups)g;
 SELECT coalesce(jsonb_agg(x ORDER BY x->>'at' DESC),'[]'::jsonb)INTO history FROM(SELECT jsonb_build_object('id',id,'event',kind,'title',title,'at',created_at,'evidence_state',evidence_state,'record_id',payload->>'listing_id','release',payload->'release')x FROM zoi.delivery_events WHERE p_since IS NULL OR created_at>p_since ORDER BY created_at DESC LIMIT 60)s;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',request_id,'message',message,'context',context,'status',state,'at',created_at)ORDER BY created_at DESC),'[]'::jsonb)INTO reports FROM(SELECT *FROM zoi.delivery_reports ORDER BY created_at DESC LIMIT 100)s;
 SELECT coalesce(jsonb_agg(jsonb_build_object('name',CASE key WHEN 'queue_sync'THEN 'Authoritative work queue'WHEN 'metrics_sync'THEN 'Record coverage and corrections'WHEN 'owner_actions_sync'THEN 'Owner actions'WHEN 'mobile_sync'THEN 'Mobile releases'END,'state','connected','last_success_at',updated_at)),'[]'::jsonb)INTO feeds FROM zoi.delivery_state WHERE key IN('queue_sync','metrics_sync','owner_actions_sync','mobile_sync');
 feeds:=feeds||coalesce(queue->'feeds','[]'::jsonb);
 RETURN jsonb_build_object('jobs',zoi.delivery_job_status())||jsonb_build_object('schema_version',1,'generated_at',now(),'last_activity_at',last_activity,'scope',coalesce(queue->'scope','{}'::jsonb),'metrics',coalesce(metrics->'metrics','[]'::jsonb),'coverage',coalesce(metrics->'coverage','{}'::jsonb),'groups',groups,'ready',ready,'actions',coalesce((SELECT jsonb_agg(a||jsonb_build_object('status',coalesce((SELECT state FROM zoi.delivery_action_checks c WHERE c.action_id=a->>'id'ORDER BY created_at DESC LIMIT 1),a->>'status','needs your action'),'last_checked_at',(SELECT checked_at FROM zoi.delivery_action_checks c WHERE c.action_id=a->>'id'ORDER BY created_at DESC LIMIT 1)))FROM jsonb_array_elements(coalesce(actions->'actions','[]'::jsonb))a),'[]'::jsonb),'activity',history,'mobile',coalesce(mobiles->'mobile','[]'::jsonb),'feeds',feeds,'reported_problems',reports);
END $function$;

DO $writer_guard$ BEGIN IF md5(pg_get_functiondef('zoi.enrich_apply(jsonb)'::regprocedure))<>'310678a4bd7d77d5467dbd07604349d9' THEN RAISE EXCEPTION 'canonical_writer_changed';END IF;END $writer_guard$;

COMMIT;

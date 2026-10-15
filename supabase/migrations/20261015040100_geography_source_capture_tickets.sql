-- Source-only Cron admission without queueing a reusable credential. Does not install/enable Cron.
BEGIN;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='30s';
DO $guard$DECLARE x record;p record;BEGIN
 FOR x IN SELECT * FROM(VALUES
 ('public.geography_source_capture_acquire(uuid)','8941c21efae7b8f687a2e839c6ba3eb2'),
 ('public.geography_source_capture_release(uuid)','0554c412af77901a5f4a0d607bf2376a'),
 ('public.geography_source_archive_budget()','d2ecc17519cf06e5008f105a58fb45a6'),
 ('public.geography_publisher_document_lease(integer)','e76aea1d124889fc37b7d846dff03830'),
 ('public.geography_repair_lease(integer,text)','7dee3566b96b2466515aba4097227661'))v(signature,digest)LOOP
 SELECT md5(pg_get_functiondef(oid))AS digest,pg_get_userbyid(proowner)AS owner_name,proacl::text AS acl,prosecdef,proconfig INTO p FROM pg_proc WHERE oid=to_regprocedure(x.signature);
 IF p.digest IS DISTINCT FROM x.digest OR p.owner_name IS DISTINCT FROM 'postgres'OR p.acl IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']THEN RAISE EXCEPTION 'capture_ticket_dependency_drift:%',x.signature;END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)')AND pg_get_userbyid(proowner)='supabase_admin'AND proacl IS NULL AND NOT prosecdef AND proconfig IS NULL AND md5(pg_get_functiondef(oid))='05103078b4b36c776bc0925f4fecf8e2')THEN RAISE EXCEPTION 'capture_ticket_transport_drift';END IF;
 IF to_regclass('zoi.geography_capture_ticket_policy')IS NOT NULL OR to_regclass('zoi.geography_capture_tickets')IS NOT NULL THEN RAISE EXCEPTION 'capture_ticket_candidate_exists';END IF;
END $guard$;
CREATE TABLE zoi.geography_capture_ticket_policy(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),enabled boolean NOT NULL DEFAULT false,
 generation_id uuid NOT NULL DEFAULT gen_random_uuid(),starts_at timestamptz,expires_at timestamptz,last_admitted_at timestamptz,next_strategy text NOT NULL DEFAULT 'official_sources_v1'CHECK(next_strategy IN('official_sources_v1','publisher_profiles_v1')),
 CHECK((starts_at IS NULL AND expires_at IS NULL AND NOT enabled)OR(starts_at IS NOT NULL AND expires_at IS NOT NULL AND expires_at>starts_at AND expires_at<=starts_at+interval'24 hours'))
);
ALTER TABLE zoi.geography_capture_ticket_policy OWNER TO postgres;
ALTER TABLE zoi.geography_capture_ticket_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.geography_capture_ticket_policy FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO zoi.geography_capture_ticket_policy(singleton)VALUES(true);
CREATE FUNCTION zoi.geography_capture_policy_generation()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $fn$BEGIN
 IF NEW.enabled IS DISTINCT FROM OLD.enabled OR NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN NEW.generation_id:=gen_random_uuid();
 ELSIF NEW.generation_id IS DISTINCT FROM OLD.generation_id THEN RAISE EXCEPTION 'capture_policy_generation_immutable';END IF;RETURN NEW;END $fn$;
ALTER FUNCTION zoi.geography_capture_policy_generation()OWNER TO postgres;REVOKE ALL ON FUNCTION zoi.geography_capture_policy_generation()FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER geography_capture_policy_generation BEFORE UPDATE ON zoi.geography_capture_ticket_policy FOR EACH ROW EXECUTE FUNCTION zoi.geography_capture_policy_generation();
CREATE TABLE zoi.geography_capture_tickets(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_sha256 text NOT NULL UNIQUE CHECK(ticket_sha256~'^[a-f0-9]{64}$'),
 purpose text NOT NULL DEFAULT 'geography_source_capture_v1'CHECK(purpose='geography_source_capture_v1'),
 project_ref text NOT NULL DEFAULT 'csebihpaychdkanjjsmz'CHECK(project_ref='csebihpaychdkanjjsmz'),
 policy_generation uuid NOT NULL,strategy text NOT NULL CHECK(strategy IN('official_sources_v1','publisher_profiles_v1')),
 job_cap integer NOT NULL DEFAULT 4 CHECK(job_cap=4),max_source_requests integer NOT NULL,max_response_bytes bigint NOT NULL,
 issued_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,consumed_at timestamptz,revoked_at timestamptz,net_request_id bigint,
 CHECK(expires_at>issued_at AND expires_at<=issued_at+interval'2 minutes'),
 CHECK((strategy='official_sources_v1'AND max_source_requests=50 AND max_response_bytes=15000000)OR(strategy='publisher_profiles_v1'AND max_source_requests=30 AND max_response_bytes=12000000))
);
ALTER TABLE zoi.geography_capture_tickets OWNER TO postgres;
ALTER TABLE zoi.geography_capture_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.geography_capture_tickets FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX geography_capture_tickets_daily ON zoi.geography_capture_tickets(issued_at);
CREATE FUNCTION zoi.geography_capture_ticket_immutable()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $fn$
BEGIN
 IF TG_OP='DELETE'THEN RAISE EXCEPTION 'capture_ticket_history_immutable';END IF;
 IF(to_jsonb(NEW)-ARRAY['consumed_at','revoked_at'])IS DISTINCT FROM(to_jsonb(OLD)-ARRAY['consumed_at','revoked_at'])OR(OLD.consumed_at IS NOT NULL AND NEW.consumed_at IS DISTINCT FROM OLD.consumed_at)OR(OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at)THEN RAISE EXCEPTION 'capture_ticket_history_immutable';END IF;
 RETURN NEW;
END $fn$;
ALTER FUNCTION zoi.geography_capture_ticket_immutable()OWNER TO postgres;REVOKE ALL ON FUNCTION zoi.geography_capture_ticket_immutable()FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER geography_capture_ticket_immutable BEFORE UPDATE OR DELETE ON zoi.geography_capture_tickets FOR EACH ROW EXECUTE FUNCTION zoi.geography_capture_ticket_immutable();
CREATE FUNCTION public.geography_source_ticket_consume(p_ticket text,p_strategy text)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $fn$
DECLARE policy zoi.geography_capture_ticket_policy;t zoi.geography_capture_tickets;stamp timestamptz;
BEGIN
 IF p_ticket IS NULL OR p_ticket!~'^[a-f0-9]{64}$'OR p_strategy IS NULL OR p_strategy NOT IN('official_sources_v1','publisher_profiles_v1')THEN RAISE EXCEPTION 'capture_ticket_unavailable' USING errcode='42501';END IF;
 -- Shared policy lock makes disable/expiry/revocation and consumption serializable.
 SELECT * INTO policy FROM zoi.geography_capture_ticket_policy WHERE singleton FOR SHARE;
 SELECT * INTO t FROM zoi.geography_capture_tickets WHERE ticket_sha256=encode(extensions.digest(p_ticket,'sha256'),'hex')FOR UPDATE;
 stamp:=clock_timestamp();
 IF NOT policy.enabled OR policy.starts_at>stamp OR policy.expires_at IS NULL OR policy.expires_at<=stamp OR t.id IS NULL OR t.policy_generation IS DISTINCT FROM policy.generation_id OR t.strategy IS DISTINCT FROM p_strategy OR t.issued_at>stamp OR t.expires_at<=stamp OR t.consumed_at IS NOT NULL OR t.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'capture_ticket_unavailable' USING errcode='42501';END IF;
 UPDATE zoi.geography_capture_tickets SET consumed_at=stamp WHERE id=t.id;
 RETURN jsonb_build_object('admitted',true,'strategy',t.strategy,'job_cap',t.job_cap,'max_source_requests',t.max_source_requests,'max_response_bytes',t.max_response_bytes,'expires_at',t.expires_at);
END $fn$;
ALTER FUNCTION public.geography_source_ticket_consume(text,text)OWNER TO postgres;REVOKE ALL ON FUNCTION public.geography_source_ticket_consume(text,text)FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.geography_source_ticket_consume(text,text)TO service_role;
CREATE FUNCTION zoi.geography_source_capture_tick()RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $fn$
DECLARE policy zoi.geography_capture_ticket_policy;stamp timestamptz;day_start timestamptz;n integer;ticket text;ticket_id uuid;strategy text;expiry timestamptz;request_id bigint;budget jsonb;
BEGIN
 SELECT * INTO policy FROM zoi.geography_capture_ticket_policy WHERE singleton FOR UPDATE;stamp:=clock_timestamp();
 IF NOT policy.enabled OR policy.starts_at>stamp OR policy.expires_at IS NULL OR policy.expires_at<=stamp THEN RETURN jsonb_build_object('admitted',false,'reason','disabled_or_expired');END IF;
 IF policy.last_admitted_at IS NOT NULL AND policy.last_admitted_at>stamp-interval'5 minutes'THEN RETURN jsonb_build_object('admitted',false,'reason','interval');END IF;
 day_start:=date_trunc('day',stamp AT TIME ZONE 'UTC')AT TIME ZONE 'UTC';
 SELECT count(*)INTO n FROM zoi.geography_capture_tickets WHERE issued_at>=day_start AND issued_at<day_start+interval'1 day';
 IF n>=288 THEN RETURN jsonb_build_object('admitted',false,'reason','daily_limit');END IF;
 budget:=public.geography_source_archive_budget();
 IF budget->'can_archive'IS DISTINCT FROM 'true'::jsonb OR jsonb_typeof(budget->'stored_bytes')IS DISTINCT FROM 'number'OR jsonb_typeof(budget->'limit_bytes')IS DISTINCT FROM 'number'OR(budget->>'stored_bytes')::numeric<0 OR(budget->>'limit_bytes')::numeric<=0 OR(budget->>'limit_bytes')::numeric>536870912 OR(budget->>'stored_bytes')::numeric+15000000>(budget->>'limit_bytes')::numeric THEN RETURN jsonb_build_object('admitted',false,'reason','archive_budget');END IF;
 -- Budget IO may wait. Recheck the hard window immediately before mint/queue.
 stamp:=clock_timestamp();IF policy.expires_at<=stamp THEN RETURN jsonb_build_object('admitted',false,'reason','disabled_or_expired');END IF;
 strategy:=policy.next_strategy;expiry:=least(stamp+interval'2 minutes',policy.expires_at);ticket:=encode(extensions.gen_random_bytes(32),'hex');ticket_id:=gen_random_uuid();
 -- Persist hash only. The queued capability grants one fixed preauthorized batch, never archive reads or reusable-token authority.
 request_id:=net.http_post(url:='https://csebihpaychdkanjjsmz.supabase.co/functions/v1/geography-repair-source-consumer',body:=CASE WHEN strategy='publisher_profiles_v1'THEN'{"strategy":"publisher_profiles_v1"}'::jsonb ELSE'{}'::jsonb END,headers:=jsonb_build_object('Content-Type','application/json','x-geography-capture-ticket',ticket),timeout_milliseconds:=115000);
 IF request_id IS NULL THEN RAISE EXCEPTION 'capture_ticket_queue_unconfirmed';END IF;
 INSERT INTO zoi.geography_capture_tickets(id,ticket_sha256,policy_generation,strategy,max_source_requests,max_response_bytes,issued_at,expires_at,net_request_id)VALUES(ticket_id,encode(extensions.digest(ticket,'sha256'),'hex'),policy.generation_id,strategy,CASE WHEN strategy='publisher_profiles_v1'THEN 30 ELSE 50 END,CASE WHEN strategy='publisher_profiles_v1'THEN 12000000 ELSE 15000000 END,stamp,expiry,request_id);
 UPDATE zoi.geography_capture_ticket_policy SET last_admitted_at=stamp,next_strategy=CASE WHEN strategy='official_sources_v1'THEN'publisher_profiles_v1'ELSE'official_sources_v1'END WHERE singleton;
 RETURN jsonb_build_object('admitted',true,'strategy',strategy,'job_cap',4,'ticket_id',ticket_id,'net_request_id',request_id,'expires_at',expiry,'daily_reserved_admissions',n+1);
END $fn$;
ALTER FUNCTION zoi.geography_source_capture_tick()OWNER TO postgres;REVOKE ALL ON FUNCTION zoi.geography_source_capture_tick()FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON FUNCTION zoi.geography_source_capture_tick()IS'Postgres Cron only. Disabled until explicit expiring policy enabled. One fixed <=4-job batch per5min, alternating official/publisher, <=288reserved admissions/day. No cron installed. Queue contains only one-use2min capability, never reusable token. Platform queue remains SQL-readable.';
NOTIFY pgrst,'reload schema';COMMIT;

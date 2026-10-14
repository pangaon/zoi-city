BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='20s';
CREATE FUNCTION zoi.delivery_geography_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO zoi.delivery_events(request_id,kind,title,payload,evidence_state)
 VALUES(gen_random_uuid(),'geography_job_status',CASE NEW.status WHEN 'leased'THEN 'A map research record was assigned for processing.'WHEN 'applied'THEN 'A reviewed map correction was applied; its receipt is available.'WHEN 'reviewed'THEN 'A map proposal received independent review.'WHEN 'input_changed'THEN 'A listing changed; its earlier map research must be rechecked.'ELSE 'Map research recorded a result or remaining requirement.'END,
 jsonb_build_object('job_id',NEW.id,'listing_id',NEW.listing_id,'previous_state',OLD.status,'state',NEW.status,'attempts',NEW.attempts,'at',NEW.updated_at),'automatic');
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION zoi.delivery_geography_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER delivery_geography_status AFTER UPDATE ON zoi.geography_repair_jobs FOR EACH ROW WHEN(OLD.status IS DISTINCT FROM NEW.status OR OLD.attempts IS DISTINCT FROM NEW.attempts) EXECUTE FUNCTION zoi.delivery_geography_event();
-- A changed input remains visible until a replacement job or reviewed result exists.
DO $reader$ DECLARE definition text;needle text:='j.status NOT IN(''applied'',''input_changed'')';BEGIN
 SELECT pg_get_functiondef('public.zoi_delivery_records(text,integer,integer,text)'::regprocedure)INTO definition;
 -- The reader's bounded query is itself a SQL string inside PL/pgSQL.
 needle:=replace(needle,'''','''''');
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'delivery_remaining_reader_changed';END IF;
 EXECUTE replace(definition,needle,replace('j.status<>''applied''','''',''''''));
END $reader$;
NOTIFY pgrst,'reload schema';
COMMIT;

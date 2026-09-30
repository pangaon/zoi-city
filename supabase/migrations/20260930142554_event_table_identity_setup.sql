BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE zoi.event_table_identity_settings(event_id uuid PRIMARY KEY REFERENCES zoi.listings(id),workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id),venue_id uuid NOT NULL UNIQUE REFERENCES public.event_venues(id),version integer NOT NULL CHECK(version>0));
CREATE TABLE zoi.event_table_identity_requests(profile_id uuid NOT NULL REFERENCES zoi.user_profiles(id),request_id uuid NOT NULL,payload jsonb NOT NULL,receipt jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(profile_id,request_id));
ALTER TABLE zoi.event_table_identity_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoi.event_table_identity_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.event_table_identity_settings,zoi.event_table_identity_requests FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.table_identity_get(p_workspace uuid,p_event uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s zoi.event_table_identity_settings;rows jsonb;
BEGIN PERFORM zoi.table_inventory_operator(p_workspace,p_event);
 SELECT * INTO s FROM zoi.event_table_identity_settings WHERE event_id=p_event;
 IF s.event_id IS NOT NULL AND s.workspace_id IS DISTINCT FROM p_workspace THEN RAISE EXCEPTION 'inventory_owner_changed';END IF;
 IF s.venue_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.event_venues WHERE id=s.venue_id AND event_id=p_event AND workspace_id=p_workspace) THEN RAISE EXCEPTION 'event_not_owned';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'label',t.name,'capacity',t.capacity) ORDER BY t.id),'[]') INTO rows FROM public.venue_tables_zones t JOIN public.event_venues v ON v.id=t.venue_id WHERE v.id=s.venue_id AND v.event_id=p_event AND v.workspace_id=p_workspace;
 RETURN jsonb_build_object('ok',true,'event_id',p_event,'version',coalesce(s.version,0),'venue_id',s.venue_id,'tables',rows);
END $$;
CREATE FUNCTION public.table_identity_save(p_workspace uuid,p_event uuid,p_expected_version integer,p_request uuid,p_tables jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;s zoi.event_table_identity_settings;prior zoi.event_table_identity_requests;payload jsonb;result jsonb;item jsonb;tid uuid;label text;v_capacity integer;existing public.venue_tables_zones;v uuid;total integer;
BEGIN
 actor:=zoi.table_inventory_operator(p_workspace,p_event);
 IF p_request IS NULL OR p_expected_version IS NULL OR p_expected_version<0 THEN RAISE EXCEPTION 'invalid_request';END IF;
 payload:=jsonb_build_object('workspace',p_workspace,'event',p_event,'version',p_expected_version,'tables',p_tables);
 PERFORM pg_advisory_xact_lock(hashtextextended('table-identity-request:'||actor::text||':'||p_request::text,0));
 SELECT * INTO prior FROM zoi.event_table_identity_requests WHERE profile_id=actor AND request_id=p_request;
 IF prior.request_id IS NOT NULL THEN IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN prior.receipt;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('table-identity-actor:'||actor::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('event-table-mode:'||p_event::text,0));
 SELECT * INTO s FROM zoi.event_table_identity_settings WHERE event_id=p_event FOR UPDATE;
 IF s.event_id IS NOT NULL AND s.workspace_id IS DISTINCT FROM p_workspace THEN RAISE EXCEPTION 'inventory_owner_changed';END IF;
 IF coalesce(s.version,0)<>p_expected_version THEN RAISE EXCEPTION 'version_conflict';END IF;
 IF jsonb_typeof(p_tables) IS DISTINCT FROM 'array' OR octet_length(p_tables::text)>50000 THEN RAISE EXCEPTION 'invalid_tables';END IF;
 IF jsonb_array_length(p_tables) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid_tables';END IF;
 -- Share the existing price/hold serialization boundary; adding inventory never enables sales.
 PERFORM 1 FROM zoi.event_table_settings WHERE event_id=p_event FOR UPDATE;
 IF EXISTS(SELECT 1 FROM zoi.event_table_holds WHERE event_id=p_event AND status='active' AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'active_holds';END IF;
 IF EXISTS(SELECT 1 FROM zoi.event_table_settings WHERE event_id=p_event AND enabled) THEN RAISE EXCEPTION 'disable_inventory_first';END IF;
 IF (SELECT count(*) FROM zoi.event_table_identity_requests WHERE profile_id=actor AND created_at>clock_timestamp()-interval '1 day')>=30 THEN RAISE EXCEPTION 'setup_daily_limit';END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_tables) LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(item)k WHERE k NOT IN('id','label','capacity')) OR jsonb_typeof(item->'id') IS DISTINCT FROM 'string' OR coalesce(item->>'id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR jsonb_typeof(item->'label') IS DISTINCT FROM 'string' OR length(btrim(item->>'label')) NOT BETWEEN 1 AND 80 OR (item->>'label')~'[[:cntrl:]]' OR jsonb_typeof(item->'capacity') IS DISTINCT FROM 'number' OR coalesce(item->>'capacity','')!~'^[0-9]+$' THEN RAISE EXCEPTION 'invalid_tables';END IF;
  IF (item->>'capacity')::numeric NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'invalid_tables';END IF;
 END LOOP;
 IF (SELECT count(DISTINCT (x->>'id')::uuid) FROM jsonb_array_elements(p_tables)x)<>jsonb_array_length(p_tables) OR (SELECT count(DISTINCT lower(btrim(x->>'label'))) FROM jsonb_array_elements(p_tables)x)<>jsonb_array_length(p_tables) THEN RAISE EXCEPTION 'duplicate_table';END IF;
 IF EXISTS(SELECT 1 FROM public.venue_tables_zones t WHERE t.venue_id=s.venue_id AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_tables)x WHERE (x->>'id')::uuid=t.id)) THEN RAISE EXCEPTION 'table_removal_not_supported';END IF;
 SELECT count(*) INTO total FROM public.venue_tables_zones t JOIN public.event_venues v ON v.id=t.venue_id WHERE v.event_id=p_event AND v.workspace_id=p_workspace AND v.id IS DISTINCT FROM s.venue_id;
 IF total+jsonb_array_length(p_tables)>200 THEN RAISE EXCEPTION 'table_limit';END IF;
 v:=s.venue_id;
 IF v IS NULL THEN INSERT INTO public.event_venues(event_id,workspace_id,name,dimensions_w,dimensions_d,scale_meters_per_px)VALUES(p_event,p_workspace,'Event table inventory',NULL,NULL,NULL) RETURNING id INTO v;
 ELSE PERFORM 1 FROM public.event_venues WHERE id=v AND event_id=p_event AND workspace_id=p_workspace FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'event_not_owned';END IF;END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_tables) LOOP
  tid:=(item->>'id')::uuid;label:=btrim(item->>'label');v_capacity:=(item->>'capacity')::integer;
  SELECT * INTO existing FROM public.venue_tables_zones WHERE id=tid FOR UPDATE;
  IF existing.id IS NOT NULL THEN
   IF existing.venue_id IS DISTINCT FROM v THEN RAISE EXCEPTION 'table_not_owned';END IF;
   IF (existing.name IS DISTINCT FROM label OR existing.capacity IS DISTINCT FROM v_capacity) AND EXISTS(SELECT 1 FROM zoi.event_table_inventory WHERE table_id=tid) THEN RAISE EXCEPTION 'table_already_priced';END IF;
   UPDATE public.venue_tables_zones SET name=label,capacity=v_capacity WHERE id=tid;
  ELSE INSERT INTO public.venue_tables_zones(id,venue_id,name,capacity,zone_type,shape)VALUES(tid,v,label,v_capacity,'inventory',NULL);END IF;
 END LOOP;
 INSERT INTO zoi.event_table_identity_settings VALUES(p_event,p_workspace,v,coalesce(s.version,0)+1) ON CONFLICT(event_id)DO UPDATE SET version=excluded.version;
 result:=jsonb_build_object('ok',true,'event_id',p_event,'venue_id',v,'version',coalesce(s.version,0)+1,'table_ids',(SELECT jsonb_agg((x->>'id')::uuid ORDER BY (x->>'id')::uuid)FROM jsonb_array_elements(p_tables)x),'enabled',false);
 INSERT INTO zoi.event_table_identity_requests(profile_id,request_id,payload,receipt)VALUES(actor,p_request,payload,result);
 RETURN result;
END $$;
CREATE FUNCTION public.table_identity_receipt(p_workspace uuid,p_event uuid,p_request uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;r zoi.event_table_identity_requests;
BEGIN actor:=zoi.table_inventory_operator(p_workspace,p_event);IF p_request IS NULL THEN RAISE EXCEPTION 'invalid_request';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('table-identity-request:'||actor::text||':'||p_request::text,0));
 SELECT * INTO r FROM zoi.event_table_identity_requests WHERE profile_id=actor AND request_id=p_request AND payload->>'workspace'=p_workspace::text AND payload->>'event'=p_event::text;
 RETURN jsonb_build_object('ok',true,'found',r.request_id IS NOT NULL,'receipt',r.receipt);
END $$;
REVOKE ALL ON FUNCTION public.table_identity_get(uuid,uuid),public.table_identity_save(uuid,uuid,integer,uuid,jsonb),public.table_identity_receipt(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.table_identity_get(uuid,uuid),public.table_identity_save(uuid,uuid,integer,uuid,jsonb),public.table_identity_receipt(uuid,uuid,uuid) TO authenticated;
-- The legacy layout writer deletes/recreates rows. Managed inventory IDs cannot
-- take that path (the failure rolls back its preceding venue update as well).
CREATE FUNCTION zoi.protect_table_identity_delete()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF EXISTS(SELECT 1 FROM zoi.event_table_identity_settings WHERE venue_id=OLD.venue_id) THEN RAISE EXCEPTION 'table_identity_managed';END IF;RETURN OLD;END $$;
REVOKE ALL ON FUNCTION zoi.protect_table_identity_delete() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER protect_table_identity_delete BEFORE DELETE ON public.venue_tables_zones FOR EACH ROW EXECUTE FUNCTION zoi.protect_table_identity_delete();
COMMIT;

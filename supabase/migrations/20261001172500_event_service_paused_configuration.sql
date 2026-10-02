BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
DO $$BEGIN IF to_regprocedure('public.menu_item_save_once(uuid,uuid,uuid,integer,jsonb)') IS NULL OR to_regprocedure('zoi.workspace_locked_role(uuid)') IS NULL OR to_regprocedure('zoi.suite_lock_session()') IS NULL OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='menu_items' AND column_name='revision') THEN RAISE EXCEPTION 'service_menu_prerequisite_missing';END IF;END$$;
-- Additive paused setup only. The existing event_service_not_configured order gate is unchanged.
CREATE TABLE zoi.event_service_configurations(workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id),event_id uuid NOT NULL REFERENCES zoi.listings(id),venue_id uuid PRIMARY KEY REFERENCES public.event_venues(id),revision integer NOT NULL CHECK(revision>0),data jsonb NOT NULL,updated_by uuid NOT NULL,updated_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE zoi.event_service_configuration_requests(actor uuid NOT NULL,request uuid NOT NULL,workspace_id uuid NOT NULL,event_id uuid NOT NULL,venue_id uuid NOT NULL,arguments jsonb,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(actor,request));
CREATE INDEX event_service_configuration_requests_time ON zoi.event_service_configuration_requests(actor,created_at);
ALTER TABLE zoi.event_service_configurations ENABLE ROW LEVEL SECURITY;ALTER TABLE zoi.event_service_configuration_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.event_service_configurations,zoi.event_service_configuration_requests FROM PUBLIC,anon,authenticated;
CREATE FUNCTION zoi.event_service_setup_authorize(p_workspace uuid,p_event uuid DEFAULT NULL,p_venue uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE role text;BEGIN
 role:=zoi.workspace_locked_role(p_workspace);IF coalesce(role,'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'not_authorized' USING errcode='42501';END IF;
 IF p_event IS NOT NULL THEN PERFORM 1 FROM zoi.listings WHERE id=p_event AND owner_workspace_id=p_workspace AND entity_type='event' FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'event_not_owned' USING errcode='42501';END IF;END IF;
 IF p_venue IS NOT NULL THEN IF p_event IS NULL THEN RAISE EXCEPTION 'event_required';END IF;PERFORM 1 FROM public.event_venues WHERE id=p_venue AND event_id=p_event AND workspace_id=p_workspace FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'venue_not_owned' USING errcode='42501';END IF;END IF;
 PERFORM zoi.suite_lock_session();
END$$;
CREATE FUNCTION public.event_service_setup_context(p_workspace uuid,p_event uuid DEFAULT NULL,p_after uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE events jsonb;venues jsonb;tables jsonb;more boolean;BEGIN
 PERFORM zoi.event_service_setup_authorize(p_workspace,p_event);
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') INTO events FROM(SELECT id,name FROM zoi.listings WHERE owner_workspace_id=p_workspace AND entity_type='event' AND (p_after IS NULL OR id>p_after) ORDER BY id LIMIT 100)x;
 SELECT count(*)>100 INTO more FROM(SELECT 1 FROM zoi.listings WHERE owner_workspace_id=p_workspace AND entity_type='event' AND(p_after IS NULL OR id>p_after) LIMIT 101)x;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY id),'[]') INTO venues FROM public.event_venues WHERE workspace_id=p_workspace AND event_id=p_event;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'venue_id',t.venue_id,'name',t.name) ORDER BY t.id),'[]') INTO tables FROM public.venue_tables_zones t JOIN public.event_venues v ON v.id=t.venue_id WHERE v.workspace_id=p_workspace AND v.event_id=p_event;
 RETURN jsonb_build_object('ok',true,'workspace_id',p_workspace,'event_id',p_event,'selected_event',(SELECT jsonb_build_object('id',id,'name',name) FROM zoi.listings WHERE id=p_event),'events',events,'has_more',more,'venues',venues,'tables',tables,'ordering_enabled',false);
END$$;
CREATE FUNCTION public.event_service_setup_get(p_workspace uuid,p_event uuid,p_venue uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE c zoi.event_service_configurations;stale jsonb;BEGIN
 PERFORM zoi.event_service_setup_authorize(p_workspace,p_event,p_venue);
 SELECT * INTO c FROM zoi.event_service_configurations WHERE venue_id=p_venue;
 IF FOUND AND (c.workspace_id<>p_workspace OR c.event_id<>p_event) THEN RAISE EXCEPTION 'setup_ownership_changed';END IF;
 SELECT coalesce(jsonb_agg(x->>'menu_item_id'),'[]') INTO stale FROM jsonb_array_elements(coalesce(c.data->'items','[]'))x LEFT JOIN public.menu_items m ON m.id=(x->>'menu_item_id')::uuid WHERE m.id IS NULL OR m.workspace_id<>p_workspace OR m.revision<>(x->>'menu_revision')::integer OR NOT m.is_available OR m.currency<>'CAD';
 RETURN jsonb_build_object('ok',true,'workspace_id',p_workspace,'event_id',p_event,'venue_id',p_venue,'revision',coalesce(c.revision,0),'data',c.data,'stale_item_ids',stale,'status','paused','ordering_enabled',false);
END$$;
CREATE FUNCTION zoi.event_service_setup_capacity() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN IF(SELECT count(*)FROM zoi.event_service_configuration_requests WHERE actor=auth.uid() AND created_at>clock_timestamp()-interval '1 hour')>=120 THEN RAISE EXCEPTION 'setup_request_limit';END IF;END$$;
CREATE FUNCTION public.event_service_setup_save(p_workspace uuid,p_event uuid,p_venue uuid,p_expected_revision integer,p_request uuid,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE prior zoi.event_service_configuration_requests;c zoi.event_service_configurations;args jsonb;result jsonb;t jsonb;i jsonb;m public.menu_items;seen uuid[]:='{}';ids uuid[]:='{}';opens timestamptz;closes timestamptz;BEGIN
 PERFORM zoi.event_service_setup_authorize(p_workspace,p_event,p_venue);
 IF p_request IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0 OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR octet_length(p_data::text)>100000 THEN RAISE EXCEPTION 'invalid_setup';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('event-service-setup:'||auth.uid()::text,0));PERFORM zoi.suite_lock_session();
 args:=jsonb_build_object('revision',p_expected_revision,'data',p_data);
 SELECT * INTO prior FROM zoi.event_service_configuration_requests WHERE actor=auth.uid() AND request=p_request;
 IF FOUND THEN IF prior.workspace_id<>p_workspace OR prior.event_id<>p_event OR prior.venue_id<>p_venue OR(prior.arguments IS NOT NULL AND prior.arguments<>args) THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN prior.result;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('event-service-venue:'||p_venue::text,0));
 SELECT * INTO c FROM zoi.event_service_configurations WHERE venue_id=p_venue FOR UPDATE;
 IF FOUND AND(c.workspace_id<>p_workspace OR c.event_id<>p_event) THEN RAISE EXCEPTION 'setup_ownership_changed';END IF;
 IF coalesce(c.revision,0)<>p_expected_revision THEN RAISE EXCEPTION 'version_conflict';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_data)k WHERE k NOT IN('opens_at','closes_at','currency','table_ids','items')) OR p_data->>'currency' IS DISTINCT FROM 'CAD' OR jsonb_typeof(p_data->'table_ids') IS DISTINCT FROM 'array' OR jsonb_typeof(p_data->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'table_ids') NOT BETWEEN 0 AND 500 OR jsonb_array_length(p_data->'items') NOT BETWEEN 0 AND 500 THEN RAISE EXCEPTION 'invalid_setup';END IF;
 IF coalesce(p_data->>'opens_at','')!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([.]\d+)?(Z|[+-]\d{2}:\d{2})$' OR coalesce(p_data->>'closes_at','')!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([.]\d+)?(Z|[+-]\d{2}:\d{2})$' THEN RAISE EXCEPTION 'invalid_service_window';END IF;
 opens:=(p_data->>'opens_at')::timestamptz;closes:=(p_data->>'closes_at')::timestamptz;IF NOT isfinite(opens) OR NOT isfinite(closes) OR closes<=opens THEN RAISE EXCEPTION 'invalid_service_window';END IF;
 FOR t IN SELECT value FROM jsonb_array_elements(p_data->'table_ids') ORDER BY value LOOP
  IF jsonb_typeof(t)<>'string' OR(t#>>'{}')::uuid=ANY(ids) THEN RAISE EXCEPTION 'invalid_service_table';END IF;ids:=array_append(ids,(t#>>'{}')::uuid);
  PERFORM 1 FROM public.venue_tables_zones WHERE id=(t#>>'{}')::uuid AND venue_id=p_venue FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'invalid_service_table';END IF;
 END LOOP;
 FOR i IN SELECT value FROM jsonb_array_elements(p_data->'items') ORDER BY value->>'menu_item_id' LOOP
  IF jsonb_typeof(i)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(i)k WHERE k NOT IN('menu_item_id','menu_revision','initial_stock','requires_staff_approval')) OR jsonb_typeof(i->'menu_item_id') IS DISTINCT FROM 'string' OR jsonb_typeof(i->'menu_revision') IS DISTINCT FROM 'number' OR jsonb_typeof(i->'initial_stock') IS DISTINCT FROM 'number' OR jsonb_typeof(i->'requires_staff_approval') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'invalid_service_item';END IF;
  IF(i->>'menu_item_id')::uuid=ANY(seen) OR(i->>'initial_stock')::numeric NOT BETWEEN 0 AND 1000000 OR(i->>'initial_stock')::numeric<>trunc((i->>'initial_stock')::numeric) OR(i->>'menu_revision')::numeric<1 OR(i->>'menu_revision')::numeric<>trunc((i->>'menu_revision')::numeric) THEN RAISE EXCEPTION 'invalid_service_item';END IF;seen:=array_append(seen,(i->>'menu_item_id')::uuid);
  SELECT * INTO m FROM public.menu_items WHERE id=(i->>'menu_item_id')::uuid AND workspace_id=p_workspace FOR SHARE;
  IF NOT FOUND OR NOT m.is_available OR m.currency<>'CAD' OR m.price_cents<=0 OR m.price_cents>1000000 OR m.station NOT IN('kitchen','bar','merch') OR m.revision<>(i->>'menu_revision')::integer THEN RAISE EXCEPTION 'menu_review_required';END IF;
 END LOOP;
 PERFORM zoi.suite_lock_session();PERFORM zoi.event_service_setup_capacity();
 INSERT INTO zoi.event_service_configurations(workspace_id,event_id,venue_id,revision,data,updated_by)VALUES(p_workspace,p_event,p_venue,p_expected_revision+1,p_data,auth.uid())ON CONFLICT(venue_id)DO UPDATE SET revision=excluded.revision,data=excluded.data,updated_by=excluded.updated_by,updated_at=clock_timestamp();
 result:=jsonb_build_object('ok',true,'workspace_id',p_workspace,'event_id',p_event,'venue_id',p_venue,'request_id',p_request,'revision',p_expected_revision+1,'status','saved_paused','ordering_enabled',false);
 INSERT INTO zoi.event_service_configuration_requests VALUES(auth.uid(),p_request,p_workspace,p_event,p_venue,args,result,clock_timestamp());RETURN result;
END$$;
CREATE FUNCTION public.event_service_setup_request(p_workspace uuid,p_event uuid,p_venue uuid,p_request uuid,p_cancel_if_missing boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE prior zoi.event_service_configuration_requests;result jsonb;BEGIN
 PERFORM zoi.event_service_setup_authorize(p_workspace,p_event,p_venue);IF p_request IS NULL OR p_cancel_if_missing IS NULL THEN RAISE EXCEPTION 'invalid_request';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('event-service-setup:'||auth.uid()::text,0));PERFORM zoi.suite_lock_session();
 SELECT * INTO prior FROM zoi.event_service_configuration_requests WHERE actor=auth.uid() AND request=p_request;
 IF FOUND THEN IF prior.workspace_id<>p_workspace OR prior.event_id<>p_event OR prior.venue_id<>p_venue THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN prior.result;END IF;
 result:=jsonb_build_object('ok',true,'workspace_id',p_workspace,'event_id',p_event,'venue_id',p_venue,'request_id',p_request,'status',CASE WHEN p_cancel_if_missing THEN 'cancelled' ELSE 'unknown' END,'ordering_enabled',false);
 IF p_cancel_if_missing THEN PERFORM zoi.event_service_setup_capacity();INSERT INTO zoi.event_service_configuration_requests VALUES(auth.uid(),p_request,p_workspace,p_event,p_venue,NULL,result,clock_timestamp());END IF;RETURN result;
END$$;
REVOKE ALL ON FUNCTION zoi.event_service_setup_authorize(uuid,uuid,uuid),zoi.event_service_setup_capacity() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.event_service_setup_context(uuid,uuid,uuid),public.event_service_setup_get(uuid,uuid,uuid),public.event_service_setup_save(uuid,uuid,uuid,integer,uuid,jsonb),public.event_service_setup_request(uuid,uuid,uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.event_service_setup_context(uuid,uuid,uuid),public.event_service_setup_get(uuid,uuid,uuid),public.event_service_setup_save(uuid,uuid,uuid,integer,uuid,jsonb),public.event_service_setup_request(uuid,uuid,uuid,uuid,boolean) TO authenticated;
NOTIFY pgrst,'reload schema';COMMIT;

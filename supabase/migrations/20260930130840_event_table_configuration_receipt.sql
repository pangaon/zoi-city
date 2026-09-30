BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE FUNCTION public.table_inventory_configure_receipt(p_workspace uuid,p_event uuid,p_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE a uuid;r zoi.event_table_config_requests;
BEGIN
 a:=zoi.table_inventory_operator(p_workspace,p_event);
 IF p_request IS NULL THEN RAISE EXCEPTION 'invalid_request';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('table-config-request:'||a::text||':'||p_request::text,0));
 SELECT * INTO r FROM zoi.event_table_config_requests WHERE profile_id=a AND request_id=p_request;
 IF r.request_id IS NULL THEN RETURN jsonb_build_object('ok',true,'found',false);END IF;
 IF r.payload->>'workspace' IS DISTINCT FROM p_workspace::text OR r.payload->>'event' IS DISTINCT FROM p_event::text THEN RETURN jsonb_build_object('ok',true,'found',false);END IF;
 RETURN jsonb_build_object('ok',true,'found',true,'receipt',r.receipt);
END $$;
REVOKE ALL ON FUNCTION public.table_inventory_configure_receipt(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.table_inventory_configure_receipt(uuid,uuid,uuid) TO authenticated;
COMMIT;

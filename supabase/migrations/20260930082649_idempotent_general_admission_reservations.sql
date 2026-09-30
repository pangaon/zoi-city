BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE zoi.general_ticket_requests(
 request_id uuid PRIMARY KEY,
 actor_user_id uuid,
 payload_hash text NOT NULL,
 reservation_id uuid NOT NULL REFERENCES zoi.ticket_reservations(id) ON DELETE CASCADE,
 receipt jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE zoi.general_ticket_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.general_ticket_requests FROM PUBLIC,anon,authenticated;

CREATE FUNCTION zoi.general_ticket_validate(p_event uuid,p_type bigint,p_name text,p_email text,p_qty integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE event zoi.listings;tier zoi.ticket_types;starts timestamptz;
BEGIN
 IF p_qty IS NULL OR p_qty NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'quantity_must_be_1_to_10'; END IF;
 IF coalesce(length(btrim(p_name)),0) NOT BETWEEN 1 AND 200 OR coalesce(length(btrim(p_email)),0) NOT BETWEEN 3 AND 254
 OR btrim(p_email) !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' THEN RAISE EXCEPTION 'valid_name_and_email_required'; END IF;
 SELECT * INTO event FROM zoi.listings WHERE id=p_event FOR SHARE;
 IF event.id IS NULL OR event.entity_type<>'event' OR event.publish_status IS DISTINCT FROM 'published'
 OR event.moderation_status IS NULL OR event.moderation_status NOT IN('clean','cleared') OR coalesce(event.marketplace_status,'')='hidden'
 THEN RAISE EXCEPTION 'event_unavailable'; END IF;
 IF coalesce(event.profile->>'event_at','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$' THEN RAISE EXCEPTION 'event_time_unavailable'; END IF;
 BEGIN starts:=(event.profile->>'event_at')::timestamptz;EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'event_time_unavailable';END;
 IF starts<=clock_timestamp() THEN RAISE EXCEPTION 'event_has_started'; END IF;
 SELECT * INTO tier FROM zoi.ticket_types WHERE id=p_type AND event_id=p_event FOR UPDATE;
 IF tier.id IS NULL OR tier.active IS DISTINCT FROM true THEN RAISE EXCEPTION 'ticket_type_unavailable'; END IF;
 IF event.owner_workspace_id IS DISTINCT FROM tier.workspace_id OR tier.workspace_id IS NULL THEN RAISE EXCEPTION 'event_owner_changed'; END IF;
 IF tier.reserved IS NULL OR tier.reserved<0 THEN RAISE EXCEPTION 'ticket_inventory_unavailable'; END IF;
 IF tier.price_cents IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'priced_tickets_require_checkout'; END IF;
 IF EXISTS(SELECT 1 FROM zoi.seating_sessions WHERE ticket_type_id=p_type) THEN RAISE EXCEPTION 'choose_seats_for_this_event'; END IF;
 IF tier.capacity IS NOT NULL AND (tier.reserved::bigint+p_qty)>tier.capacity THEN RAISE EXCEPTION 'not enough tickets left'; END IF;
END $$;
REVOKE ALL ON FUNCTION zoi.general_ticket_validate(uuid,bigint,text,text,integer) FROM PUBLIC,anon,authenticated;

-- Preserve the existing inventory writer/signature. Apply the same admission
-- checks to direct legacy clients, which remain non-idempotent.
CREATE OR REPLACE FUNCTION public.tickets_reserve(p_event uuid,p_type bigint,p_name text,p_email text,p_qty integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='zoi','public' AS $$
DECLARE t zoi.ticket_types;r zoi.ticket_reservations;
BEGIN
 IF NOT zoi.flag('feature_tickets') THEN RAISE EXCEPTION 'ticketing_paused'; END IF;
 PERFORM zoi.general_ticket_validate(p_event,p_type,p_name,p_email,p_qty);
 SELECT * INTO t FROM zoi.ticket_types WHERE id=p_type AND event_id=p_event AND active=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ticket type not found'; END IF;
 IF coalesce(t.price_cents,0)>0 THEN RAISE EXCEPTION 'priced_tickets_require_checkout'; END IF;
 IF t.capacity IS NOT NULL AND t.reserved::bigint+p_qty>t.capacity THEN RAISE EXCEPTION 'not enough tickets left'; END IF;
 UPDATE zoi.ticket_types SET reserved=reserved+p_qty WHERE id=t.id;
 INSERT INTO zoi.ticket_reservations(event_id,ticket_type_id,buyer_name,buyer_email,qty,amount_cents,status)
 VALUES(p_event,p_type,btrim(p_name),btrim(p_email),p_qty,0,'reserved') RETURNING * INTO r;
 RETURN jsonb_build_object('ok',true,'code',r.code,'qty',r.qty,'amount_cents',0,'currency',t.currency,'paid',false);
END $$;

CREATE FUNCTION public.tickets_reserve_once(p_request uuid,p_event uuid,p_type bigint,p_name text,p_email text,p_qty integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();fingerprint text;prior zoi.general_ticket_requests;result jsonb;reservation uuid;
BEGIN
 IF p_request IS NULL THEN RAISE EXCEPTION 'request_id_required'; END IF;
 IF octet_length(coalesce(p_name,''))>1000 OR octet_length(coalesce(p_email,''))>1000 THEN RAISE EXCEPTION 'invalid_request'; END IF;
 fingerprint:=encode(sha256(convert_to(jsonb_build_object('event',p_event,'type',p_type,'name',btrim(p_name),'email',btrim(p_email),'qty',p_qty)::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,382197));
 SELECT * INTO prior FROM zoi.general_ticket_requests WHERE request_id=p_request;
 IF FOUND THEN
  IF prior.actor_user_id IS DISTINCT FROM actor OR prior.payload_hash<>fingerprint THEN RAISE EXCEPTION 'request_conflict'; END IF;
  RETURN prior.receipt;
 END IF;
 result:=public.tickets_reserve(p_event,p_type,p_name,p_email,p_qty);
 SELECT id INTO reservation FROM zoi.ticket_reservations WHERE code=result->>'code' AND event_id=p_event AND ticket_type_id=p_type;
 IF result->>'ok' IS DISTINCT FROM 'true' OR reservation IS NULL THEN RAISE EXCEPTION 'reservation_not_confirmed'; END IF;
 result:=result||jsonb_build_object('request_id',p_request,'event_id',p_event,'ticket_type_id',p_type::text);
 INSERT INTO zoi.general_ticket_requests(request_id,actor_user_id,payload_hash,reservation_id,receipt)
 VALUES(p_request,actor,fingerprint,reservation,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.tickets_reserve_once(uuid,uuid,bigint,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tickets_reserve_once(uuid,uuid,bigint,text,text,integer) TO anon,authenticated,service_role;
-- The unpredictable client nonce is a receipt capability; no contact lookup exists.
CREATE FUNCTION public.tickets_reserve_receipt(p_request uuid,p_event uuid,p_type bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE prior zoi.general_ticket_requests;
BEGIN
 IF p_request IS NULL OR p_event IS NULL OR p_type IS NULL THEN RAISE EXCEPTION 'invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,382197));
 SELECT * INTO prior FROM zoi.general_ticket_requests WHERE request_id=p_request;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'found',false); END IF;
 IF prior.actor_user_id IS DISTINCT FROM auth.uid() OR prior.receipt->>'event_id'<>p_event::text OR prior.receipt->>'ticket_type_id'<>p_type::text
 THEN RAISE EXCEPTION 'request_unavailable'; END IF;
 RETURN jsonb_build_object('ok',true,'found',true,'receipt',prior.receipt);
END $$;
REVOKE ALL ON FUNCTION public.tickets_reserve_receipt(uuid,uuid,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tickets_reserve_receipt(uuid,uuid,bigint) TO anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;

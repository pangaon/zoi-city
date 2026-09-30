BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE FUNCTION zoi.ticket_event_publicly_open(p_event uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE raw_time text;starts timestamptz;
BEGIN
 SELECT l.profile->>'event_at' INTO raw_time FROM zoi.listings l WHERE l.id=p_event AND l.entity_type='event'
 AND l.publish_status='published' AND l.moderation_status IN('clean','cleared') AND coalesce(l.marketplace_status,'')<>'hidden';
 IF raw_time IS NULL OR raw_time !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$' THEN RETURN false;END IF;
 BEGIN starts:=raw_time::timestamptz;EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;END;
 RETURN starts>statement_timestamp();
END $$;
REVOKE ALL ON FUNCTION zoi.ticket_event_publicly_open(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.tickets_event_public(p_event uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('id',l.id,'name',l.name,'city',l.city,'country',l.country,'description',l.description,'event_at',l.profile->>'event_at','slug',l.slug)
 FROM zoi.listings l WHERE l.id=p_event AND l.entity_type='event' AND l.publish_status='published'
 AND l.moderation_status IN('clean','cleared') AND coalesce(l.marketplace_status,'')<>'hidden' LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.tickets_types_list(p_event uuid)
RETURNS TABLE(id bigint,name text,description text,price_cents integer,currency text,capacity integer,reserved integer,sold_out boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT t.id,t.name,t.description,t.price_cents,t.currency,t.capacity,t.reserved,(t.capacity IS NOT NULL AND t.reserved>=t.capacity)
 FROM zoi.ticket_types t JOIN zoi.listings l ON l.id=t.event_id
 WHERE t.event_id=p_event AND t.active=true AND t.workspace_id=l.owner_workspace_id AND zoi.ticket_event_publicly_open(p_event)
 ORDER BY t.sort,t.price_cents,t.id;
$$;
CREATE OR REPLACE FUNCTION public.tickets_checkout_info(p_event uuid,p_type bigint)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('type_id',t.id,'type_name',t.name,'price_cents',t.price_cents,'currency',coalesce(t.currency,'cad'),
 'capacity',t.capacity,'reserved',t.reserved,'active',t.active,'event_name',l.name,'event_city',l.city)
 FROM zoi.ticket_types t JOIN zoi.listings l ON l.id=t.event_id WHERE t.id=p_type AND t.event_id=p_event AND t.active=true
 AND t.workspace_id=l.owner_workspace_id AND zoi.ticket_event_publicly_open(p_event) LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.tickets_reservations_list(p_workspace uuid,p_event uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign_in_required' USING ERRCODE='42501';END IF;
 SELECT id INTO actor FROM zoi.user_profiles WHERE auth_user_id=auth.uid();
 PERFORM 1 FROM zoi.workspace_members WHERE workspace_id=p_workspace AND profile_id=actor AND role IN('owner','admin','editor') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'workspace_permission_denied' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM zoi.listings WHERE id=p_event AND owner_workspace_id=p_workspace FOR SHARE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM zoi.ticket_types WHERE event_id=p_event AND workspace_id=p_workspace)
 THEN RAISE EXCEPTION 'no_access_to_event' USING ERRCODE='42501';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('code',r.code,'name',r.buyer_name,'email',r.buyer_email,'qty',r.qty,
 'amount_cents',r.amount_cents,'status',r.status,'paid',(r.payment_status='paid'),'checked_in',(r.checked_in_at IS NOT NULL),'type',t.name,'created_at',r.created_at)
 ORDER BY r.created_at DESC) FROM zoi.ticket_reservations r JOIN zoi.ticket_types t ON t.id=r.ticket_type_id
 WHERE r.event_id=p_event AND t.workspace_id=p_workspace),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.tickets_reservations_list(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tickets_reservations_list(uuid,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.tickets_reserve_receipt(p_request uuid,p_event uuid,p_type bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE prior zoi.general_ticket_requests;r zoi.ticket_reservations;available boolean;
BEGIN
 IF p_request IS NULL OR p_event IS NULL OR p_type IS NULL THEN RAISE EXCEPTION 'invalid_request';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,382197));
 SELECT * INTO prior FROM zoi.general_ticket_requests WHERE request_id=p_request;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'found',false);END IF;
 IF prior.actor_user_id IS DISTINCT FROM auth.uid() OR prior.receipt->>'event_id'<>p_event::text OR prior.receipt->>'ticket_type_id'<>p_type::text
 THEN RAISE EXCEPTION 'request_unavailable';END IF;
 SELECT * INTO r FROM zoi.ticket_reservations WHERE id=prior.reservation_id;
 IF r.id IS NULL THEN RAISE EXCEPTION 'request_unavailable';END IF;
 available:=zoi.ticket_event_publicly_open(p_event) AND zoi.flag('feature_tickets') AND EXISTS(
 SELECT 1 FROM zoi.ticket_types t JOIN zoi.listings l ON l.id=t.event_id WHERE t.id=p_type AND t.active=true AND t.workspace_id=l.owner_workspace_id);
 RETURN jsonb_build_object('ok',true,'found',true,'receipt',prior.receipt,'current_status',r.status,'checked_in',r.checked_in_at IS NOT NULL,'event_available',available);
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;

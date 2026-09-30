BEGIN;
CREATE TABLE zoi.table_tab_requests(request_id uuid PRIMARY KEY,kind text NOT NULL CHECK(kind IN('cash','order')),actor_auth uuid,workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id),tab_id uuid NOT NULL REFERENCES public.table_tabs(id),payload jsonb NOT NULL,receipt jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX table_tab_requests_tab_time ON zoi.table_tab_requests(tab_id,created_at DESC);
ALTER TABLE zoi.table_tab_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.table_tab_requests FROM PUBLIC,anon,authenticated;
-- No active source caller uses these legacy nonce-less writes. Require migration
-- to exact-retry APIs instead of silently making duplicate cash/order records.
CREATE OR REPLACE FUNCTION public.table_tab_record_cash_payment(p_workspace uuid,p_tab_id uuid,p_amount numeric,p_method text DEFAULT 'cash')RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$SELECT json_build_object('ok',false,'error','request_id_required')$$;
CREATE OR REPLACE FUNCTION public.table_tab_guest_order(p_qr_slug text,p_guest_name text,p_items jsonb)RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$SELECT json_build_object('ok',false,'error','request_id_required')$$;
CREATE FUNCTION public.table_tab_cash_once(p_workspace uuid,p_tab_id uuid,p_amount numeric,p_request uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;tab public.table_tabs;owner_ws uuid;prior zoi.table_tab_requests;payload jsonb;receipt jsonb;payment uuid;
BEGIN
 SELECT id INTO actor FROM zoi.user_profiles WHERE auth_user_id=auth.uid();IF actor IS NULL THEN RAISE EXCEPTION 'not_authorized' USING errcode='42501';END IF;
 PERFORM 1 FROM zoi.workspace_members WHERE workspace_id=p_workspace AND profile_id=actor AND role IN('owner','admin')FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized' USING errcode='42501';END IF;
 IF p_request IS NULL OR p_tab_id IS NULL OR p_amount IS NULL OR p_amount::text IN('NaN','Infinity','-Infinity') OR p_amount<=0 OR p_amount>1000000 OR p_amount<>round(p_amount,2)THEN RAISE EXCEPTION 'invalid_cash_amount';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('table-tab-request:'||p_request::text,0));
 SELECT v.workspace_id INTO owner_ws FROM public.table_tabs t JOIN public.venue_tables_zones z ON z.id=t.table_id JOIN public.event_venues v ON v.id=z.venue_id WHERE t.id=p_tab_id FOR SHARE OF v,z;
 IF owner_ws IS DISTINCT FROM p_workspace THEN RAISE EXCEPTION 'tab_unavailable';END IF;
 payload:=jsonb_build_object('workspace',p_workspace,'tab',p_tab_id,'amount',p_amount,'method','cash');
 SELECT * INTO prior FROM zoi.table_tab_requests WHERE request_id=p_request;
 IF FOUND THEN IF prior.kind<>'cash' OR prior.actor_auth IS DISTINCT FROM auth.uid() OR prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN prior.receipt;END IF;
 SELECT * INTO tab FROM public.table_tabs WHERE id=p_tab_id FOR UPDATE;
 IF tab.status IS DISTINCT FROM 'open' OR tab.total_amount IS NULL OR tab.paid_amount IS NULL OR tab.total_amount::text IN('NaN','Infinity','-Infinity') OR tab.paid_amount::text IN('NaN','Infinity','-Infinity') OR tab.paid_amount<0 OR tab.total_amount<tab.paid_amount THEN RAISE EXCEPTION 'tab_unavailable';END IF;
 IF p_amount>tab.total_amount-tab.paid_amount THEN RAISE EXCEPTION 'amount_exceeds_balance';END IF;
 INSERT INTO public.tab_payments(tab_id,amount,payment_method,payment_status,collected_by_staff_id)VALUES(p_tab_id,p_amount,'cash','completed',auth.uid())RETURNING id INTO payment;
 UPDATE public.table_tabs SET paid_amount=paid_amount+p_amount,status=CASE WHEN paid_amount+p_amount=total_amount THEN 'closed' ELSE 'open' END,updated_at=clock_timestamp()WHERE id=p_tab_id RETURNING * INTO tab;
 receipt:=jsonb_build_object('ok',true,'request_id',p_request,'workspace_id',p_workspace,'tab_id',p_tab_id,'payment_id',payment,'amount',p_amount,'method','cash','recorded_by_staff',true,'online_payment_collected',false,'remaining_amount',tab.total_amount-tab.paid_amount,'tab_status',tab.status);
 INSERT INTO zoi.table_tab_requests VALUES(p_request,'cash',auth.uid(),p_workspace,p_tab_id,payload,receipt,clock_timestamp());RETURN receipt;
END $$;
CREATE FUNCTION public.table_tab_order_once(p_request uuid,p_qr_slug text,p_guest_name text,p_items jsonb)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE zone public.venue_tables_zones;venue public.event_venues;tab public.table_tabs;item public.menu_items;it jsonb;prior zoi.table_tab_requests;payload jsonb;receipt jsonb;member uuid;ord uuid;total numeric:=0;qty integer;ids uuid[]:='{}';itemid uuid;station text;
BEGIN
 IF p_request IS NULL OR length(coalesce(p_qr_slug,'')) NOT BETWEEN 1 AND 100 OR length(btrim(coalesce(p_guest_name,''))) NOT BETWEEN 1 AND 120 OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_order';END IF;
 IF jsonb_array_length(p_items) NOT BETWEEN 1 AND 20 OR octet_length(p_items::text)>10000 THEN RAISE EXCEPTION 'invalid_order';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('table-tab-request:'||p_request::text,0));
 SELECT * INTO zone FROM public.venue_tables_zones WHERE qr_slug=p_qr_slug FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'table_unavailable';END IF;
 SELECT * INTO venue FROM public.event_venues WHERE id=zone.venue_id FOR SHARE;IF venue.workspace_id IS NULL THEN RAISE EXCEPTION 'table_unavailable';END IF;
 payload:=jsonb_build_object('qr',p_qr_slug,'name',btrim(p_guest_name),'items',p_items);
 SELECT * INTO prior FROM zoi.table_tab_requests WHERE request_id=p_request;
 IF FOUND THEN IF prior.kind<>'order' OR prior.actor_auth IS DISTINCT FROM auth.uid() OR prior.workspace_id IS DISTINCT FROM venue.workspace_id OR prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN prior.receipt;END IF;
 IF venue.event_id IS NOT NULL THEN RAISE EXCEPTION 'event_service_not_configured';END IF;
 -- Event dates do not authorize a service window. Event-linked ordering stays
 -- closed until an organizer-approved service configuration is implemented.
 -- Server catalogue price/availability only; any bad item rejects the entire order.
 FOR it IN SELECT value FROM jsonb_array_elements(p_items)LOOP
 IF jsonb_typeof(it) IS DISTINCT FROM 'object' OR jsonb_typeof(it->'menu_item_id') IS DISTINCT FROM 'string' OR coalesce(it->>'menu_item_id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR jsonb_typeof(it->'quantity') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'invalid_order_item';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(it)k WHERE k NOT IN('menu_item_id','quantity'))THEN RAISE EXCEPTION 'invalid_order_item';END IF;
 IF (it->>'quantity')::numeric NOT BETWEEN 1 AND 20 OR (it->>'quantity')::numeric<>trunc((it->>'quantity')::numeric)THEN RAISE EXCEPTION 'invalid_order_quantity';END IF;
 itemid:=(it->>'menu_item_id')::uuid;IF itemid=ANY(ids)THEN RAISE EXCEPTION 'duplicate_order_item';END IF;ids:=array_append(ids,itemid);
 SELECT * INTO item FROM public.menu_items WHERE id=itemid AND workspace_id=venue.workspace_id AND is_available FOR SHARE;IF NOT FOUND OR item.price_cents IS NULL OR item.price_cents<=0 OR item.price_cents>1000000 THEN RAISE EXCEPTION 'menu_item_unavailable';END IF;
 total:=total+item.price_cents::numeric/100*(it->>'quantity')::integer;
 END LOOP;
 IF total>1000000 THEN RAISE EXCEPTION 'invalid_order_total';END IF;
 SELECT * INTO tab FROM public.table_tabs WHERE table_id=zone.id AND status='open' ORDER BY created_at DESC,id LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN INSERT INTO public.table_tabs(table_id,status,total_amount,paid_amount)VALUES(zone.id,'open',0,0)RETURNING * INTO tab;END IF;
 IF tab.total_amount IS NULL OR tab.paid_amount IS NULL OR tab.total_amount::text IN('NaN','Infinity','-Infinity') OR tab.paid_amount::text IN('NaN','Infinity','-Infinity') OR tab.total_amount<0 OR tab.paid_amount<0 OR tab.paid_amount>tab.total_amount THEN RAISE EXCEPTION 'tab_unavailable';END IF;
 IF(SELECT count(*)FROM zoi.table_tab_requests WHERE tab_id=tab.id AND kind='order' AND created_at>clock_timestamp()-interval '1 minute')>=20 THEN RAISE EXCEPTION 'order_rate_limited';END IF;
 INSERT INTO public.table_members(tab_id,guest_name)VALUES(tab.id,btrim(p_guest_name))RETURNING id INTO member;
 INSERT INTO public.event_orders(tab_id,table_id,member_id,customer_name,total_amount,payment_status,fulfillment_status,target_station)VALUES(tab.id,zone.id,member,btrim(p_guest_name),total,'tab','received','kitchen')RETURNING id INTO ord;
 FOR it IN SELECT value FROM jsonb_array_elements(p_items)LOOP SELECT * INTO item FROM public.menu_items WHERE id=(it->>'menu_item_id')::uuid;
 INSERT INTO public.event_order_items(order_id,item_name,quantity,unit_price)VALUES(ord,item.name,(it->>'quantity')::integer,item.price_cents::numeric/100);
 IF station IS NULL OR station='kitchen' THEN station:=item.station;END IF;
 END LOOP;
 UPDATE public.event_orders SET target_station=coalesce(station,'kitchen')WHERE id=ord;
 UPDATE public.table_tabs SET total_amount=total_amount+total,updated_at=clock_timestamp()WHERE id=tab.id;
 receipt:=jsonb_build_object('ok',true,'request_id',p_request,'order_id',ord,'tab_id',tab.id,'total',total,'payment_status','tab','online_payment_collected',false);
 INSERT INTO zoi.table_tab_requests VALUES(p_request,'order',auth.uid(),venue.workspace_id,tab.id,payload,receipt,clock_timestamp());RETURN receipt;
END $$;
REVOKE ALL ON FUNCTION public.table_tab_cash_once(uuid,uuid,numeric,uuid),public.table_tab_order_once(uuid,text,text,jsonb)FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.table_tab_cash_once(uuid,uuid,numeric,uuid)TO authenticated;
GRANT EXECUTE ON FUNCTION public.table_tab_order_once(uuid,text,text,jsonb)TO anon,authenticated;
COMMIT;

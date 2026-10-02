BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
-- Exact retained definitions are populated and verified by the isolated fixture before freeze.
DO $$BEGIN
 IF md5(pg_get_functiondef('public.kds_ticket_advance(uuid,uuid,text)'::regprocedure))<>'46b60f5be58a8d60b2bcad7da9297e68' THEN RAISE EXCEPTION 'kds_writer_definition_changed';END IF;
 IF md5(pg_get_functiondef('public.kds_tickets_list(uuid,text)'::regprocedure))<>'0a25f6cd62c2cdcf64a3fa660aa44a63' THEN RAISE EXCEPTION 'kds_reader_definition_changed';END IF;
END$$;
ALTER TABLE public.event_orders ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK(revision>0);
CREATE FUNCTION zoi.service_order_revision() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.table_id IS DISTINCT FROM OLD.table_id OR NEW.event_id IS DISTINCT FROM OLD.event_id OR NEW.tab_id IS DISTINCT FROM OLD.tab_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'order_scope_immutable';END IF;
 NEW.revision:=OLD.revision+1;NEW.updated_at:=clock_timestamp();RETURN NEW;
END$$;
CREATE TRIGGER service_order_revision BEFORE UPDATE ON public.event_orders FOR EACH ROW EXECUTE FUNCTION zoi.service_order_revision();
CREATE FUNCTION zoi.service_order_item_revision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN
 IF TG_OP='UPDATE' AND NEW.order_id IS DISTINCT FROM OLD.order_id THEN RAISE EXCEPTION 'order_item_scope_immutable';END IF;
 UPDATE public.event_orders SET updated_at=clock_timestamp() WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.order_id ELSE NEW.order_id END;
 RETURN NULL;
END$$;
CREATE TRIGGER service_order_item_revision AFTER INSERT OR UPDATE OR DELETE ON public.event_order_items FOR EACH ROW EXECUTE FUNCTION zoi.service_order_item_revision();
ALTER TABLE public.event_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_order_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_orders,public.event_order_items FROM PUBLIC,anon,authenticated;
DO $$DECLARE t text;r text;p text;BEGIN
 FOREACH t IN ARRAY ARRAY['event_orders','event_order_items'] LOOP
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
 FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
 IF has_table_privilege(r,'public.'||t,p) THEN RAISE EXCEPTION 'service_direct_access_unexpected';END IF;
 END LOOP;
 FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE'] LOOP
 IF has_any_column_privilege(r,'public.'||t,p) THEN RAISE EXCEPTION 'service_direct_column_access_unexpected';END IF;
 END LOOP;END LOOP;END LOOP;
END$$;
CREATE TABLE zoi.service_queue_requests(actor uuid NOT NULL,request_id uuid NOT NULL,workspace_id uuid NOT NULL,order_id uuid NOT NULL,arguments jsonb,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(actor,request_id));
CREATE INDEX service_queue_requests_actor_time ON zoi.service_queue_requests(actor,created_at);
ALTER TABLE zoi.service_queue_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.service_queue_requests FROM PUBLIC,anon,authenticated;
CREATE FUNCTION zoi.service_queue_authorize(p_workspace uuid,p_order uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE role text;ev uuid;ve uuid;ta uuid;o public.event_orders;BEGIN
 role:=zoi.workspace_locked_role(p_workspace);
 IF coalesce(role,'') NOT IN('owner','admin','editor') THEN RAISE EXCEPTION 'insufficient_permission' USING errcode='42501';END IF;
 IF p_order IS NOT NULL THEN
 SELECT v.event_id,v.id,t.id INTO ev,ve,ta FROM public.event_orders x JOIN public.venue_tables_zones t ON t.id=x.table_id JOIN public.event_venues v ON v.id=t.venue_id WHERE x.id=p_order AND v.workspace_id=p_workspace;
 IF NOT FOUND THEN RAISE EXCEPTION 'order_unavailable' USING errcode='42501';END IF;
 IF ev IS NOT NULL THEN
 PERFORM 1 FROM zoi.listings WHERE id=ev AND owner_workspace_id=p_workspace AND entity_type='event' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'order_unavailable' USING errcode='42501';END IF;
 END IF;
 PERFORM 1 FROM public.event_venues WHERE id=ve AND workspace_id=p_workspace AND event_id IS NOT DISTINCT FROM ev FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'order_unavailable' USING errcode='42501';END IF;
 PERFORM 1 FROM public.venue_tables_zones WHERE id=ta AND venue_id=ve FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'order_unavailable' USING errcode='42501';END IF;
 SELECT * INTO o FROM public.event_orders WHERE id=p_order FOR UPDATE;
 IF o.id IS NULL OR o.table_id IS DISTINCT FROM ta OR (o.event_id IS NOT NULL AND o.event_id IS DISTINCT FROM ev) THEN RAISE EXCEPTION 'order_unavailable' USING errcode='42501';END IF;
 END IF;
 PERFORM zoi.suite_lock_session();
END$$;
CREATE FUNCTION zoi.service_queue_capacity() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN
 IF(SELECT count(*) FROM zoi.service_queue_requests WHERE actor=auth.uid() AND created_at>clock_timestamp()-interval '1 hour')>=600 THEN RAISE EXCEPTION 'queue_request_limit';END IF;
END$$;
CREATE FUNCTION public.service_queue_list(p_workspace uuid,p_station text DEFAULT NULL,p_after uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE rows jsonb;more boolean;after_time timestamptz;BEGIN
 PERFORM zoi.service_queue_authorize(p_workspace);
 IF p_station IS NOT NULL AND p_station NOT IN('kitchen','bar','merch') THEN RAISE EXCEPTION 'invalid_station';END IF;
 IF p_after IS NOT NULL THEN
 SELECT coalesce(o.created_at,'-infinity'::timestamptz) INTO after_time FROM public.event_orders o JOIN public.venue_tables_zones t ON t.id=o.table_id JOIN public.event_venues v ON v.id=t.venue_id WHERE o.id=p_after AND v.workspace_id=p_workspace AND(v.event_id IS NULL OR EXISTS(SELECT 1 FROM zoi.listings e WHERE e.id=v.event_id AND e.owner_workspace_id=p_workspace));
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_queue_cursor';END IF;
 END IF;
 WITH page AS(SELECT o.id,o.customer_name,o.total_amount,o.payment_status,o.fulfillment_status,o.target_station,o.notes,o.created_at,o.revision,v.event_id,t.name AS table_name,
 (SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'item_name',i.item_name,'quantity',i.quantity,'unit_price',i.unit_price,'special_instructions',i.special_instructions) ORDER BY i.id),'[]') FROM public.event_order_items i WHERE i.order_id=o.id) AS items
 FROM public.event_orders o JOIN public.venue_tables_zones t ON t.id=o.table_id JOIN public.event_venues v ON v.id=t.venue_id
 WHERE v.workspace_id=p_workspace AND(o.event_id IS NULL OR o.event_id=v.event_id) AND(v.event_id IS NULL OR EXISTS(SELECT 1 FROM zoi.listings e WHERE e.id=v.event_id AND e.owner_workspace_id=p_workspace AND e.entity_type='event'))
 AND o.fulfillment_status IN('received','preparing','ready') AND(p_station IS NULL OR o.target_station=p_station) AND(p_after IS NULL OR(coalesce(o.created_at,'-infinity'::timestamptz),o.id)>(after_time,p_after)) ORDER BY coalesce(o.created_at,'-infinity'::timestamptz),o.id LIMIT 101)
 SELECT coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY coalesce(p.created_at,'-infinity'::timestamptz),p.id) FROM(SELECT * FROM page ORDER BY coalesce(created_at,'-infinity'::timestamptz),id LIMIT 100)p),'[]'),(SELECT count(*)>100 FROM page) INTO rows,more;
 PERFORM zoi.suite_lock_session();
 RETURN jsonb_build_object('ok',true,'workspace_id',p_workspace,'station',p_station,'tickets',rows,'has_more',more);
END$$;
CREATE FUNCTION public.kds_ticket_advance_once(p_workspace uuid,p_order uuid,p_expected_revision integer,p_status text,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE prior zoi.service_queue_requests;o public.event_orders;args jsonb;r jsonb;BEGIN
 IF p_order IS NULL OR p_request IS NULL OR p_expected_revision IS NULL OR p_expected_revision<1 OR coalesce(p_status,'') NOT IN('preparing','ready','delivered') THEN RAISE EXCEPTION 'invalid_transition';END IF;
 PERFORM zoi.service_queue_authorize(p_workspace,p_order);
 PERFORM pg_advisory_xact_lock(hashtextextended('service-queue:'||auth.uid()::text,0));
 PERFORM zoi.suite_lock_session();
 args:=jsonb_build_object('expected_revision',p_expected_revision,'status',p_status);
 SELECT * INTO prior FROM zoi.service_queue_requests WHERE actor=auth.uid() AND request_id=p_request;
 IF FOUND THEN
 IF prior.workspace_id IS DISTINCT FROM p_workspace OR prior.order_id IS DISTINCT FROM p_order OR(prior.arguments IS NOT NULL AND prior.arguments IS DISTINCT FROM args) THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN prior.result;
 END IF;
 SELECT * INTO o FROM public.event_orders WHERE id=p_order;
 IF o.revision<>p_expected_revision THEN RAISE EXCEPTION 'version_conflict';END IF;
 IF NOT((o.fulfillment_status='received' AND p_status='preparing')OR(o.fulfillment_status='preparing' AND p_status='ready')OR(o.fulfillment_status='ready' AND p_status='delivered')) THEN RAISE EXCEPTION 'invalid_transition';END IF;
 PERFORM zoi.service_queue_capacity();
 UPDATE public.event_orders SET fulfillment_status=p_status WHERE id=p_order RETURNING * INTO o;
 r:=jsonb_build_object('ok',true,'workspace_id',p_workspace,'order_id',p_order,'request_id',p_request,'status','advanced','fulfillment_status',o.fulfillment_status,'revision',o.revision);
 INSERT INTO zoi.service_queue_requests VALUES(auth.uid(),p_request,p_workspace,p_order,args,r,clock_timestamp());RETURN r;
END$$;
CREATE FUNCTION public.service_queue_request(p_workspace uuid,p_order uuid,p_request uuid,p_cancel_if_missing boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE prior zoi.service_queue_requests;r jsonb;BEGIN
 IF p_order IS NULL OR p_request IS NULL OR p_cancel_if_missing IS NULL THEN RAISE EXCEPTION 'invalid_request';END IF;
 PERFORM zoi.service_queue_authorize(p_workspace,p_order);
 PERFORM pg_advisory_xact_lock(hashtextextended('service-queue:'||auth.uid()::text,0));PERFORM zoi.suite_lock_session();
 SELECT * INTO prior FROM zoi.service_queue_requests WHERE actor=auth.uid() AND request_id=p_request;
 IF FOUND THEN IF prior.workspace_id IS DISTINCT FROM p_workspace OR prior.order_id IS DISTINCT FROM p_order THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN prior.result;END IF;
 r:=jsonb_build_object('ok',true,'workspace_id',p_workspace,'order_id',p_order,'request_id',p_request,'status',CASE WHEN p_cancel_if_missing THEN 'cancelled' ELSE 'unknown' END);
 IF p_cancel_if_missing THEN PERFORM zoi.service_queue_capacity();INSERT INTO zoi.service_queue_requests VALUES(auth.uid(),p_request,p_workspace,p_order,NULL,r,clock_timestamp());END IF;RETURN r;
END$$;
-- Legacy Studio advances remain usable with current authority and serialized state.
-- Same-state retry is harmless, but is not an immutable modern request receipt.
CREATE OR REPLACE FUNCTION public.kds_ticket_advance(p_workspace uuid,p_order_id uuid,p_status text) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE o public.event_orders;BEGIN
 PERFORM zoi.service_queue_authorize(p_workspace,p_order_id);
 IF p_order_id IS NULL OR coalesce(p_status,'') NOT IN('received','preparing','ready','delivered') THEN RETURN json_build_object('ok',false,'error','invalid_transition');END IF;
 SELECT * INTO o FROM public.event_orders WHERE id=p_order_id;
 IF o.fulfillment_status=p_status THEN RETURN json_build_object('ok',true);END IF;
 IF NOT((o.fulfillment_status='received' AND p_status='preparing')OR(o.fulfillment_status='preparing' AND p_status='ready')OR(o.fulfillment_status='ready' AND p_status='delivered')) THEN RETURN json_build_object('ok',false,'error','invalid_transition');END IF;
 PERFORM zoi.suite_lock_session();
 UPDATE public.event_orders SET fulfillment_status=p_status WHERE id=p_order_id;
 RETURN json_build_object('ok',true);
END$$;
CREATE OR REPLACE FUNCTION public.kds_tickets_list(p_workspace uuid,p_station text DEFAULT NULL) RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$SELECT public.service_queue_list(p_workspace,p_station,NULL)::json$$;
REVOKE ALL ON FUNCTION zoi.service_order_revision(),zoi.service_order_item_revision(),zoi.service_queue_authorize(uuid,uuid),zoi.service_queue_capacity() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.service_queue_list(uuid,text,uuid),public.kds_ticket_advance_once(uuid,uuid,integer,text,uuid),public.service_queue_request(uuid,uuid,uuid,boolean),public.kds_ticket_advance(uuid,uuid,text),public.kds_tickets_list(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.service_queue_list(uuid,text,uuid),public.kds_ticket_advance_once(uuid,uuid,integer,text,uuid),public.service_queue_request(uuid,uuid,uuid,boolean),public.kds_ticket_advance(uuid,uuid,text),public.kds_tickets_list(uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

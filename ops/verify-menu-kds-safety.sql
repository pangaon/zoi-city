BEGIN;
SET LOCAL request.jwt.claim.sub='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';
DO $$
DECLARE ws uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor uuid;prior_role text;venue uuid;zone uuid;order_id uuid;item uuid;r jsonb;before_items bigint;stamp timestamptz;
BEGIN
 SELECT p.id,m.role INTO actor,prior_role FROM zoi.user_profiles p JOIN zoi.workspace_members m ON m.profile_id=p.id
 WHERE p.auth_user_id=auth.uid() AND p.id='21a04e78-e3b1-448e-8517-47aad25dd5da' AND m.workspace_id=ws FOR UPDATE OF m;
 IF actor IS NULL OR prior_role IS NULL OR prior_role NOT IN('owner','admin') THEN RAISE EXCEPTION 'qa_scope_unavailable';END IF;
 SELECT count(*) INTO before_items FROM public.menu_items WHERE workspace_id=ws;
 INSERT INTO public.event_venues(name,workspace_id)VALUES('Private rollback QA operator venue',ws)RETURNING id INTO venue;
 INSERT INTO public.venue_tables_zones(venue_id,name)VALUES(venue,'Private rollback QA operator table')RETURNING id INTO zone;
 INSERT INTO public.event_orders(table_id,customer_name,total_amount,fulfillment_status)VALUES(zone,'Private rollback QA',0,'received')RETURNING id INTO order_id;
 UPDATE zoi.workspace_members SET role='viewer' WHERE workspace_id=ws AND profile_id=actor;
 r:=public.menu_item_save(ws,null,'Private rollback QA item',null,500,'kitchen',true);
 IF r->>'ok' IS DISTINCT FROM 'false' OR r->>'error' IS DISTINCT FROM 'insufficient_permission' THEN RAISE EXCEPTION 'viewer_menu_not_denied';END IF;
 IF (SELECT count(*) FROM public.menu_items WHERE workspace_id=ws) IS DISTINCT FROM before_items THEN RAISE EXCEPTION 'viewer_menu_mutated';END IF;
 r:=public.kds_ticket_advance(ws,order_id,'preparing');
 IF r->>'ok' IS DISTINCT FROM 'false' OR r->>'error' IS DISTINCT FROM 'insufficient_permission' OR (SELECT fulfillment_status FROM public.event_orders WHERE id=order_id) IS DISTINCT FROM 'received' THEN RAISE EXCEPTION 'viewer_kds_not_denied';END IF;
 UPDATE zoi.workspace_members SET role='editor' WHERE workspace_id=ws AND profile_id=actor;
 r:=public.menu_item_save(ws,null,'Private rollback QA item',null,500,'kitchen',true);
 IF r->>'ok' IS DISTINCT FROM 'true' OR r->>'id' IS NULL THEN RAISE EXCEPTION 'editor_menu_failed';END IF;
 item:=(r->>'id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.menu_items WHERE id=item AND workspace_id=ws AND name='Private rollback QA item' AND price_cents=500) THEN RAISE EXCEPTION 'editor_menu_receipt_mismatch';END IF;
 IF (public.kds_ticket_advance(ws,order_id,'ready'))->>'error' IS DISTINCT FROM 'invalid_transition' THEN RAISE EXCEPTION 'kds_skip_accepted';END IF;
 r:=public.kds_ticket_advance(ws,order_id,'preparing');
 IF r->>'ok' IS DISTINCT FROM 'true' OR (SELECT fulfillment_status FROM public.event_orders WHERE id=order_id) IS DISTINCT FROM 'preparing' THEN RAISE EXCEPTION 'editor_kds_failed';END IF;
 SELECT updated_at INTO stamp FROM public.event_orders WHERE id=order_id;
 IF (public.kds_ticket_advance(ws,order_id,'preparing'))->>'ok' IS DISTINCT FROM 'true' OR (SELECT updated_at FROM public.event_orders WHERE id=order_id) IS DISTINCT FROM stamp THEN RAISE EXCEPTION 'kds_same_state_changed';END IF;
 IF (public.kds_ticket_advance(ws,order_id,'received'))->>'error' IS DISTINCT FROM 'invalid_transition' THEN RAISE EXCEPTION 'kds_reverse_accepted';END IF;
 r:=public.kds_ticket_advance(ws,order_id,'ready');
 IF r->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'kds_ready_failed';END IF;
 r:=public.kds_ticket_advance(ws,order_id,'delivered');
 IF r->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'kds_delivered_failed';END IF;
 IF (public.kds_ticket_advance(ws,order_id,'cancelled'))->>'error' IS DISTINCT FROM 'invalid_transition' THEN RAISE EXCEPTION 'kds_terminal_reversed';END IF;
 IF has_function_privilege('anon','public.menu_item_save(uuid,uuid,text,text,integer,text,boolean)','EXECUTE') OR has_function_privilege('anon','public.kds_ticket_advance(uuid,uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'operator_acl_failed';END IF;
 -- Restore even before the enclosing rollback; only the pinned QA membership is touched.
 UPDATE zoi.workspace_members SET role=prior_role WHERE workspace_id=ws AND profile_id=actor;
END $$;
SELECT 'menu_kds_safety_rollback_checks_passed' AS result;
ROLLBACK;

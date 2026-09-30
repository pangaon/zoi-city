BEGIN;
SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='15s';
SET LOCAL request.jwt.claim.sub='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';
DO $$
DECLARE ws uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';venue uuid;tbl uuid;tab uuid;ord uuid;r jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.user_profiles p JOIN zoi.workspace_members m ON m.profile_id=p.id WHERE p.id=actor AND p.auth_user_id=auth.uid() AND m.workspace_id=ws AND m.role IN('owner','admin')) THEN RAISE EXCEPTION 'qa_scope_unavailable';END IF;
 INSERT INTO public.event_venues(name,workspace_id)VALUES('Private rollback service read QA',ws)RETURNING id INTO venue;
 INSERT INTO public.venue_tables_zones(venue_id,name)VALUES(venue,'QA table')RETURNING id INTO tbl;
 INSERT INTO public.table_tabs(table_id,total_amount)VALUES(tbl,5)RETURNING id INTO tab;
 INSERT INTO public.event_orders(table_id,tab_id,customer_name,total_amount,fulfillment_status,target_station)VALUES(tbl,tab,'Private QA',5,'received','bar')RETURNING id INTO ord;
 r:=public.table_tab_list(ws);IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'tabs') x WHERE x->>'id'=tab::text)THEN RAISE EXCEPTION 'qa_tab_missing';END IF;
 r:=public.kds_tickets_list(ws,'bar');IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'tickets') x WHERE x->>'id'=ord::text)THEN RAISE EXCEPTION 'qa_order_missing';END IF;
 UPDATE zoi.workspace_members SET role='viewer' WHERE workspace_id=ws AND profile_id=actor;
 IF public.table_tab_list(ws)->>'error' IS DISTINCT FROM 'insufficient_permission' OR public.kds_tickets_list(ws,null)->>'error' IS DISTINCT FROM 'insufficient_permission' THEN RAISE EXCEPTION 'qa_viewer_exposure';END IF;
 UPDATE zoi.workspace_members SET role='editor' WHERE workspace_id=ws AND profile_id=actor;
 UPDATE public.event_venues SET event_id=gen_random_uuid() WHERE id=venue;
 r:=public.table_tab_list(ws);IF EXISTS(SELECT 1 FROM jsonb_array_elements(r->'tabs') x WHERE x->>'id'=tab::text)THEN RAISE EXCEPTION 'qa_orphan_event_tab_exposure';END IF;
 r:=public.kds_tickets_list(ws,null);IF EXISTS(SELECT 1 FROM jsonb_array_elements(r->'tickets') x WHERE x->>'id'=ord::text)THEN RAISE EXCEPTION 'qa_orphan_event_order_exposure';END IF;
 IF has_function_privilege('anon','public.table_tab_list(uuid)','EXECUTE') OR has_function_privilege('anon','public.kds_tickets_list(uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'qa_read_acl';END IF;
END $$;
SELECT 'service_operator_read_checks_passed' AS result;
ROLLBACK;

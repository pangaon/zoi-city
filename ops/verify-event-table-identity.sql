BEGIN;
SET LOCAL statement_timeout='20s';
SET LOCAL request.jwt.claim.sub='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';
DO $$
DECLARE ws uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';event uuid:=gen_random_uuid();tbl uuid:=gen_random_uuid();request uuid:=gen_random_uuid();data jsonb;r jsonb;got jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.user_profiles p JOIN zoi.workspace_members m ON m.profile_id=p.id WHERE p.id=actor AND p.auth_user_id=auth.uid() AND m.workspace_id=ws AND m.role IN('owner','admin')) THEN RAISE EXCEPTION 'qa_scope_unavailable';END IF;
 IF NOT EXISTS(SELECT 1 FROM zoi.categories WHERE id=6 AND slug='events-entertainment') THEN RAISE EXCEPTION 'qa_event_category_unavailable';END IF;
 INSERT INTO zoi.listings(id,name,entity_type,owner_workspace_id,primary_category_id,publish_status,moderation_status,marketplace_status)VALUES(event,'Private rollback table identity QA','event',ws,6,'draft','clean','hidden');
 data:=jsonb_build_array(jsonb_build_object('id',tbl,'label','QA table identity','capacity',4));
 r:=public.table_identity_save(ws,event,0,request,data);
 IF r->>'ok' IS DISTINCT FROM 'true' OR r->>'version' IS DISTINCT FROM '1' OR r->>'enabled' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'identity_save_failed';END IF;
 IF public.table_identity_save(ws,event,0,request,data) IS DISTINCT FROM r THEN RAISE EXCEPTION 'identity_retry_failed';END IF;
 got:=public.table_identity_get(ws,event);
 IF got#>>'{tables,0,id}' IS DISTINCT FROM tbl::text OR got#>>'{tables,0,capacity}' IS DISTINCT FROM '4' OR jsonb_array_length(got->'tables') IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'identity_read_failed';END IF;
 got:=public.table_identity_receipt(ws,event,request);
 IF got->>'found' IS DISTINCT FROM 'true' OR got->'receipt' IS DISTINCT FROM r OR got ? 'payload' THEN RAISE EXCEPTION 'identity_recovery_failed';END IF;
 IF EXISTS(SELECT 1 FROM zoi.event_table_settings WHERE event_id=event) OR EXISTS(SELECT 1 FROM zoi.event_table_holds WHERE event_id=event) THEN RAISE EXCEPTION 'identity_created_sales';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.event_venues WHERE id=(r->>'venue_id')::uuid AND dimensions_w IS NULL AND dimensions_d IS NULL AND scale_meters_per_px IS NULL) THEN RAISE EXCEPTION 'identity_invented_geometry';END IF;
 BEGIN DELETE FROM public.venue_tables_zones WHERE id=tbl;RAISE EXCEPTION 'identity_delete_allowed';EXCEPTION WHEN raise_exception THEN IF SQLERRM IS DISTINCT FROM 'table_identity_managed' THEN RAISE;END IF;END;
 BEGIN UPDATE zoi.workspace_members SET role='viewer' WHERE workspace_id=ws AND profile_id=actor;PERFORM public.table_identity_receipt(ws,event,request);RAISE EXCEPTION 'identity_viewer_allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 IF has_function_privilege('anon','public.table_identity_save(uuid,uuid,integer,uuid,jsonb)','EXECUTE') OR has_table_privilege('authenticated','zoi.event_table_identity_requests','SELECT') THEN RAISE EXCEPTION 'identity_acl_failed';END IF;
END $$;
SELECT 'event_table_identity_rollback_checks_passed' AS result;
ROLLBACK;

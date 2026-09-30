BEGIN;
SET LOCAL request.jwt.claim.sub='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';
DO $$
DECLARE ws uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';event uuid:=gen_random_uuid();venue uuid;tbl uuid;request uuid:=gen_random_uuid();config_request uuid:=gen_random_uuid();data jsonb;r jsonb;h jsonb;retry jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.user_profiles p JOIN zoi.workspace_members m ON m.profile_id=p.id WHERE p.id=actor AND p.auth_user_id=auth.uid() AND m.workspace_id=ws AND m.role IN('owner','admin')) THEN RAISE EXCEPTION 'qa_scope_unavailable';END IF;
 INSERT INTO zoi.listings(id,name,entity_type,owner_workspace_id,publish_status,moderation_status,marketplace_status)VALUES(event,'Private rollback table hold QA','event',ws,'published','clean','visible');
 INSERT INTO public.event_venues(event_id,name,workspace_id)VALUES(event,'Private rollback table hold QA',ws)RETURNING id INTO venue;
 INSERT INTO public.venue_tables_zones(venue_id,name,capacity)VALUES(venue,'QA table',4)RETURNING id INTO tbl;
 data:=jsonb_build_object('starts_at',to_char(clock_timestamp()+interval '1 day','YYYY-MM-DD"T"HH24:MI:SSOF'),'enabled',true,'tables',jsonb_build_array(jsonb_build_object('table_id',tbl,'source_label','QA1','capacity',4,'min_party_size',2,'price_per_guest_cents',100,'currency','CAD','fees_included',true)));
 -- Explicit UTC ISO offset independent of session timezone or to_char OF width.
 data:=jsonb_set(data,'{starts_at}',to_jsonb(to_char((clock_timestamp()+interval '1 day')AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')));
 r:=public.table_inventory_configure(ws,event,0,config_request,data);
 IF r->>'ok' IS DISTINCT FROM 'true' OR r->>'version' IS DISTINCT FROM '1' OR r->>'payment_enabled' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'table_config_failed';END IF;
 IF public.table_inventory_configure(ws,event,0,config_request,data) IS DISTINCT FROM r THEN RAISE EXCEPTION 'table_config_retry_failed';END IF;
 retry:=public.table_inventory_configure_receipt(ws,event,config_request);
 IF retry->>'found' IS DISTINCT FROM 'true' OR retry->'receipt' IS DISTINCT FROM r OR retry ? 'payload' THEN RAISE EXCEPTION 'configuration_recovery_failed';END IF;
 IF public.table_inventory_configure_receipt(ws,event,gen_random_uuid())->>'found' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'unknown_config_request_failed';END IF;
 BEGIN
  UPDATE zoi.workspace_members SET role='viewer' WHERE workspace_id=ws AND profile_id=actor;
  PERFORM public.table_inventory_configure_receipt(ws,event,config_request);
  RAISE EXCEPTION 'viewer_config_receipt_exposed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 IF has_function_privilege('anon','public.table_inventory_configure_receipt(uuid,uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'config_receipt_acl_failed';END IF;
 r:=public.table_inventory_map(event);IF r->>'configured' IS DISTINCT FROM 'true' OR r#>>'{tables,0,availability}' IS DISTINCT FROM 'available' THEN RAISE EXCEPTION 'table_map_failed';END IF;
 r:=public.table_hold_create(event,tbl,2,1,request);h:=r->'hold';
 IF r->>'ok' IS DISTINCT FROM 'true' OR r->>'payment_collected' IS DISTINCT FROM 'false' OR h->>'status' IS DISTINCT FROM 'active' OR h->>'total_cents' IS DISTINCT FROM '200' OR h->>'exclusive_table' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'table_hold_failed';END IF;
 retry:=public.table_hold_create(event,tbl,2,1,request);IF retry->'hold' IS DISTINCT FROM h THEN RAISE EXCEPTION 'table_hold_retry_failed';END IF;
 r:=public.table_hold_status(event,request);IF r#>'{holds,0}' IS DISTINCT FROM h THEN RAISE EXCEPTION 'table_hold_recovery_failed';END IF;
 r:=public.table_inventory_map(event);IF r#>>'{tables,0,availability}' IS DISTINCT FROM 'held' THEN RAISE EXCEPTION 'table_hold_not_protected';END IF;
 r:=public.table_hold_release((h->>'id')::uuid);IF r#>>'{hold,status}' IS DISTINCT FROM 'released' THEN RAISE EXCEPTION 'table_release_failed';END IF;
 IF(public.table_hold_create(event,tbl,2,1,request))#>>'{hold,status}' IS DISTINCT FROM 'released' THEN RAISE EXCEPTION 'table_hold_reacquired';END IF;
 IF has_table_privilege('authenticated','zoi.event_table_holds','SELECT') OR has_function_privilege('anon','public.table_hold_create(uuid,uuid,integer,integer,uuid)','EXECUTE') THEN RAISE EXCEPTION 'table_hold_acl_failed';END IF;
END $$;
SELECT 'event_table_configuration_receipt_rollback_checks_passed' AS result;
ROLLBACK;

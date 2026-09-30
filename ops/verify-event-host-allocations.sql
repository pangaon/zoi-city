BEGIN;
SET LOCAL request.jwt.claim.sub='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';
DO $$
DECLARE ws uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';event uuid:=gen_random_uuid();venue uuid;tbl uuid;request uuid:=gen_random_uuid();config_request uuid:=gen_random_uuid();token text:=encode(extensions.gen_random_bytes(32),'hex');data jsonb;r jsonb;h jsonb;retry jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.user_profiles p JOIN zoi.workspace_members m ON m.profile_id=p.id WHERE p.id=actor AND p.auth_user_id=auth.uid() AND m.workspace_id=ws AND m.role IN('owner','admin')) THEN RAISE EXCEPTION 'qa_scope_unavailable';END IF;
 IF NOT EXISTS(SELECT 1 FROM zoi.categories WHERE id=6 AND slug='events-entertainment') THEN RAISE EXCEPTION 'qa_event_category_unavailable';END IF;
 INSERT INTO zoi.listings(id,name,entity_type,owner_workspace_id,primary_category_id,publish_status,moderation_status,marketplace_status)VALUES(event,'Private rollback table hold QA','event',ws,6,'published','clean','visible');
 IF NOT EXISTS(SELECT 1 FROM zoi.listings l WHERE l.id=event AND l.owner_workspace_id=ws AND l.publish_status='published' AND l.moderation_status='clean' AND l.marketplace_status='visible') THEN RAISE EXCEPTION 'qa_event_public_eligibility_failed';END IF;
 INSERT INTO public.event_venues(event_id,name,workspace_id)VALUES(event,'Private rollback table hold QA',ws)RETURNING id INTO venue;
 INSERT INTO public.venue_tables_zones(venue_id,name,capacity)VALUES(venue,'QA table',4)RETURNING id INTO tbl;
 data:=jsonb_build_object('starts_at',to_char(clock_timestamp()+interval '1 day','YYYY-MM-DD"T"HH24:MI:SSOF'),'enabled',true,'tables',jsonb_build_array(jsonb_build_object('table_id',tbl,'source_label','QA1','capacity',4,'min_party_size',2,'price_per_guest_cents',100,'currency','CAD','fees_included',true)));
 -- Explicit UTC ISO offset independent of session timezone or to_char OF width.
 data:=jsonb_set(data,'{starts_at}',to_jsonb(to_char((clock_timestamp()+interval '1 day')AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')));

 r:=public.table_inventory_configure(ws,event,0,config_request,data);
 r:=public.event_host_allocate(ws,event,tbl,actor,4,clock_timestamp()+interval '1 hour',1,request);
 IF r->>'ok' IS DISTINCT FROM 'true' OR r#>>'{allocation,quota}' IS DISTINCT FROM '4' OR r->>'payment_collected' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'host_allocation_failed';END IF;
 h:=r->'allocation';
 r:=public.table_inventory_map(event);IF r#>>'{tables,0,availability}' IS DISTINCT FROM 'unavailable' THEN RAISE EXCEPTION 'host_public_availability_failed';END IF;
 data:=public.event_host_guest_save((h->>'id')::uuid,gen_random_uuid(),0,gen_random_uuid(),'Private QA guest',3,token);
 IF data#>>'{guest,quantity}' IS DISTINCT FROM '3' OR data->>'delivery_configured' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'host_guest_failed';END IF;
 r:=public.event_host_claim_preview(token);
 IF r->>'quantity' IS DISTINCT FROM '3' OR r->>'table_label' IS DISTINCT FROM 'QA1' OR r->>'payment_collected' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'host_claim_preview_failed';END IF;
 r:=public.event_host_claim(token,gen_random_uuid());
 IF r->>'quantity' IS DISTINCT FROM '3' OR r->>'ticket_issued' IS DISTINCT FROM 'false' OR r->>'payment_collected' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'host_claim_failed';END IF;
 r:=public.event_host_release((h->>'id')::uuid,1,gen_random_uuid());
 IF r#>>'{allocation,status}' IS DISTINCT FROM 'released' THEN RAISE EXCEPTION 'host_release_failed';END IF;
 IF public.table_inventory_map(event)#>>'{tables,0,availability}' IS DISTINCT FROM 'available' THEN RAISE EXCEPTION 'host_release_inventory_failed';END IF;
 IF has_function_privilege('anon','public.event_host_claim(text,uuid)','EXECUTE') OR has_table_privilege('authenticated','zoi.event_host_guests','SELECT') THEN RAISE EXCEPTION 'host_acl_failed';END IF;
END $$;
SELECT 'event_host_allocation_rollback_checks_passed' AS result;
ROLLBACK;

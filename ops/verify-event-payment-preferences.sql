BEGIN;
SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='20s';
SET LOCAL request.jwt.claim.sub='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';
DO $$
DECLARE ws uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';ev uuid:=gen_random_uuid();venue uuid;tbl uuid;guest uuid:=gen_random_uuid();nonce uuid:=gen_random_uuid();token text:=encode(extensions.gen_random_bytes(32),'hex');data jsonb;r jsonb;a jsonb;receipt jsonb;failed boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.user_profiles p JOIN zoi.workspace_members m ON m.profile_id=p.id WHERE p.id=actor AND p.auth_user_id=auth.uid() AND m.workspace_id=ws AND m.role IN('owner','admin')) THEN RAISE EXCEPTION 'qa_scope_unavailable';END IF;
 IF NOT EXISTS(SELECT 1 FROM zoi.categories WHERE id=6 AND slug='events-entertainment') THEN RAISE EXCEPTION 'qa_event_category_unavailable';END IF;
 INSERT INTO zoi.listings(id,name,entity_type,owner_workspace_id,primary_category_id,publish_status,moderation_status,marketplace_status)VALUES(ev,'Private rollback payment policy QA','event',ws,6,'published','clean','visible');
 INSERT INTO public.event_venues(event_id,name,workspace_id)VALUES(ev,'Private rollback payment policy QA',ws)RETURNING id INTO venue;
 INSERT INTO public.venue_tables_zones(venue_id,name,capacity)VALUES(venue,'QA table',4)RETURNING id INTO tbl;
 data:=jsonb_build_object('starts_at',to_char((clock_timestamp()+interval '1 day')AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),'enabled',true,'tables',jsonb_build_array(jsonb_build_object('table_id',tbl,'source_label','QA1','capacity',4,'min_party_size',2,'price_per_guest_cents',100,'currency','CAD','fees_included',true)));
 PERFORM public.table_inventory_configure(ws,ev,0,gen_random_uuid(),data);
 r:=public.event_payment_policy_get(ws,ev);IF r#>>'{policy,allow_pay_at_door}' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'payment_policy_default_failed';END IF;
 PERFORM public.event_payment_policy_save(ws,ev,0,gen_random_uuid(),true,false);
 a:=public.event_host_allocate(ws,ev,tbl,actor,4,clock_timestamp()+interval '1 hour',1,gen_random_uuid())->'allocation';
 PERFORM public.event_host_guest_save((a->>'id')::uuid,guest,0,gen_random_uuid(),'QA guest',3,token);PERFORM public.event_host_claim(token,gen_random_uuid());
 receipt:=public.event_guest_payment_choose(guest,'pay_at_door',1,0,nonce);
 IF receipt->>'payment_collected' IS DISTINCT FROM 'false' OR receipt->>'ticket_issued' IS DISTINCT FROM 'false' OR receipt->>'quantity' IS DISTINCT FROM '3' OR receipt#>>'{choice,status}' IS DISTINCT FROM 'unpaid' THEN RAISE EXCEPTION 'payment_preference_failed';END IF;
 IF public.event_guest_payment_choose(guest,'pay_at_door',1,0,nonce) IS DISTINCT FROM receipt THEN RAISE EXCEPTION 'payment_preference_replay_failed';END IF;
 r:=public.event_payment_operator_report(ws,ev);IF r#>>'{preferences,0,unpaid_preference_cents}' IS DISTINCT FROM '300' OR r->>'settlement_ledger' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'payment_operator_report_failed';END IF;
 failed:=false;BEGIN PERFORM public.event_guest_payment_choose(guest,'pay_online',1,1,gen_random_uuid());EXCEPTION WHEN OTHERS THEN IF SQLERRM='online_provider_unavailable' THEN failed:=true;ELSE RAISE;END IF;END;IF NOT failed THEN RAISE EXCEPTION 'online_payment_not_blocked';END IF;
 PERFORM public.event_payment_policy_save(ws,ev,1,gen_random_uuid(),false,false);
 r:=public.event_guest_payment_options(ev);IF r#>>'{guests,0,choice,status}' IS DISTINCT FROM 'needs_review' THEN RAISE EXCEPTION 'payment_policy_refresh_failed';END IF;
 IF public.table_inventory_map(ev)#>>'{tables,0,availability}' IS DISTINCT FROM 'unavailable' THEN RAISE EXCEPTION 'payment_mutated_inventory';END IF;
 IF has_function_privilege('anon','public.event_guest_payment_choose(uuid,text,integer,integer,uuid)','EXECUTE') OR has_table_privilege('authenticated','zoi.event_guest_payment_preferences','SELECT') THEN RAISE EXCEPTION 'payment_acl_failed';END IF;
END $$;
SELECT 'event_payment_preferences_rollback_checks_passed' AS result;
ROLLBACK;

BEGIN;
SET LOCAL request.jwt.claim.sub='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';
DO $$
DECLARE ws uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor uuid;venue uuid;zone uuid;tab uuid;req uuid:=gen_random_uuid();r jsonb;r2 jsonb;denied boolean:=false;
BEGIN
 SELECT p.id INTO actor FROM zoi.user_profiles p JOIN zoi.workspace_members m ON m.profile_id=p.id WHERE p.auth_user_id=auth.uid() AND m.workspace_id=ws AND m.role IN('owner','admin');IF actor IS NULL THEN RAISE EXCEPTION 'qa_scope_unavailable';END IF;
 INSERT INTO public.event_venues(name,workspace_id)VALUES('Private rollback QA venue',ws)RETURNING id INTO venue;
 INSERT INTO public.venue_tables_zones(venue_id,name)VALUES(venue,'Private rollback QA table')RETURNING id INTO zone;
 INSERT INTO public.table_tabs(table_id,status,total_amount,paid_amount)VALUES(zone,'open',10,0)RETURNING id INTO tab;
 r:=public.table_tab_cash_once(ws,tab,6,req);IF r->>'ok' IS DISTINCT FROM 'true' OR r->>'method' IS DISTINCT FROM 'cash' OR r->>'online_payment_collected' IS DISTINCT FROM 'false' OR r->>'remaining_amount' IS DISTINCT FROM '4' THEN RAISE EXCEPTION 'cash_receipt_failed';END IF;
 r2:=public.table_tab_cash_once(ws,tab,6,req);IF r2 IS DISTINCT FROM r OR(SELECT count(*)FROM public.tab_payments WHERE tab_id=tab)<>1 THEN RAISE EXCEPTION 'cash_retry_failed';END IF;
 BEGIN PERFORM public.table_tab_cash_once(ws,tab,5,gen_random_uuid());EXCEPTION WHEN OTHERS THEN IF SQLERRM='amount_exceeds_balance' THEN denied:=true;ELSE RAISE;END IF;END;IF NOT denied THEN RAISE EXCEPTION 'overpayment_accepted';END IF;
 IF(public.table_tab_record_cash_payment(ws,tab,1,'card'))->>'error' IS DISTINCT FROM 'request_id_required' THEN RAISE EXCEPTION 'legacy_cash_not_contained';END IF;
 IF(public.table_tab_guest_order('nonexistent','QA','[]'))->>'error' IS DISTINCT FROM 'request_id_required' THEN RAISE EXCEPTION 'legacy_order_not_contained';END IF;
 IF has_function_privilege('anon','public.table_tab_cash_once(uuid,uuid,numeric,uuid)','EXECUTE') OR has_table_privilege('authenticated','zoi.table_tab_requests','SELECT') THEN RAISE EXCEPTION 'receipt_acl_failed';END IF;
END $$;
SELECT 'table_tab_safety_rollback_checks_passed' AS result;
ROLLBACK;

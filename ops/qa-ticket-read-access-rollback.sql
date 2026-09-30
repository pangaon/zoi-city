-- Synthetic, transaction-only event/tier. No customer or payment mutation.
BEGIN;
SET LOCAL statement_timeout='20s';
SET LOCAL lock_timeout='3s';
DO $qa$
DECLARE ws uuid:='053a5656-b19b-48a4-8721-65c4674f647c';ev uuid:=gen_random_uuid();req uuid:=gen_random_uuid();tier bigint;cat bigint;a jsonb;b jsonb;blocked boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.workspaces WHERE id=ws) THEN RAISE EXCEPTION 'qa_workspace_missing'; END IF;
 SELECT primary_category_id INTO cat FROM zoi.listings WHERE entity_type='event' AND primary_category_id IS NOT NULL LIMIT 1;
 IF cat IS NULL THEN RAISE EXCEPTION 'qa_event_category_missing';END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 INSERT INTO zoi.listings(id,name,slug,entity_type,primary_category_id,city,country,address,website,description,publish_status,moderation_status,marketplace_status,profile,owner_workspace_id)
 VALUES(ev,'Transactional GA QA','rollback-ticket-read-'||ev,'event',cat,'Athens','Greece','QA transaction only','https://example.org','Synthetic transaction only','published','clean','none',jsonb_build_object('event_at',clock_timestamp()+interval '10 days'),ws);
 INSERT INTO zoi.ticket_types(event_id,workspace_id,name,price_cents,currency,capacity,reserved,active)
 VALUES(ev,ws,'Transactional free QA',0,'CAD',3,0,true) RETURNING id INTO tier;
 a:=public.tickets_reserve_once(req,ev,tier,'QA synthetic customer','qa@example.org',2);
 b:=public.tickets_reserve_once(req,ev,tier,'QA synthetic customer','qa@example.org',2);
 IF a<>b OR a->>'request_id'<>req::text OR (SELECT reserved FROM zoi.ticket_types WHERE id=tier)<>2 THEN RAISE EXCEPTION 'qa_idempotency_failed';END IF;
 b:=public.tickets_reserve_receipt(req,ev,tier);
 IF b->>'found'<>'true' OR b->'receipt'<>a OR b::text LIKE '%qa@example.org%' THEN RAISE EXCEPTION 'qa_private_receipt_failed';END IF;
 blocked:=false;BEGIN PERFORM public.tickets_reserve_once(req,ev,tier,'Changed name','qa@example.org',2);EXCEPTION WHEN OTHERS THEN IF SQLERRM='request_conflict' THEN blocked:=true;ELSE RAISE;END IF;END;
 IF NOT blocked THEN RAISE EXCEPTION 'qa_changed_retry_allowed';END IF;
 blocked:=false;BEGIN PERFORM public.tickets_reserve_once(gen_random_uuid(),ev,tier,'QA synthetic customer','qa@example.org',2);EXCEPTION WHEN OTHERS THEN IF SQLERRM='not enough tickets left' THEN blocked:=true;ELSE RAISE;END IF;END;
 IF NOT blocked OR (SELECT reserved FROM zoi.ticket_types WHERE id=tier)<>2 THEN RAISE EXCEPTION 'qa_capacity_failed';END IF;
 UPDATE zoi.listings SET marketplace_status='hidden' WHERE id=ev;
 blocked:=false;BEGIN PERFORM public.tickets_reserve(ev,tier,'QA synthetic customer','qa@example.org',1);EXCEPTION WHEN OTHERS THEN IF SQLERRM='event_unavailable' THEN blocked:=true;ELSE RAISE;END IF;END;
 IF NOT blocked THEN RAISE EXCEPTION 'qa_legacy_visibility_bypass';END IF;
 IF public.tickets_reserve_once(req,ev,tier,'QA synthetic customer','qa@example.org',2)<>a THEN RAISE EXCEPTION 'qa_closed_receipt_recovery_failed';END IF;
 IF public.tickets_event_public(ev) IS NOT NULL OR EXISTS(SELECT 1 FROM public.tickets_types_list(ev)) OR public.tickets_checkout_info(ev,tier) IS NOT NULL
 THEN RAISE EXCEPTION 'qa_hidden_read_leak';END IF;
 IF NOT EXISTS(SELECT 1 FROM zoi.user_profiles WHERE id='21a04e78-e3b1-448e-8517-47aad25dd5da' AND auth_user_id='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd')
 THEN RAISE EXCEPTION 'qa_actor_mismatch';END IF;
 PERFORM set_config('request.jwt.claim.sub','2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd',true);
 UPDATE zoi.workspace_members SET role='viewer' WHERE workspace_id=ws AND profile_id='21a04e78-e3b1-448e-8517-47aad25dd5da';
 IF NOT FOUND THEN RAISE EXCEPTION 'qa_membership_missing';END IF;
 blocked:=false;BEGIN PERFORM public.tickets_reservations_list(ws,ev);EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'qa_viewer_contacts_leak';END IF;
 UPDATE zoi.workspace_members SET role='owner' WHERE workspace_id=ws AND profile_id='21a04e78-e3b1-448e-8517-47aad25dd5da';
 IF jsonb_array_length(public.tickets_reservations_list(ws,ev))<>1 THEN RAISE EXCEPTION 'qa_owner_read_missing';END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 UPDATE zoi.ticket_reservations SET status='cancelled' WHERE code=a->>'code';
 b:=public.tickets_reserve_receipt(req,ev,tier);
 IF b->>'current_status'<>'cancelled' OR b->'receipt'<>a OR b->>'event_available'<>'false' THEN RAISE EXCEPTION 'qa_cancellation_status_missing';END IF;
END $qa$;
ROLLBACK;
SELECT true AS general_ticket_rollback_passed,(SELECT count(*) FROM zoi.listings WHERE slug LIKE 'rollback-ticket-read-%') AS persisted_test_listings;

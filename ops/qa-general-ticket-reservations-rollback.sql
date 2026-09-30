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
 VALUES(ev,'Transactional GA QA','rollback-ga-'||ev,'event',cat,'Athens','Greece','QA transaction only','https://example.org','Synthetic transaction only','published','clean','none',jsonb_build_object('event_at',clock_timestamp()+interval '10 days'),ws);
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
END $qa$;
ROLLBACK;
SELECT true AS general_ticket_rollback_passed,(SELECT count(*) FROM zoi.listings WHERE slug LIKE 'rollback-ga-%') AS persisted_test_listings;

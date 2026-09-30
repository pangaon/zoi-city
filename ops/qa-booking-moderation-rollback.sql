BEGIN;
SET LOCAL statement_timeout='20s';SET LOCAL lock_timeout='3s';
DO $qa$
DECLARE ws uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor uuid:='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';ev uuid:=gen_random_uuid();cat bigint;service jsonb;resource jsonb;slot jsonb;b jsonb;request uuid:=gen_random_uuid();blocked boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.workspace_members m JOIN zoi.user_profiles p ON p.id=m.profile_id WHERE m.workspace_id=ws AND p.auth_user_id=actor AND m.role IN('owner','admin')) THEN RAISE EXCEPTION 'qa_owner_missing';END IF;
 SELECT primary_category_id INTO cat FROM zoi.listings WHERE primary_category_id IS NOT NULL LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 INSERT INTO zoi.listings(id,entity_type,name,slug,primary_category_id,city,country,address,website,publish_status,moderation_status,marketplace_status,owner_workspace_id)
 VALUES(ev,'business','Transactional moderation QA','rollback-booking-moderation-'||ev,cat,'Athens','Greece','QA','https://example.org','published','clean','none',ws);
 -- Dedicated QA configuration only, restored by rollback including any old listing.
 INSERT INTO zoi.booking_settings(workspace_id,listing_id,timezone,currency,enabled) VALUES(ws,ev,'Europe/Athens','EUR',true)
 ON CONFLICT(workspace_id) DO UPDATE SET listing_id=excluded.listing_id,enabled=true;
 service:=public.booking_item_save(ws,'service',null,0,'{"name":"Moderation QA","duration_minutes":60,"buffer_minutes":0,"price_cents":0,"active":true}')->'item';
 resource:=public.booking_item_save(ws,'resource',null,0,'{"name":"Moderation QA","kind":"table","capacity":4,"active":true}')->'item';
 slot:=public.booking_slot_save(ws,null,0,(service->>'id')::uuid,(resource->>'id')::uuid,clock_timestamp()+interval '20 days',true)->'slot';
 UPDATE zoi.listings SET moderation_status='flagged' WHERE id=ev;
 blocked:=false;BEGIN PERFORM public.booking_create((slot->>'id')::uuid,request,'QA','qa@example.org',2,1);EXCEPTION WHEN OTHERS THEN IF SQLERRM='booking_unavailable' THEN blocked:=true;ELSE RAISE;END IF;END;
 IF NOT blocked THEN RAISE EXCEPTION 'qa_flagged_booking_allowed';END IF;
 UPDATE zoi.listings SET moderation_status='cleared' WHERE id=ev;
 b:=public.booking_create((slot->>'id')::uuid,request,'QA','qa@example.org',2,1);
 IF b->'booking'->>'status'<>'confirmed' THEN RAISE EXCEPTION 'qa_cleared_booking_failed';END IF;
 UPDATE zoi.listings SET moderation_status='flagged' WHERE id=ev;
 IF public.booking_create((slot->>'id')::uuid,request,'QA','qa@example.org',2,1)<>b THEN RAISE EXCEPTION 'qa_historical_retry_changed';END IF;
END $qa$;
ROLLBACK;
SELECT true AS booking_moderation_rollback_passed,(SELECT count(*) FROM zoi.listings WHERE slug LIKE 'rollback-booking-moderation-%') AS persisted_test_listings;

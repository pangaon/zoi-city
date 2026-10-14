-- Reviewed production SQL contract fixture only. No provider calls or public posts.
-- Existing dedicated QA owner and actual active session; all new rows rolled back.
-- Never replace authority helpers, disable triggers or print auth credentials.
BEGIN;
SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='45s';SET LOCAL idle_in_transaction_session_timeout='60s';
CREATE TEMP TABLE qa_venue_results(label text PRIMARY KEY,passed boolean) ON COMMIT DROP;
GRANT INSERT,SELECT ON qa_venue_results TO authenticated,service_role;
CREATE FUNCTION pg_temp.qa_venue_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'qa_venue_assertion_failed:%',label;END IF;INSERT INTO pg_temp.qa_venue_results VALUES(label,true);END$$;
DO $qa$
DECLARE executor name:=current_user;
 ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor constant uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';account constant uuid:='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';
 listing constant uuid:='c1eb6d31-5454-4c5c-b52b-cd2610140001';foreign_listing constant uuid:='c1eb6d31-5454-4c5c-b52b-cd2610140002';other_ws constant uuid:='c1eb6d31-5454-4c5c-b52b-cd2610140003';channel_id constant bigint:=-9126101400001;ephemeral_session constant uuid:='c1eb6d31-5454-4c5c-b52b-cd2610140004';fixture_source constant text:='qa-publisher-aged-rollback-20261014';item jsonb;source_record jsonb;due jsonb;snapshot jsonb;original_meta jsonb;sid uuid;category bigint;receipt jsonb;replay jsonb;post zoi.social_posts;denied boolean;
BEGIN
 IF EXISTS(SELECT 1 FROM zoi.listings WHERE id IN(listing,foreign_listing))OR EXISTS(SELECT 1 FROM zoi.workspaces WHERE id=other_ws)OR EXISTS(SELECT 1 FROM zoi.social_channels WHERE id=channel_id)OR EXISTS(SELECT 1 FROM auth.sessions WHERE id=ephemeral_session)OR EXISTS(SELECT 1 FROM zoi.editorial_sources WHERE id=fixture_source)OR EXISTS(SELECT 1 FROM zoi.social_posts WHERE meta->>'qa_publisher_fixture'='20261014')THEN RAISE EXCEPTION 'qa_publisher_fixture_collision';END IF;
 IF NOT EXISTS(SELECT 1 FROM zoi.workspaces w JOIN zoi.workspace_members m ON m.workspace_id=w.id JOIN zoi.user_profiles p ON p.id=m.profile_id JOIN auth.users u ON u.id=p.auth_user_id WHERE w.id=ws AND w.name='Zoi isolated QA 2026-09-30' AND w.owner_profile_id=actor AND m.profile_id=actor AND m.role='owner' AND p.auth_user_id=account AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND NOT coalesce(u.is_anonymous,false)AND(u.banned_until IS NULL OR u.banned_until<=clock_timestamp()))THEN RAISE EXCEPTION 'dedicated_qa_authority_unavailable';END IF;
 SELECT s.id INTO sid FROM auth.sessions s WHERE s.user_id=account AND(s.not_after IS NULL OR s.not_after>clock_timestamp())ORDER BY s.created_at DESC NULLS LAST LIMIT 1;IF sid IS NULL THEN RAISE EXCEPTION 'dedicated_qa_current_session_unavailable';END IF;
 IF to_regprocedure('public.booking_operator_list(uuid,timestamptz,timestamptz)')IS NULL THEN RAISE EXCEPTION 'venue_current_authority_schema_unavailable';END IF;
 INSERT INTO auth.sessions(id,user_id,created_at,updated_at,not_after)VALUES(ephemeral_session,account,clock_timestamp(),clock_timestamp(),clock_timestamp()-interval'1 minute');
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',account,'role','authenticated','session_id',sid)::text,true);PERFORM set_config('request.jwt.claim.sub',account::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
 receipt:=public.booking_operator_list(ws,clock_timestamp(),clock_timestamp()+interval'1 day');PERFORM pg_temp.qa_venue_assert(receipt->>'ok'='true'AND receipt->>'role'='owner','actual_owner_private_reader');
 item:=public.booking_item_save(ws,'service',NULL,0,'{"name":"Rollback-only authority service 20261014","active":true,"duration_minutes":60,"buffer_minutes":0,"price_cents":0}');PERFORM pg_temp.qa_venue_assert(item->>'ok'='true'AND item#>>'{item,workspace_id}'=ws::text,'actual_canonical_service_writer_no_public_booking');
 receipt:=public.venue_reference_capabilities(ws);PERFORM pg_temp.qa_venue_assert(receipt->>'ok'='true','actual_venue_reader_current_session');
 EXECUTE format('SET LOCAL ROLE %I',executor);UPDATE zoi.workspace_members SET role='viewer'WHERE workspace_id=ws AND profile_id=actor;EXECUTE 'SET LOCAL ROLE authenticated';
 denied:=false;BEGIN PERFORM public.booking_operator_list(ws,clock_timestamp(),clock_timestamp()+interval'1 day');EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;PERFORM pg_temp.qa_venue_assert(denied,'viewer_private_customer_data_refused');
 denied:=false;BEGIN PERFORM public.booking_item_save(ws,'service',NULL,0,'{"name":"Must not create service","active":true,"duration_minutes":60,"buffer_minutes":0,"price_cents":0}');EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;PERFORM pg_temp.qa_venue_assert(denied,'viewer_management_refused');
 receipt:=public.venue_reference_capabilities(ws);PERFORM pg_temp.qa_venue_assert(receipt->>'ok'='true','viewer_venue_reference_policy_preserved');
 EXECUTE format('SET LOCAL ROLE %I',executor);DELETE FROM zoi.workspace_members WHERE workspace_id=ws AND profile_id=actor;EXECUTE 'SET LOCAL ROLE authenticated';
 receipt:=public.booking_operator_list(ws,clock_timestamp(),clock_timestamp()+interval'1 day');PERFORM pg_temp.qa_venue_assert(receipt->>'role'='owner','actual_owner_fallback_role');
 EXECUTE format('SET LOCAL ROLE %I',executor);INSERT INTO zoi.workspace_members(workspace_id,profile_id,role)VALUES(ws,actor,'owner');PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',account,'role','authenticated','session_id',ephemeral_session)::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
 denied:=false;BEGIN PERFORM public.booking_operator_list(ws,clock_timestamp(),clock_timestamp()+interval'1 day');EXCEPTION WHEN insufficient_privilege THEN denied:=SQLERRM='suite_session_unavailable';END;PERFORM pg_temp.qa_venue_assert(denied,'expired_session_private_customer_data_refused');
 denied:=false;BEGIN PERFORM public.venue_reference_capabilities(ws);EXCEPTION WHEN insufficient_privilege THEN denied:=SQLERRM='suite_session_unavailable';END;PERFORM pg_temp.qa_venue_assert(denied,'expired_session_venue_reference_refused');
 EXECUTE format('SET LOCAL ROLE %I',executor);
 PERFORM pg_temp.qa_venue_assert(NOT EXISTS(SELECT 1 FROM zoi.booking_slots WHERE service_id=(item#>>'{item,id}')::uuid)AND NOT EXISTS(SELECT 1 FROM zoi.bookings WHERE workspace_id=ws AND customer_name='Rollback-only authority service 20261014'),'no_slot_stock_or_customer_booking_created');
END $qa$;
SELECT label,passed FROM qa_venue_results ORDER BY label;
ROLLBACK;
SELECT jsonb_build_object('rollback_completed',true,'fixture_service_absent',NOT EXISTS(SELECT 1 FROM zoi.booking_services WHERE name='Rollback-only authority service 20261014'),'fixture_session_absent',NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id='c1eb6d31-5454-4c5c-b52b-cd2610140004'),'provider_or_publication_acceptance',false);

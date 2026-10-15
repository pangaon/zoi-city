-- ROOT ONLY: actual canonical customer booking + planner authority, BEGIN/ROLLBACK.
-- Uses the existing dedicated QA account and its real current session. Creates no
-- auth users, replaces no helpers, weakens no grants and calls no provider/publisher.
-- All venue/profile/booking/session rows below are fresh, uncommitted fixtures.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='45s';
SET LOCAL idle_in_transaction_session_timeout='60s';
CREATE TEMP TABLE qa_planner_session_results(label text PRIMARY KEY,passed boolean) ON COMMIT DROP;
GRANT INSERT,SELECT ON qa_planner_session_results TO authenticated;
CREATE FUNCTION pg_temp.qa_planner_session_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'qa_planner_session_assertion_failed:%',label;END IF;
INSERT INTO pg_temp.qa_planner_session_results VALUES(label,true);END$$;
DO $qa$
DECLARE executor name:=current_user;
 qa_ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';
 actor constant uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';
 account constant uuid:='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';
 fixture_owner constant uuid:='d5c0b002-1015-4a00-8a00-000000000001';
 ws constant uuid:='d5c0b002-1015-4a00-8a00-000000000002';
 listing constant uuid:='d5c0b002-1015-4a00-8a00-000000000003';
 service constant uuid:='d5c0b002-1015-4a00-8a00-000000000004';
 resource constant uuid:='d5c0b002-1015-4a00-8a00-000000000005';
 expired_sid constant uuid:='d5c0b002-1015-4a00-8a00-000000000006';
 first_slot constant uuid:='d5c0b002-1015-4a00-8a00-000000000010';
 next_slot constant uuid:='d5c0b002-1015-4a00-8a00-000000000011';
 spare_slot constant uuid:='d5c0b002-1015-4a00-8a00-000000000012';
 other_slot constant uuid:='d5c0b002-1015-4a00-8a00-000000000013';
 create_nonce constant uuid:='d5c0b002-1015-4a00-8a00-000000000020';
 move_nonce constant uuid:='d5c0b002-1015-4a00-8a00-000000000021';
 other_nonce constant uuid:='d5c0b002-1015-4a00-8a00-000000000022';
 other_booking constant uuid:='d5c0b002-1015-4a00-8a00-000000000030';
 plan_id uuid;plan_data jsonb;plan_receipt jsonb;plan_saved jsonb;plan_confirmed jsonb;provider_booking uuid;planner_refusals integer:=0;sid uuid;category bigint;receipt jsonb;replay jsonb;moved jsonb;booking uuid;denied boolean;call text;expired_refusals integer:=0;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.workspaces w JOIN zoi.workspace_members m ON m.workspace_id=w.id JOIN zoi.user_profiles p ON p.id=m.profile_id JOIN auth.users u ON u.id=p.auth_user_id WHERE w.id=qa_ws AND w.name='Zoi isolated QA 2026-09-30' AND w.owner_profile_id=actor AND m.profile_id=actor AND m.role='owner' AND p.auth_user_id=account AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND NOT coalesce(u.is_anonymous,false)AND(u.banned_until IS NULL OR u.banned_until<=clock_timestamp()))THEN RAISE EXCEPTION 'dedicated_qa_authority_unavailable';END IF;
 SELECT s.id INTO sid FROM auth.sessions s WHERE s.user_id=account AND(s.not_after IS NULL OR s.not_after>clock_timestamp())ORDER BY s.created_at DESC NULLS LAST LIMIT 1;
 IF sid IS NULL THEN RAISE EXCEPTION 'dedicated_qa_current_session_unavailable';END IF;
 IF to_regprocedure('zoi.booking_customer_authority(uuid,boolean)')IS NULL THEN RAISE EXCEPTION 'planner_session_current_authority_schema_unavailable';END IF;
 IF EXISTS(SELECT 1 FROM zoi.event_plans WHERE data->>'title'='Rollback-only coordinated event') OR EXISTS(SELECT 1 FROM zoi.event_plan_requests WHERE request_id IN('d5c0b002-1015-4a00-8a00-000000000050','d5c0b002-1015-4a00-8a00-000000000051','d5c0b002-1015-4a00-8a00-000000000053')) OR EXISTS(SELECT 1 FROM zoi.user_profiles WHERE id=fixture_owner)OR EXISTS(SELECT 1 FROM zoi.workspaces WHERE id=ws)OR EXISTS(SELECT 1 FROM zoi.listings WHERE id=listing OR slug='qa-planner-session-rollback-20261015')OR EXISTS(SELECT 1 FROM auth.sessions WHERE id=expired_sid)OR EXISTS(SELECT 1 FROM zoi.booking_services WHERE id=service)OR EXISTS(SELECT 1 FROM zoi.booking_resources WHERE id=resource)OR EXISTS(SELECT 1 FROM zoi.booking_slots WHERE id IN(first_slot,next_slot,spare_slot,other_slot))OR EXISTS(SELECT 1 FROM zoi.bookings WHERE request_id IN(create_nonce,other_nonce))OR EXISTS(SELECT 1 FROM zoi.booking_reschedules WHERE request_id=move_nonce)THEN RAISE EXCEPTION 'planner_session_fixture_collision';END IF;
 SELECT id INTO category FROM zoi.categories WHERE slug='restaurants'LIMIT 1;IF category IS NULL THEN RAISE EXCEPTION 'qa_category_unavailable';END IF;
 -- A new unbound profile owns only the synthetic venue. The real QA account
 -- remains a normal nonmember customer of this workspace, with no role changes
 -- to its existing QA workspace and no new authentication identity.
 INSERT INTO zoi.user_profiles(id,display_name,auth_user_id)VALUES(fixture_owner,'Rollback-only venue owner 20261015',NULL);
 INSERT INTO zoi.workspaces(id,name,kind,owner_profile_id,created_by_auth)VALUES(ws,'Rollback-only customer booking venue 20261015','business',fixture_owner,account);
 INSERT INTO zoi.listings(id,owner_workspace_id,entity_type,name,slug,primary_category_id,publish_status,moderation_status,marketplace_status,profile,city,country,address)VALUES(listing,ws,'business','Rollback-only customer booking page','qa-planner-session-rollback-20261015',category,'draft','clean','active','{}','Athens','Greece','1 Rollback Fixture Street');
 PERFORM pg_temp.qa_planner_session_assert((SELECT publish_status='draft'FROM zoi.listings WHERE id=listing),'explicit_draft_preserved');
 UPDATE zoi.listings SET publish_status='published'WHERE id=listing;
 PERFORM pg_temp.qa_planner_session_assert((SELECT publish_status='published'AND owner_workspace_id=ws AND moderation_status='clean'FROM zoi.listings WHERE id=listing),'actual_publish_gate_accepts_complete_owned_fixture');
 INSERT INTO zoi.booking_settings(workspace_id,listing_id,timezone,currency,enabled)VALUES(ws,listing,'UTC','EUR',true);
 INSERT INTO zoi.booking_services(id,workspace_id,name,duration_minutes,buffer_minutes,price_cents,active)VALUES(service,ws,'Rollback-only customer service 20261015',60,0,1000,true);
 INSERT INTO zoi.booking_resources(id,workspace_id,name,kind,capacity,active)VALUES(resource,ws,'Rollback-only customer table 20261015','table',4,true);
 INSERT INTO zoi.booking_slots(id,workspace_id,service_id,resource_id,starts_at,ends_at,blocked_until,service_name,resource_name,capacity,price_cents,currency)
 SELECT id,ws,service,resource,clock_timestamp()+make_interval(days=>n),clock_timestamp()+make_interval(days=>n,hours=>1),clock_timestamp()+make_interval(days=>n,hours=>1),'Rollback-only customer service 20261015','Rollback-only customer table 20261015',4,1000,'EUR'FROM(VALUES(first_slot,2),(next_slot,3),(spare_slot,4),(other_slot,5))v(id,n);
 INSERT INTO zoi.bookings(id,workspace_id,slot_id,profile_id,request_id,customer_name,customer_email,party_size)VALUES(other_booking,ws,other_slot,fixture_owner,other_nonce,'Rollback-only other customer','other-customer@example.test',1);
 INSERT INTO auth.sessions(id,user_id,created_at,updated_at,not_after)VALUES(expired_sid,account,clock_timestamp(),clock_timestamp(),clock_timestamp()-interval'1 minute');
 PERFORM pg_temp.qa_planner_session_assert(NOT EXISTS(SELECT 1 FROM zoi.workspace_members WHERE workspace_id=ws AND profile_id=actor)AND(SELECT owner_profile_id<>actor FROM zoi.workspaces WHERE id=ws),'actual_customer_is_not_venue_member_or_owner');
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',account,'role','authenticated','session_id',sid)::text,true);PERFORM set_config('request.jwt.claim.sub',account::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
 receipt:=public.booking_create(first_slot,create_nonce,'Rollback-only QA customer','customer@example.test',2,1);booking:=(receipt#>>'{booking,id}')::uuid;
 PERFORM pg_temp.qa_planner_session_assert(receipt->>'ok'='true'AND receipt#>>'{booking,profile_id}'=actor::text AND receipt#>>'{booking,workspace_id}'=ws::text AND receipt#>>'{booking,status}'='confirmed','ordinary_nonmember_customer_creates_actual_canonical_booking');
 replay:=public.booking_create(first_slot,create_nonce,'Rollback-only QA customer','customer@example.test',2,1);
 PERFORM pg_temp.qa_planner_session_assert(replay#>>'{booking,id}'=booking::text AND replay#>>'{booking,version}'='1','lost_create_reply_same_nonce_returns_original_booking');
 receipt:=public.booking_my_list(listing);PERFORM pg_temp.qa_planner_session_assert(jsonb_array_length(receipt->'bookings')=1 AND receipt#>>'{bookings,0,id}'=booking::text,'nonmember_private_list_contains_only_own_booking');
 receipt:=public.booking_reschedule_options(booking,clock_timestamp(),clock_timestamp()+interval'10 days');PERFORM pg_temp.qa_planner_session_assert(jsonb_array_length(receipt->'slots')>=2,'nonmember_can_read_current_reschedule_options');
 receipt:=public.booking_reschedule_history(booking);PERFORM pg_temp.qa_planner_session_assert(receipt->>'ok'='true'AND jsonb_array_length(receipt->'changes')=0,'nonmember_can_read_own_empty_history');
 denied:=false;BEGIN PERFORM public.booking_status_set(booking,1,'completed');EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='booking_status_not_allowed';END;PERFORM pg_temp.qa_planner_session_assert(denied,'ordinary_customer_has_no_operator_completion_power');
 denied:=false;BEGIN PERFORM public.booking_reschedule_history(other_booking);EXCEPTION WHEN insufficient_privilege THEN denied:=SQLERRM='booking_not_owned';END;PERFORM pg_temp.qa_planner_session_assert(denied,'other_customer_private_history_refused');
 denied:=false;BEGIN PERFORM public.booking_status_set(other_booking,1,'cancelled');EXCEPTION WHEN insufficient_privilege THEN denied:=SQLERRM='booking_not_owned';END;PERFORM pg_temp.qa_planner_session_assert(denied,'other_customer_cancellation_refused');
 EXECUTE format('SET LOCAL ROLE %I',executor);INSERT INTO zoi.workspace_members(workspace_id,profile_id,role)VALUES(ws,actor,'owner');EXECUTE 'SET LOCAL ROLE authenticated';
 denied:=false;BEGIN PERFORM public.booking_reschedule_history(other_booking);EXCEPTION WHEN insufficient_privilege THEN denied:=SQLERRM='booking_not_owned';END;PERFORM pg_temp.qa_planner_session_assert(denied,'forged_owner_label_cannot_read_other_customer_history');
 denied:=false;BEGIN PERFORM public.booking_status_set(booking,1,'completed');EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='booking_status_not_allowed';END;PERFORM pg_temp.qa_planner_session_assert(denied,'forged_owner_label_has_no_operator_power');
 EXECUTE format('SET LOCAL ROLE %I',executor);DELETE FROM zoi.workspace_members WHERE workspace_id=ws AND profile_id=actor;EXECUTE 'SET LOCAL ROLE authenticated';
 moved:=public.booking_reschedule(booking,1,next_slot,1,move_nonce,1000,'EUR');replay:=public.booking_reschedule(booking,1,next_slot,1,move_nonce,1000,'EUR');
 PERFORM pg_temp.qa_planner_session_assert(moved#>>'{booking,version}'='2'AND moved#>>'{booking,slot_id}'=next_slot::text AND replay->>'reschedule_id'=moved->>'reschedule_id','lost_move_reply_same_nonce_returns_one_canonical_reschedule');
 -- Existing real session stays unchanged. Only the separate uncommitted expired
 -- session is used to prove all six APIs refuse even successful prior receipts.
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',account,'role','authenticated','session_id',expired_sid)::text,true);
 FOREACH call IN ARRAY ARRAY[
  format('SELECT public.booking_create(%L,%L,%L,%L,2,1)',first_slot,create_nonce,'Rollback-only QA customer','customer@example.test'),
  format('SELECT public.booking_my_list(%L)',listing),
  format('SELECT public.booking_status_set(%L,2,%L)',booking,'cancelled'),
  format('SELECT public.booking_reschedule(%L,1,%L,1,%L,1000,%L)',booking,next_slot,move_nonce,'EUR'),
  format('SELECT public.booking_reschedule_options(%L,clock_timestamp(),clock_timestamp()+interval %L)',booking,'10 days'),
  format('SELECT public.booking_reschedule_history(%L)',booking)
 ]LOOP
  denied:=false;BEGIN EXECUTE call;EXCEPTION WHEN insufficient_privilege THEN denied:=SQLERRM='suite_session_unavailable';END;
  IF NOT denied THEN RAISE EXCEPTION 'expired_planner_session_call_not_refused';END IF;expired_refusals:=expired_refusals+1;
 END LOOP;
 PERFORM pg_temp.qa_planner_session_assert(expired_refusals=6,'all_six_expired_session_apis_including_successful_replays_refused');
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',account,'role','authenticated','session_id',sid)::text,true);
 receipt:=public.booking_status_set(booking,2,'cancelled');replay:=public.booking_status_set(booking,2,'cancelled');
 PERFORM pg_temp.qa_planner_session_assert(receipt#>>'{booking,status}'='cancelled'AND receipt#>>'{booking,version}'='3'AND replay#>>'{booking,version}'='3','current_customer_cancellation_and_lost_reply_recovery_preserved');
 denied:=false;BEGIN PERFORM zoi.booking_customer_authority(NULL,false);EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;PERFORM pg_temp.qa_planner_session_assert(denied,'new_authority_helper_not_callable_by_browser');
 -- Actual remaining planner journey, still the ordinary nonmember customer.
 PERFORM pg_temp.qa_planner_session_assert((public.event_plan_capabilities()->>'version')='1','current_customer_planner_capability');
 plan_data:=jsonb_build_object('title','Rollback-only coordinated event','kind','other','timezone','UTC','customer_name','Rollback-only QA customer','customer_email','customer@example.test','private_notes','PRIVATE rollback-only notes','selections','[]'::jsonb);
 plan_saved:=public.event_plan_save(NULL,0,'d5c0b002-1015-4a00-8a00-000000000050',plan_data);plan_id:=(plan_saved#>>'{plan,id}')::uuid;
 replay:=public.event_plan_save(NULL,0,'d5c0b002-1015-4a00-8a00-000000000050',plan_data);
 PERFORM pg_temp.qa_planner_session_assert(plan_saved->>'ok'='true'AND replay#>>'{plan,id}'=plan_id::text AND replay#>>'{plan,version}'='1','lost_private_plan_save_response_replays_original_plan');
 receipt:=public.event_plan_get(plan_id);PERFORM pg_temp.qa_planner_session_assert(receipt#>>'{plan,id}'=plan_id::text AND receipt#>>'{plan,data,private_notes}'='PRIVATE rollback-only notes','current_customer_reopens_private_draft');
 receipt:=public.event_plan_list(0);PERFORM pg_temp.qa_planner_session_assert(EXISTS(SELECT 1 FROM jsonb_array_elements(receipt->'plans')p WHERE p->>'id'=plan_id::text),'private_plan_list_contains_new_current_customer_plan');
 plan_data:=jsonb_set(plan_data,'{selections}',(SELECT jsonb_agg(jsonb_build_object('slot_id',v.slot,'listing_id',listing,'workspace_id',ws,'slot_version',1,'settings_version',1,'party_size',2,'price_cents',1000,'currency','EUR','resource_kind','table','role',v.label,'shared_context','Explicit rollback-only provider context')ORDER BY v.slot)FROM(VALUES(first_slot,'First event table'),(spare_slot,'Second event table'))v(slot,label)));
 plan_receipt:=public.event_plan_save(plan_id,1,'d5c0b002-1015-4a00-8a00-000000000051',plan_data);
 PERFORM pg_temp.qa_planner_session_assert(plan_receipt#>>'{plan,version}'='2','canonical_private_plan_edit_CAS_preserved');
 denied:=false;BEGIN PERFORM public.event_plan_save(plan_id,1,'d5c0b002-1015-4a00-8a00-000000000052',plan_data);EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='version_conflict';END;PERFORM pg_temp.qa_planner_session_assert(denied,'stale_plan_edit_refused');
 replay:=public.event_plan_save(NULL,0,'d5c0b002-1015-4a00-8a00-000000000050',plan_saved#>'{plan,data}');
 PERFORM pg_temp.qa_planner_session_assert(replay#>>'{plan,version}'='1','old_plan_save_receipt_is_immutable_after_new_edit');
 plan_confirmed:=public.event_plan_confirm(plan_id,2,'d5c0b002-1015-4a00-8a00-000000000053');
 replay:=public.event_plan_confirm(plan_id,2,'d5c0b002-1015-4a00-8a00-000000000053');
 PERFORM pg_temp.qa_planner_session_assert(plan_confirmed->>'ok'='true'AND plan_confirmed->>'version'='3'AND jsonb_array_length(plan_confirmed->'bookings')=2 AND replay=plan_confirmed,'lost_multislot_confirmation_response_replays_exact_two_bookings');
 provider_booking:=(plan_confirmed#>>'{bookings,0,booking,id}')::uuid;
 denied:=false;BEGIN PERFORM public.event_plan_provider_context(provider_booking);EXCEPTION WHEN insufficient_privilege THEN denied:=SQLERRM='workspace_permission_denied';END;PERFORM pg_temp.qa_planner_session_assert(denied,'ordinary_customer_cannot_read_provider_private_operator_context');
 -- Mutate only the new uncommitted synthetic workspace owner to exercise the
 -- foundation actual-owner fallback. No real QA workspace/member row changes.
 EXECUTE format('SET LOCAL ROLE %I',executor);UPDATE zoi.workspaces SET owner_profile_id=actor WHERE id=ws;EXECUTE 'SET LOCAL ROLE authenticated';
 receipt:=public.event_plan_provider_context(provider_booking);
 PERFORM pg_temp.qa_planner_session_assert(receipt#>>'{context,shared_context}'='Explicit rollback-only provider context'AND position('PRIVATE rollback-only notes'in receipt::text)=0,'actual_current_provider_owner_reads_only_explicit_shared_context');
 EXECUTE format('SET LOCAL ROLE %I',executor);UPDATE zoi.workspaces SET owner_profile_id=fixture_owner WHERE id=ws;EXECUTE 'SET LOCAL ROLE authenticated';
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',account,'role','authenticated','session_id',expired_sid)::text,true);
 FOREACH call IN ARRAY ARRAY[
  'SELECT public.event_plan_capabilities()',format('SELECT public.event_plan_get(%L)',plan_id),'SELECT public.event_plan_list(0)',format('SELECT public.event_plan_provider_context(%L)',provider_booking),
  format('SELECT public.event_plan_save(NULL,0,%L,%L::jsonb)','d5c0b002-1015-4a00-8a00-000000000050',plan_saved#>'{plan,data}'),
  format('SELECT public.event_plan_confirm(%L,2,%L)',plan_id,'d5c0b002-1015-4a00-8a00-000000000053')
 ]LOOP denied:=false;BEGIN EXECUTE call;EXCEPTION WHEN insufficient_privilege THEN denied:=SQLERRM='suite_session_unavailable';END;IF NOT denied THEN RAISE EXCEPTION 'expired_planner_call_not_refused';END IF;planner_refusals:=planner_refusals+1;END LOOP;
 PERFORM pg_temp.qa_planner_session_assert(planner_refusals=6,'all_six_planner_private_calls_and_successful_save_confirm_replays_refuse_expired_session');
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',account,'role','authenticated','session_id',sid)::text,true);
 EXECUTE format('SET LOCAL ROLE %I',executor);
 PERFORM pg_temp.qa_planner_session_assert((SELECT count(*)=1 FROM zoi.event_plans WHERE id=plan_id AND profile_id=actor)AND(SELECT count(*)=3 FROM zoi.event_plan_requests WHERE profile_id=actor AND request_id IN('d5c0b002-1015-4a00-8a00-000000000050','d5c0b002-1015-4a00-8a00-000000000051','d5c0b002-1015-4a00-8a00-000000000053'))AND(SELECT count(*)=2 FROM zoi.event_plan_bookings p WHERE p.plan_id=(plan_saved#>>'{plan,id}')::uuid),'one_plan_three_immutable_requests_two_bookings_only');
 PERFORM pg_temp.qa_planner_session_assert((SELECT count(*)=1 FROM zoi.bookings WHERE profile_id=actor AND request_id=create_nonce)AND(SELECT count(*)=1 FROM zoi.booking_reschedules WHERE actor_profile_id=actor AND request_id=move_nonce),'one_actual_create_and_move_receipt_only');
 PERFORM pg_temp.qa_planner_session_assert((SELECT not_after IS NULL OR not_after>clock_timestamp()FROM auth.sessions WHERE id=sid AND user_id=account)AND NOT EXISTS(SELECT 1 FROM zoi.workspace_members WHERE workspace_id=ws AND profile_id=actor),'original_current_session_and_nonmember_authority_retained');
END $qa$;
SELECT label,passed FROM qa_planner_session_results ORDER BY label;
ROLLBACK;
SELECT jsonb_build_object(
 'rollback_completed',true,
 'fixture_profile_absent',NOT EXISTS(SELECT 1 FROM zoi.user_profiles WHERE id='d5c0b002-1015-4a00-8a00-000000000001'),
 'fixture_workspace_absent',NOT EXISTS(SELECT 1 FROM zoi.workspaces WHERE id='d5c0b002-1015-4a00-8a00-000000000002'),
 'fixture_listing_absent',NOT EXISTS(SELECT 1 FROM zoi.listings WHERE id='d5c0b002-1015-4a00-8a00-000000000003'),
 'fixture_settings_absent',NOT EXISTS(SELECT 1 FROM zoi.booking_settings WHERE workspace_id='d5c0b002-1015-4a00-8a00-000000000002'),
 'fixture_services_absent',NOT EXISTS(SELECT 1 FROM zoi.booking_services WHERE id='d5c0b002-1015-4a00-8a00-000000000004'),
 'fixture_resources_absent',NOT EXISTS(SELECT 1 FROM zoi.booking_resources WHERE id='d5c0b002-1015-4a00-8a00-000000000005'),
 'fixture_slots_absent',NOT EXISTS(SELECT 1 FROM zoi.booking_slots WHERE workspace_id='d5c0b002-1015-4a00-8a00-000000000002'),
 'fixture_bookings_absent',NOT EXISTS(SELECT 1 FROM zoi.bookings WHERE workspace_id='d5c0b002-1015-4a00-8a00-000000000002'),
 'fixture_reschedules_absent',NOT EXISTS(SELECT 1 FROM zoi.booking_reschedules WHERE workspace_id='d5c0b002-1015-4a00-8a00-000000000002'),
 'fixture_audit_absent',NOT EXISTS(SELECT 1 FROM zoi.booking_audit WHERE workspace_id='d5c0b002-1015-4a00-8a00-000000000002'),
 'fixture_plans_absent',NOT EXISTS(SELECT 1 FROM zoi.event_plans WHERE data->>'title'='Rollback-only coordinated event'),
 'fixture_plan_requests_absent',NOT EXISTS(SELECT 1 FROM zoi.event_plan_requests WHERE request_id IN('d5c0b002-1015-4a00-8a00-000000000050','d5c0b002-1015-4a00-8a00-000000000051','d5c0b002-1015-4a00-8a00-000000000053')),
 'fixture_plan_links_absent',NOT EXISTS(SELECT 1 FROM zoi.event_plan_bookings WHERE shared_context='Explicit rollback-only provider context'),
 'fixture_session_absent',NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id='d5c0b002-1015-4a00-8a00-000000000006'),
 'provider_or_publication_acceptance',false);

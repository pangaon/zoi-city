BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='20s';
-- Use the single configured founder and a real current auth.sessions row.
-- Never replace authentication helpers or return personal data/token values.
DO $qa$
DECLARE actor uuid;sid uuid;claims jsonb;result jsonb;report_id uuid:=gen_random_uuid();ack_id uuid:=gen_random_uuid();context jsonb:='{"feature_id":"qa-founder-probe","group":"owners","profile_url":null,"release":null}'::jsonb;checks integer:=0;before_reports bigint;before_actions bigint;
BEGIN
 IF(SELECT count(*)FROM zoi.delivery_founders WHERE enabled)<>1 THEN RAISE EXCEPTION'qa_expected_single_founder';END IF;
 SELECT f.user_id,s.id INTO actor,sid FROM zoi.delivery_founders f JOIN auth.users u ON u.id=f.user_id JOIN auth.sessions s ON s.user_id=u.id WHERE f.enabled AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND NOT coalesce(u.is_anonymous,false)AND(u.banned_until IS NULL OR u.banned_until<=now())AND(s.not_after IS NULL OR s.not_after>now())ORDER BY s.created_at DESC LIMIT 1;
 IF actor IS NULL OR sid IS NULL THEN RAISE EXCEPTION'qa_current_founder_session_unavailable';END IF;
 claims:=jsonb_build_object('sub',actor,'session_id',sid,'role','authenticated');
 SELECT count(*)INTO before_reports FROM zoi.delivery_reports;SELECT count(*)INTO before_actions FROM zoi.delivery_action_checks;
 PERFORM public.zoi_delivery_progress(gen_random_uuid(),'queue_sync','{"scope":{"version":"rollback-only probe"},"groups":[{"id":"owners","label":"Owner workspaces","status":"being tested","outcomes":[]}]}'::jsonb);
 PERFORM public.zoi_delivery_progress(gen_random_uuid(),'owner_actions_sync','{"actions":[{"id":"qa-readiness","title":"Rollback-only configuration probe","status":"needs your action"}]}'::jsonb);
 PERFORM set_config('request.jwt.claims',claims::text,true);EXECUTE'SET LOCAL ROLE authenticated';
 result:=public.zoi_delivery_dashboard();IF result->>'schema_version'<>'1'THEN RAISE EXCEPTION'qa_dashboard_shape';END IF;checks:=checks+1;
 result:=public.zoi_delivery_records('addresses_corrected',32,0,NULL);IF jsonb_typeof(result->'rows')<>'array'OR jsonb_array_length(result->'rows')>32 THEN RAISE EXCEPTION'qa_record_reader_shape';END IF;checks:=checks+1;
 result:=public.zoi_delivery_report(report_id,context,'Rollback-only founder report; no real customer operation.');IF result->'ok'<>'true'::jsonb THEN RAISE EXCEPTION'qa_report_not_confirmed';END IF;checks:=checks+1;
 result:=public.zoi_delivery_report(report_id,context,'Rollback-only founder report; no real customer operation.');IF result->'replayed'<>'true'::jsonb THEN RAISE EXCEPTION'qa_report_not_replayed';END IF;checks:=checks+1;
 BEGIN PERFORM public.zoi_delivery_report(report_id,context,'Different text must not reinterpret the receipt');RAISE EXCEPTION'qa_report_conflict_not_refused';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'delivery_report_payload_conflict'THEN RAISE;END IF;checks:=checks+1;END;
 result:=public.zoi_delivery_dashboard();IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(result->'reported_problems')r WHERE r->>'id'=report_id::text)THEN RAISE EXCEPTION'qa_report_not_persisted';END IF;checks:=checks+1;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(result->'groups')g CROSS JOIN LATERAL jsonb_array_elements(g->'outcomes')o WHERE g->>'id'='owners'AND o->>'id'='problem:'||report_id::text)THEN RAISE EXCEPTION'qa_report_not_in_authoritative_queue';END IF;checks:=checks+1;
 result:=public.zoi_delivery_action_ack(ack_id,'qa-readiness');IF result->>'status'<>'check_required'THEN RAISE EXCEPTION'qa_ack_falsely_ready';END IF;checks:=checks+1;
 result:=public.zoi_delivery_action_ack(ack_id,'qa-readiness');IF result->'replayed'<>'true'::jsonb THEN RAISE EXCEPTION'qa_ack_not_replayed';END IF;checks:=checks+1;
 result:=public.zoi_delivery_check_context(ack_id);IF result->>'request_id'<>ack_id::text OR result->>'action_id'<>'qa-readiness'THEN RAISE EXCEPTION'qa_context_not_bound';END IF;checks:=checks+1;
 BEGIN PERFORM public.zoi_delivery_check_context(gen_random_uuid());RAISE EXCEPTION'qa_unknown_context_not_denied';EXCEPTION WHEN insufficient_privilege THEN checks:=checks+1;END;
 EXECUTE'RESET ROLE';
 IF(SELECT count(*)FROM zoi.delivery_reports)<>before_reports+1 OR(SELECT count(*)FROM zoi.delivery_action_checks)<>before_actions+1 THEN RAISE EXCEPTION'qa_duplicate_mutation';END IF;checks:=checks+1;
 BEGIN EXECUTE'SET LOCAL ROLE anon';PERFORM public.zoi_delivery_dashboard();RAISE EXCEPTION'qa_anonymous_not_denied';EXCEPTION WHEN insufficient_privilege THEN checks:=checks+1;END;EXECUTE'RESET ROLE';
 PERFORM set_config('request.jwt.claims','{}',true);BEGIN EXECUTE'SET LOCAL ROLE authenticated';PERFORM public.zoi_delivery_dashboard();RAISE EXCEPTION'qa_missing_actor_not_denied';EXCEPTION WHEN insufficient_privilege THEN checks:=checks+1;END;EXECUTE'RESET ROLE';
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'session_id',gen_random_uuid(),'role','authenticated')::text,true);BEGIN EXECUTE'SET LOCAL ROLE authenticated';PERFORM public.zoi_delivery_dashboard();RAISE EXCEPTION'qa_unbound_session_not_denied';EXCEPTION WHEN insufficient_privilege THEN checks:=checks+1;END;EXECUTE'RESET ROLE';
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'session_id',sid,'role','authenticated')::text,true);BEGIN EXECUTE'SET LOCAL ROLE authenticated';PERFORM public.zoi_delivery_dashboard();RAISE EXCEPTION'qa_nonfounder_not_denied';EXCEPTION WHEN insufficient_privilege THEN checks:=checks+1;END;EXECUTE'RESET ROLE';
 PERFORM set_config('request.jwt.claims',claims::text,true);BEGIN EXECUTE'SET LOCAL ROLE authenticated';PERFORM 1 FROM zoi.delivery_founders;RAISE EXCEPTION'qa_private_registry_not_denied';EXCEPTION WHEN insufficient_privilege THEN checks:=checks+1;END;EXECUTE'RESET ROLE';
 BEGIN EXECUTE'SET LOCAL ROLE authenticated';PERFORM public.zoi_delivery_progress(gen_random_uuid(),'activity','{}');RAISE EXCEPTION'qa_founder_progress_writer_not_denied';EXCEPTION WHEN insufficient_privilege THEN checks:=checks+1;END;EXECUTE'RESET ROLE';
 BEGIN EXECUTE'SET LOCAL ROLE authenticated';PERFORM 1 FROM zoi.delivery_reports;RAISE EXCEPTION'qa_private_reports_not_denied';EXCEPTION WHEN insufficient_privilege THEN checks:=checks+1;END;EXECUTE'RESET ROLE';
 PERFORM public.zoi_delivery_progress(gen_random_uuid(),'action_observed',jsonb_build_object('check_request',ack_id,'state','authorized','observation',jsonb_build_object('provider_operation_verified',false)));
 EXECUTE'SET LOCAL ROLE authenticated';result:=public.zoi_delivery_dashboard();IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(result->'actions')a WHERE a->>'id'='qa-readiness'AND a->>'status'='authorized')THEN RAISE EXCEPTION'qa_observation_not_visible';END IF;checks:=checks+1;EXECUTE'RESET ROLE';
 IF checks<>20 THEN RAISE EXCEPTION'qa_check_count';END IF;
 PERFORM set_config('zoi.qa.founder_delivery_result',jsonb_build_object('checks',checks,'actual_founder_session_boundary',true,'private_data_denied',true,'report_ack_persistence_and_nonce',true,'automatic_operation_verified',false,'rollback_only',true)::text,true);
END $qa$;
SELECT current_setting('zoi.qa.founder_delivery_result')::jsonb AS result;
ROLLBACK;

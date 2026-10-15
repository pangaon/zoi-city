-- Root-only installed-catalog/no-session probe. No fabricated Auth claims,
-- uploads, source/customer data reads, asset/post writes or provider calls.
BEGIN;
SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='20s';
CREATE TEMP TABLE studio_media_probe_before ON COMMIT DROP AS SELECT count(*)AS events FROM zoi.studio_media_events;
DO $catalog$
DECLARE sig text;user_api boolean;service_api boolean;policy text;
BEGIN
 FOREACH sig IN ARRAY ARRAY['zoi.studio_exact_keys(jsonb,text[])','zoi.studio_storage_path(text)','zoi.studio_object(text,boolean)','zoi.studio_render_context(uuid,uuid,uuid,jsonb)','zoi.studio_media_receipt_guard()','zoi.studio_media_insert_allowed(text,text)','zoi.studio_media_delete_allowed(text,text)','public.studio_media_prepare(uuid,uuid,uuid,jsonb,text)','public.studio_media_request(uuid,uuid,uuid,boolean)','public.studio_media_prove(uuid,jsonb,text,text,integer,jsonb)','public.business_creative_render_save(uuid,uuid,uuid,jsonb)','public.studio_media_cleanup_plan(uuid)','public.studio_media_cleanup_finish(uuid)','public.studio_media_cleanup_candidates()']LOOP
  user_api:=sig LIKE 'public.studio_media_prepare(%'OR sig LIKE 'public.studio_media_request(%'OR sig LIKE 'public.business_creative_render_save(%'OR sig LIKE 'zoi.studio_media_insert_allowed(%'OR sig LIKE 'zoi.studio_media_delete_allowed(%';
  service_api:=sig LIKE 'public.studio_media_prove(%'OR sig LIKE 'public.studio_media_cleanup_%';
  IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure(sig)AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=""']::text[])OR has_function_privilege('anon',sig,'execute')OR has_function_privilege('authenticated',sig,'execute')IS DISTINCT FROM user_api OR has_function_privilege('service_role',sig,'execute')IS DISTINCT FROM service_api THEN RAISE EXCEPTION 'studio_media_probe_contract:%',sig;END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='zoi.studio_media_events'::regclass AND relrowsecurity)OR EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='zoi'AND tablename='studio_media_events')OR EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role'])role WHERE has_table_privilege(role,'zoi.studio_media_events','SELECT,INSERT,UPDATE,DELETE'))THEN RAISE EXCEPTION 'studio_media_probe_private_sidecar';END IF;
 FOREACH policy IN ARRAY ARRAY['studio_media_granted_insert','studio_media_unresolved_delete']LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage'AND tablename='objects'AND policyname=policy AND permissive='RESTRICTIVE'AND roles=ARRAY['authenticated']::name[])THEN RAISE EXCEPTION 'studio_media_probe_storage_policy:%',policy;END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='zoi.business_creative_requests'::regclass AND tgname='studio_media_receipt_context'AND tgtype=7 AND tgenabled='O'AND tgfoid='zoi.studio_media_receipt_guard()'::regprocedure)THEN RAISE EXCEPTION 'studio_media_probe_receipt_trigger';END IF;
END$catalog$;
SET LOCAL request.jwt.claims='{}';SET LOCAL ROLE authenticated;
DO $no_session$
DECLARE refusals integer:=0;
BEGIN
 BEGIN PERFORM public.studio_media_prepare('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','{}','original');EXCEPTION WHEN OTHERS THEN IF SQLSTATE='42501'OR SQLERRM~'not_signed_in|suite_session_unavailable|not_authorized'THEN refusals:=refusals+1;ELSE RAISE;END IF;END;
 BEGIN PERFORM public.studio_media_request('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003',true);EXCEPTION WHEN OTHERS THEN IF SQLSTATE='42501'OR SQLERRM~'not_signed_in|suite_session_unavailable|not_authorized'THEN refusals:=refusals+1;ELSE RAISE;END IF;END;
 BEGIN PERFORM public.business_creative_render_save('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','{}');EXCEPTION WHEN OTHERS THEN IF SQLSTATE='42501'OR SQLERRM~'not_signed_in|suite_session_unavailable|not_authorized'THEN refusals:=refusals+1;ELSE RAISE;END IF;END;
 IF refusals<>3 THEN RAISE EXCEPTION 'studio_media_probe_missing_session_not_refused';END IF;
END$no_session$;
RESET ROLE;
DO $unchanged$BEGIN IF(SELECT events FROM studio_media_probe_before)IS DISTINCT FROM(SELECT count(*)FROM zoi.studio_media_events)THEN RAISE EXCEPTION 'studio_media_probe_mutated_sidecar';END IF;END$unchanged$;
SELECT 'studio_media_catalog_and_no_session_probe_passed'AS result;
ROLLBACK;

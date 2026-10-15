-- Root-only post-migration catalog and no-session probe; no fabricated claims,
-- fixture contacts/listings/posts, provider calls or durable writes. Always rollback.
BEGIN;
SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='20s';
CREATE TEMP TABLE qa_business_creative_before ON COMMIT DROP AS SELECT count(*)AS rows FROM zoi.business_creative_requests;
DO $catalog$
DECLARE sig text;public_api boolean;
BEGIN
 FOREACH sig IN ARRAY ARRAY[
 'zoi.business_creative_project_layer(jsonb,text)',
 'zoi.business_creative_source(jsonb)',
 'zoi.business_creative_receipt_immutable()',
 'zoi.business_creative_receipt(uuid,uuid,uuid)',
 'public.business_creative_draft_save(uuid,uuid,uuid,jsonb)',
 'public.business_creative_draft_recover(uuid,uuid,uuid,boolean)',
 'public.business_creative_draft_get(uuid,uuid)']LOOP
  public_api:=sig LIKE 'public.%';
  IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure(sig)AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=""']::text[] AND prosecdef=(public_api OR sig LIKE 'zoi.business_creative_receipt(%'))THEN RAISE EXCEPTION 'business_creative_probe_catalog:%',sig;END IF;
  IF has_function_privilege('anon',sig,'execute')OR has_function_privilege('service_role',sig,'execute')OR has_function_privilege('authenticated',sig,'execute')IS DISTINCT FROM public_api THEN RAISE EXCEPTION 'business_creative_probe_acl:%',sig;END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='zoi.business_creative_requests'::regclass AND relrowsecurity)OR EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='zoi'AND tablename='business_creative_requests')OR has_table_privilege('anon','zoi.business_creative_requests','select,insert,update,delete')OR has_table_privilege('authenticated','zoi.business_creative_requests','select,insert,update,delete')OR has_table_privilege('service_role','zoi.business_creative_requests','select,insert,update,delete')THEN RAISE EXCEPTION 'business_creative_probe_private_ledger';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='zoi.business_creative_requests'::regclass AND tgname='business_creative_receipt_immutable'AND NOT tgisinternal AND tgenabled='O')THEN RAISE EXCEPTION 'business_creative_probe_immutable_trigger';END IF;
END$catalog$;
SET LOCAL request.jwt.claims='{}';
SET LOCAL ROLE authenticated;
DO $no_session$
DECLARE n integer:=0;
BEGIN
 BEGIN PERFORM public.business_creative_draft_save('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','{}');EXCEPTION WHEN OTHERS THEN IF SQLSTATE='42501'OR SQLERRM~'suite_session_unavailable|not_authorized|not_signed_in|insufficient_permission'THEN n:=n+1;ELSE RAISE;END IF;END;
 BEGIN PERFORM public.business_creative_draft_recover('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003',true);EXCEPTION WHEN OTHERS THEN IF SQLSTATE='42501'OR SQLERRM~'suite_session_unavailable|not_authorized|not_signed_in|insufficient_permission'THEN n:=n+1;ELSE RAISE;END IF;END;
 BEGIN PERFORM public.business_creative_draft_get('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004');EXCEPTION WHEN OTHERS THEN IF SQLSTATE='42501'OR SQLERRM~'suite_session_unavailable|not_authorized|not_signed_in|insufficient_permission'THEN n:=n+1;ELSE RAISE;END IF;END;
 IF n<>3 THEN RAISE EXCEPTION 'business_creative_probe_missing_session_not_refused';END IF;
END$no_session$;
RESET ROLE;
DO $unchanged$BEGIN IF(SELECT rows FROM qa_business_creative_before)IS DISTINCT FROM(SELECT count(*)FROM zoi.business_creative_requests)THEN RAISE EXCEPTION 'business_creative_probe_unexpected_receipt';END IF;END$unchanged$;
SELECT 'business_creative_catalog_and_no_session_probe_passed'AS result;
ROLLBACK;

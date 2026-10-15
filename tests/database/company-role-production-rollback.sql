-- ROOT ONLY, after exact reviewed alignment migration. No provider/storage calls.
-- Uses the existing dedicated QA account; synthetic workspace/roles only. No real membership/session edits.
BEGIN;
SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='30s';SET LOCAL idle_in_transaction_session_timeout='60s';
CREATE TEMP TABLE company_role_results(label text PRIMARY KEY,passed boolean)ON COMMIT DROP;
GRANT INSERT,SELECT ON company_role_results TO authenticated;
CREATE FUNCTION pg_temp.company_role_assert(ok boolean,label text)RETURNS void LANGUAGE plpgsql AS $$BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'company_role_assert_failed:%',label;END IF;INSERT INTO pg_temp.company_role_results VALUES(label,true);END$$;
DO $qa$ DECLARE
 executor name:=current_user;
 known_ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor constant uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';account constant uuid:='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';
 ws constant uuid:='a3c01503-1015-4000-8000-000000000001';other_profile constant uuid:='a3c01503-1015-4000-8000-000000000002';nonce constant uuid:='a3c01503-1015-4000-8000-000000000003';cancel_nonce constant uuid:='a3c01503-1015-4000-8000-000000000004';upload_nonce constant uuid:='a3c01503-1015-4000-8000-000000000005';
 sid uuid;c jsonb;p jsonb;u jsonb;r jsonb;replay jsonb;payload jsonb;denied boolean;role_name text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.workspaces w JOIN zoi.workspace_members m ON m.workspace_id=w.id JOIN zoi.user_profiles up ON up.id=m.profile_id JOIN auth.users au ON au.id=up.auth_user_id WHERE w.id=known_ws AND w.name='Zoi isolated QA 2026-09-30'AND w.owner_profile_id=actor AND m.profile_id=actor AND m.role='owner'AND up.auth_user_id=account AND au.email_confirmed_at IS NOT NULL AND au.deleted_at IS NULL AND NOT coalesce(au.is_anonymous,false)AND(au.banned_until IS NULL OR au.banned_until<=clock_timestamp()))THEN RAISE EXCEPTION 'dedicated_qa_authority_unavailable';END IF;
 SELECT id INTO sid FROM auth.sessions WHERE user_id=account AND(not_after IS NULL OR not_after>clock_timestamp())ORDER BY created_at DESC NULLS LAST LIMIT 1;IF sid IS NULL THEN RAISE EXCEPTION 'dedicated_qa_current_session_unavailable';END IF;
 IF EXISTS(SELECT 1 FROM zoi.workspaces WHERE id=ws)OR EXISTS(SELECT 1 FROM zoi.user_profiles WHERE id=other_profile)OR EXISTS(SELECT 1 FROM zoi.ops_mutation_receipts WHERE request_id IN(nonce,cancel_nonce))OR EXISTS(SELECT 1 FROM zoi.document_versions WHERE request_id=upload_nonce)THEN RAISE EXCEPTION 'company_role_fixture_collision';END IF;
 INSERT INTO zoi.user_profiles(id,display_name)VALUES(other_profile,'Rollback-only synthetic profile');
 INSERT INTO zoi.workspaces(id,name,kind,owner_profile_id,created_by_auth)VALUES(ws,'Rollback-only Company foundation 20261015','business',actor,account);
 PERFORM pg_temp.company_role_assert(NOT EXISTS(SELECT 1 FROM zoi.workspace_members WHERE workspace_id=ws),'actual_owner_without_member_fixture');
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',account,'role','authenticated','session_id',sid)::text,true);PERFORM set_config('request.jwt.claim.sub',account::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
 PERFORM pg_temp.company_role_assert(public.ops_records_list(ws,null,false)->>'role'='owner','owner_fallback_current_read_role');
 c:=public.ops_record_save(ws,'company','{"title":"Rollback Company"}',null,0);PERFORM pg_temp.company_role_assert(c->>'ok'='true','owner_fallback_canonical_company_save');
 p:=public.ops_record_save(ws,'project',jsonb_build_object('title','Rollback project','company_id',c#>>'{record,id}'),null,0);PERFORM pg_temp.company_role_assert(p->>'ok'='true','owner_fallback_canonical_project_save');
 r:=public.ops_records_list(ws,null,false);PERFORM pg_temp.company_role_assert(r->>'role'='owner','company_list_current_owner_role');
 r:=public.documents_list(ws,null);PERFORM pg_temp.company_role_assert(r->>'role'='owner','documents_ui_role_foundation_fallback');
 payload:=jsonb_build_object('p_kind','contact','p_data',jsonb_build_object('title','Rollback receipt','company_id',c#>>'{record,id}'),'p_id',null,'p_expected_version',0);
 r:=public.ops_mutation_execute(ws,nonce,'save',payload);replay:=public.ops_mutation_execute(ws,nonce,'save',payload);PERFORM pg_temp.company_role_assert(r=replay,'lost_response_immutable_receipt_exact_retry');
 denied:=false;BEGIN PERFORM public.ops_mutation_execute(ws,nonce,'save',jsonb_set(payload,'{p_data,title}','"Changed"'));EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='ops_request_conflict';END;PERFORM pg_temp.company_role_assert(denied,'same_nonce_payload_change_refused');
 r:=public.ops_request_status(ws,cancel_nonce,true);PERFORM pg_temp.company_role_assert(r->>'state'='cancelled','missing_request_cancellation_canonical');
 u:=public.document_upload_begin(ws,(p#>>'{record,id}')::uuid,null,0,'Rollback private file',upload_nonce,'proof.pdf','application/pdf',12,repeat('a',64));PERFORM pg_temp.company_role_assert(u->>'ok'='true','owner_fallback_upload_reservation');
 replay:=public.document_upload_begin(ws,(p#>>'{record,id}')::uuid,null,0,'Rollback private file',upload_nonce,'proof.pdf','application/pdf',12,repeat('a',64));PERFORM pg_temp.company_role_assert(replay#>>'{upload,id}'=u#>>'{upload,id}','upload_reservation_nonce_replay');
 r:=public.document_history(ws,(u#>>'{document,id}')::uuid);PERFORM pg_temp.company_role_assert(jsonb_array_length(r->'versions')=1,'private_history_current_owner');
 EXECUTE format('SET LOCAL ROLE %I',executor);
 INSERT INTO zoi.workspace_members(workspace_id,profile_id,role)VALUES(ws,actor,'viewer');EXECUTE 'SET LOCAL ROLE authenticated';
 PERFORM pg_temp.company_role_assert(public.ops_records_list(ws,null,false)->>'role'='viewer','real_owner_explicit_viewer_not_upgraded');
 denied:=false;BEGIN PERFORM public.documents_list(ws,null);EXCEPTION WHEN insufficient_privilege THEN denied:=SQLERRM='company_permission_denied';END;PERFORM pg_temp.company_role_assert(denied,'explicit_viewer_private_documents_denied');
 denied:=false;BEGIN PERFORM public.ops_record_save(ws,'contact','{"title":"Never viewer write"}',null,0);EXCEPTION WHEN insufficient_privilege THEN denied:=SQLERRM='company_permission_denied';END;PERFORM pg_temp.company_role_assert(denied,'explicit_viewer_company_write_denied');
 EXECUTE format('SET LOCAL ROLE %I',executor);UPDATE zoi.workspaces SET owner_profile_id=other_profile WHERE id=ws;UPDATE zoi.workspace_members SET role='owner'WHERE workspace_id=ws AND profile_id=actor;EXECUTE 'SET LOCAL ROLE authenticated';
 PERFORM pg_temp.company_role_assert(public.ops_records_list(ws,null,false)->>'role'='viewer','forged_member_owner_is_viewer');
 denied:=false;BEGIN PERFORM public.ops_record_archive(ws,(c#>>'{record,id}')::uuid,1);EXCEPTION WHEN insufficient_privilege THEN denied:=SQLERRM='company_permission_denied';END;PERFORM pg_temp.company_role_assert(denied,'forged_member_owner_manage_denied');
 EXECUTE format('SET LOCAL ROLE %I',executor);UPDATE zoi.workspaces SET owner_profile_id=actor WHERE id=ws;DELETE FROM zoi.workspace_members WHERE workspace_id=ws;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',account,'role','authenticated','session_id','a3c01503-1015-4000-8000-000000000099')::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
 denied:=false;BEGIN PERFORM public.ops_request_status(ws,nonce,false);EXCEPTION WHEN insufficient_privilege THEN denied:=SQLERRM='suite_session_unavailable';END;PERFORM pg_temp.company_role_assert(denied,'missing_session_cannot_recover_private_receipt');
 EXECUTE format('SET LOCAL ROLE %I',executor);
 PERFORM pg_temp.company_role_assert((SELECT owner_profile_id=actor FROM zoi.workspaces WHERE id=known_ws)AND(SELECT role='owner'FROM zoi.workspace_members WHERE workspace_id=known_ws AND profile_id=actor)AND(SELECT not_after IS NULL OR not_after>clock_timestamp()FROM auth.sessions WHERE id=sid AND user_id=account),'real_qa_workspace_membership_and_session_unchanged');
END $qa$;
SELECT label,passed FROM company_role_results ORDER BY label;
ROLLBACK;
SELECT jsonb_build_object('rollback_completed',true,'workspace_absent',NOT EXISTS(SELECT 1 FROM zoi.workspaces WHERE id='a3c01503-1015-4000-8000-000000000001'),'synthetic_profile_absent',NOT EXISTS(SELECT 1 FROM zoi.user_profiles WHERE id='a3c01503-1015-4000-8000-000000000002'),'records_absent',NOT EXISTS(SELECT 1 FROM zoi.ops_records WHERE workspace_id='a3c01503-1015-4000-8000-000000000001'),'receipts_absent',NOT EXISTS(SELECT 1 FROM zoi.ops_mutation_receipts WHERE workspace_id='a3c01503-1015-4000-8000-000000000001'),'documents_absent',NOT EXISTS(SELECT 1 FROM zoi.workspace_documents WHERE workspace_id='a3c01503-1015-4000-8000-000000000001'),'versions_absent',NOT EXISTS(SELECT 1 FROM zoi.document_versions WHERE workspace_id='a3c01503-1015-4000-8000-000000000001'),'document_audit_absent',NOT EXISTS(SELECT 1 FROM zoi.document_audit WHERE workspace_id='a3c01503-1015-4000-8000-000000000001'),'ops_audit_absent',NOT EXISTS(SELECT 1 FROM zoi.ops_audit WHERE workspace_id='a3c01503-1015-4000-8000-000000000001'),'provider_calls',0,'service_finish_fallback_parity',false);

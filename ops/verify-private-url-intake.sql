BEGIN;
SET LOCAL request.jwt.claim.sub='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';
DO $$DECLARE req uuid:=gen_random_uuid();r jsonb;r2 jsonb;BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.workspace_members m JOIN zoi.user_profiles p ON p.id=m.profile_id WHERE p.auth_user_id=auth.uid() AND m.workspace_id='053a5656-b19b-48a4-8721-65c4674f647c' AND m.role IN('owner','admin')) THEN RAISE EXCEPTION 'qa_scope_unavailable';END IF;
 r:=public.intake_create_draft(req,'053a5656-b19b-48a4-8721-65c4674f647c','https://qa-intake.zoi.city/rollback','Zoi QA private intake rollback','business',21,'QA','QA');
 IF r->>'status' IS DISTINCT FROM 'private_draft' OR r->'published' IS DISTINCT FROM 'false'::jsonb OR r->'ownership_verified' IS DISTINCT FROM 'false'::jsonb THEN RAISE EXCEPTION 'receipt_failed';END IF;
 IF NOT EXISTS(SELECT 1 FROM zoi.listings WHERE id=(r->>'listing_id')::uuid AND owner_workspace_id='053a5656-b19b-48a4-8721-65c4674f647c' AND publish_status='draft' AND marketplace_status='hidden' AND verification_status='unverified' AND claim_status='unclaimed') THEN RAISE EXCEPTION 'privacy_failed';END IF;
 r2:=public.intake_create_draft(req,'053a5656-b19b-48a4-8721-65c4674f647c','https://qa-intake.zoi.city/rollback','Zoi QA private intake rollback','business',21,'QA','QA');
 IF r2 IS DISTINCT FROM r THEN RAISE EXCEPTION 'retry_failed';END IF;
 IF public.intake_draft_receipt(req)->'receipt' IS DISTINCT FROM r THEN RAISE EXCEPTION 'recovery_failed';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(public.intake_lookup('https://qa-intake.zoi.city/rollback')->'matches')m WHERE m->>'id'=r->>'listing_id') THEN RAISE EXCEPTION 'private_lookup_leak';END IF;
END$$;
SELECT 'private_url_intake_rollback_checks_passed' AS result;
ROLLBACK;

-- REVIEW REQUIRED. Exact fixture only; durable receipts prevent hard deletion.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='3s';
DO $qa$
DECLARE
 fixture constant uuid := '48c711ee-e83b-4ce2-a7cc-4126d713048a';
 workspace constant uuid := '053a5656-b19b-48a4-8721-65c4674f647c';
 marker constant jsonb := '{"run":"private-owner-content-20260930-v1","listing":"48c711ee-e83b-4ce2-a7cc-4126d713048a","purpose":"edit-read-preview-only"}';
 row zoi.listings;
 category bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('private-owner-qa:'||fixture::text,0));
 IF NOT EXISTS(SELECT 1 FROM zoi.workspace_members m JOIN zoi.user_profiles p ON p.id=m.profile_id WHERE m.workspace_id=workspace AND m.role='owner' AND p.id='21a04e78-e3b1-448e-8517-47aad25dd5da' AND p.auth_user_id='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd') THEN RAISE EXCEPTION 'qa_identity_mismatch';END IF;
 SELECT * INTO row FROM zoi.listings WHERE id=fixture FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'qa_fixture_missing';END IF;
 IF row.name IS DISTINCT FROM 'ZOI INTERNAL QA — NOT PUBLIC' OR row.slug IS DISTINCT FROM 'zoi-internal-private-owner-qa-48c711ee' OR row.owner_workspace_id IS DISTINCT FROM workspace OR row.profile->'_qa_fixture' IS DISTINCT FROM marker OR row.publish_status NOT IN('draft','archived') OR row.marketplace_status IS DISTINCT FROM 'hidden' OR row.website IS NOT NULL OR row.email IS NOT NULL OR row.phone IS NOT NULL OR row.profile?'_enrich' THEN RAISE EXCEPTION 'qa_cleanup_fingerprint_mismatch';END IF;
 IF EXISTS(SELECT 1 FROM zoi.home_designs WHERE listing_id=fixture) THEN RAISE EXCEPTION 'qa_unexpected_design_write';END IF;
 IF EXISTS(SELECT 1 FROM zoi.home_content_requests WHERE listing_id=fixture AND (workspace_id IS DISTINCT FROM workspace OR actor_id IS DISTINCT FROM '21a04e78-e3b1-448e-8517-47aad25dd5da'::uuid OR request_id IS DISTINCT FROM '678a541a-c3dc-4cb0-96f5-6d67a1539b54'::uuid)) THEN RAISE EXCEPTION 'qa_unexpected_content_write';END IF;
 -- Retain the immutable request and its FK target. Never delete audit/history.
 -- Keep ownership: this explicitly labelled tombstone remains visible only to QA operators.
 UPDATE zoi.listings SET publish_status='archived',marketplace_status='hidden',description=NULL,profile=(profile-'menu'-'specials')||jsonb_build_object('_qa_cleanup','archived_receipts_retained') WHERE id=fixture;
 SELECT * INTO STRICT row FROM zoi.listings WHERE id=fixture;
 IF row.publish_status IS DISTINCT FROM 'archived' OR row.marketplace_status IS DISTINCT FROM 'hidden' OR public.home_design_public(fixture) IS NOT NULL THEN RAISE EXCEPTION 'qa_cleanup_unconfirmed';END IF;
END $qa$;
SELECT jsonb_build_object('ok',true,'archived_hidden',true,'audit_preserved',true,'hard_deleted',false,'qa_dashboard_tombstone_visible',true) AS qa_result;
COMMIT;

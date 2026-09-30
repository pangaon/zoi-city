-- REVIEW REQUIRED. Privileged setup only; not a normal owner creation test.
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
 -- Existing records are never adopted or overwritten, including a prior run.
 IF EXISTS(SELECT 1 FROM zoi.listings WHERE id=fixture OR slug='zoi-internal-private-owner-qa-48c711ee') THEN RAISE EXCEPTION 'qa_fixture_already_exists';END IF;
 SELECT id INTO STRICT category FROM zoi.categories WHERE slug='restaurants';
 INSERT INTO zoi.listings(id,name,slug,entity_type,primary_category_id,owner_workspace_id,publish_status,marketplace_status,moderation_status,profile)
 VALUES(fixture,'ZOI INTERNAL QA — NOT PUBLIC','zoi-internal-private-owner-qa-48c711ee','business',category,workspace,'draft','hidden','clean',jsonb_build_object('_qa_fixture',marker));
 SELECT * INTO STRICT row FROM zoi.listings WHERE id=fixture FOR UPDATE;
 IF row.publish_status IS DISTINCT FROM 'draft' OR row.marketplace_status IS DISTINCT FROM 'hidden' OR row.owner_workspace_id IS DISTINCT FROM workspace OR row.profile->'_qa_fixture' IS DISTINCT FROM marker OR row.website IS NOT NULL OR row.email IS NOT NULL OR row.phone IS NOT NULL OR row.profile?'_enrich' THEN RAISE EXCEPTION 'qa_private_fixture_unconfirmed';END IF;
 IF public.home_design_public(fixture) IS NOT NULL THEN RAISE EXCEPTION 'qa_public_design_exposed';END IF;
END $qa$;
SELECT jsonb_build_object('ok',true,'private_fixture_provisioned',true,'normal_creation_tested',false) AS qa_result;
COMMIT;

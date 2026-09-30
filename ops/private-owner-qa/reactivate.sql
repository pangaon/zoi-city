-- REVIEWED-STATE CANDIDATE. Exact archived fixture only; never create or adopt.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='3s';
DO $qa$
DECLARE
 fixture constant uuid := '48c711ee-e83b-4ce2-a7cc-4126d713048a';
 workspace constant uuid := '053a5656-b19b-48a4-8721-65c4674f647c';
 actor constant uuid := '21a04e78-e3b1-448e-8517-47aad25dd5da';
 old_request constant uuid := '678a541a-c3dc-4cb0-96f5-6d67a1539b54';
 new_request constant uuid := 'fd78dcbc-6164-4658-8e87-1b5e38debe9c';
 marker constant jsonb := '{"run":"private-owner-content-20260930-v1","listing":"48c711ee-e83b-4ce2-a7cc-4126d713048a","purpose":"edit-read-preview-only"}';
 row zoi.listings;
 expected_profile jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('private-owner-qa:'||fixture::text,0));
 IF NOT EXISTS(SELECT 1 FROM zoi.workspace_members m JOIN zoi.user_profiles p ON p.id=m.profile_id WHERE m.workspace_id=workspace AND m.role='owner' AND p.id=actor AND p.auth_user_id='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd') THEN RAISE EXCEPTION 'qa_identity_mismatch';END IF;
 SELECT * INTO STRICT row FROM zoi.listings WHERE id=fixture FOR UPDATE;
 IF row.name IS DISTINCT FROM 'ZOI INTERNAL QA — NOT PUBLIC' OR row.slug IS DISTINCT FROM 'zoi-internal-private-owner-qa-48c711ee' OR row.entity_type IS DISTINCT FROM 'business' OR row.owner_workspace_id IS DISTINCT FROM workspace OR row.publish_status IS DISTINCT FROM 'archived' OR row.marketplace_status IS DISTINCT FROM 'hidden' OR row.moderation_status IS DISTINCT FROM 'clean' OR row.description IS NOT NULL OR row.website IS NOT NULL OR row.email IS NOT NULL OR row.phone IS NOT NULL OR row.photo_url IS NOT NULL OR row.hours IS NOT NULL OR row.price_range IS NOT NULL OR coalesce(row.social_links,'{}'::jsonb)<>'{}'::jsonb OR row.profile->'_qa_fixture' IS DISTINCT FROM marker OR row.profile->>'_qa_cleanup' IS DISTINCT FROM 'archived_receipts_retained' OR md5(row.profile::text) IS DISTINCT FROM '729f2ce7922ccbbb018ae911ba543b53' THEN RAISE EXCEPTION 'qa_reactivation_fingerprint_mismatch';END IF;
 IF EXISTS(SELECT 1 FROM zoi.home_designs WHERE listing_id=fixture) OR public.home_design_public(fixture) IS NOT NULL THEN RAISE EXCEPTION 'qa_unexpected_design_write';END IF;
 IF (SELECT count(*) FROM zoi.home_content_requests WHERE listing_id=fixture)<>1 OR NOT EXISTS(SELECT 1 FROM zoi.home_content_requests WHERE listing_id=fixture AND workspace_id=workspace AND actor_id=actor AND request_id=old_request AND md5(payload::text)='b24a2313e2ca31b54b3081b238408535' AND md5(receipt::text)='49fa7f303ceaa706d9ed11b7367afba9') OR EXISTS(SELECT 1 FROM zoi.home_content_requests WHERE request_id=new_request) THEN RAISE EXCEPTION 'qa_reactivation_receipt_mismatch';END IF;
 expected_profile:=jsonb_set(row.profile,'{_qa_cleanup}',to_jsonb('reactivated:fd78dcbc-6164-4658-8e87-1b5e38debe9c'::text));
 UPDATE zoi.listings SET publish_status='draft',profile=expected_profile WHERE id=fixture;
 SELECT * INTO STRICT row FROM zoi.listings WHERE id=fixture;
 IF row.publish_status IS DISTINCT FROM 'draft' OR row.marketplace_status IS DISTINCT FROM 'hidden' OR row.owner_workspace_id IS DISTINCT FROM workspace OR row.profile IS DISTINCT FROM expected_profile OR public.home_design_public(fixture) IS NOT NULL THEN RAISE EXCEPTION 'qa_reactivation_unconfirmed';END IF;
END $qa$;
SELECT jsonb_build_object('ok',true,'private_fixture_provisioned',true,'reactivated_existing_fixture',true,'prior_receipt_preserved',true,'normal_creation_tested',false) AS qa_result;
COMMIT;

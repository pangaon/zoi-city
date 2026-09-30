-- Dedicated QA owner only; synthetic restaurant and every content change rolled back.
BEGIN;SET LOCAL statement_timeout='20s';SET LOCAL lock_timeout='3s';
CREATE TEMP TABLE qa_owner_content(listing uuid)ON COMMIT DROP;
DO $setup$
DECLARE ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';l uuid:=gen_random_uuid();cat bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.workspace_members m JOIN zoi.user_profiles p ON p.id=m.profile_id WHERE m.workspace_id=ws AND m.role='owner' AND p.id='21a04e78-e3b1-448e-8517-47aad25dd5da' AND p.auth_user_id='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd')THEN RAISE EXCEPTION 'qa_identity_mismatch';END IF;
 SELECT id INTO STRICT cat FROM zoi.categories WHERE slug='restaurants';
 INSERT INTO zoi.listings(id,name,slug,entity_type,primary_category_id,owner_workspace_id,publish_status,marketplace_status,moderation_status,website,profile)VALUES(l,'Synthetic owner content QA','qa-rollback-owner-content-'||l,'business',cat,ws,'published','none','clean','https://example.org','{"_enrich":{"social":{"youtube":"https://www.youtube.com/@ExampleOrganization"},"menu":[{"section":"Source","items":[{"name":"Old source item"}]}]}}');
 INSERT INTO qa_owner_content VALUES(l);
END $setup$;
GRANT SELECT ON qa_owner_content TO authenticated;
SELECT set_config('request.jwt.claim.sub','2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd',true);
SET LOCAL ROLE authenticated;
DO $flow$
DECLARE l uuid;ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';snap jsonb;receipt jsonb;
BEGIN
 SELECT listing INTO STRICT l FROM pg_temp.qa_owner_content;snap:=public.home_content_get(ws,l);
 IF snap->'owner_content' ? 'social_links' THEN RAISE EXCEPTION 'qa_unauthored_social_override';END IF;
 receipt:=public.home_content_save(ws,l,snap->>'version',gen_random_uuid(),'{"social_links":{}}','{}');
 snap:=public.home_content_get(ws,l);
 IF snap#>'{owner_content,social_links}' IS DISTINCT FROM '{}'::jsonb OR snap->>'version' IS DISTINCT FROM receipt->>'version' THEN RAISE EXCEPTION 'qa_owner_social_clear_missing';END IF;
 IF snap#>>'{profile,_enrich,social,youtube}' IS DISTINCT FROM 'https://www.youtube.com/@ExampleOrganization' THEN RAISE EXCEPTION 'qa_source_evidence_changed';END IF;
END $flow$;
RESET ROLE;
DO $public$ DECLARE l uuid; BEGIN SELECT listing INTO STRICT l FROM pg_temp.qa_owner_content;
 IF zoi.public_owner_content(l)->'social_links' IS DISTINCT FROM '{}'::jsonb THEN RAISE EXCEPTION 'qa_public_social_clear_missing';END IF;
END $public$;
ROLLBACK;

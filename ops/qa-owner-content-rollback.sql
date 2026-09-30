-- Dedicated QA owner only; synthetic restaurant and every content change rolled back.
BEGIN;SET LOCAL statement_timeout='20s';SET LOCAL lock_timeout='3s';
CREATE TEMP TABLE qa_owner_content(listing uuid)ON COMMIT DROP;
DO $setup$
DECLARE ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';l uuid:=gen_random_uuid();cat bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.workspace_members m JOIN zoi.user_profiles p ON p.id=m.profile_id WHERE m.workspace_id=ws AND m.role='owner' AND p.id='21a04e78-e3b1-448e-8517-47aad25dd5da' AND p.auth_user_id='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd')THEN RAISE EXCEPTION 'qa_identity_mismatch';END IF;
 SELECT id INTO STRICT cat FROM zoi.categories WHERE slug='restaurants';
 INSERT INTO zoi.listings(id,name,slug,entity_type,primary_category_id,owner_workspace_id,publish_status,marketplace_status,moderation_status,website,profile)VALUES(l,'Synthetic owner content QA','qa-rollback-owner-content-'||l,'business',cat,ws,'published','none','clean','https://example.org','{"_enrich":{"menu":[{"section":"Source","items":[{"name":"Old source item"}]}]}}');
 INSERT INTO qa_owner_content VALUES(l);
END $setup$;
GRANT SELECT ON qa_owner_content TO authenticated;
SELECT set_config('request.jwt.claim.sub','2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd',true);
SET LOCAL ROLE authenticated;
DO $flow$
DECLARE l uuid;ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';snap jsonb;a jsonb;b jsonb;k uuid:=gen_random_uuid();patch jsonb:='{"menu":[{"section":"QA section","items":[{"name":"Synthetic dish","price":"EUR 12.50","note":"Rollback only"}]}],"specials":[{"name":"Synthetic offer","when":"Fixture only","price":"EUR 9","note":"Not a real offer"}]}';
BEGIN
 SELECT listing INTO STRICT l FROM pg_temp.qa_owner_content;snap:=public.home_content_get(ws,l);
 a:=public.home_content_save(ws,l,snap->>'version',k,'{"description":"Synthetic owner wording"}',patch);
 b:=public.home_content_save(ws,l,snap->>'version',k,'{"description":"Synthetic owner wording"}',patch);
 IF a IS DISTINCT FROM b THEN RAISE EXCEPTION 'qa_retry_receipt_changed';END IF;
 BEGIN PERFORM public.home_content_save(ws,l,snap->>'version',gen_random_uuid(),'{}','{}');RAISE EXCEPTION 'qa_stale_save_allowed';EXCEPTION WHEN raise_exception THEN IF sqlerrm<>'version_conflict' THEN RAISE;END IF;END;
 snap:=public.home_content_get(ws,l);IF snap#>'{profile,menu}' IS DISTINCT FROM patch->'menu' OR snap#>>'{base,description}'<>'Synthetic owner wording' THEN RAISE EXCEPTION 'qa_saved_content_missing';END IF;
 a:=public.home_content_save(ws,l,snap->>'version',gen_random_uuid(),'{}','{"menu":null,"specials":null}');snap:=public.home_content_get(ws,l);
 IF snap#>'{profile,menu}' IS DISTINCT FROM 'null'::jsonb OR snap#>'{profile,specials}' IS DISTINCT FROM 'null'::jsonb OR snap#>>'{profile,_enrich,menu,0,items,0,name}'<>'Old source item' THEN RAISE EXCEPTION 'qa_clear_or_source_preservation_failed';END IF;
END $flow$;
RESET ROLE;
SELECT jsonb_build_object('ok',true,'checks',4,'rollback_follows',true)qa_owner_content_result;
ROLLBACK;

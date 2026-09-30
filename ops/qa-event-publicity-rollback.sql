-- Dedicated QA identity; synthetic event and every write/receipt rolled back.
BEGIN;SET LOCAL statement_timeout='20s';SET LOCAL lock_timeout='3s';
CREATE TEMP TABLE qa_event_publicity(listing uuid,expected jsonb)ON COMMIT DROP;
DO $setup$
DECLARE ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';l uuid:=gen_random_uuid();cat bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.workspace_members m JOIN zoi.user_profiles p ON p.id=m.profile_id WHERE m.workspace_id=ws AND m.role='owner' AND p.id='21a04e78-e3b1-448e-8517-47aad25dd5da' AND p.auth_user_id='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd')THEN RAISE EXCEPTION 'qa_identity_mismatch';END IF;
 SELECT id INTO STRICT cat FROM zoi.categories WHERE slug='restaurants';
 INSERT INTO zoi.listings(id,name,slug,entity_type,primary_category_id,owner_workspace_id,publish_status,marketplace_status,moderation_status,website,profile)VALUES(l,'Synthetic publicity QA','qa-rollback-event-publicity-'||l,'event',cat,ws,'published','none','clean','https://example.org','{"_enrich":{"description":"Retained source"}}');
 INSERT INTO qa_event_publicity VALUES(l,'{"event_url":"https://example.org/concert","sales":{"enabled":true,"count":3,"as_of":"2026-09-30T12:00:00Z","expires_at":"2026-10-01T12:00:00Z","source_url":"https://example.org/report","label":"Tickets sold"},"highlights":[{"id":"qa-video","title":"Synthetic archive","url":"https://www.youtube.com/watch?v=abcdefghijk","poster":"https://example.org/poster.jpg"}],"posts":[]}');
END $setup$;
GRANT SELECT ON qa_event_publicity TO authenticated;
SELECT set_config('request.jwt.claim.sub','2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd',true);
SET LOCAL ROLE authenticated;
DO $save$
DECLARE l uuid;p jsonb;ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';snap jsonb;a jsonb;b jsonb;k uuid:=gen_random_uuid();
BEGIN
 SELECT listing,expected INTO STRICT l,p FROM pg_temp.qa_event_publicity;snap:=public.home_content_get(ws,l);
 a:=public.home_content_save(ws,l,snap->>'version',k,'{}',jsonb_build_object('event_publicity',p));b:=public.home_content_save(ws,l,snap->>'version',k,'{}',jsonb_build_object('event_publicity',p));IF a IS DISTINCT FROM b THEN RAISE EXCEPTION 'qa_retry_receipt_changed';END IF;
 BEGIN PERFORM public.home_content_get('00000000-0000-4000-8000-000000000099',l);RAISE EXCEPTION 'qa_cross_scope_allowed';EXCEPTION WHEN OTHERS THEN IF sqlerrm NOT IN('not_authorized','no_access_to_listing') THEN RAISE;END IF;END;
 snap:=public.home_content_get(ws,l);
 BEGIN PERFORM public.home_content_save(ws,l,snap->>'version',gen_random_uuid(),'{}',jsonb_build_object('event_publicity',jsonb_set(p,'{sales,count}','-1')));RAISE EXCEPTION 'qa_invalid_count_allowed';EXCEPTION WHEN raise_exception THEN IF sqlerrm<>'invalid_event_publicity' THEN RAISE;END IF;END;
 BEGIN PERFORM public.home_content_save(ws,l,snap->>'version',gen_random_uuid(),'{}',jsonb_build_object('event_publicity',jsonb_set(p,'{highlights,0,url}','"javascript:alert(1)"')));RAISE EXCEPTION 'qa_invalid_url_allowed';EXCEPTION WHEN raise_exception THEN IF sqlerrm<>'invalid_event_publicity' THEN RAISE;END IF;END;
END $save$;
RESET ROLE;
DO $read$ DECLARE l uuid;p jsonb;BEGIN SELECT listing,expected INTO STRICT l,p FROM qa_event_publicity;IF zoi.public_owner_content(l)#>'{profile,event_publicity}' IS DISTINCT FROM p THEN RAISE EXCEPTION 'qa_public_projection_mismatch';END IF;END $read$;
SET LOCAL ROLE authenticated;
DO $clear$ DECLARE l uuid;ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';snap jsonb;BEGIN SELECT listing INTO STRICT l FROM pg_temp.qa_event_publicity;snap:=public.home_content_get(ws,l);PERFORM public.home_content_save(ws,l,snap->>'version',gen_random_uuid(),'{}','{"event_publicity":null}');END $clear$;
RESET ROLE;
DO $read_clear$ DECLARE l uuid;BEGIN SELECT listing INTO STRICT l FROM qa_event_publicity;IF zoi.public_owner_content(l)#>'{profile,event_publicity}' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'qa_public_clear_missing';END IF;IF (SELECT profile#>>'{_enrich,description}' FROM zoi.listings WHERE id=l)<>'Retained source' THEN RAISE EXCEPTION 'qa_source_changed';END IF;END $read_clear$;
SELECT jsonb_build_object('ok',true,'checks',7,'rollback_follows',true)qa_event_publicity_result;
ROLLBACK;

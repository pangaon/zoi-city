-- Synthetic service-pipeline receipts only; never retained or counted as real review.
BEGIN;
SET LOCAL statement_timeout='20s';SET LOCAL lock_timeout='3s';
DO $qa$
DECLARE ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';l zoi.listings;listing uuid:=gen_random_uuid();cat bigint;fp text;criterion_revision integer;a jsonb;b jsonb;e jsonb;before_rows bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.workspace_members m JOIN zoi.user_profiles p ON p.id=m.profile_id WHERE m.workspace_id=ws AND m.role='owner' AND p.id='21a04e78-e3b1-448e-8517-47aad25dd5da' AND p.auth_user_id='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd') THEN RAISE EXCEPTION 'qa_identity_mismatch';END IF;
 SELECT id INTO STRICT cat FROM zoi.categories WHERE slug='restaurants';
 INSERT INTO zoi.listings(id,entity_type,name,slug,primary_category_id,website,publish_status,marketplace_status,moderation_status,owner_workspace_id,profile)VALUES(listing,'business','Synthetic rollback criterion test','qa-rollback-criteria-'||listing,cat,'https://example.org','published','none','clean',ws,'{"description":"Owner wording preserved"}');
 SELECT * INTO l FROM zoi.listings WHERE id=listing;
 IF public.listing_quality_checklist(listing)->>'complete'<>'false' THEN RAISE EXCEPTION 'qa_false_completion';END IF;
 UPDATE zoi.listings SET profile=profile||jsonb_build_object('_enrich',jsonb_build_object('lease',jsonb_build_object('id','rollback-criterion','task','classification','fingerprint',zoi.listing_quality_fingerprint(l),'expires_at',now()+interval '10 minutes')))WHERE id=listing;
 SELECT * INTO l FROM zoi.listings WHERE id=listing;fp:=zoi.quality_criterion_fingerprint(l);SELECT max(revision) INTO criterion_revision FROM zoi.quality_criteria WHERE key='identity';
 e:=jsonb_build_object('kind','source','performed',true,'observations','Synthetic rollback-only evidence, not an actual source review.','refs',jsonb_build_array(jsonb_build_object('uri','https://example.org/rollback-only','sha256',repeat('a',64))),'blockers','[]'::jsonb);
 a:=public.listing_quality_criterion_record(gen_random_uuid(),listing,'identity',criterion_revision,'specialist','qa-rollback-specialist',null,'rollback-criterion',fp,repeat('0',40),'passed',e);
 BEGIN PERFORM public.listing_quality_criterion_record(gen_random_uuid(),listing,'identity',criterion_revision,'reviewer','qa-rollback-specialist',(a->>'id')::uuid,null,fp,repeat('0',40),'passed',e);RAISE EXCEPTION 'qa_same_actor_allowed';EXCEPTION WHEN raise_exception THEN IF sqlerrm<>'independent_review_required' THEN RAISE;END IF;END;
 e:=jsonb_set(e,'{refs,0,sha256}',to_jsonb(repeat('b',64)));
 b:=public.listing_quality_criterion_record(gen_random_uuid(),listing,'identity',criterion_revision,'reviewer','qa-rollback-reviewer',(a->>'id')::uuid,null,fp,repeat('0',40),'passed',e);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.listing_quality_checklist(listing)->'criteria')c WHERE c->>'key'='identity' AND c->>'status'='signed_off')THEN RAISE EXCEPTION 'qa_review_missing';END IF;
 UPDATE zoi.listings SET profile=profile||'{"description":"Owner edited after review"}'WHERE id=listing;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.listing_quality_checklist(listing)->'criteria')c WHERE c->>'key'='identity' AND c->>'status'='pending_recheck')THEN RAISE EXCEPTION 'qa_stale_source_allowed';END IF;
 IF has_function_privilege('authenticated','public.listing_quality_checklist(uuid)','execute') OR has_table_privilege('anon','zoi.quality_signoffs','select')THEN RAISE EXCEPTION 'qa_public_evidence_access';END IF;
END $qa$;
SELECT jsonb_build_object('ok',true,'checks',6,'rollback_follows',true) qa_criteria_result;
ROLLBACK;

BEGIN;
SET LOCAL request.jwt.claim.sub='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';
DO $$
DECLARE actor uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';uid uuid:=auth.uid();lid uuid:=gen_random_uuid();slug text:='private-rollback-follow-'||lid::text;r jsonb;answer text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.user_profiles p JOIN zoi.workspace_members m ON m.profile_id=p.id WHERE p.id=actor AND p.auth_user_id=uid AND m.workspace_id='053a5656-b19b-48a4-8721-65c4674f647c' AND m.role IN('owner','admin')) THEN RAISE EXCEPTION 'qa_scope_unavailable';END IF;
 -- This public-eligibility fixture exists only in this uncommitted transaction.
 INSERT INTO zoi.listings(id,slug,name,entity_type,publish_status,moderation_status,marketplace_status,rating,rating_count)
 VALUES(lid,slug,'Private rollback follow review QA','business','published','clean','visible',null,0);
 -- Production's insert publish gate may hold new listings; this dedicated uncommitted fixture explicitly sets eligibility.
 UPDATE zoi.listings SET publish_status='published',moderation_status='clean',marketplace_status='visible' WHERE id=lid;
 IF NOT EXISTS(SELECT 1 FROM zoi.listings WHERE id=lid AND owner_workspace_id IS NULL AND owner_user_id IS NULL AND publish_status='published' AND moderation_status='clean' AND marketplace_status<>'hidden') THEN RAISE EXCEPTION 'qa_listing_scope_failed';END IF;
 r:=public.zoi_follow_place(gen_random_uuid(),slug,'follow');IF r->>'error' IS DISTINCT FROM 'profile_mismatch' THEN RAISE EXCEPTION 'forged_follow_allowed';END IF;
 r:=public.zoi_follow_place(actor,slug,'follow');IF r->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'follow_failed';END IF;
 r:=public.zoi_follow_place(actor,slug,'follow');IF r->>'ok' IS DISTINCT FROM 'true' OR (SELECT count(*)FROM zoi.user_places WHERE profile_id=actor AND listing_id=lid AND relation='follow') IS DISTINCT FROM 1::bigint THEN RAISE EXCEPTION 'follow_retry_failed';END IF;
 r:=public.zoi_follow_place(actor,slug,'my_church');IF r->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'affiliation_fixture_failed';END IF;
 r:=public.zoi_unfollow_place(actor,slug);IF r->>'ok' IS DISTINCT FROM 'true' OR EXISTS(SELECT 1 FROM zoi.user_places WHERE profile_id=actor AND listing_id=lid AND relation='follow') OR NOT EXISTS(SELECT 1 FROM zoi.user_places WHERE profile_id=actor AND listing_id=lid AND relation='my_church') THEN RAISE EXCEPTION 'unfollow_scope_failed';END IF;
 answer:=public.zoi_submit_review(slug,'Ignored caller name',5,'Private rollback QA authored review');IF answer IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION 'pending_review_failed';END IF;
 IF public.zoi_submit_review(slug,'Another ignored name',5,'Private rollback QA authored review') IS DISTINCT FROM 'pending' OR (SELECT count(*)FROM zoi.reviews WHERE listing_id=lid AND author_user_id=uid) IS DISTINCT FROM 1::bigint THEN RAISE EXCEPTION 'review_retry_failed';END IF;
 IF NOT EXISTS(SELECT 1 FROM zoi.reviews WHERE listing_id=lid AND author_user_id=uid AND moderation_status='under_review' AND author_name IS DISTINCT FROM 'Ignored caller name') OR public.zoi_listing_reviews(slug)::jsonb IS DISTINCT FROM '[]'::jsonb OR (SELECT rating_count FROM zoi.listings WHERE id=lid) IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'pending_review_visibility_failed';END IF;
 UPDATE zoi.reviews SET moderation_status='cleared' WHERE listing_id=lid AND author_user_id=uid;
 IF jsonb_array_length(public.zoi_listing_reviews(slug)::jsonb) IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'approved_read_failed';END IF;
 UPDATE zoi.listings SET marketplace_status='hidden' WHERE id=lid;
 IF public.zoi_listing_reviews(slug)::jsonb IS DISTINCT FROM '[]'::jsonb OR (public.zoi_follow_place(actor,slug,'follow'))->>'error' IS DISTINCT FROM 'not_found' THEN RAISE EXCEPTION 'private_parent_leak';END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 IF public.zoi_submit_review(slug,'Spoof',5,'Anonymous') IS DISTINCT FROM 'not_signed_in' OR (public.zoi_follow_place(actor,slug,'follow'))->>'error' IS DISTINCT FROM 'not_signed_in' THEN RAISE EXCEPTION 'anonymous_write_allowed';END IF;
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 IF has_function_privilege('anon','public.zoi_follow_place(uuid,text,text)','EXECUTE') OR has_function_privilege('anon','public.zoi_unfollow_place(uuid,text)','EXECUTE') OR has_function_privilege('anon','public.zoi_submit_review(text,text,integer,text)','EXECUTE') THEN RAISE EXCEPTION 'anonymous_acl_failed';END IF;
END $$;
SELECT 'follow_review_rollback_checks_passed' AS result;
ROLLBACK;

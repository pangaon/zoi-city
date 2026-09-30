-- Transaction-only QA. No object upload, no committed post/profile, no emails.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='20s';
SET LOCAL request.jwt.claim.sub='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';
DO $$
DECLARE actor uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';request uuid:=gen_random_uuid();pubrequest uuid:=gen_random_uuid();a jsonb;r jsonb;again jsonb;asset uuid;post uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.user_profiles WHERE id=actor AND auth_user_id=auth.uid()) THEN RAISE EXCEPTION 'qa_identity_changed';END IF;
 a:=public.community_media_begin(request,'post','image/png',100,repeat('a',64),'{"type":"image","mime_type":"image/png","width":1,"height":1,"duration_seconds":null}');asset:=(a->>'id')::uuid;
 PERFORM public.community_media_finish(asset);
 BEGIN PERFORM public.community_media_read(asset);RAISE EXCEPTION 'qa_private_asset_exposed';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'media_unavailable' THEN RAISE;END IF;END;
 r:=public.community_publish(pubrequest,'Transaction-only media QA',array[asset],NULL,'{"intent":"moment","topics":["community"]}');post:=(r->>'id')::uuid;
 again:=public.community_publish(pubrequest,'Transaction-only media QA',array[asset],NULL,'{"intent":"moment","topics":["community"]}');IF r<>again THEN RAISE EXCEPTION 'qa_retry_mismatch';END IF;
 IF NOT (public.community_post_get(post)->'post'->'media'->0->>'id'=asset::text) THEN RAISE EXCEPTION 'qa_missing_media';END IF;
 PERFORM public.community_media_read(asset);
 BEGIN PERFORM public.community_media_discard(asset);RAISE EXCEPTION 'qa_attached_media_deleted';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'media_in_use' THEN RAISE;END IF;END;
 UPDATE zoi.feed_posts SET status='hidden' WHERE id=post;
 BEGIN PERFORM public.community_media_read(asset);RAISE EXCEPTION 'qa_hidden_media_exposed';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'media_unavailable' THEN RAISE;END IF;END;
END $$;
ROLLBACK;
SELECT jsonb_build_object('ok',true,'transaction_rolled_back',true,'persisted_fixture_posts',(SELECT count(*) FROM zoi.feed_posts WHERE profile_id='21a04e78-e3b1-448e-8517-47aad25dd5da' AND body='Transaction-only media QA')) AS qa_community_media_result;

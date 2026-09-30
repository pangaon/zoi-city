BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='15s';
DO $$
DECLARE fixture uuid:=gen_random_uuid();v_slug text:='zoi-blocked-rollback-'||fixture::text;row_lease record;result boolean;p jsonb;cat bigint;ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';
BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.workspace_members m JOIN zoi.user_profiles u ON u.id=m.profile_id WHERE m.workspace_id=ws AND m.role='owner' AND u.id='21a04e78-e3b1-448e-8517-47aad25dd5da' AND u.auth_user_id='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd') THEN RAISE EXCEPTION 'qa_identity_changed';END IF;
 SELECT id INTO cat FROM zoi.categories ORDER BY id LIMIT 1;
 INSERT INTO zoi.listings(id,name,slug,entity_type,publish_status,moderation_status,website,primary_category_id,city,country,address,owner_workspace_id,profile)
 VALUES(fixture,'Rollback only',v_slug,'business','published','clean','https://example.org/',cat,'Athens','Greece','Private rollback fixture',ws,jsonb_build_object('description','OWNER_KEEP','_enrich',jsonb_build_object('phone','OLD_KEEP','checked_at','2026-09-16','provenance',jsonb_build_object('phone','reviewed'))));
 SELECT * INTO row_lease FROM public.enrich_sample_lease(array[fixture]);
 IF row_lease.lease_id IS NULL THEN RAISE EXCEPTION 'qa_lease_missing';END IF;
 SELECT a.applied INTO result FROM public.enrich_apply(jsonb_build_array(jsonb_build_object('slug',v_slug,'lease_id',row_lease.lease_id,'website','https://example.org/','profile',jsonb_build_object('blocked','true','blocked_reason','http403'),'provenance','{}'::jsonb)))a;
 IF result IS DISTINCT FROM true THEN RAISE EXCEPTION 'qa_block_receipt_missing';END IF;
 SELECT profile INTO p FROM zoi.listings WHERE id=fixture;
 IF p->>'description' IS DISTINCT FROM 'OWNER_KEEP' OR p#>>'{_enrich,phone}' IS DISTINCT FROM 'OLD_KEEP' OR p#>>'{_enrich,checked_at}' IS DISTINCT FROM '2026-09-16' OR p#>>'{_enrich,provenance,phone}' IS DISTINCT FROM 'reviewed' OR p#>>'{_enrich,blocked}' IS DISTINCT FROM 'true' OR p#>>'{_enrich,blocked_reason}' IS DISTINCT FROM 'http403' OR p#>>'{_coverage,tasks,enrichment,status}' IS DISTINCT FROM 'blocked' THEN RAISE EXCEPTION 'qa_block_data_lost';END IF;
 SELECT a.applied INTO result FROM public.enrich_apply(jsonb_build_array(jsonb_build_object('slug',v_slug,'lease_id',row_lease.lease_id,'website','https://example.org/','profile',jsonb_build_object('phone','REPLAY'))))a;
 IF result IS DISTINCT FROM false THEN RAISE EXCEPTION 'qa_consumed_lease_replayed';END IF;
END $$;
ROLLBACK;
SELECT jsonb_build_object('ok',true,'transaction_rolled_back',true,'persisted_fixtures',(SELECT count(*) FROM zoi.listings WHERE slug LIKE 'zoi-blocked-rollback-%')) AS qa_enrichment_blocked_result;

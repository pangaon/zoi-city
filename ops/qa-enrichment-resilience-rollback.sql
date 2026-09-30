-- One private fixture inside a rollback-only transaction. No HTTP, no production listing edits.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='15s';
DO $$
DECLARE fixture uuid:=gen_random_uuid();slug text:='zoi-enrich-rollback-'||fixture::text;lease text:=gen_random_uuid()::text;result boolean;p jsonb;cat bigint;ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';
BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.workspace_members m JOIN zoi.user_profiles u ON u.id=m.profile_id WHERE m.workspace_id=ws AND m.role='owner' AND u.id='21a04e78-e3b1-448e-8517-47aad25dd5da' AND u.auth_user_id='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd') THEN RAISE EXCEPTION 'qa_identity_changed';END IF;
 SELECT id INTO cat FROM zoi.categories ORDER BY id LIMIT 1;IF cat IS NULL THEN RAISE EXCEPTION 'qa_category_missing';END IF;
 INSERT INTO zoi.listings(id,name,slug,entity_type,publish_status,marketplace_status,website,primary_category_id,city,country,address,owner_workspace_id,profile)
 VALUES(fixture,'Enrichment rollback only',slug,'business','draft','hidden','https://example.org/',cat,'Athens','Greece','Private rollback fixture',ws,jsonb_build_object('description','OWNER_KEEP','_enrich',jsonb_build_object('phone','OLD_KEEP','checked_at','2026-09-16','lease',jsonb_build_object('id',lease,'source_website','https://example.org/','expires_at',now()+interval '5 minutes'))));
 SELECT a.applied INTO result FROM public.enrich_apply(jsonb_build_array(jsonb_build_object('slug',slug,'lease_id',lease,'website','https://example.org/','profile',jsonb_build_object('crawl_status','error','last_error','qa_timeout'),'provenance','{}'::jsonb)))a;
 IF result IS DISTINCT FROM true THEN RAISE EXCEPTION 'qa_error_receipt_missing';END IF;
 SELECT profile INTO p FROM zoi.listings WHERE id=fixture;
 IF p->>'description'<>'OWNER_KEEP' OR p->'_enrich'->>'phone'<>'OLD_KEEP' OR p->'_enrich'->>'checked_at'<>'2026-09-16' OR p->'_enrich'->>'last_attempt_at' IS NULL THEN RAISE EXCEPTION 'qa_last_good_data_lost';END IF;
 SELECT a.applied INTO result FROM public.enrich_apply(jsonb_build_array(jsonb_build_object('slug',slug,'lease_id',lease,'website','https://example.org/','profile',jsonb_build_object('phone','REPLAY'),'provenance','{}'::jsonb)))a;
 IF result IS DISTINCT FROM false THEN RAISE EXCEPTION 'qa_consumed_lease_replayed';END IF;
END $$;
ROLLBACK;
SELECT jsonb_build_object('ok',true,'transaction_rolled_back',true,'persisted_fixtures',(SELECT count(*) FROM zoi.listings WHERE slug LIKE 'zoi-enrich-rollback-%')) AS qa_enrichment_resilience_result;

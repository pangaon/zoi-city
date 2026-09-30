-- Run after reviewed migration; no synthetic records survive.
BEGIN;
SET LOCAL statement_timeout='15s';SET LOCAL lock_timeout='3s';
DO $qa$ DECLARE prefix text:='NameMatch'||replace(gen_random_uuid()::text,'-',''); ids uuid[]:=ARRAY[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];i integer;cat bigint;r jsonb; BEGIN
SELECT primary_category_id INTO cat FROM zoi.listings WHERE publish_status='published' AND primary_category_id IS NOT NULL LIMIT 1;
FOR i IN 1..4 LOOP
INSERT INTO zoi.listings(id,slug,name,entity_type,primary_category_id,city,country,address,website,description,publish_status,moderation_status,trust_score,photo_url,profile)
VALUES(ids[i],'qa-name-relevance-'||ids[i],CASE i WHEN 1 THEN prefix WHEN 2 THEN prefix||' Productions' WHEN 3 THEN 'K'||prefix ELSE prefix||' hidden' END,'business',cat,'Athens','Greece','QA rollback only','https://example.org','Transactional search relevance check only.','published','clean',CASE i WHEN 3 THEN 0.99 ELSE 0.01 END,'https://example.org/art.jpg','{"hero_kind":"event_poster","hero_url":"https://example.org/art.jpg"}');
END LOOP;
UPDATE zoi.listings SET marketplace_status='hidden' WHERE id=ids[4];
r:=public.explore_search(prefix,NULL,NULL,NULL,2,0,NULL);
IF jsonb_array_length(r)<>2 OR r->0->>'id'<>ids[1]::text OR r->1->>'id'<>ids[2]::text OR r->1->>'image_kind'<>'event_poster' THEN RAISE EXCEPTION 'qa_name_ranking_or_image_kind_failed';END IF;
UPDATE zoi.listings SET photo_url='https://example.org/room.jpg' WHERE id=ids[2];
r:=public.explore_search(prefix||' Productions',NULL,NULL,NULL,2,0,NULL);
IF r->0->>'image_kind' IS NOT NULL THEN RAISE EXCEPTION 'qa_replaced_image_role_failed';END IF;
END $qa$;
ROLLBACK;
SELECT true AS name_relevance_rollback_passed,(SELECT count(*) FROM zoi.listings WHERE slug LIKE 'qa-name-relevance-%') AS persisted_test_rows;

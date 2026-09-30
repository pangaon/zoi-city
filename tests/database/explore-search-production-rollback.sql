-- Run only AFTER the reviewed migration. Every synthetic row is rolled back.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='3s';
DO $qa$
DECLARE
 prefix text:='ExploreRollback'||replace(gen_random_uuid()::text,'-','');
 cat bigint;ids uuid[]:=ARRAY[]::uuid[];i integer;x uuid;result jsonb;first_page jsonb;second_page jsonb;
 before_count bigint;after_count bigint;statuses text[]:=ARRAY['clean','cleared','flagged','under_review','actioned','clean','clean','clean'];
BEGIN
 SELECT primary_category_id INTO cat FROM zoi.listings
 WHERE publish_status='published' AND entity_type='travel_place' AND primary_category_id IS NOT NULL LIMIT 1;
 IF cat IS NULL THEN RAISE EXCEPTION 'qa_category_missing';END IF;
 SELECT coalesce(n,0) INTO before_count FROM public.dir_counts() WHERE entity_type='travel_place';
 FOR i IN 1..8 LOOP
  x:=gen_random_uuid();ids:=array_append(ids,x);
  INSERT INTO zoi.listings(id,slug,name,entity_type,primary_category_id,city,country,address,website,
   description,publish_status,moderation_status,marketplace_status,trust_score,verification_status)
  VALUES(x,'rollback-explore-'||x,prefix||' '||i,'travel_place',cat,'Athens','Greece',
   'Rollback verification address','https://example.org','Transactional visibility verification only.',
   'published','clean','none',CASE WHEN i>2 THEN 0.99 ELSE 0.9-i*0.01 END,'unverified');
  UPDATE zoi.listings SET publish_status=CASE i WHEN 7 THEN 'draft' WHEN 8 THEN 'pending_review' ELSE 'published' END,
   moderation_status=statuses[i],marketplace_status=CASE WHEN i=6 THEN 'hidden' ELSE 'none' END WHERE id=x;
 END LOOP;
 result:=public.explore_search(prefix,'travel_place',NULL,NULL,48,0,NULL);
 IF jsonb_array_length(result)<>2 OR EXISTS(SELECT 1 FROM jsonb_array_elements(result)e WHERE (e->>'id')::uuid<>ALL(ids[1:2]))
 THEN RAISE EXCEPTION 'qa_visibility_guard_failed';END IF;
 first_page:=public.explore_search(prefix,'travel_place',NULL,NULL,1,0,NULL);
 second_page:=public.explore_search(prefix,'travel_place',NULL,NULL,1,1,NULL);
 IF jsonb_array_length(first_page)<>1 OR jsonb_array_length(second_page)<>1 OR first_page->0->>'id'=second_page->0->>'id'
 THEN RAISE EXCEPTION 'qa_before_limit_or_pagination_failed';END IF;
 SELECT coalesce(n,0) INTO after_count FROM public.dir_counts() WHERE entity_type='travel_place';
 IF after_count<>before_count+2 THEN RAISE EXCEPTION 'qa_count_visibility_failed';END IF;
 result:=public.explore_fresh(12);
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(result)e WHERE (e->>'id')::uuid=ANY(ids[3:8]))
 THEN RAISE EXCEPTION 'qa_fresh_visibility_failed';END IF;
 IF NOT has_function_privilege('anon','public.explore_search(text,text,text,text,integer,integer,text)','execute')
 THEN RAISE EXCEPTION 'qa_anonymous_contract_missing';END IF;
END $qa$;
ROLLBACK;
SELECT true AS rollback_visibility_flow_passed,
 (SELECT count(*) FROM zoi.listings WHERE slug LIKE 'rollback-explore-%') AS persisted_test_listings;

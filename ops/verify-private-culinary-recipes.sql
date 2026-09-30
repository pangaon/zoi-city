BEGIN;
SET LOCAL request.jwt.claim.sub='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';
DO $$
DECLARE ws uuid:='053a5656-b19b-48a4-8721-65c4674f647c';listing uuid:='48c711ee-e83b-4ce2-a7cc-4126d713048a';rid uuid:=gen_random_uuid();req uuid:=gen_random_uuid();name text;data jsonb;r jsonb;r2 jsonb;
BEGIN
 SELECT l.name INTO name FROM zoi.listings l WHERE l.id=listing AND l.owner_workspace_id=ws AND l.marketplace_status='hidden' AND l.publish_status<>'published' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'private_qa_listing_unavailable';END IF;
 data:=jsonb_build_object('id',rid,'title','Private culinary rollback QA','servings',2,'chef',jsonb_build_object('name',name,'listing_id',listing),'source_url',null,'ingredients',jsonb_build_array(jsonb_build_object('id','rice','name','QA rice','quantity',100,'unit','g','note','')),'steps',jsonb_build_array(jsonb_build_object('id','cook','text','Private validation only','timer_seconds',60)),'video',null);
 r:=public.culinary_recipe_save(ws,rid,listing,0,req,data);IF r->>'ok' IS DISTINCT FROM 'true' OR r#>>'{recipe,status}' IS DISTINCT FROM 'draft' OR r#>>'{recipe,version}' IS DISTINCT FROM '1' OR r#>>'{recipe,workspace_id}' IS DISTINCT FROM ws::text THEN RAISE EXCEPTION 'recipe_receipt_invalid';END IF;
 r2:=public.culinary_recipe_save(ws,rid,listing,0,req,data);IF r2 IS DISTINCT FROM r THEN RAISE EXCEPTION 'recipe_retry_invalid';END IF;
 IF public.culinary_recipe_receipt(ws,req)->'receipt' IS DISTINCT FROM r THEN RAISE EXCEPTION 'recipe_recovery_invalid';END IF;
 IF public.culinary_recipe_get(ws,rid)#>'{recipe,recipe_json}' IS DISTINCT FROM data THEN RAISE EXCEPTION 'recipe_reload_invalid';END IF;
 IF has_table_privilege('authenticated','zoi.culinary_recipes','SELECT') OR has_function_privilege('anon','public.culinary_recipe_get(uuid,uuid)','EXECUTE')THEN RAISE EXCEPTION 'recipe_privacy_invalid';END IF;
END $$;
SELECT 'private_culinary_recipe_rollback_checks_passed' AS result;
ROLLBACK;

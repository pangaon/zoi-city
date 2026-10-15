BEGIN;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='15s';
-- Exact actual production body/authority guards. Only the per-section item
-- predicate expands from 100 to 300; all existing owner authorization/CAS/nonces,
-- other fields, 20-section and 200 KB content constraints retain their source bytes.
DO $patch$DECLARE signature text;definition text;needle text:=$old$jsonb_array_length(sec->'items')>100$old$;BEGIN
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.home_content_save_before_revision(uuid,uuid,text,uuid,jsonb,jsonb)'::regprocedure AND md5(prosrc)='8455ff7d97ea4eaafc176de32099f8e1'AND proowner='postgres'::regrole AND proacl::text='{postgres=X/postgres}'AND proconfig=ARRAY['search_path=""']AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'owner_menu_capacity_baseline_changed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.home_revision_content_valid(jsonb,jsonb)'::regprocedure AND md5(prosrc)='7f3850936d4e7b8cfe1ef99f8d005a71'AND proowner='postgres'::regrole AND proacl::text='{postgres=X/postgres}'AND proconfig=ARRAY['search_path=""']AND prosecdef=false AND provolatile='i')THEN RAISE EXCEPTION 'owner_menu_capacity_baseline_changed';END IF;
 FOREACH signature IN ARRAY ARRAY['zoi.home_revision_content_valid(jsonb,jsonb)','zoi.home_content_save_before_revision(uuid,uuid,text,uuid,jsonb,jsonb)']LOOP
 definition:=pg_get_functiondef(signature::regprocedure);
 IF(length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'owner_menu_capacity_patch_changed';END IF;
 EXECUTE replace(definition,needle,$new$jsonb_array_length(sec->'items')>300$new$);
 END LOOP;
END$patch$;
COMMIT;

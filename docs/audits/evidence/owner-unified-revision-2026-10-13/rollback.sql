-- Run only after independent review, before any private revision is activated.
-- Once activated, keep database guards and deploy a corrected compatible editor.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
LOCK TABLE zoi.home_designs IN ACCESS EXCLUSIVE MODE;
DO $$BEGIN IF EXISTS(SELECT 1 FROM zoi.home_designs WHERE staged)THEN RAISE EXCEPTION 'active_private_revisions_prevent_legacy_rollback';END IF;END $$;
DROP FUNCTION public.home_revision_publish(uuid,uuid,uuid,integer,uuid),public.home_revision_preview_confirm(uuid,uuid,integer,uuid),public.home_revision_preview_data(uuid,uuid,integer),public.home_revision_change(uuid,uuid,uuid,integer,text,jsonb,jsonb,integer),public.home_revision_get(uuid,uuid);
DROP FUNCTION public.home_content_get(uuid,uuid),public.home_content_save(uuid,uuid,text,uuid,jsonb,jsonb),public.home_media_save(uuid,uuid,integer,uuid,jsonb),public.home_design_change(uuid,uuid,uuid,integer,text,jsonb,integer),public.bizpage_save(uuid,uuid,text,text,text,text,text,text,text,jsonb),public.bizpage_save_profile(uuid,uuid,jsonb);
DO $restore$
DECLARE f record;meta jsonb;grant_item jsonb;new_name text;BEGIN
 FOR f IN SELECT p.oid,p.proname,pg_get_function_identity_arguments(p.oid)args FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='zoi' AND p.proname IN('home_content_get_before_revision','home_content_save_before_revision','home_media_save_before_revision','home_design_change_before_revision','bizpage_save_before_revision','bizpage_save_profile_before_revision')LOOP
  meta:=obj_description(f.oid,'pg_proc')::jsonb;
  IF meta->'acl' IS NULL THEN RAISE EXCEPTION 'original_acl_backup_missing';END IF;
  FOR grant_item IN SELECT value FROM jsonb_array_elements(meta->'acl')LOOP
   EXECUTE format('GRANT %s ON FUNCTION %s TO %s%s',grant_item->>'privilege',f.oid::regprocedure,CASE WHEN grant_item->>'grantee'='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(grant_item->>'grantee')END,CASE WHEN grant_item->>'grantable'='true' THEN ' WITH GRANT OPTION' ELSE '' END);
  END LOOP;
  EXECUTE format('COMMENT ON FUNCTION %s IS %L',f.oid::regprocedure,meta->>'previous_comment');
  EXECUTE format('ALTER FUNCTION %s SET SCHEMA public',f.oid::regprocedure);
  new_name:=replace(f.proname,'_before_revision','');
  EXECUTE format('ALTER FUNCTION %s RENAME TO %I',f.oid::regprocedure,new_name);
 END LOOP;
END $restore$;
DROP FUNCTION zoi.home_revision_guard(uuid,uuid),zoi.home_revision_baseline(zoi.listings),zoi.home_revision_content_valid(jsonb,jsonb),zoi.home_revision_profile_snapshot(jsonb);
ALTER TABLE zoi.home_design_history DROP COLUMN content;
ALTER TABLE zoi.home_designs DROP COLUMN staged,DROP COLUMN draft_content,DROP COLUMN published_content,DROP COLUMN content_baseline,DROP COLUMN preview_receipt;
NOTIFY pgrst,'reload schema';
COMMIT;

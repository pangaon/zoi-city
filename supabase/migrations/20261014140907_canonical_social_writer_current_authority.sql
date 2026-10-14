BEGIN;
SET LOCAL lock_timeout='3s';
DO $guard$
DECLARE signature text;expected text;old_check text;definition text;grants text[];p pg_proc;
BEGIN
 IF to_regprocedure('zoi.assert_workspace_write(uuid,text[])')IS NULL THEN RAISE EXCEPTION 'canonical_writer_authority_unavailable';END IF;
 FOR signature,expected,old_check IN SELECT *FROM(VALUES
 ('public.social_save_post(uuid,text,text[],timestamptz,text,jsonb,text,jsonb,uuid)','910c8969ee91315a26f84f296bcb6b35','IF NOT zoi.is_ws_member(p_workspace) THEN RAISE EXCEPTION ''not authorized for this workspace''; END IF;'),
 ('public.social_delete_post(uuid,uuid)','e1ec8015ff2cbe56c90dcf68742d6f43','IF NOT zoi.is_ws_member(p_workspace) THEN RAISE EXCEPTION ''not authorized''; END IF;')
 )v(signature,expected,old_check)LOOP
  SELECT *INTO STRICT p FROM pg_proc WHERE oid=signature::regprocedure;
  definition:=pg_get_functiondef(p.oid);
  SELECT array_agg(coalesce(r.rolname,'PUBLIC')||':'||a.is_grantable::text ORDER BY coalesce(r.rolname,'PUBLIC'))INTO grants FROM aclexplode(p.proacl)a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='EXECUTE';
  IF md5(definition)<>expected OR pg_get_userbyid(p.proowner)<>'postgres'OR grants IS DISTINCT FROM ARRAY['PUBLIC:false','anon:false','authenticated:false','postgres:false','service_role:false']::text[] OR position(old_check IN definition)=0 THEN RAISE EXCEPTION 'canonical_writer_contract_changed';END IF;
  EXECUTE replace(definition,old_check,'PERFORM zoi.assert_workspace_write(p_workspace);');
 END LOOP;
END $guard$;
REVOKE ALL ON FUNCTION public.social_save_post(uuid,text,text[],timestamptz,text,jsonb,text,jsonb,uuid),public.social_delete_post(uuid,uuid)FROM PUBLIC,anon;
NOTIFY pgrst,'reload schema';
COMMIT;

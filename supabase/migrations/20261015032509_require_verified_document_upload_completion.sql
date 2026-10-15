-- Phase B ONLY after deployed verified Edge readback/authority gates. No provider or blob writes.
BEGIN;SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
DO $guard$DECLARE p record;x record;BEGIN
 FOR x IN SELECT * FROM(VALUES
('public.document_upload_finish(uuid)','dae6ca9225ade22c41a6269659413200','{postgres=X/postgres,service_role=X/postgres}'),
('public.document_upload_finish_verified(uuid,text)','8e54275ccce370d6b01ab975f58a25b2','{postgres=X/postgres,service_role=X/postgres}'),
('zoi.document_upload_complete(uuid,text)','6aab538553378394970f8343909ec3f9','{postgres=X/postgres}'),
('zoi.document_upload_completion_authority(uuid)','6025f3e64713a771a2fe272d97efa95c','{postgres=X/postgres}'),
('zoi.document_upload_bind_authority(uuid,uuid)','8fd20f1057bf3d98355c7237236147f6','{postgres=X/postgres}'))AS expected(signature,body_hash,acl)LOOP
 SELECT md5(prosrc)AS body_hash,pg_get_userbyid(proowner)AS owner_name,proacl::text AS acl,proconfig,prosecdef,provolatile INTO p FROM pg_proc WHERE oid=to_regprocedure(x.signature);
 IF p.body_hash IS DISTINCT FROM x.body_hash OR p.owner_name IS DISTINCT FROM 'postgres'OR p.acl IS DISTINCT FROM x.acl OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']OR p.prosecdef IS DISTINCT FROM true OR p.provolatile IS DISTINCT FROM 'v'::"char"THEN RAISE EXCEPTION 'document_verified_hardening_definition_drift:%',x.signature;END IF;
 END LOOP;
END $guard$;
CREATE OR REPLACE FUNCTION public.document_upload_finish(p_version uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$DECLARE state text;BEGIN
 PERFORM zoi.document_upload_completion_authority(p_version);
 SELECT v.state INTO state FROM zoi.document_versions v WHERE v.id=p_version;
 IF state IS DISTINCT FROM 'ready'THEN RAISE EXCEPTION 'upload_verified_completion_required';END IF;
 -- Current-authorized receipt recovery only. Never makes a pending version ready.
 RETURN zoi.document_upload_complete(p_version,NULL);
END $fn$;
COMMIT;

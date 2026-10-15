-- Phase A: additive authority grants and verified finalization. Deploy reviewed Edge before phase B.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
CREATE TEMP TABLE document_finish_expected(signature text,definition text,owner_name text,acl text,config jsonb,security_definer boolean,volatility text)ON COMMIT DROP;
INSERT INTO document_finish_expected VALUES('document_upload_finish(uuid)',$captured$CREATE OR REPLACE FUNCTION public.document_upload_finish(p_version uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v zoi.document_versions;doc zoi.workspace_documents;meta jsonb;
begin
 select * into v from zoi.document_versions where id=p_version;
 select * into doc from zoi.workspace_documents where id=v.document_id for update;
 select * into v from zoi.document_versions where id=p_version for update;
 if v.id is null then raise exception 'document_unavailable';end if;
 if v.state='ready' then return jsonb_build_object('ok',true,'document',to_jsonb(doc),'version',to_jsonb(v));end if;
 if v.state<>'pending' or doc.archived_at is not null or doc.current_version<>v.expected_current_version then raise exception 'upload_state_conflict';end if;
 if not exists(select 1 from zoi.workspace_members where workspace_id=v.workspace_id and profile_id=v.uploaded_by and role in ('owner','admin','editor')) or not exists(select 1 from zoi.ops_records where id=doc.project_id and workspace_id=doc.workspace_id and kind='project' and archived_at is null) then raise exception 'upload_permission_changed';end if;
 select metadata into meta from storage.objects where bucket_id='workspace-documents' and name=v.object_path;
 if meta is null or (meta->>'size')::bigint is distinct from v.size_bytes::bigint or meta->>'mimetype' is distinct from v.mime_type then raise exception 'uploaded_object_mismatch';end if;
 update zoi.document_versions set state='ready',finished_at=clock_timestamp() where id=v.id returning * into v;
 update zoi.workspace_documents set current_version=v.version,updated_at=clock_timestamp() where id=doc.id returning * into doc;
 insert into zoi.document_audit(workspace_id,document_id,version_id,actor_profile_id,action) values(v.workspace_id,doc.id,v.id,v.uploaded_by,'uploaded');
 return jsonb_build_object('ok',true,'document',to_jsonb(doc),'version',to_jsonb(v));
end $function$
$captured$,'postgres','{postgres=X/postgres,service_role=X/postgres}','["search_path=\"\""]'::jsonb,true,'v');
INSERT INTO document_finish_expected VALUES('zoi.ops_role(uuid)',$captured$CREATE OR REPLACE FUNCTION zoi.ops_role(p_workspace uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ SELECT CASE
 WHEN wm.profile_id IS NULL THEN CASE WHEN w.owner_profile_id=up.id THEN 'owner' END
 WHEN wm.role='owner'AND w.owner_profile_id IS DISTINCT FROM up.id THEN 'viewer'
 WHEN wm.role IN('owner','admin','editor','viewer')THEN wm.role END
 FROM zoi.workspaces w JOIN zoi.user_profiles up ON up.auth_user_id=auth.uid()
 LEFT JOIN zoi.workspace_members wm ON wm.workspace_id=w.id AND wm.profile_id=up.id
 WHERE w.id=p_workspace;
$function$
$captured$,'postgres','{postgres=X/postgres,authenticated=X/postgres}','["search_path=\"\""]'::jsonb,true,'s');
INSERT INTO document_finish_expected VALUES('document_upload_begin(uuid,uuid,uuid,integer,text,uuid,text,text,integer,text)',$captured$CREATE OR REPLACE FUNCTION public.document_upload_begin(p_workspace uuid, p_project uuid, p_document uuid, p_expected_version integer, p_title text, p_request uuid, p_filename text, p_mime text, p_size integer, p_sha256 text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE authority_actor uuid; actor uuid;doc zoi.workspace_documents;v zoi.document_versions;suffix text;next_version integer;
BEGIN
 authority_actor:=zoi.company_document_upload_authority(p_workspace);
 actor:=zoi.document_actor(p_workspace);
 if p_request is null or p_size is null or p_size not between 1 and 10485760 or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or p_mime is null or p_mime not in ('application/pdf','text/plain','image/png','image/jpeg') or p_filename is null or length(p_filename) not between 1 and 180 or p_filename ~ '[[:cntrl:]/\\]' or p_title is null or length(btrim(p_title)) not between 1 and 160 then raise exception 'invalid_document_metadata';end if;
 suffix:=case p_mime when 'application/pdf' then 'pdf' when 'text/plain' then 'txt' when 'image/png' then 'png' else 'jpg' end;
 if lower(p_filename) !~ (case when p_mime='image/jpeg' then '\.(jpg|jpeg)$' else '\.'||suffix||'$' end) then raise exception 'filename_type_mismatch';end if;
 -- Actor lock serializes a repeated request ID even when a caller changes document IDs.
 perform 1 from zoi.user_profiles where id=actor for update;
 select * into v from zoi.document_versions where uploaded_by=actor and request_id=p_request;
 if v.id is not null then
  select * into doc from zoi.workspace_documents where id=v.document_id;
  if v.workspace_id is distinct from p_workspace or v.sha256 is distinct from p_sha256 or v.size_bytes is distinct from p_size or v.mime_type is distinct from p_mime or doc.project_id is distinct from p_project or v.requested_document_id is distinct from p_document or v.expected_current_version is distinct from p_expected_version or v.filename is distinct from p_filename or v.request_title is distinct from btrim(p_title) then raise exception 'document_request_conflict';end if;
  if doc.archived_at is not null then raise exception 'document_archived';end if;
  if v.state not in ('pending','ready') then raise exception 'upload_request_closed';end if;
  PERFORM zoi.company_document_authority(p_workspace,'document_read',authority_actor,true); RETURN jsonb_build_object('ok',true,'document',to_jsonb(doc),'upload',to_jsonb(v));
 end if;
 perform 1 from zoi.ops_records where id=p_project and workspace_id=p_workspace and kind='project' and archived_at is null for share;
 if not found then raise exception 'active_project_required';end if;
 if p_document is null then
  if p_expected_version is distinct from 0 then raise exception 'version_conflict';end if;
  insert into zoi.workspace_documents(workspace_id,project_id,title,created_by) values(p_workspace,p_project,btrim(p_title),actor) returning * into doc;
 else
  select * into doc from zoi.workspace_documents where id=p_document and workspace_id=p_workspace for update;
  if doc.id is null or doc.project_id<>p_project then raise exception 'document_unavailable';end if;
  if doc.archived_at is not null then raise exception 'document_archived';end if;
  if doc.current_version is distinct from p_expected_version then raise exception 'version_conflict';end if;
 end if;
 if exists(select 1 from zoi.document_versions where document_id=doc.id and state in ('pending','cleanup')) then raise exception 'document_upload_in_progress';end if;
 select coalesce(max(version),0)+1 into next_version from zoi.document_versions where document_id=doc.id;
 v.id:=gen_random_uuid();
 insert into zoi.document_versions(id,document_id,workspace_id,version,expected_current_version,request_id,requested_document_id,request_title,uploaded_by,filename,mime_type,size_bytes,sha256,object_path)
 values(v.id,doc.id,p_workspace,next_version,doc.current_version,p_request,p_document,btrim(p_title),actor,p_filename,p_mime,p_size,p_sha256,p_workspace::text||'/'||doc.id::text||'/'||v.id::text||'.'||suffix) returning * into v;
 insert into zoi.document_audit(workspace_id,document_id,version_id,actor_profile_id,action) values(p_workspace,doc.id,v.id,actor,'upload_reserved');
 PERFORM zoi.company_document_authority(p_workspace,'document_read',authority_actor,true); RETURN jsonb_build_object('ok',true,'document',to_jsonb(doc),'upload',to_jsonb(v));
end $function$
$captured$,'postgres','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}','["search_path=\"\""]'::jsonb,true,'v');
INSERT INTO document_finish_expected VALUES('zoi.suite_current_session()',$captured$CREATE OR REPLACE FUNCTION zoi.suite_current_session()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sid text:=auth.jwt()->>'session_id';
begin
 if auth.uid() is null or coalesce(sid,'') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then raise exception 'suite_session_unavailable' using errcode='42501';end if;
 perform 1 from auth.users where id=auth.uid() and deleted_at is null and coalesce(is_anonymous,false)=false and (banned_until is null or banned_until<=clock_timestamp());
 if not found then raise exception 'suite_session_unavailable' using errcode='42501';end if;
 perform 1 from auth.sessions where id=sid::uuid and user_id=auth.uid() and (not_after is null or not_after>clock_timestamp());
 if not found then raise exception 'suite_session_unavailable' using errcode='42501';end if;
end $function$
$captured$,'postgres','{postgres=X/postgres}','["search_path=\"\""]'::jsonb,true,'s');
INSERT INTO document_finish_expected VALUES('zoi.suite_lock_session()',$captured$CREATE OR REPLACE FUNCTION zoi.suite_lock_session()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sid text:=auth.jwt()->>'session_id';
begin
 if auth.uid() is null or coalesce(sid,'') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then raise exception 'suite_session_unavailable' using errcode='42501';end if;
 perform 1 from auth.users where id=auth.uid() and deleted_at is null and coalesce(is_anonymous,false)=false and (banned_until is null or banned_until<=clock_timestamp()) for share;
 if not found then raise exception 'suite_session_unavailable' using errcode='42501';end if;
 perform 1 from auth.sessions where id=sid::uuid and user_id=auth.uid() and (not_after is null or not_after>clock_timestamp()) for share;
 if not found then raise exception 'suite_session_unavailable' using errcode='42501';end if;
end $function$
$captured$,'postgres','{postgres=X/postgres}','["search_path=\"\""]'::jsonb,true,'v');
INSERT INTO document_finish_expected VALUES('zoi.workspace_locked_role(uuid)',$captured$CREATE OR REPLACE FUNCTION zoi.workspace_locked_role(p_workspace uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p uuid; o uuid; r text;
begin
 if auth.uid() is null then raise exception 'not_signed_in' using errcode='42501';end if;
 select id into p from zoi.user_profiles where auth_user_id=auth.uid();
 -- Match team writers: workspace first also serializes absent-member inserts.
 select owner_profile_id into o from zoi.workspaces where id=p_workspace for update;
 if not found or p is null then raise exception 'no_access_to_workspace' using errcode='42501';end if;
 select role into r from zoi.workspace_members where workspace_id=p_workspace and profile_id=p for share;
 if not found and o=p then r:='owner';end if;
 if r='owner' and o is distinct from p then r:='viewer';end if;
 if coalesce(r,'') not in('owner','admin','editor','viewer') then raise exception 'no_access_to_workspace' using errcode='42501';end if;
 perform zoi.suite_lock_session();
 return r;
end $function$
$captured$,'postgres','{postgres=X/postgres}','["search_path=\"\""]'::jsonb,true,'v');
INSERT INTO document_finish_expected VALUES('zoi.company_document_authority(uuid,text,uuid,boolean)',$captured$CREATE OR REPLACE FUNCTION zoi.company_document_authority(p_workspace uuid, p_permission text, p_expected_actor uuid DEFAULT NULL::uuid, p_lock boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor uuid;role_name text;
BEGIN
 IF p_permission IS NULL OR p_permission NOT IN('ops_read','ops_write','ops_manage','document_read','document_manage')THEN RAISE EXCEPTION 'invalid_company_authority';END IF;
 IF p_lock THEN
  role_name:=zoi.workspace_locked_role(p_workspace);
  SELECT id INTO actor FROM zoi.user_profiles WHERE auth_user_id=auth.uid()FOR SHARE;
  -- Profile mapping can change while workspace/member/session locks wait.
  -- Its row is now stable; reacquire the canonical role for this exact mapping.
  IF actor IS NOT NULL THEN role_name:=zoi.workspace_locked_role(p_workspace);END IF;
 ELSE
  PERFORM zoi.suite_current_session();
  SELECT id INTO actor FROM zoi.user_profiles WHERE auth_user_id=auth.uid();
  role_name:=zoi.ops_role(p_workspace);
 END IF;
 IF actor IS NULL OR role_name IS NULL OR(p_expected_actor IS NOT NULL AND actor IS DISTINCT FROM p_expected_actor)
 OR(p_permission IN('ops_write','document_read')AND role_name NOT IN('owner','admin','editor'))
 OR(p_permission IN('ops_manage','document_manage')AND role_name NOT IN('owner','admin'))THEN RAISE EXCEPTION 'company_permission_denied' USING ERRCODE='42501';END IF;
 PERFORM zoi.suite_current_session();RETURN actor;
END
$function$
$captured$,'postgres','{postgres=X/postgres}','["search_path=\"\""]'::jsonb,true,'v');
INSERT INTO document_finish_expected VALUES('zoi.company_document_upload_authority(uuid)',$captured$CREATE OR REPLACE FUNCTION zoi.company_document_upload_authority(p_workspace uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor uuid;BEGIN
 PERFORM zoi.workspace_locked_role(p_workspace);
 SELECT id INTO actor FROM zoi.user_profiles WHERE auth_user_id=auth.uid()FOR UPDATE;
 IF actor IS NULL THEN RAISE EXCEPTION 'company_permission_denied' USING ERRCODE='42501';END IF;
 PERFORM zoi.company_document_authority(p_workspace,'document_read',actor,true);
 RETURN actor;
END $function$
$captured$,'postgres','{postgres=X/postgres}','["search_path=\"\""]'::jsonb,true,'v');
DO $guard$DECLARE x record;p record;BEGIN
 FOR x IN SELECT * FROM document_finish_expected LOOP
  SELECT pg_get_functiondef(oid) AS definition,pg_get_userbyid(proowner) AS owner_name,proacl::text AS acl,to_jsonb(proconfig) AS config,prosecdef AS security_definer,provolatile::text AS volatility INTO p FROM pg_proc WHERE oid=to_regprocedure(x.signature);
  IF p.definition IS DISTINCT FROM x.definition OR p.owner_name IS DISTINCT FROM x.owner_name OR p.acl IS DISTINCT FROM x.acl OR p.config IS DISTINCT FROM x.config OR p.security_definer IS DISTINCT FROM x.security_definer OR p.volatility IS DISTINCT FROM x.volatility THEN RAISE EXCEPTION 'document_finalizer_actual_definition_drift:%',x.signature;END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity)OR NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage'AND tablename='objects'AND policyname='workspace_documents_server_only'AND permissive='RESTRICTIVE'AND cmd='ALL'AND roles=ARRAY['anon','authenticated']::name[] AND qual=$policy$(bucket_id <> 'workspace-documents'::text)$policy$ AND with_check=$policy$(bucket_id <> 'workspace-documents'::text)$policy$)THEN RAISE EXCEPTION 'document_finalizer_storage_privacy_drift';END IF;
 IF to_regclass('zoi.document_upload_authority_grants')IS NOT NULL OR to_regprocedure('public.document_upload_finish_verified(uuid,text)')IS NOT NULL THEN RAISE EXCEPTION 'document_finalizer_candidate_already_exists';END IF;
END $guard$;
CREATE TABLE zoi.document_upload_authority_grants(
 grant_no bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 version_id uuid NOT NULL REFERENCES zoi.document_versions(id),
 workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id),
 actor_profile_id uuid NOT NULL REFERENCES zoi.user_profiles(id),
 account_id uuid NOT NULL,
 session_id uuid NOT NULL,
 granted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE zoi.document_upload_authority_grants OWNER TO postgres;
ALTER TABLE zoi.document_upload_authority_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.document_upload_authority_grants FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SEQUENCE zoi.document_upload_authority_grants_grant_no_seq FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX document_upload_authority_current ON zoi.document_upload_authority_grants(version_id,grant_no DESC);
CREATE FUNCTION zoi.document_upload_grant_immutable()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$BEGIN RAISE EXCEPTION 'document_authority_grant_immutable';END $fn$;
ALTER FUNCTION zoi.document_upload_grant_immutable()OWNER TO postgres;REVOKE ALL ON FUNCTION zoi.document_upload_grant_immutable()FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER document_upload_grant_immutable BEFORE UPDATE OR DELETE ON zoi.document_upload_authority_grants FOR EACH ROW EXECUTE FUNCTION zoi.document_upload_grant_immutable();
CREATE FUNCTION zoi.document_upload_bind_authority(p_version uuid,p_actor uuid)RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v zoi.document_versions;d zoi.workspace_documents;prior zoi.document_upload_authority_grants;sid uuid;account uuid:=auth.uid();
BEGIN
 SELECT * INTO v FROM zoi.document_versions WHERE id=p_version;
 IF v.id IS NULL OR v.uploaded_by IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'document_unavailable';END IF;
 PERFORM zoi.company_document_authority(v.workspace_id,'document_read',p_actor,true);
 -- Reservation entry already took profile UPDATE; retain it through immutable grant admission.
 PERFORM 1 FROM zoi.user_profiles WHERE id=p_actor AND auth_user_id=account FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'upload_permission_changed' USING errcode='42501';END IF;
 SELECT * INTO d FROM zoi.workspace_documents WHERE id=v.document_id AND workspace_id=v.workspace_id FOR UPDATE;
 SELECT * INTO v FROM zoi.document_versions WHERE id=p_version FOR UPDATE;
 IF d.id IS NULL OR d.archived_at IS NOT NULL OR v.state NOT IN('pending','ready') THEN RAISE EXCEPTION 'upload_request_closed';END IF;
 sid:=(auth.jwt()->>'session_id')::uuid;
 SELECT * INTO prior FROM zoi.document_upload_authority_grants WHERE version_id=p_version ORDER BY grant_no DESC LIMIT 1;
 IF prior.grant_no IS NOT NULL AND(prior.account_id IS DISTINCT FROM account OR prior.actor_profile_id IS DISTINCT FROM p_actor OR prior.workspace_id IS DISTINCT FROM v.workspace_id)THEN RAISE EXCEPTION 'upload_authority_context_changed' USING errcode='42501';END IF;
 IF prior.session_id IS DISTINCT FROM sid THEN
  -- Even a previously used SID requires a fresh append after another grant; history is never rewritten.
  INSERT INTO zoi.document_upload_authority_grants(version_id,workspace_id,actor_profile_id,account_id,session_id)VALUES(p_version,v.workspace_id,p_actor,account,sid);
 END IF;
 PERFORM zoi.company_document_authority(v.workspace_id,'document_read',p_actor,true);
END $fn$;
ALTER FUNCTION zoi.document_upload_bind_authority(uuid,uuid)OWNER TO postgres;REVOKE ALL ON FUNCTION zoi.document_upload_bind_authority(uuid,uuid)FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION zoi.document_upload_completion_authority(p_version uuid)RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v zoi.document_versions;g zoi.document_upload_authority_grants;o uuid;r text;
BEGIN
 SELECT * INTO v FROM zoi.document_versions WHERE id=p_version;
 IF v.id IS NULL THEN RAISE EXCEPTION 'document_unavailable';END IF;
 -- Same canonical role policy as workspace_locked_role, using the immutable grant's actor/account.
 SELECT owner_profile_id INTO o FROM zoi.workspaces WHERE id=v.workspace_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'upload_permission_changed' USING errcode='42501';END IF;
 SELECT role INTO r FROM zoi.workspace_members WHERE workspace_id=v.workspace_id AND profile_id=v.uploaded_by FOR SHARE;
 IF NOT FOUND AND o=v.uploaded_by THEN r:='owner';END IF;
 IF r='owner'AND o IS DISTINCT FROM v.uploaded_by THEN r:='viewer';END IF;
 IF coalesce(r,'')NOT IN('owner','admin','editor')THEN RAISE EXCEPTION 'upload_permission_changed' USING errcode='42501';END IF;
 -- Explicit upload_begin replay is the only path to grant or renew a session. No service renewal.
 SELECT * INTO g FROM zoi.document_upload_authority_grants WHERE version_id=p_version ORDER BY grant_no DESC LIMIT 1;
 IF g.grant_no IS NULL OR g.workspace_id IS DISTINCT FROM v.workspace_id OR g.actor_profile_id IS DISTINCT FROM v.uploaded_by THEN RAISE EXCEPTION 'upload_authority_resume_required' USING errcode='42501';END IF;
 PERFORM 1 FROM auth.users WHERE id=g.account_id AND deleted_at IS NULL AND NOT coalesce(is_anonymous,false)AND(banned_until IS NULL OR banned_until<=clock_timestamp())FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'upload_session_unavailable' USING errcode='42501';END IF;
 PERFORM 1 FROM auth.sessions WHERE id=g.session_id AND user_id=g.account_id AND(not_after IS NULL OR not_after>clock_timestamp())FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'upload_session_unavailable' USING errcode='42501';END IF;
 PERFORM 1 FROM zoi.user_profiles WHERE id=v.uploaded_by AND auth_user_id=g.account_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'upload_permission_changed' USING errcode='42501';END IF;
END $fn$;
ALTER FUNCTION zoi.document_upload_completion_authority(uuid)OWNER TO postgres;REVOKE ALL ON FUNCTION zoi.document_upload_completion_authority(uuid)FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION zoi.document_upload_complete(p_version uuid,p_verified_sha256 text)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v zoi.document_versions;doc zoi.workspace_documents;meta jsonb;
BEGIN
 PERFORM zoi.document_upload_completion_authority(p_version);
 SELECT * INTO v FROM zoi.document_versions WHERE id=p_version;
 PERFORM 1 FROM zoi.ops_records WHERE id=(SELECT project_id FROM zoi.workspace_documents WHERE id=v.document_id)AND workspace_id=v.workspace_id AND kind='project'AND archived_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'upload_permission_changed' USING errcode='42501';END IF;
 SELECT * INTO doc FROM zoi.workspace_documents WHERE id=v.document_id AND workspace_id=v.workspace_id FOR UPDATE;
 SELECT * INTO v FROM zoi.document_versions WHERE id=p_version FOR UPDATE;
 IF doc.id IS NULL OR doc.archived_at IS NOT NULL OR v.state NOT IN('pending','ready')THEN RAISE EXCEPTION 'upload_state_conflict';END IF;
 IF p_verified_sha256 IS NOT NULL AND(p_verified_sha256 !~'^[a-f0-9]{64}$'OR p_verified_sha256 IS DISTINCT FROM v.sha256)THEN RAISE EXCEPTION 'uploaded_object_hash_mismatch';END IF;
 IF v.state='pending'AND doc.current_version IS DISTINCT FROM v.expected_current_version THEN RAISE EXCEPTION 'upload_state_conflict';END IF;
 PERFORM 1 FROM storage.buckets WHERE id='workspace-documents'AND type='STANDARD'AND public=false AND(file_size_limit IS NULL OR file_size_limit>=v.size_bytes)AND(allowed_mime_types IS NULL OR v.mime_type=ANY(allowed_mime_types))FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'upload_storage_policy_changed';END IF;
 SELECT metadata INTO meta FROM storage.objects WHERE bucket_id='workspace-documents'AND name=v.object_path AND coalesce(is_delete_marker,false)=false AND archived_at IS NULL FOR SHARE;
 IF meta IS NULL OR(meta->>'size')::bigint IS DISTINCT FROM v.size_bytes::bigint OR meta->>'mimetype'IS DISTINCT FROM v.mime_type THEN RAISE EXCEPTION 'uploaded_object_mismatch';END IF;
 IF v.state='ready'THEN
  PERFORM zoi.document_upload_completion_authority(p_version);
  RETURN jsonb_build_object('ok',true,'document',to_jsonb(doc),'version',to_jsonb(v),'content_verified',p_verified_sha256 IS NOT NULL);
 END IF;
 PERFORM zoi.document_upload_completion_authority(p_version);
 UPDATE zoi.document_versions SET state='ready',finished_at=clock_timestamp()WHERE id=v.id RETURNING * INTO v;
 UPDATE zoi.workspace_documents SET current_version=v.version,updated_at=clock_timestamp()WHERE id=doc.id RETURNING * INTO doc;
 INSERT INTO zoi.document_audit(workspace_id,document_id,version_id,actor_profile_id,action)VALUES(v.workspace_id,doc.id,v.id,v.uploaded_by,'uploaded');
 PERFORM zoi.document_upload_completion_authority(p_version);
 RETURN jsonb_build_object('ok',true,'document',to_jsonb(doc),'version',to_jsonb(v),'content_verified',p_verified_sha256 IS NOT NULL);
END $fn$;
ALTER FUNCTION zoi.document_upload_complete(uuid,text)OWNER TO postgres;REVOKE ALL ON FUNCTION zoi.document_upload_complete(uuid,text)FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.document_upload_finish_verified(p_version uuid,p_sha256 text)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$BEGIN
 IF p_sha256 IS NULL OR p_sha256 !~'^[a-f0-9]{64}$'THEN RAISE EXCEPTION 'uploaded_object_hash_required';END IF;
 RETURN zoi.document_upload_complete(p_version,p_sha256);
END $fn$;
ALTER FUNCTION public.document_upload_finish_verified(uuid,text)OWNER TO postgres;REVOKE ALL ON FUNCTION public.document_upload_finish_verified(uuid,text)FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.document_upload_finish_verified(uuid,text)TO service_role;
CREATE OR REPLACE FUNCTION public.document_upload_finish(p_version uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$BEGIN
 -- Compatibility phase A only: authority-checked metadata finalization, never marked byte verified.
 RETURN zoi.document_upload_complete(p_version,NULL);
END $fn$;
CREATE OR REPLACE FUNCTION public.document_upload_begin(p_workspace uuid, p_project uuid, p_document uuid, p_expected_version integer, p_title text, p_request uuid, p_filename text, p_mime text, p_size integer, p_sha256 text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE authority_actor uuid; actor uuid;doc zoi.workspace_documents;v zoi.document_versions;suffix text;next_version integer;
BEGIN
 authority_actor:=zoi.company_document_upload_authority(p_workspace);
 actor:=zoi.document_actor(p_workspace);
 if p_request is null or p_size is null or p_size not between 1 and 10485760 or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or p_mime is null or p_mime not in ('application/pdf','text/plain','image/png','image/jpeg') or p_filename is null or length(p_filename) not between 1 and 180 or p_filename ~ '[[:cntrl:]/\\]' or p_title is null or length(btrim(p_title)) not between 1 and 160 then raise exception 'invalid_document_metadata';end if;
 suffix:=case p_mime when 'application/pdf' then 'pdf' when 'text/plain' then 'txt' when 'image/png' then 'png' else 'jpg' end;
 if lower(p_filename) !~ (case when p_mime='image/jpeg' then '\.(jpg|jpeg)$' else '\.'||suffix||'$' end) then raise exception 'filename_type_mismatch';end if;
 -- Actor lock serializes a repeated request ID even when a caller changes document IDs.
 perform 1 from zoi.user_profiles where id=actor for update;
 select * into v from zoi.document_versions where uploaded_by=actor and request_id=p_request;
 if v.id is not null then
  select * into doc from zoi.workspace_documents where id=v.document_id;
  if v.workspace_id is distinct from p_workspace or v.sha256 is distinct from p_sha256 or v.size_bytes is distinct from p_size or v.mime_type is distinct from p_mime or doc.project_id is distinct from p_project or v.requested_document_id is distinct from p_document or v.expected_current_version is distinct from p_expected_version or v.filename is distinct from p_filename or v.request_title is distinct from btrim(p_title) then raise exception 'document_request_conflict';end if;
  if doc.archived_at is not null then raise exception 'document_archived';end if;
  if v.state not in ('pending','ready') then raise exception 'upload_request_closed';end if;
  PERFORM zoi.document_upload_bind_authority(v.id,actor); PERFORM zoi.company_document_authority(p_workspace,'document_read',authority_actor,true); RETURN jsonb_build_object('ok',true,'document',to_jsonb(doc),'upload',to_jsonb(v));
 end if;
 perform 1 from zoi.ops_records where id=p_project and workspace_id=p_workspace and kind='project' and archived_at is null for share;
 if not found then raise exception 'active_project_required';end if;
 if p_document is null then
  if p_expected_version is distinct from 0 then raise exception 'version_conflict';end if;
  insert into zoi.workspace_documents(workspace_id,project_id,title,created_by) values(p_workspace,p_project,btrim(p_title),actor) returning * into doc;
 else
  select * into doc from zoi.workspace_documents where id=p_document and workspace_id=p_workspace for update;
  if doc.id is null or doc.project_id<>p_project then raise exception 'document_unavailable';end if;
  if doc.archived_at is not null then raise exception 'document_archived';end if;
  if doc.current_version is distinct from p_expected_version then raise exception 'version_conflict';end if;
 end if;
 if exists(select 1 from zoi.document_versions where document_id=doc.id and state in ('pending','cleanup')) then raise exception 'document_upload_in_progress';end if;
 select coalesce(max(version),0)+1 into next_version from zoi.document_versions where document_id=doc.id;
 v.id:=gen_random_uuid();
 insert into zoi.document_versions(id,document_id,workspace_id,version,expected_current_version,request_id,requested_document_id,request_title,uploaded_by,filename,mime_type,size_bytes,sha256,object_path)
 values(v.id,doc.id,p_workspace,next_version,doc.current_version,p_request,p_document,btrim(p_title),actor,p_filename,p_mime,p_size,p_sha256,p_workspace::text||'/'||doc.id::text||'/'||v.id::text||'.'||suffix) returning * into v;
 insert into zoi.document_audit(workspace_id,document_id,version_id,actor_profile_id,action) values(p_workspace,doc.id,v.id,actor,'upload_reserved');
 PERFORM zoi.document_upload_bind_authority(v.id,actor); PERFORM zoi.company_document_authority(p_workspace,'document_read',authority_actor,true); RETURN jsonb_build_object('ok',true,'document',to_jsonb(doc),'upload',to_jsonb(v));
end $function$;
COMMIT;

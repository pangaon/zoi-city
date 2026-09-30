-- Workspace roles confirmed live 2026-09-30: owner/admin/editor/viewer.
-- Editor is the staff capability; company administration stays owner/admin.
-- Company information is user-maintained records, not filing/legal services.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE zoi.ops_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('company','contact','project','task')),
 title text NOT NULL CHECK(char_length(title) BETWEEN 1 AND 200),
 data jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(data)='object'),
 company_id uuid, project_id uuid, contact_id uuid,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','blocked','completed')),
 due_at timestamptz, assignee_profile_id uuid,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz,
 UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,company_id) REFERENCES zoi.ops_records(workspace_id,id),
 FOREIGN KEY(workspace_id,project_id) REFERENCES zoi.ops_records(workspace_id,id),
 FOREIGN KEY(workspace_id,contact_id) REFERENCES zoi.ops_records(workspace_id,id)
);
CREATE INDEX ops_records_workspace_kind_idx ON zoi.ops_records(workspace_id,kind,updated_at DESC);
CREATE INDEX ops_records_deadline_idx ON zoi.ops_records(workspace_id,due_at) WHERE archived_at IS NULL AND status<>'completed';
CREATE TABLE zoi.ops_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id) ON DELETE CASCADE,
 record_id uuid NOT NULL REFERENCES zoi.ops_records(id),actor_profile_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN ('created','updated','archived')),
 version integer NOT NULL,before_data jsonb,after_data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ops_audit_workspace_created_idx ON zoi.ops_audit(workspace_id,created_at DESC);
CREATE INDEX ops_audit_record_created_idx ON zoi.ops_audit(record_id,created_at DESC);
CREATE FUNCTION zoi.ops_role(p_workspace uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT wm.role FROM zoi.workspace_members wm JOIN zoi.user_profiles up ON up.id=wm.profile_id
 WHERE wm.workspace_id=p_workspace AND up.auth_user_id=auth.uid(); $$;
REVOKE ALL ON FUNCTION zoi.ops_role(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION zoi.ops_role(uuid) TO authenticated;
ALTER TABLE zoi.ops_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoi.ops_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.ops_records,zoi.ops_audit FROM PUBLIC,anon,authenticated;
-- No direct writes are granted: all changes must pass version checks and audit.
GRANT SELECT ON zoi.ops_records,zoi.ops_audit TO authenticated;
CREATE POLICY ops_records_member_read ON zoi.ops_records FOR SELECT TO authenticated USING(zoi.ops_role(workspace_id) IS NOT NULL);
CREATE POLICY ops_audit_member_read ON zoi.ops_audit FOR SELECT TO authenticated USING(zoi.ops_role(workspace_id) IS NOT NULL);

CREATE FUNCTION public.ops_records_list(p_workspace uuid,p_kind text DEFAULT NULL,p_include_archived boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE role_name text; records jsonb; members jsonb;
BEGIN
 role_name:=zoi.ops_role(p_workspace);
 IF auth.uid() IS NULL OR role_name IS NULL THEN RAISE EXCEPTION 'not_authorized'; END IF;
 IF p_kind IS NOT NULL AND p_kind NOT IN ('company','contact','project','task') THEN RAISE EXCEPTION 'invalid_kind'; END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.updated_at DESC),'[]') INTO records FROM zoi.ops_records r
 WHERE r.workspace_id=p_workspace AND (p_kind IS NULL OR r.kind=p_kind) AND (p_include_archived OR r.archived_at IS NULL);
 SELECT COALESCE(jsonb_agg(jsonb_build_object('profile_id',wm.profile_id,'display_name',COALESCE(up.display_name,'Team member'),'role',wm.role)),'[]') INTO members FROM zoi.workspace_members wm JOIN zoi.user_profiles up ON up.id=wm.profile_id WHERE wm.workspace_id=p_workspace;
 RETURN jsonb_build_object('ok',true,'role',role_name,'records',records,'members',members);
END; $$;
REVOKE ALL ON FUNCTION public.ops_records_list(uuid,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_records_list(uuid,text,boolean) TO authenticated;

CREATE FUNCTION public.ops_record_save(p_workspace uuid,p_kind text,p_data jsonb,p_id uuid DEFAULT NULL,p_expected_version integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE role_name text; actor uuid; prior zoi.ops_records; saved zoi.ops_records; details jsonb;
 company uuid; project uuid; contact uuid; assignee uuid; title_value text; status_value text; deadline timestamptz;
BEGIN
 role_name:=zoi.ops_role(p_workspace);
 IF auth.uid() IS NULL OR role_name IS NULL THEN RAISE EXCEPTION 'not_authorized'; END IF;
 IF role_name NOT IN ('owner','admin','editor') OR (p_kind='company' AND role_name NOT IN ('owner','admin')) THEN RAISE EXCEPTION 'insufficient_permission'; END IF;
 IF p_kind IS NULL OR p_kind NOT IN ('company','contact','project','task') OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_record'; END IF;
 SELECT id INTO actor FROM zoi.user_profiles WHERE auth_user_id=auth.uid();
 title_value:=btrim(COALESCE(p_data->>'title',''));
 IF char_length(title_value) NOT BETWEEN 1 AND 200 OR octet_length(p_data::text)>30000 THEN RAISE EXCEPTION 'invalid_record'; END IF;
 status_value:=COALESCE(NULLIF(p_data->>'status',''),'open');
 IF status_value NOT IN ('open','in_progress','blocked','completed') THEN RAISE EXCEPTION 'invalid_status'; END IF;
 BEGIN
  company:=NULLIF(p_data->>'company_id','')::uuid;project:=NULLIF(p_data->>'project_id','')::uuid;
  contact:=NULLIF(p_data->>'contact_id','')::uuid;assignee:=NULLIF(p_data->>'assignee_profile_id','')::uuid;
  deadline:=NULLIF(p_data->>'due_at','')::timestamptz;
 EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'invalid_record'; END;
 IF p_kind='company' AND (company IS NOT NULL OR project IS NOT NULL OR contact IS NOT NULL) THEN RAISE EXCEPTION 'invalid_parent'; END IF;
 IF p_kind IN ('contact','project') AND project IS NOT NULL THEN RAISE EXCEPTION 'invalid_parent'; END IF;
 IF p_kind='contact' AND contact IS NOT NULL THEN RAISE EXCEPTION 'invalid_parent'; END IF;
 IF p_kind='task' AND project IS NULL THEN RAISE EXCEPTION 'project_required'; END IF;
 IF p_kind='project' AND company IS NULL THEN RAISE EXCEPTION 'company_required'; END IF;
 -- Lock referenced rows so an archive cannot race link validation.
 IF company IS NOT NULL THEN
  PERFORM 1 FROM zoi.ops_records WHERE id=company AND workspace_id=p_workspace AND kind='company' AND archived_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'cross_workspace_link'; END IF;
 END IF;
 IF project IS NOT NULL THEN
  SELECT company_id INTO company FROM zoi.ops_records WHERE id=project AND workspace_id=p_workspace AND kind='project' AND archived_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'cross_workspace_link'; END IF;
 END IF;
 IF contact IS NOT NULL THEN
  PERFORM 1 FROM zoi.ops_records WHERE id=contact AND workspace_id=p_workspace AND kind='contact' AND archived_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'cross_workspace_link'; END IF;
 END IF;
 IF assignee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM zoi.workspace_members WHERE workspace_id=p_workspace AND profile_id=assignee) THEN RAISE EXCEPTION 'invalid_assignee'; END IF;
 details:=jsonb_build_object('notes',COALESCE(p_data->>'notes',''),'sector',COALESCE(p_data->>'sector','business'),
 'legal_name',COALESCE(p_data->>'legal_name',''),'jurisdiction',COALESCE(p_data->>'jurisdiction',''),
 'registration_number',COALESCE(p_data->>'registration_number',''),'website',COALESCE(p_data->>'website',''),
 'email',COALESCE(p_data->>'email',''),'phone',COALESCE(p_data->>'phone',''));
 IF details->>'sector' NOT IN ('business','lawyer','church','restaurant','stylist','creator') THEN RAISE EXCEPTION 'invalid_sector'; END IF;
 IF p_id IS NULL THEN
  IF p_expected_version IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'version_conflict'; END IF;
  INSERT INTO zoi.ops_records(workspace_id,kind,title,data,company_id,project_id,contact_id,status,due_at,assignee_profile_id)
  VALUES(p_workspace,p_kind,title_value,details,company,project,contact,status_value,deadline,assignee) RETURNING * INTO saved;
 ELSE
  SELECT * INTO prior FROM zoi.ops_records WHERE id=p_id AND workspace_id=p_workspace AND kind=p_kind FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'record_not_found'; END IF;
  IF prior.archived_at IS NOT NULL THEN RAISE EXCEPTION 'record_archived'; END IF;
  IF p_expected_version IS NULL OR prior.version<>p_expected_version THEN RAISE EXCEPTION 'version_conflict'; END IF;
  IF p_kind='project' AND prior.company_id IS DISTINCT FROM company AND EXISTS(SELECT 1 FROM zoi.ops_records WHERE workspace_id=p_workspace AND project_id=p_id AND archived_at IS NULL) THEN RAISE EXCEPTION 'project_has_tasks_cannot_move_company'; END IF;
  UPDATE zoi.ops_records SET title=title_value,data=details,company_id=company,project_id=project,contact_id=contact,
    status=status_value,due_at=deadline,assignee_profile_id=assignee,version=version+1,updated_at=now()
  WHERE id=p_id RETURNING * INTO saved;
 END IF;
 INSERT INTO zoi.ops_audit(workspace_id,record_id,actor_profile_id,action,version,before_data,after_data)
 VALUES(p_workspace,saved.id,actor,CASE WHEN p_id IS NULL THEN 'created' ELSE 'updated' END,saved.version,
 CASE WHEN p_id IS NULL THEN NULL ELSE to_jsonb(prior) END,to_jsonb(saved));
 RETURN jsonb_build_object('ok',true,'record',to_jsonb(saved));
END; $$;
REVOKE ALL ON FUNCTION public.ops_record_save(uuid,text,jsonb,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_record_save(uuid,text,jsonb,uuid,integer) TO authenticated;

CREATE FUNCTION public.ops_record_archive(p_workspace uuid,p_id uuid,p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE prior zoi.ops_records; saved zoi.ops_records; actor uuid; role_name text;
BEGIN
 role_name:=zoi.ops_role(p_workspace);
 IF auth.uid() IS NULL OR role_name IS NULL THEN RAISE EXCEPTION 'not_authorized'; END IF;
 IF role_name NOT IN ('owner','admin') THEN RAISE EXCEPTION 'insufficient_permission'; END IF;
 SELECT id INTO actor FROM zoi.user_profiles WHERE auth_user_id=auth.uid();
 SELECT * INTO prior FROM zoi.ops_records WHERE id=p_id AND workspace_id=p_workspace FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'record_not_found'; END IF;
 IF p_expected_version IS NULL OR prior.version<>p_expected_version THEN RAISE EXCEPTION 'version_conflict'; END IF;
 IF prior.archived_at IS NOT NULL THEN RAISE EXCEPTION 'record_archived'; END IF;
 IF EXISTS(SELECT 1 FROM zoi.ops_records WHERE workspace_id=p_workspace AND archived_at IS NULL AND (company_id=p_id OR project_id=p_id OR contact_id=p_id)) THEN RAISE EXCEPTION 'record_has_active_dependents'; END IF;
 UPDATE zoi.ops_records SET archived_at=now(),version=version+1,updated_at=now() WHERE id=p_id RETURNING * INTO saved;
 INSERT INTO zoi.ops_audit(workspace_id,record_id,actor_profile_id,action,version,before_data,after_data)
 VALUES(p_workspace,p_id,actor,'archived',saved.version,to_jsonb(prior),to_jsonb(saved));
 RETURN jsonb_build_object('ok',true,'record',to_jsonb(saved));
END; $$;
REVOKE ALL ON FUNCTION public.ops_record_archive(uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_record_archive(uuid,uuid,integer) TO authenticated;

CREATE FUNCTION public.ops_audit_list(p_workspace uuid,p_record uuid DEFAULT NULL,p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE events jsonb;
BEGIN
 IF auth.uid() IS NULL OR zoi.ops_role(p_workspace) IS NULL THEN RAISE EXCEPTION 'not_authorized'; END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC),'[]') INTO events FROM (
 SELECT * FROM zoi.ops_audit WHERE workspace_id=p_workspace AND (p_record IS NULL OR record_id=p_record)
 ORDER BY created_at DESC LIMIT greatest(least(p_limit,200),1)) a;
 RETURN jsonb_build_object('ok',true,'events',events);
END; $$;
REVOKE ALL ON FUNCTION public.ops_audit_list(uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_audit_list(uuid,uuid,integer) TO authenticated;
COMMIT;

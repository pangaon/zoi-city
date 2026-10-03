-- Draft Company/Operations and private-document session authority candidate. No live writes applied.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
CREATE TEMP TABLE company_authority_expected(signature text PRIMARY KEY,definition_hash text NOT NULL,acl text NOT NULL) ON COMMIT DROP;
INSERT INTO company_authority_expected VALUES
('public.document_archive(uuid,uuid,integer)','0043aa3f5ceac24e338b9c8ba8e2317f','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.document_cleanup_finish(uuid)','a1084b0420e5481ed442a28119e1f4a8','{postgres=X/postgres,service_role=X/postgres}'),
('public.document_cleanup_prepare(uuid,uuid)','32967a8364fd8d1957f60e8fa8786316','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.document_download_authorize(uuid,uuid)','f7f1d06451f6aa6e1aea15667d1c13c4','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.document_history(uuid,uuid)','db604c7320477b0f365d4dabfdf444e3','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.document_upload_begin(uuid,uuid,uuid,integer,text,uuid,text,text,integer,text)','428f18d82346885d4d528e0b3951cf13','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.document_upload_finish(uuid)','aa9ec3b83677ca92931a5625fae0cd66','{postgres=X/postgres,service_role=X/postgres}'),
('public.documents_list(uuid,uuid)','0b3c9ac4b1c9d06ef766f82e865b4685','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.ops_audit_list(uuid,uuid,integer)','36a1a671e336f64db2b728463a0ab96f','{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'),
('public.ops_mutation_execute(uuid,uuid,text,jsonb)','e726a6ebbd1d5806ef0b205658733bcb','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.ops_record_archive(uuid,uuid,integer)','6ab05dddd0db62baabf8d1d2e324cf34','{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'),
('public.ops_record_save(uuid,text,jsonb,uuid,integer)','7430f92b2de1c9275dce53fe3c42e505','{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'),
('public.ops_records_list(uuid,text,boolean)','82044bcfccaa6f8ab41de65335465ad6','{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'),
('public.ops_request_status(uuid,uuid,boolean)','1b17b0be678e0ce36d7bdf22c12758aa','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('zoi.document_actor(uuid,boolean)','f3e73deb0de227b63fa0922ee7f9ad41','{postgres=X/postgres}'),
('zoi.ops_receipt_value(zoi.ops_mutation_receipts)','e6f20d09f61fd6004c9377b94d203c6e','{postgres=X/postgres}'),
('zoi.ops_role(uuid)','d706cb4e4c100718d522863f80e0e71c','{postgres=X/postgres,authenticated=X/postgres}'),
('zoi.suite_current_session()','8ceef7877aeb972d09d8694f6c85dff7','{postgres=X/postgres}'),
('zoi.suite_lock_session()','04328c4d98e5f5671777a88435870c58','{postgres=X/postgres}');
DO $guard$ DECLARE x record;p pg_proc;BEGIN
 IF to_regprocedure('zoi.company_document_authority(uuid,text,uuid,boolean)') IS NOT NULL OR to_regprocedure('zoi.company_session_readable()') IS NOT NULL THEN RAISE EXCEPTION 'company_authority_candidate_already_exists';END IF;
 FOR x IN SELECT * FROM company_authority_expected LOOP SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(x.signature);
 IF p.oid IS NULL OR md5(pg_get_functiondef(p.oid)) IS DISTINCT FROM x.definition_hash OR pg_get_userbyid(p.proowner) IS DISTINCT FROM 'postgres' OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[] OR p.proacl::text IS DISTINCT FROM x.acl THEN RAISE EXCEPTION 'company_authority_preflight_changed: %',x.signature;END IF;END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='zoi' AND tablename='ops_audit' AND policyname='ops_audit_member_read' AND roles::text='{authenticated}' AND permissive='PERMISSIVE' AND cmd='SELECT' AND qual='(zoi.ops_role(workspace_id) IS NOT NULL)' AND with_check IS NULL) THEN RAISE EXCEPTION 'company_authority_policy_changed: ops_audit_member_read';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='zoi' AND tablename='ops_records' AND policyname='ops_records_member_read' AND roles::text='{authenticated}' AND permissive='PERMISSIVE' AND cmd='SELECT' AND qual='(zoi.ops_role(workspace_id) IS NOT NULL)' AND with_check IS NULL) THEN RAISE EXCEPTION 'company_authority_policy_changed: ops_records_member_read';END IF;
 IF (SELECT count(*)=6 AND bool_and(c.relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='zoi' AND c.relname IN('ops_records','ops_audit','ops_mutation_receipts','workspace_documents','document_versions','document_audit')) IS DISTINCT FROM true THEN RAISE EXCEPTION 'company_authority_rls_changed';END IF;
END $guard$;
CREATE FUNCTION zoi.company_document_authority(p_workspace uuid,p_permission text,p_expected_actor uuid DEFAULT NULL,p_lock boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE actor uuid;role_name text;
BEGIN
 IF p_permission IS NULL OR p_permission NOT IN('ops_read','ops_write','ops_manage','document_read','document_manage') THEN RAISE EXCEPTION 'invalid_company_authority';END IF;
 IF p_lock THEN PERFORM zoi.suite_lock_session();ELSE PERFORM zoi.suite_current_session();END IF;
 IF p_lock THEN
  SELECT up.id,wm.role INTO actor,role_name FROM zoi.user_profiles up JOIN zoi.workspace_members wm ON wm.profile_id=up.id WHERE up.auth_user_id=auth.uid() AND wm.workspace_id=p_workspace FOR SHARE OF up,wm;
 ELSE
  SELECT up.id,wm.role INTO actor,role_name FROM zoi.user_profiles up JOIN zoi.workspace_members wm ON wm.profile_id=up.id WHERE up.auth_user_id=auth.uid() AND wm.workspace_id=p_workspace;
 END IF;
 IF actor IS NULL OR role_name IS NULL OR (p_expected_actor IS NOT NULL AND actor IS DISTINCT FROM p_expected_actor)
 OR (p_permission IN('ops_write','document_read') AND role_name NOT IN('owner','admin','editor'))
 OR (p_permission IN('ops_manage','document_manage') AND role_name NOT IN('owner','admin')) THEN RAISE EXCEPTION 'company_permission_denied' USING ERRCODE='42501';END IF;
 -- Membership/profile locks may themselves wait past a not_after deadline.
 PERFORM zoi.suite_current_session();
 RETURN actor;
END $function$;
ALTER FUNCTION zoi.company_document_authority(uuid,text,uuid,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.company_document_authority(uuid,text,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION zoi.company_session_readable() RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $function$
BEGIN PERFORM zoi.suite_current_session();RETURN true;EXCEPTION WHEN insufficient_privilege THEN RETURN false;END $function$;
ALTER FUNCTION zoi.company_session_readable() OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.company_session_readable() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION zoi.company_session_readable() TO authenticated;
CREATE OR REPLACE FUNCTION public.ops_records_list(p_workspace uuid, p_kind text DEFAULT NULL::text, p_include_archived boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE authority_actor uuid; role_name text; records jsonb; members jsonb;
BEGIN
 authority_actor:=zoi.company_document_authority(p_workspace,'ops_read',NULL,false);
 role_name:=zoi.ops_role(p_workspace);
 IF auth.uid() IS NULL OR role_name IS NULL THEN RAISE EXCEPTION 'not_authorized'; END IF;
 IF p_kind IS NOT NULL AND p_kind NOT IN ('company','contact','project','task') THEN RAISE EXCEPTION 'invalid_kind'; END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.updated_at DESC),'[]') INTO records FROM zoi.ops_records r
 WHERE r.workspace_id=p_workspace AND (p_kind IS NULL OR r.kind=p_kind) AND (p_include_archived OR r.archived_at IS NULL);
 SELECT COALESCE(jsonb_agg(jsonb_build_object('profile_id',wm.profile_id,'display_name',COALESCE(up.display_name,'Team member'),'role',wm.role)),'[]') INTO members FROM zoi.workspace_members wm JOIN zoi.user_profiles up ON up.id=wm.profile_id WHERE wm.workspace_id=p_workspace;
 PERFORM zoi.company_document_authority(p_workspace,'ops_read',authority_actor,true); role_name:=zoi.ops_role(p_workspace); RETURN jsonb_build_object('ok',true,'role',role_name,'records',records,'members',members);
END; $function$
;

CREATE OR REPLACE FUNCTION public.ops_audit_list(p_workspace uuid, p_record uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE authority_actor uuid; events jsonb;
BEGIN
 authority_actor:=zoi.company_document_authority(p_workspace,'ops_read',NULL,false);
 IF auth.uid() IS NULL OR zoi.ops_role(p_workspace) IS NULL THEN RAISE EXCEPTION 'not_authorized'; END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC),'[]') INTO events FROM (
 SELECT * FROM zoi.ops_audit WHERE workspace_id=p_workspace AND (p_record IS NULL OR record_id=p_record)
 ORDER BY created_at DESC LIMIT greatest(least(p_limit,200),1)) a;
 PERFORM zoi.company_document_authority(p_workspace,'ops_read',authority_actor,true); RETURN jsonb_build_object('ok',true,'events',events);
END; $function$
;

CREATE OR REPLACE FUNCTION public.ops_record_save(p_workspace uuid, p_kind text, p_data jsonb, p_id uuid DEFAULT NULL::uuid, p_expected_version integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE authority_actor uuid; role_name text; actor uuid; prior zoi.ops_records; saved zoi.ops_records; details jsonb;
 company uuid; project uuid; contact uuid; assignee uuid; title_value text; status_value text; deadline timestamptz;
BEGIN
 authority_actor:=zoi.company_document_authority(p_workspace,CASE WHEN p_kind='company' THEN 'ops_manage' ELSE 'ops_write' END,NULL,false);
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
 IF assignee IS NOT NULL THEN PERFORM 1 FROM zoi.workspace_members WHERE workspace_id=p_workspace AND profile_id=assignee FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'invalid_assignee';END IF;END IF; PERFORM zoi.company_document_authority(p_workspace,CASE WHEN p_kind='company' THEN 'ops_manage' ELSE 'ops_write' END,authority_actor,true); RETURN jsonb_build_object('ok',true,'record',to_jsonb(saved));
END; $function$
;

CREATE OR REPLACE FUNCTION public.ops_record_archive(p_workspace uuid, p_id uuid, p_expected_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE authority_actor uuid; prior zoi.ops_records; saved zoi.ops_records; actor uuid; role_name text;
BEGIN
 authority_actor:=zoi.company_document_authority(p_workspace,'ops_manage',NULL,false);
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
 PERFORM zoi.company_document_authority(p_workspace,'ops_manage',authority_actor,true); RETURN jsonb_build_object('ok',true,'record',to_jsonb(saved));
END; $function$
;

CREATE OR REPLACE FUNCTION public.ops_mutation_execute(p_workspace uuid, p_request uuid, p_action text, p_args jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE authority_actor uuid; actor uuid;r zoi.ops_mutation_receipts;h bytea;result jsonb;record jsonb;role_name text;
BEGIN
 authority_actor:=zoi.company_document_authority(p_workspace,CASE WHEN p_action='archive' OR (p_action='save' AND p_args->>'p_kind'='company') THEN 'ops_manage' ELSE 'ops_write' END,NULL,false);
 select id into actor from zoi.user_profiles where auth_user_id=auth.uid();role_name:=zoi.ops_role(p_workspace);
 if auth.uid() is null or actor is null or coalesce(role_name,'') not in('owner','admin','editor') then raise exception 'ops_permission_denied' using errcode='42501';end if;
 if p_request is null or p_action is null or p_action not in('save','archive') or jsonb_typeof(p_args) is distinct from 'object' or octet_length(p_args::text)>32000 then raise exception 'invalid_ops_request';end if;
 if exists(select 1 from jsonb_object_keys(p_args) as keys(k) where k<>all(case when p_action='save' then array['p_kind','p_data','p_id','p_expected_version'] else array['p_id','p_expected_version'] end)) then raise exception 'invalid_ops_request';end if;
 h:=sha256(convert_to(p_args::text,'UTF8'));
 perform pg_advisory_xact_lock(hashtextextended('ops-request:'||actor::text||':'||p_request::text,0));
 select * into r from zoi.ops_mutation_receipts where actor_id=actor and request_id=p_request;
 if found then
  if r.workspace_id is distinct from p_workspace then raise exception 'ops_request_conflict';end if;
  if r.state='cancelled' then raise exception 'ops_request_cancelled';end if;
  if r.action is distinct from p_action or r.args_hash is distinct from h then raise exception 'ops_request_conflict';end if;
  PERFORM zoi.company_document_authority(p_workspace,CASE WHEN p_action='archive' OR (p_action='save' AND p_args->>'p_kind'='company') THEN 'ops_manage' ELSE 'ops_write' END,authority_actor,true); RETURN zoi.ops_receipt_value(r);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('ops-actor:'||actor::text,0));
 if (select count(*) from zoi.ops_mutation_receipts where actor_id=actor and created_at>clock_timestamp()-interval '24 hours')>=500 then raise exception 'ops_request_limit';end if;
 if p_action='save' then result:=public.ops_record_save(p_workspace,p_args->>'p_kind',p_args->'p_data',(p_args->>'p_id')::uuid,(p_args->>'p_expected_version')::integer);
 else result:=public.ops_record_archive(p_workspace,(p_args->>'p_id')::uuid,(p_args->>'p_expected_version')::integer);end if;
 record:=result->'record';
 if (result->>'ok')::boolean is distinct from true or record->>'id' is null or (record->>'workspace_id')::uuid is distinct from p_workspace then raise exception 'ops_unconfirmed';end if;
 insert into zoi.ops_mutation_receipts(actor_id,request_id,workspace_id,state,action,args_hash,record_id,kind,version) values(actor,p_request,p_workspace,'saved',p_action,h,(record->>'id')::uuid,record->>'kind',(record->>'version')::integer) returning * into r;
 PERFORM zoi.company_document_authority(p_workspace,CASE WHEN p_action='archive' OR (p_action='save' AND p_args->>'p_kind'='company') THEN 'ops_manage' ELSE 'ops_write' END,authority_actor,true); RETURN zoi.ops_receipt_value(r);
end $function$
;

CREATE OR REPLACE FUNCTION public.ops_request_status(p_workspace uuid, p_request uuid, p_cancel_if_missing boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE authority_actor uuid; actor uuid;r zoi.ops_mutation_receipts;
BEGIN
 authority_actor:=zoi.company_document_authority(p_workspace,'ops_write',NULL,false);
 select id into actor from zoi.user_profiles where auth_user_id=auth.uid();
 if auth.uid() is null or actor is null or coalesce(zoi.ops_role(p_workspace),'') not in('owner','admin','editor') then raise exception 'ops_permission_denied' using errcode='42501';end if;
 if p_request is null then raise exception 'invalid_ops_request';end if;
 perform pg_advisory_xact_lock(hashtextextended('ops-request:'||actor::text||':'||p_request::text,0));
 select * into r from zoi.ops_mutation_receipts where actor_id=actor and request_id=p_request;
 if found then
  if r.workspace_id is distinct from p_workspace then raise exception 'ops_permission_denied' using errcode='42501';end if;
  PERFORM zoi.company_document_authority(p_workspace,'ops_write',authority_actor,true); RETURN zoi.ops_receipt_value(r);
 end if;
 if not coalesce(p_cancel_if_missing,false) then PERFORM zoi.company_document_authority(p_workspace,'ops_write',authority_actor,true); RETURN jsonb_build_object('ok',true,'state','missing','workspace_id',p_workspace,'request_id',p_request);end if;
 perform pg_advisory_xact_lock(hashtextextended('ops-actor:'||actor::text,0));
 if (select count(*) from zoi.ops_mutation_receipts where actor_id=actor and created_at>clock_timestamp()-interval '24 hours')>=500 then raise exception 'ops_request_limit';end if;
 insert into zoi.ops_mutation_receipts(actor_id,request_id,workspace_id,state) values(actor,p_request,p_workspace,'cancelled') returning * into r;
 PERFORM zoi.company_document_authority(p_workspace,'ops_write',authority_actor,true); RETURN zoi.ops_receipt_value(r);
end $function$
;

CREATE OR REPLACE FUNCTION public.documents_list(p_workspace uuid, p_project uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE authority_actor uuid; actor uuid;docs jsonb;projects jsonb;role text;
BEGIN
 authority_actor:=zoi.company_document_authority(p_workspace,'document_read',NULL,false);
 actor:=zoi.document_actor(p_workspace);select m.role into role from zoi.workspace_members m where workspace_id=p_workspace and profile_id=actor;
 select coalesce(jsonb_agg(to_jsonb(d) order by d.updated_at desc),'[]') into docs from(select d.*,v.id as current_version_id,v.filename,v.mime_type,v.size_bytes from zoi.workspace_documents d left join zoi.document_versions v on v.document_id=d.id and v.version=d.current_version and v.state='ready' where d.workspace_id=p_workspace and (p_project is null or d.project_id=p_project) order by d.updated_at desc limit 300)d;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title) order by title),'[]') into projects from zoi.ops_records where workspace_id=p_workspace and kind='project' and archived_at is null;
 PERFORM zoi.company_document_authority(p_workspace,'document_read',authority_actor,true); select m.role into role from zoi.workspace_members m where workspace_id=p_workspace and profile_id=authority_actor; RETURN jsonb_build_object('ok',true,'role',role,'documents',docs,'projects',projects);
end $function$
;

CREATE OR REPLACE FUNCTION public.document_history(p_workspace uuid, p_document uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE authority_actor uuid; doc zoi.workspace_documents;versions jsonb;audit jsonb;
BEGIN
 authority_actor:=zoi.company_document_authority(p_workspace,'document_read',NULL,false);
 perform zoi.document_actor(p_workspace);
 select * into doc from zoi.workspace_documents where id=p_document and workspace_id=p_workspace;
 if doc.id is null then raise exception 'document_unavailable';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',version,'filename',filename,'mime_type',mime_type,'size_bytes',size_bytes,'state',state,'uploaded_by',uploaded_by,'created_at',created_at,'finished_at',finished_at) order by version desc),'[]') into versions from (select * from zoi.document_versions where document_id=doc.id order by version desc limit 100) recent_versions;
 select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]') into audit from(select id,version_id,actor_profile_id,action,created_at from zoi.document_audit where document_id=doc.id order by created_at desc limit 100)a;
 PERFORM zoi.company_document_authority(p_workspace,'document_read',authority_actor,true); RETURN jsonb_build_object('ok',true,'document',to_jsonb(doc),'versions',versions,'audit',audit);
end $function$
;

CREATE OR REPLACE FUNCTION public.document_download_authorize(p_workspace uuid, p_version uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE authority_actor uuid; actor uuid;v zoi.document_versions;doc zoi.workspace_documents;
BEGIN
 authority_actor:=zoi.company_document_authority(p_workspace,'document_read',NULL,false);
 actor:=zoi.document_actor(p_workspace);
 select * into v from zoi.document_versions where id=p_version and workspace_id=p_workspace and state='ready';
 select * into doc from zoi.workspace_documents where id=v.document_id and archived_at is null;
 if v.id is null or doc.id is null then raise exception 'document_unavailable';end if;
 insert into zoi.document_audit(workspace_id,document_id,version_id,actor_profile_id,action) values(p_workspace,doc.id,v.id,actor,'download_requested');
 PERFORM zoi.company_document_authority(p_workspace,'document_read',authority_actor,true); RETURN jsonb_build_object('ok',true,'object_path',v.object_path,'filename',v.filename,'expires_in',60);
end $function$
;

CREATE OR REPLACE FUNCTION public.document_upload_begin(p_workspace uuid, p_project uuid, p_document uuid, p_expected_version integer, p_title text, p_request uuid, p_filename text, p_mime text, p_size integer, p_sha256 text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE authority_actor uuid; actor uuid;doc zoi.workspace_documents;v zoi.document_versions;suffix text;next_version integer;
BEGIN
 authority_actor:=zoi.company_document_authority(p_workspace,'document_read',NULL,false);
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
;

CREATE OR REPLACE FUNCTION public.document_archive(p_workspace uuid, p_document uuid, p_expected_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE authority_actor uuid; actor uuid;doc zoi.workspace_documents;
BEGIN
 authority_actor:=zoi.company_document_authority(p_workspace,'document_manage',NULL,false);
 actor:=zoi.document_actor(p_workspace,true);
 select * into doc from zoi.workspace_documents where id=p_document and workspace_id=p_workspace for update;
 if doc.id is null then raise exception 'document_unavailable';end if;
 if doc.archived_at is not null then PERFORM zoi.company_document_authority(p_workspace,'document_manage',authority_actor,true); RETURN jsonb_build_object('ok',true,'document',to_jsonb(doc));end if;
 if doc.current_version is distinct from p_expected_version then raise exception 'version_conflict';end if;
 if exists(select 1 from zoi.document_versions where document_id=doc.id and state in ('pending','cleanup')) then raise exception 'document_upload_in_progress';end if;
 update zoi.workspace_documents set archived_at=clock_timestamp(),updated_at=clock_timestamp() where id=doc.id returning * into doc;
 insert into zoi.document_audit(workspace_id,document_id,actor_profile_id,action) values(p_workspace,doc.id,actor,'archived');
 PERFORM zoi.company_document_authority(p_workspace,'document_manage',authority_actor,true); RETURN jsonb_build_object('ok',true,'document',to_jsonb(doc));
end $function$
;

CREATE OR REPLACE FUNCTION public.document_cleanup_prepare(p_workspace uuid, p_version uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE authority_actor uuid; actor uuid;v zoi.document_versions;doc zoi.workspace_documents;
BEGIN
 authority_actor:=zoi.company_document_authority(p_workspace,'document_manage',NULL,false);
 actor:=zoi.document_actor(p_workspace,true);
 select * into v from zoi.document_versions where id=p_version and workspace_id=p_workspace;
 select * into doc from zoi.workspace_documents where id=v.document_id for update;
 select * into v from zoi.document_versions where id=p_version and workspace_id=p_workspace for update;
 if v.id is null or v.state='ready' or v.created_at>clock_timestamp()-interval '15 minutes' then raise exception 'cleanup_not_allowed';end if;
 if v.state<>'cleanup' then
 update zoi.document_versions set state='cleanup',cleanup_by=actor where id=v.id returning * into v;
 insert into zoi.document_audit(workspace_id,document_id,version_id,actor_profile_id,action) values(p_workspace,doc.id,v.id,actor,'cleanup_started');
 end if;
 PERFORM zoi.company_document_authority(p_workspace,'document_manage',authority_actor,true); RETURN jsonb_build_object('ok',true,'object_path',v.object_path,'version_id',v.id);
end $function$
;

CREATE OR REPLACE FUNCTION zoi.document_actor(p_workspace uuid,p_manage boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$ BEGIN RETURN zoi.company_document_authority(p_workspace,CASE WHEN p_manage THEN 'document_manage' ELSE 'document_read' END,NULL,false);END $function$;;
ALTER POLICY ops_audit_member_read ON zoi.ops_audit USING (zoi.ops_role(workspace_id) IS NOT NULL AND zoi.company_session_readable());
ALTER POLICY ops_records_member_read ON zoi.ops_records USING (zoi.ops_role(workspace_id) IS NOT NULL AND zoi.company_session_readable());
DO $check$ DECLARE x record;p pg_proc;BEGIN
 FOR x IN SELECT * FROM company_authority_expected LOOP SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(x.signature);
 IF pg_get_userbyid(p.proowner) IS DISTINCT FROM 'postgres' OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[] OR p.proacl::text IS DISTINCT FROM x.acl THEN RAISE EXCEPTION 'company_authority_contract_changed: %',x.signature;END IF;END LOOP;
END $check$;
COMMIT;

-- Guardian enrollment recovery. Existing records and all legacy RPC signatures retained.
-- New clients must verify reader capability before writes/recovery. No messages or payments.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
DO $$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.youth_child_save(uuid,int,uuid,text,boolean)'::regprocedure) IS DISTINCT FROM '121025dd4fc2d4c5873d54503359ff26' THEN RAISE EXCEPTION 'youth_source_changed: youth_child_save'; END IF; END $$;
ALTER FUNCTION public.youth_child_save(uuid,int,uuid,text,boolean) SET SCHEMA zoi;
ALTER FUNCTION zoi.youth_child_save(uuid,int,uuid,text,boolean) RENAME TO youth_child_save_retained;
REVOKE ALL ON FUNCTION zoi.youth_child_save_retained(uuid,int,uuid,text,boolean) FROM public,anon,authenticated;
DO $$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.youth_program_save(uuid,uuid,int,uuid,jsonb)'::regprocedure) IS DISTINCT FROM '19741893b245b18d8d73c1fab641c985' THEN RAISE EXCEPTION 'youth_source_changed: youth_program_save'; END IF; END $$;
ALTER FUNCTION public.youth_program_save(uuid,uuid,int,uuid,jsonb) SET SCHEMA zoi;
ALTER FUNCTION zoi.youth_program_save(uuid,uuid,int,uuid,jsonb) RENAME TO youth_program_save_retained;
REVOKE ALL ON FUNCTION zoi.youth_program_save_retained(uuid,uuid,int,uuid,jsonb) FROM public,anon,authenticated;
DO $$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.youth_enrol(uuid,uuid,int,int,uuid,jsonb)'::regprocedure) IS DISTINCT FROM '7ed6443a4e98fad7928352b0a101d83b' THEN RAISE EXCEPTION 'youth_source_changed: youth_enrol'; END IF; END $$;
ALTER FUNCTION public.youth_enrol(uuid,uuid,int,int,uuid,jsonb) SET SCHEMA zoi;
ALTER FUNCTION zoi.youth_enrol(uuid,uuid,int,int,uuid,jsonb) RENAME TO youth_enrol_retained;
REVOKE ALL ON FUNCTION zoi.youth_enrol_retained(uuid,uuid,int,int,uuid,jsonb) FROM public,anon,authenticated;
DO $$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.youth_registration_decide(uuid,uuid,int,uuid,text)'::regprocedure) IS DISTINCT FROM '2d43c7afc5f040dc91902e020c8eb07d' THEN RAISE EXCEPTION 'youth_source_changed: youth_registration_decide'; END IF; END $$;
ALTER FUNCTION public.youth_registration_decide(uuid,uuid,int,uuid,text) SET SCHEMA zoi;
ALTER FUNCTION zoi.youth_registration_decide(uuid,uuid,int,uuid,text) RENAME TO youth_registration_decide_retained;
REVOKE ALL ON FUNCTION zoi.youth_registration_decide_retained(uuid,uuid,int,uuid,text) FROM public,anon,authenticated;
DO $$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.youth_withdraw(uuid,int,uuid)'::regprocedure) IS DISTINCT FROM 'e8789c1c748c374f03e5e33430f226b4' THEN RAISE EXCEPTION 'youth_source_changed: youth_withdraw'; END IF; END $$;
ALTER FUNCTION public.youth_withdraw(uuid,int,uuid) SET SCHEMA zoi;
ALTER FUNCTION zoi.youth_withdraw(uuid,int,uuid) RENAME TO youth_withdraw_retained;
REVOKE ALL ON FUNCTION zoi.youth_withdraw_retained(uuid,int,uuid) FROM public,anon,authenticated;
DO $$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.youth_staff_set(uuid,uuid,uuid,boolean,uuid)'::regprocedure) IS DISTINCT FROM '95899286b2113345c29cb25b89ccaf23' THEN RAISE EXCEPTION 'youth_source_changed: youth_staff_set'; END IF; END $$;
ALTER FUNCTION public.youth_staff_set(uuid,uuid,uuid,boolean,uuid) SET SCHEMA zoi;
ALTER FUNCTION zoi.youth_staff_set(uuid,uuid,uuid,boolean,uuid) RENAME TO youth_staff_set_retained;
REVOKE ALL ON FUNCTION zoi.youth_staff_set_retained(uuid,uuid,uuid,boolean,uuid) FROM public,anon,authenticated;
DO $$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.youth_class_link(uuid,uuid,uuid,boolean,uuid)'::regprocedure) IS DISTINCT FROM '7cb4d83c4ae0e2c991b36231f60b4ea6' THEN RAISE EXCEPTION 'youth_source_changed: youth_class_link'; END IF; END $$;
ALTER FUNCTION public.youth_class_link(uuid,uuid,uuid,boolean,uuid) SET SCHEMA zoi;
ALTER FUNCTION zoi.youth_class_link(uuid,uuid,uuid,boolean,uuid) RENAME TO youth_class_link_retained;
REVOKE ALL ON FUNCTION zoi.youth_class_link_retained(uuid,uuid,uuid,boolean,uuid) FROM public,anon,authenticated;
DO $$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.youth_attendance_set(uuid,uuid,uuid,int,uuid,text)'::regprocedure) IS DISTINCT FROM '4b103a00e88f6998a0a605b2f7ef799e' THEN RAISE EXCEPTION 'youth_source_changed: youth_attendance_set'; END IF; END $$;
ALTER FUNCTION public.youth_attendance_set(uuid,uuid,uuid,int,uuid,text) SET SCHEMA zoi;
ALTER FUNCTION zoi.youth_attendance_set(uuid,uuid,uuid,int,uuid,text) RENAME TO youth_attendance_set_retained;
REVOKE ALL ON FUNCTION zoi.youth_attendance_set_retained(uuid,uuid,uuid,int,uuid,text) FROM public,anon,authenticated;
DO $$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.youth_family()'::regprocedure) IS DISTINCT FROM 'fc11c2abb4c9aac02995804a9d362356' THEN RAISE EXCEPTION 'youth_source_changed: youth_family'; END IF; END $$;
ALTER FUNCTION public.youth_family() SET SCHEMA zoi;
ALTER FUNCTION zoi.youth_family() RENAME TO youth_family_retained;
REVOKE ALL ON FUNCTION zoi.youth_family_retained() FROM public,anon,authenticated;
DO $$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.youth_operator(uuid,uuid,int)'::regprocedure) IS DISTINCT FROM 'ca8185c920ffe0211501f00fbb09c890' THEN RAISE EXCEPTION 'youth_source_changed: youth_operator'; END IF; END $$;
ALTER FUNCTION public.youth_operator(uuid,uuid,int) SET SCHEMA zoi;
ALTER FUNCTION zoi.youth_operator(uuid,uuid,int) RENAME TO youth_operator_retained;
REVOKE ALL ON FUNCTION zoi.youth_operator_retained(uuid,uuid,int) FROM public,anon,authenticated;

-- The scope contains identifiers only. Null create IDs are significant.
CREATE FUNCTION zoi.youth_request_scope(p_operation text,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN
 RETURN CASE p_operation
 WHEN 'youth_child_save' THEN jsonb_build_object('id',p_payload->'id')
 WHEN 'youth_program_save' THEN jsonb_build_object('workspace',p_payload->'workspace','id',p_payload->'id','listing',p_payload->'data'->'listing_id')
 WHEN 'youth_enrol' THEN jsonb_build_object('program',p_payload->'program','child',p_payload->'child')
 WHEN 'youth_registration_decide' THEN jsonb_build_object('workspace',p_payload->'workspace','registration',p_payload->'registration')
 WHEN 'youth_withdraw' THEN jsonb_build_object('registration',p_payload->'registration')
 WHEN 'youth_staff_set' THEN jsonb_build_object('workspace',p_payload->'workspace','program',p_payload->'program','profile',p_payload->'profile')
 WHEN 'youth_class_link' THEN jsonb_build_object('workspace',p_payload->'workspace','program',p_payload->'program','event',p_payload->'event')
 WHEN 'youth_attendance_set' THEN jsonb_build_object('workspace',p_payload->'workspace','registration',p_payload->'registration','event',p_payload->'event')
 ELSE NULL END;
END $$;
CREATE FUNCTION zoi.youth_payload_operation(p_payload jsonb) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE p_payload->>'action' WHEN 'child_save' THEN 'youth_child_save' WHEN 'program_save' THEN 'youth_program_save' WHEN 'enrol' THEN 'youth_enrol' WHEN 'decide' THEN 'youth_registration_decide' WHEN 'withdraw' THEN 'youth_withdraw' WHEN 'staff' THEN 'youth_staff_set' WHEN 'class' THEN 'youth_class_link' WHEN 'attendance' THEN 'youth_attendance_set' END;
$$;
CREATE FUNCTION zoi.youth_operation_authorize(p_operation text,p_scope jsonb,p_recovery boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=zoi.org_actor();w uuid;listing uuid;program uuid;registration uuid;child uuid;r text;keys text[];k text;pr zoi.youth_programs;reg zoi.youth_registrations;
BEGIN
 PERFORM zoi.suite_current_session();
 IF actor IS NULL THEN RAISE EXCEPTION 'sign_in_required' USING ERRCODE='42501';END IF;
 keys:=CASE p_operation WHEN 'youth_child_save' THEN ARRAY['id'] WHEN 'youth_program_save' THEN ARRAY['workspace','id','listing'] WHEN 'youth_enrol' THEN ARRAY['program','child'] WHEN 'youth_registration_decide' THEN ARRAY['workspace','registration'] WHEN 'youth_withdraw' THEN ARRAY['registration'] WHEN 'youth_staff_set' THEN ARRAY['workspace','program','profile'] WHEN 'youth_class_link' THEN ARRAY['workspace','program','event'] WHEN 'youth_attendance_set' THEN ARRAY['workspace','registration','event'] END;
 IF keys IS NULL OR jsonb_typeof(p_scope) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(p_scope))<>cardinality(keys) THEN RAISE EXCEPTION 'invalid_youth_scope';END IF;
 FOREACH k IN ARRAY keys LOOP
  IF NOT p_scope ? k OR (k<>'id' AND p_scope->>k IS NULL) OR (p_scope->>k IS NOT NULL AND p_scope->>k !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') THEN RAISE EXCEPTION 'invalid_youth_scope';END IF;
 END LOOP;
 -- A single actor queue serializes old writer shapes with missing-request tombstones.
 PERFORM pg_advisory_xact_lock(hashtextextended('youth-operation:'||auth.uid()::text,0));
 w:=(p_scope->>'workspace')::uuid;program:=(p_scope->>'program')::uuid;registration:=(p_scope->>'registration')::uuid;
 IF registration IS NOT NULL THEN SELECT * INTO reg FROM zoi.youth_registrations WHERE id=registration;IF reg.id IS NULL THEN RAISE EXCEPTION 'registration_unavailable' USING ERRCODE='42501';END IF;program:=reg.program_id;END IF;
 IF p_operation='youth_program_save' THEN program:=(p_scope->>'id')::uuid;listing:=(p_scope->>'listing')::uuid;END IF;
 IF program IS NOT NULL THEN
  SELECT * INTO pr FROM zoi.youth_programs WHERE id=program;
  IF pr.id IS NULL OR (w IS NOT NULL AND pr.workspace_id IS DISTINCT FROM w) THEN RAISE EXCEPTION 'program_unavailable' USING ERRCODE='42501';END IF;
  w:=pr.workspace_id;listing:=pr.listing_id;
 END IF;
 IF w IS NOT NULL THEN
  -- Workspace first matches team/ownership writers, including guardian requests.
  PERFORM 1 FROM zoi.workspaces WHERE id=w FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;
  IF p_operation IN('youth_program_save','youth_registration_decide','youth_staff_set','youth_class_link','youth_attendance_set') THEN
   r:=zoi.workspace_locked_role(w);
   IF coalesce(r,'') NOT IN('owner','admin') AND NOT(p_operation='youth_attendance_set' AND coalesce(r,'')='editor') THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;
  END IF;
  PERFORM 1 FROM zoi.listings WHERE id=listing AND (owner_workspace_id=w OR p_operation='youth_withdraw' OR(p_recovery AND p_operation='youth_enrol')) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'owned_listing_required' USING ERRCODE='42501';END IF;
 END IF;
 IF program IS NOT NULL THEN
  PERFORM 1 FROM zoi.youth_programs WHERE id=program AND workspace_id=w AND listing_id=listing FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'program_unavailable' USING ERRCODE='42501';END IF;
  IF p_operation='youth_program_save' AND listing IS DISTINCT FROM (p_scope->>'listing')::uuid THEN RAISE EXCEPTION 'owned_listing_required' USING ERRCODE='42501';END IF;
  IF r='editor' THEN PERFORM 1 FROM zoi.youth_staff WHERE program_id=program AND profile_id=actor AND enabled FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;END IF;
 END IF;
 IF registration IS NOT NULL THEN
  SELECT * INTO reg FROM zoi.youth_registrations WHERE id=registration AND program_id=program FOR UPDATE;
  IF reg.id IS NULL OR(p_operation='youth_withdraw' AND reg.guardian_id IS DISTINCT FROM actor) THEN RAISE EXCEPTION 'registration_unavailable' USING ERRCODE='42501';END IF;
 END IF;
 child:=CASE WHEN p_operation='youth_child_save' THEN (p_scope->>'id')::uuid WHEN p_operation='youth_enrol' THEN (p_scope->>'child')::uuid END;
 IF child IS NOT NULL THEN PERFORM 1 FROM zoi.youth_children WHERE id=child AND guardian_id=actor FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'child_unavailable' USING ERRCODE='42501';END IF;END IF;
 PERFORM zoi.suite_lock_session();RETURN actor;
END $$;
CREATE FUNCTION zoi.youth_operation_begin(p_operation text,p_request uuid,p_scope jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;r zoi.youth_requests;
BEGIN
 IF p_request IS NULL THEN RAISE EXCEPTION 'request_id_required';END IF;
 actor:=zoi.youth_operation_authorize(p_operation,p_scope);
 SELECT * INTO r FROM zoi.youth_requests WHERE actor_id=actor AND request_id=p_request;
 IF r.request_id IS NOT NULL THEN
  IF r.payload->>'_cancelled'='true' THEN
   IF r.payload->>'operation' IS DISTINCT FROM p_operation OR (CASE WHEN jsonb_typeof(r.payload->'scope')='object' THEN r.payload->'scope' IS DISTINCT FROM p_scope ELSE (r.payload->>'workspace')::uuid IS DISTINCT FROM (p_scope->>'workspace')::uuid END) THEN RAISE EXCEPTION 'request_payload_conflict';END IF;
   RETURN true;
  END IF;
  IF zoi.youth_payload_operation(r.payload) IS DISTINCT FROM p_operation OR zoi.youth_request_scope(p_operation,r.payload) IS DISTINCT FROM p_scope THEN RAISE EXCEPTION 'request_payload_conflict';END IF;
 ELSIF (SELECT count(*) FROM zoi.youth_requests WHERE actor_id=actor)>=9900 THEN RAISE EXCEPTION 'youth_request_limit';END IF;
 RETURN false;
END $$;
CREATE FUNCTION zoi.youth_operation_envelope(p_request uuid,p_operation text,p_scope jsonb,p_state text,p_value jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_value||jsonb_build_object('ok',true,'state',p_state,'request_id',p_request,'operation',p_operation,'scope',p_scope,'workspace_id',p_scope->'workspace','actor_id',auth.uid(),'actor_profile_id',zoi.org_actor());
$$;
CREATE FUNCTION public.youth_operation_request(p_request uuid,p_operation text,p_scope jsonb,p_cancel_if_missing boolean DEFAULT false,p_legacy_workspace uuid DEFAULT null) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;r zoi.youth_requests;value jsonb;derived jsonb;role text;
BEGIN
 IF p_request IS NULL OR p_cancel_if_missing IS NULL THEN RAISE EXCEPTION 'invalid_youth_request';END IF;
 IF p_scope IS NULL THEN
  -- Old browser markers contain nonce/operation/workspace only. Derive a saved
  -- target on the server; a missing target can only fence this actor's nonce.
  PERFORM zoi.suite_current_session();actor:=zoi.org_actor();
  IF actor IS NULL OR coalesce(p_operation,'') NOT IN('youth_child_save','youth_program_save','youth_enrol','youth_registration_decide','youth_withdraw','youth_staff_set','youth_class_link','youth_attendance_set') THEN RAISE EXCEPTION 'invalid_youth_request';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('youth-operation:'||auth.uid()::text,0));
  SELECT * INTO r FROM zoi.youth_requests WHERE actor_id=actor AND request_id=p_request;
  IF r.request_id IS NOT NULL AND r.payload->>'_cancelled' IS DISTINCT FROM 'true' THEN
   IF zoi.youth_payload_operation(r.payload) IS DISTINCT FROM p_operation THEN RAISE EXCEPTION 'request_payload_conflict';END IF;
   derived:=zoi.youth_request_scope(p_operation,r.payload);
   IF (derived->>'workspace')::uuid IS DISTINCT FROM p_legacy_workspace THEN RAISE EXCEPTION 'request_payload_conflict';END IF;
   PERFORM zoi.youth_operation_authorize(p_operation,derived,true);
   RETURN zoi.youth_operation_envelope(p_request,p_operation,derived,'saved',jsonb_build_object('receipt',r.receipt,'historical',true));
  END IF;
  IF p_operation IN('youth_child_save','youth_enrol','youth_withdraw') THEN
   IF p_legacy_workspace IS NOT NULL THEN RAISE EXCEPTION 'invalid_youth_scope';END IF;
  ELSE
   role:=zoi.workspace_locked_role(p_legacy_workspace);
   IF coalesce(role,'') NOT IN('owner','admin') AND NOT(p_operation='youth_attendance_set' AND coalesce(role,'')='editor') THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;
  END IF;
  PERFORM zoi.suite_lock_session();
  IF r.request_id IS NOT NULL THEN
   IF r.payload->>'operation' IS DISTINCT FROM p_operation OR coalesce(r.payload->'scope'->>'workspace',r.payload->>'workspace')::uuid IS DISTINCT FROM p_legacy_workspace THEN RAISE EXCEPTION 'request_payload_conflict';END IF;
   RETURN zoi.youth_operation_envelope(p_request,p_operation,r.payload->'scope','cancelled')||jsonb_build_object('workspace_id',p_legacy_workspace);
  END IF;
  IF NOT p_cancel_if_missing THEN RETURN zoi.youth_operation_envelope(p_request,p_operation,null,'missing')||jsonb_build_object('workspace_id',p_legacy_workspace);END IF;
  IF (SELECT count(*) FROM zoi.youth_requests WHERE actor_id=actor)>=10000 THEN RAISE EXCEPTION 'youth_request_limit';END IF;
  value:=zoi.youth_operation_envelope(p_request,p_operation,null,'cancelled')||jsonb_build_object('workspace_id',p_legacy_workspace);
  INSERT INTO zoi.youth_requests(actor_id,request_id,payload,receipt) VALUES(actor,p_request,jsonb_build_object('_cancelled',true,'operation',p_operation,'scope',null,'workspace',p_legacy_workspace),value);
  RETURN value;
 END IF;
 actor:=zoi.youth_operation_authorize(p_operation,p_scope,true);
 SELECT * INTO r FROM zoi.youth_requests WHERE actor_id=actor AND request_id=p_request;
 IF r.request_id IS NOT NULL THEN
  IF r.payload->>'_cancelled'='true' THEN
   IF r.payload->>'operation' IS DISTINCT FROM p_operation OR (CASE WHEN jsonb_typeof(r.payload->'scope')='object' THEN r.payload->'scope' IS DISTINCT FROM p_scope ELSE (r.payload->>'workspace')::uuid IS DISTINCT FROM (p_scope->>'workspace')::uuid END) THEN RAISE EXCEPTION 'request_payload_conflict';END IF;
   RETURN zoi.youth_operation_envelope(p_request,p_operation,p_scope,'cancelled');
  END IF;
  IF zoi.youth_payload_operation(r.payload) IS DISTINCT FROM p_operation OR zoi.youth_request_scope(p_operation,r.payload) IS DISTINCT FROM p_scope THEN RAISE EXCEPTION 'request_payload_conflict';END IF;
  RETURN zoi.youth_operation_envelope(p_request,p_operation,p_scope,'saved',jsonb_build_object('receipt',r.receipt,'historical',true));
 END IF;
 IF NOT p_cancel_if_missing THEN RETURN zoi.youth_operation_envelope(p_request,p_operation,p_scope,'missing');END IF;
 IF (SELECT count(*) FROM zoi.youth_requests WHERE actor_id=actor)>=10000 THEN RAISE EXCEPTION 'youth_request_limit';END IF;
 value:=zoi.youth_operation_envelope(p_request,p_operation,p_scope,'cancelled');
 INSERT INTO zoi.youth_requests(actor_id,request_id,payload,receipt) VALUES(actor,p_request,jsonb_build_object('_cancelled',true,'operation',p_operation,'scope',p_scope),value);
 RETURN value;
END $$;
CREATE FUNCTION public.youth_child_save(p_id uuid,p_expected_version int,p_request uuid,p_name text,p_archived boolean default false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE scope jsonb:=jsonb_build_object('id',p_id);value jsonb;
BEGIN
 IF zoi.youth_operation_begin('youth_child_save',p_request,scope) THEN RETURN zoi.youth_operation_envelope(p_request,'youth_child_save',scope,'cancelled');END IF;
 value:=zoi.youth_child_save_retained(p_id,p_expected_version,p_request,p_name,p_archived);
 PERFORM zoi.suite_lock_session();
 RETURN zoi.youth_operation_envelope(p_request,'youth_child_save',scope,'saved',value);
END $$;
REVOKE ALL ON FUNCTION public.youth_child_save(uuid,int,uuid,text,boolean) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.youth_child_save(uuid,int,uuid,text,boolean) TO authenticated;
CREATE FUNCTION public.youth_program_save(p_workspace uuid,p_id uuid,p_expected_version int,p_request uuid,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE scope jsonb:=jsonb_build_object('workspace',p_workspace,'id',p_id,'listing',p_data->>'listing_id');value jsonb;
BEGIN
 IF zoi.youth_operation_begin('youth_program_save',p_request,scope) THEN RETURN zoi.youth_operation_envelope(p_request,'youth_program_save',scope,'cancelled');END IF;
 value:=zoi.youth_program_save_retained(p_workspace,p_id,p_expected_version,p_request,p_data);
 PERFORM zoi.suite_lock_session();
 RETURN zoi.youth_operation_envelope(p_request,'youth_program_save',scope,'saved',value);
END $$;
REVOKE ALL ON FUNCTION public.youth_program_save(uuid,uuid,int,uuid,jsonb) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.youth_program_save(uuid,uuid,int,uuid,jsonb) TO authenticated;
CREATE FUNCTION public.youth_enrol(p_program uuid,p_child uuid,p_expected_version int,p_program_version int,p_request uuid,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE scope jsonb:=jsonb_build_object('program',p_program,'child',p_child);value jsonb;
BEGIN
 IF zoi.youth_operation_begin('youth_enrol',p_request,scope) THEN RETURN zoi.youth_operation_envelope(p_request,'youth_enrol',scope,'cancelled');END IF;
 value:=zoi.youth_enrol_retained(p_program,p_child,p_expected_version,p_program_version,p_request,p_data);
 PERFORM zoi.suite_lock_session();
 RETURN zoi.youth_operation_envelope(p_request,'youth_enrol',scope,'saved',value);
END $$;
REVOKE ALL ON FUNCTION public.youth_enrol(uuid,uuid,int,int,uuid,jsonb) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.youth_enrol(uuid,uuid,int,int,uuid,jsonb) TO authenticated;
CREATE FUNCTION public.youth_registration_decide(p_workspace uuid,p_registration uuid,p_expected_version int,p_request uuid,p_status text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE scope jsonb:=jsonb_build_object('workspace',p_workspace,'registration',p_registration);value jsonb;
BEGIN
 IF zoi.youth_operation_begin('youth_registration_decide',p_request,scope) THEN RETURN zoi.youth_operation_envelope(p_request,'youth_registration_decide',scope,'cancelled');END IF;
 value:=zoi.youth_registration_decide_retained(p_workspace,p_registration,p_expected_version,p_request,p_status);
 PERFORM zoi.suite_lock_session();
 RETURN zoi.youth_operation_envelope(p_request,'youth_registration_decide',scope,'saved',value);
END $$;
REVOKE ALL ON FUNCTION public.youth_registration_decide(uuid,uuid,int,uuid,text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.youth_registration_decide(uuid,uuid,int,uuid,text) TO authenticated;
CREATE FUNCTION public.youth_withdraw(p_registration uuid,p_expected_version int,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE scope jsonb:=jsonb_build_object('registration',p_registration);value jsonb;
BEGIN
 IF zoi.youth_operation_begin('youth_withdraw',p_request,scope) THEN RETURN zoi.youth_operation_envelope(p_request,'youth_withdraw',scope,'cancelled');END IF;
 value:=zoi.youth_withdraw_retained(p_registration,p_expected_version,p_request);
 PERFORM zoi.suite_lock_session();
 RETURN zoi.youth_operation_envelope(p_request,'youth_withdraw',scope,'saved',value);
END $$;
REVOKE ALL ON FUNCTION public.youth_withdraw(uuid,int,uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.youth_withdraw(uuid,int,uuid) TO authenticated;
CREATE FUNCTION public.youth_staff_set(p_workspace uuid,p_program uuid,p_profile uuid,p_enabled boolean,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE scope jsonb:=jsonb_build_object('workspace',p_workspace,'program',p_program,'profile',p_profile);value jsonb;
BEGIN
 IF zoi.youth_operation_begin('youth_staff_set',p_request,scope) THEN RETURN zoi.youth_operation_envelope(p_request,'youth_staff_set',scope,'cancelled');END IF;
 value:=zoi.youth_staff_set_retained(p_workspace,p_program,p_profile,p_enabled,p_request);
 PERFORM zoi.suite_lock_session();
 RETURN zoi.youth_operation_envelope(p_request,'youth_staff_set',scope,'saved',value);
END $$;
REVOKE ALL ON FUNCTION public.youth_staff_set(uuid,uuid,uuid,boolean,uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.youth_staff_set(uuid,uuid,uuid,boolean,uuid) TO authenticated;
CREATE FUNCTION public.youth_class_link(p_workspace uuid,p_program uuid,p_event uuid,p_enabled boolean,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE scope jsonb:=jsonb_build_object('workspace',p_workspace,'program',p_program,'event',p_event);value jsonb;
BEGIN
 IF zoi.youth_operation_begin('youth_class_link',p_request,scope) THEN RETURN zoi.youth_operation_envelope(p_request,'youth_class_link',scope,'cancelled');END IF;
 value:=zoi.youth_class_link_retained(p_workspace,p_program,p_event,p_enabled,p_request);
 PERFORM zoi.suite_lock_session();
 RETURN zoi.youth_operation_envelope(p_request,'youth_class_link',scope,'saved',value);
END $$;
REVOKE ALL ON FUNCTION public.youth_class_link(uuid,uuid,uuid,boolean,uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.youth_class_link(uuid,uuid,uuid,boolean,uuid) TO authenticated;
CREATE FUNCTION public.youth_attendance_set(p_workspace uuid,p_registration uuid,p_event uuid,p_expected_version int,p_request uuid,p_status text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE scope jsonb:=jsonb_build_object('workspace',p_workspace,'registration',p_registration,'event',p_event);value jsonb;
BEGIN
 IF zoi.youth_operation_begin('youth_attendance_set',p_request,scope) THEN RETURN zoi.youth_operation_envelope(p_request,'youth_attendance_set',scope,'cancelled');END IF;
 value:=zoi.youth_attendance_set_retained(p_workspace,p_registration,p_event,p_expected_version,p_request,p_status);
 PERFORM zoi.suite_lock_session();
 RETURN zoi.youth_operation_envelope(p_request,'youth_attendance_set',scope,'saved',value);
END $$;
REVOKE ALL ON FUNCTION public.youth_attendance_set(uuid,uuid,uuid,int,uuid,text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.youth_attendance_set(uuid,uuid,uuid,int,uuid,text) TO authenticated;
CREATE FUNCTION public.youth_family() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE value jsonb;
BEGIN PERFORM zoi.suite_lock_session(); value:=zoi.youth_family_retained();PERFORM zoi.suite_lock_session();RETURN value||jsonb_build_object('actor_id',auth.uid(),'actor_profile_id',zoi.org_actor(),'capabilities',jsonb_build_object('youth_recovery',1));END $$;
REVOKE ALL ON FUNCTION public.youth_family() FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.youth_family() TO authenticated;
CREATE FUNCTION public.youth_operator(p_workspace uuid,p_program uuid default null,p_offset int default 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE value jsonb;
BEGIN IF coalesce(zoi.workspace_locked_role(p_workspace),'') NOT IN('owner','admin','editor') THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF; value:=zoi.youth_operator_retained(p_workspace,p_program,p_offset);PERFORM zoi.suite_lock_session();RETURN value||jsonb_build_object('actor_id',auth.uid(),'actor_profile_id',zoi.org_actor(),'capabilities',jsonb_build_object('youth_recovery',1));END $$;
REVOKE ALL ON FUNCTION public.youth_operator(uuid,uuid,int) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.youth_operator(uuid,uuid,int) TO authenticated;
REVOKE ALL ON FUNCTION zoi.youth_request_scope(text,jsonb),zoi.youth_payload_operation(jsonb),zoi.youth_operation_authorize(text,jsonb,boolean),zoi.youth_operation_begin(text,uuid,jsonb),zoi.youth_operation_envelope(uuid,text,jsonb,text,jsonb),public.youth_operation_request(uuid,text,jsonb,boolean,uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.youth_operation_request(uuid,text,jsonb,boolean,uuid) TO authenticated;
-- Existing private table remains inaccessible through direct Data API writes.
ALTER TABLE zoi.youth_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.youth_requests FROM public,anon,authenticated;
commit;

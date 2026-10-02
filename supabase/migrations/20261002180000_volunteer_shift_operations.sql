-- Volunteer operations: receipt-bound saves and staff attendance, independent of signup.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
DO $$BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.org_program_save(uuid,text,text,text,uuid,integer)'::regprocedure) IS DISTINCT FROM '321a548a9e6142dd49e714312ba7c396' OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.org_shift_save(uuid,uuid,text,text,timestamptz,timestamptz,text,integer,text,uuid,integer)'::regprocedure) IS DISTINCT FROM '30a6bdade5507df2fa459b5dde9dfcf6' OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.org_roster(uuid,uuid)'::regprocedure) IS DISTINCT FROM 'd757b565d28fc68f48d157f8302b01b4' THEN RAISE EXCEPTION 'volunteer_definition_changed';END IF;
 IF to_regprocedure('zoi.workspace_locked_role(uuid)') IS NULL THEN RAISE EXCEPTION 'current_workspace_authority_required';END IF;
END$$;
ALTER TABLE zoi.org_registrations ADD COLUMN version integer NOT NULL DEFAULT 1,ADD COLUMN attendance text NOT NULL DEFAULT 'not_recorded' CHECK(attendance IN('not_recorded','arrived','completed','no_show')),ADD COLUMN attendance_at timestamptz,ADD COLUMN attendance_note text NOT NULL DEFAULT '' CHECK(length(attendance_note)<=500);
CREATE FUNCTION zoi.org_registration_revision()RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN NEW.version:=OLD.version+1;IF OLD.status='cancelled'AND NEW.status='active'THEN NEW.attendance:='not_recorded';NEW.attendance_at:=NULL;NEW.attendance_note:='';END IF;RETURN NEW;END$$;
CREATE TRIGGER org_registration_revision BEFORE UPDATE ON zoi.org_registrations FOR EACH ROW EXECUTE FUNCTION zoi.org_registration_revision();
CREATE TABLE zoi.org_operation_receipts(actor uuid NOT NULL,request_id uuid NOT NULL,workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id),operation text NOT NULL CHECK(operation IN('program','shift','attendance')),target_id uuid,input jsonb,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(actor,request_id));
ALTER TABLE zoi.org_operation_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.org_operation_receipts,zoi.org_programs,zoi.org_shifts,zoi.org_registrations,zoi.org_audit FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.org_program_save(uuid,text,text,text,uuid,integer) SET SCHEMA zoi;
ALTER FUNCTION zoi.org_program_save(uuid,text,text,text,uuid,integer) RENAME TO org_program_save_retained;
ALTER FUNCTION public.org_shift_save(uuid,uuid,text,text,timestamptz,timestamptz,text,integer,text,uuid,integer) SET SCHEMA zoi;
ALTER FUNCTION zoi.org_shift_save(uuid,uuid,text,text,timestamptz,timestamptz,text,integer,text,uuid,integer) RENAME TO org_shift_save_retained;
REVOKE ALL ON FUNCTION zoi.org_program_save_retained(uuid,text,text,text,uuid,integer),zoi.org_shift_save_retained(uuid,uuid,text,text,timestamptz,timestamptz,text,integer,text,uuid,integer) FROM PUBLIC,anon,authenticated;
-- Retain every validation and write; use current authority for recorded-owner fallback.
CREATE OR REPLACE FUNCTION zoi.org_program_save_retained(p_workspace uuid,p_title text,p_description text,p_status text,p_id uuid DEFAULT NULL,p_expected_version integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r zoi.org_programs;actor uuid:=zoi.org_actor();BEGIN
 IF COALESCE(zoi.workspace_current_role(p_workspace),'') NOT IN('owner','admin','editor') THEN RAISE EXCEPTION 'not_authorized'; END IF;
 IF p_id IS NULL THEN
  IF p_expected_version IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'version_conflict'; END IF;
  INSERT INTO zoi.org_programs(workspace_id,title,description,status) VALUES(p_workspace,btrim(p_title),COALESCE(p_description,''),p_status) RETURNING * INTO r;
 ELSE
  SELECT * INTO r FROM zoi.org_programs WHERE id=p_id AND workspace_id=p_workspace FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'program_not_found'; END IF;
  IF r.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version_conflict'; END IF;
  IF p_status<>'published' AND EXISTS(SELECT 1 FROM zoi.org_shifts s JOIN zoi.org_registrations g ON g.shift_id=s.id WHERE s.program_id=r.id AND g.status='active' AND s.ends_at>clock_timestamp()) THEN RAISE EXCEPTION 'cancel_registered_shifts_first'; END IF;
  UPDATE zoi.org_programs SET title=btrim(p_title),description=COALESCE(p_description,''),status=p_status,version=version+1,updated_at=clock_timestamp() WHERE id=r.id RETURNING * INTO r;
 END IF;
 INSERT INTO zoi.org_audit(workspace_id,entity_id,action,actor_profile_id) VALUES(p_workspace,r.id,'program_saved',actor);
 RETURN jsonb_build_object('ok',true,'program',to_jsonb(r));END;$$;
CREATE OR REPLACE FUNCTION zoi.org_shift_save_retained(p_workspace uuid,p_program uuid,p_title text,p_location text,p_starts_at timestamptz,p_ends_at timestamptz,p_timezone text,p_capacity integer,p_status text,p_id uuid DEFAULT NULL,p_expected_version integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r zoi.org_shifts;active_count integer;actor uuid:=zoi.org_actor();BEGIN
 IF COALESCE(zoi.workspace_current_role(p_workspace),'') NOT IN('owner','admin','editor') THEN RAISE EXCEPTION 'not_authorized'; END IF;
 PERFORM 1 FROM zoi.org_programs WHERE id=p_program AND workspace_id=p_workspace AND status<>'archived' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'program_not_found'; END IF;
 IF p_starts_at IS NULL OR p_ends_at IS NULL OR NOT isfinite(p_starts_at) OR NOT isfinite(p_ends_at) OR p_ends_at<=p_starts_at THEN RAISE EXCEPTION 'invalid_shift_times'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p_timezone) THEN RAISE EXCEPTION 'invalid_timezone'; END IF;
 IF p_id IS NULL THEN
  IF p_expected_version IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'version_conflict'; END IF;
  IF p_starts_at<=clock_timestamp() THEN RAISE EXCEPTION 'start_must_be_future'; END IF;
  INSERT INTO zoi.org_shifts(workspace_id,program_id,title,location,starts_at,ends_at,timezone,capacity,status) VALUES(p_workspace,p_program,btrim(p_title),COALESCE(p_location,''),p_starts_at,p_ends_at,p_timezone,p_capacity,p_status) RETURNING * INTO r;
 ELSE
  SELECT * INTO r FROM zoi.org_shifts WHERE id=p_id AND workspace_id=p_workspace FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'shift_not_found'; END IF;
  IF r.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version_conflict'; END IF;
  IF p_starts_at<=clock_timestamp() AND NOT(p_status='cancelled' AND r.starts_at<=clock_timestamp() AND p_starts_at=r.starts_at AND p_ends_at=r.ends_at) THEN RAISE EXCEPTION 'start_must_be_future'; END IF;
  IF r.program_id<>p_program THEN RAISE EXCEPTION 'shift_program_immutable'; END IF;
  SELECT count(*) INTO active_count FROM zoi.org_registrations WHERE shift_id=r.id AND status='active';
  IF p_capacity<active_count AND p_status<>'cancelled' THEN RAISE EXCEPTION 'capacity_below_registrations'; END IF;
  IF active_count>0 AND (r.starts_at<>p_starts_at OR r.ends_at<>p_ends_at OR r.program_id<>p_program) THEN RAISE EXCEPTION 'registered_shift_times_locked'; END IF;
  IF r.starts_at<=clock_timestamp() AND p_status<>'cancelled' THEN RAISE EXCEPTION 'started_shift_read_only'; END IF;
  IF r.status='cancelled' AND p_status<>'cancelled' THEN RAISE EXCEPTION 'cancelled_shift_cannot_reopen'; END IF;
  UPDATE zoi.org_shifts SET program_id=p_program,title=btrim(p_title),location=COALESCE(p_location,''),starts_at=p_starts_at,ends_at=p_ends_at,timezone=p_timezone,capacity=p_capacity,status=p_status,version=version+1,updated_at=clock_timestamp() WHERE id=r.id RETURNING * INTO r;
  IF p_status='cancelled' THEN UPDATE zoi.org_registrations SET status='cancelled',updated_at=clock_timestamp() WHERE shift_id=r.id AND status='active'; END IF;
 END IF;
 INSERT INTO zoi.org_audit(workspace_id,entity_id,action,actor_profile_id) VALUES(p_workspace,r.id,CASE WHEN p_status='cancelled' THEN 'shift_cancelled' ELSE 'shift_saved' END,actor);
 RETURN jsonb_build_object('ok',true,'shift',to_jsonb(r));END;$$;
-- Installed clients retain their existing signature and CAS. Legacy create has no
-- replay receipt: callers must inspect the list after an uncertain response. Modern
-- clients exclusively use org_operation_save/request; no fallback is introduced.
CREATE FUNCTION public.org_program_save(p_workspace uuid,p_title text,p_description text,p_status text,p_id uuid DEFAULT NULL,p_expected_version integer DEFAULT 0)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE v jsonb;BEGIN PERFORM zoi.org_operation_authorize(p_workspace);v:=zoi.org_program_save_retained(p_workspace,p_title,p_description,p_status,p_id,p_expected_version);PERFORM zoi.suite_lock_session();RETURN v;END$$;
CREATE FUNCTION public.org_shift_save(p_workspace uuid,p_program uuid,p_title text,p_location text,p_starts_at timestamptz,p_ends_at timestamptz,p_timezone text,p_capacity integer,p_status text,p_id uuid DEFAULT NULL,p_expected_version integer DEFAULT 0)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE v jsonb;BEGIN PERFORM zoi.org_operation_authorize(p_workspace);v:=zoi.org_shift_save_retained(p_workspace,p_program,p_title,p_location,p_starts_at,p_ends_at,p_timezone,p_capacity,p_status,p_id,p_expected_version);PERFORM zoi.suite_lock_session();RETURN v;END$$;
CREATE FUNCTION zoi.org_operation_authorize(p_workspace uuid)RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN IF coalesce(zoi.workspace_locked_role(p_workspace),'') NOT IN('owner','admin','editor')THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;END$$;
CREATE FUNCTION public.org_operation_request(p_workspace uuid,p_request uuid,p_operation text,p_target uuid DEFAULT NULL,p_cancel_if_missing boolean DEFAULT false)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r zoi.org_operation_receipts;v jsonb;
BEGIN
 PERFORM zoi.org_operation_authorize(p_workspace);
 IF p_request IS NULL OR coalesce(p_operation,'') NOT IN('program','shift','attendance') OR (p_operation='attendance' AND p_target IS NULL)THEN RAISE EXCEPTION 'invalid_operation_request';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('org-operation:'||auth.uid()::text,0));PERFORM zoi.suite_lock_session();
 SELECT * INTO r FROM zoi.org_operation_receipts WHERE actor=auth.uid() AND request_id=p_request;
 IF FOUND THEN
 IF r.workspace_id IS DISTINCT FROM p_workspace OR r.operation IS DISTINCT FROM p_operation OR r.target_id IS DISTINCT FROM p_target THEN RAISE EXCEPTION 'request_conflict';END IF;
 RETURN jsonb_build_object('ok',true,'workspace_id',p_workspace,'request_id',p_request,'operation',p_operation,'target_id',p_target,'found',true,'receipt',r.result);END IF;
 IF coalesce(p_cancel_if_missing,false)THEN
 IF (SELECT count(*)FROM zoi.org_operation_receipts WHERE actor=auth.uid())>=10000 THEN RAISE EXCEPTION 'operation_receipt_capacity';END IF;
 v:=jsonb_build_object('ok',false,'status','cancelled','workspace_id',p_workspace,'request_id',p_request,'operation',p_operation,'target_id',p_target);
 INSERT INTO zoi.org_operation_receipts(actor,request_id,workspace_id,operation,target_id,result)VALUES(auth.uid(),p_request,p_workspace,p_operation,p_target,v);
 RETURN jsonb_build_object('ok',true,'workspace_id',p_workspace,'request_id',p_request,'operation',p_operation,'target_id',p_target,'found',true,'receipt',v);END IF;
 RETURN jsonb_build_object('ok',true,'workspace_id',p_workspace,'request_id',p_request,'operation',p_operation,'target_id',p_target,'found',false);
END$$;
CREATE FUNCTION public.org_operation_save(p_workspace uuid,p_request uuid,p_operation text,p_target uuid,p_expected_version integer,p_values jsonb)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r zoi.org_operation_receipts;v jsonb;input_value jsonb;g zoi.org_registrations;s zoi.org_shifts;next_state text;note text;program uuid;
BEGIN
 PERFORM zoi.org_operation_authorize(p_workspace);
 IF p_request IS NULL OR coalesce(p_operation,'')NOT IN('program','shift','attendance') OR p_expected_version IS NULL OR p_expected_version<0 OR p_values IS NULL OR jsonb_typeof(p_values)<>'object' OR octet_length(p_values::text)>20000 THEN RAISE EXCEPTION 'invalid_operation_request';END IF;
 input_value:=jsonb_build_object('version',p_expected_version,'values',p_values);
 PERFORM pg_advisory_xact_lock(hashtextextended('org-operation:'||auth.uid()::text,0));PERFORM zoi.suite_lock_session();
 SELECT * INTO r FROM zoi.org_operation_receipts WHERE actor=auth.uid() AND request_id=p_request;
 IF FOUND THEN
 IF r.workspace_id IS DISTINCT FROM p_workspace OR r.operation IS DISTINCT FROM p_operation OR r.target_id IS DISTINCT FROM p_target OR (r.input IS NOT NULL AND r.input IS DISTINCT FROM input_value)THEN RAISE EXCEPTION 'request_conflict';END IF;
 RETURN r.result;END IF;
 IF (SELECT count(*)FROM zoi.org_operation_receipts WHERE actor=auth.uid())>=9900 THEN RAISE EXCEPTION 'operation_receipt_capacity';END IF;
 IF p_operation='program' THEN
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_values)k WHERE k NOT IN('title','description','status'))THEN RAISE EXCEPTION 'invalid_program_fields';END IF;
 v:=zoi.org_program_save_retained(p_workspace,p_values->>'title',p_values->>'description',p_values->>'status',p_target,p_expected_version);
 ELSIF p_operation='shift' THEN
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_values)k WHERE k NOT IN('program_id','title','location','starts_at','ends_at','timezone','capacity','status'))THEN RAISE EXCEPTION 'invalid_shift_fields';END IF;
 v:=zoi.org_shift_save_retained(p_workspace,(p_values->>'program_id')::uuid,p_values->>'title',p_values->>'location',(p_values->>'starts_at')::timestamptz,(p_values->>'ends_at')::timestamptz,p_values->>'timezone',(p_values->>'capacity')::integer,p_values->>'status',p_target,p_expected_version);
 ELSE
 IF p_target IS NULL OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_values)k WHERE k NOT IN('shift_id','attendance','note'))THEN RAISE EXCEPTION 'invalid_attendance_fields';END IF;
 SELECT x.program_id INTO program FROM zoi.org_shifts x WHERE x.id=(p_values->>'shift_id')::uuid AND x.workspace_id=p_workspace;
 IF NOT FOUND THEN RAISE EXCEPTION 'shift_not_found';END IF;
 -- Same order as retained shift save/signup: program, shift, then registration.
 PERFORM 1 FROM zoi.org_programs WHERE id=program AND workspace_id=p_workspace FOR SHARE;
 SELECT * INTO s FROM zoi.org_shifts WHERE id=(p_values->>'shift_id')::uuid AND workspace_id=p_workspace AND program_id=program FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'shift_not_found';END IF;
 SELECT * INTO g FROM zoi.org_registrations WHERE id=p_target AND shift_id=s.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'registration_not_found';END IF;
 PERFORM zoi.suite_lock_session();
 IF g.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version_conflict';END IF;
 IF g.status<>'active' OR s.status<>'scheduled' THEN RAISE EXCEPTION 'registration_not_active';END IF;
 next_state:=p_values->>'attendance';note:=btrim(coalesce(p_values->>'note',''));
 IF coalesce(next_state,'')NOT IN('not_recorded','arrived','completed','no_show') OR length(note)>500 THEN RAISE EXCEPTION 'invalid_attendance';END IF;
 IF next_state=g.attendance THEN RAISE EXCEPTION 'attendance_unchanged';END IF;
 IF next_state='not_recorded' THEN IF note=''THEN RAISE EXCEPTION 'correction_note_required';END IF;
 ELSIF next_state='arrived' THEN IF g.attendance<>'not_recorded' OR clock_timestamp()<s.starts_at-interval '30 minutes' THEN RAISE EXCEPTION 'arrival_not_available';END IF;
 ELSIF next_state='completed' THEN IF g.attendance<>'arrived' OR clock_timestamp()<s.starts_at THEN RAISE EXCEPTION 'completion_not_available';END IF;
 ELSIF next_state='no_show' THEN IF g.attendance<>'not_recorded' OR clock_timestamp()<s.ends_at THEN RAISE EXCEPTION 'no_show_not_available';END IF;END IF;
 UPDATE zoi.org_registrations SET attendance=next_state,attendance_at=clock_timestamp(),attendance_note=note,updated_at=clock_timestamp()WHERE id=g.id RETURNING * INTO g;
 INSERT INTO zoi.org_audit(workspace_id,entity_id,action,actor_profile_id)VALUES(p_workspace,g.id,'attendance_'||next_state,zoi.org_actor());
 v:=jsonb_build_object('ok',true,'registration',to_jsonb(g));
 END IF;
 -- Retained writers can wait on records; expiry is checked again before commit.
 PERFORM zoi.suite_lock_session();
 v:=v||jsonb_build_object('workspace_id',p_workspace,'request_id',p_request,'operation',p_operation,'target_id',p_target,'status','saved');
 INSERT INTO zoi.org_operation_receipts(actor,request_id,workspace_id,operation,target_id,input,result)VALUES(auth.uid(),p_request,p_workspace,p_operation,p_target,input_value,v);
 RETURN v;
END$$;
CREATE OR REPLACE FUNCTION public.org_roster(p_workspace uuid,p_shift uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE program uuid;BEGIN
 PERFORM zoi.org_operation_authorize(p_workspace);
 SELECT program_id INTO program FROM zoi.org_shifts WHERE id=p_shift AND workspace_id=p_workspace;
 IF NOT FOUND THEN RAISE EXCEPTION 'shift_not_found';END IF;
 PERFORM 1 FROM zoi.org_programs WHERE id=program AND workspace_id=p_workspace FOR SHARE;
 PERFORM 1 FROM zoi.org_shifts WHERE id=p_shift AND workspace_id=p_workspace AND program_id=program FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'shift_not_found';END IF;
 PERFORM zoi.suite_lock_session();
 RETURN jsonb_build_object('ok',true,'workspace_id',p_workspace,'shift_id',p_shift,'registrations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',g.id,'profile_id',g.profile_id,'display_name',coalesce(p.display_name,p.first_name,'Volunteer'),'status',g.status,'version',g.version,'attendance',g.attendance,'attendance_at',g.attendance_at,'attendance_note',g.attendance_note,'created_at',g.created_at)ORDER BY g.created_at,g.id)FROM zoi.org_registrations g JOIN zoi.user_profiles p ON p.id=g.profile_id WHERE g.shift_id=p_shift),'[]'::jsonb));
END$$;
REVOKE ALL ON FUNCTION zoi.org_operation_authorize(uuid),zoi.org_registration_revision() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.org_operation_save(uuid,uuid,text,uuid,integer,jsonb),public.org_operation_request(uuid,uuid,text,uuid,boolean),public.org_program_save(uuid,text,text,text,uuid,integer),public.org_shift_save(uuid,uuid,text,text,timestamptz,timestamptz,text,integer,text,uuid,integer),public.org_roster(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.org_operation_save(uuid,uuid,text,uuid,integer,jsonb),public.org_operation_request(uuid,uuid,text,uuid,boolean),public.org_program_save(uuid,text,text,text,uuid,integer),public.org_shift_save(uuid,uuid,text,text,timestamptz,timestamptz,text,integer,text,uuid,integer),public.org_roster(uuid,uuid) TO authenticated;
DO $$BEGIN IF(SELECT md5(prosrc)FROM pg_proc WHERE oid='public.org_signup(uuid)'::regprocedure)IS DISTINCT FROM 'd6a81f93680bf9e594301460d0b97401'THEN RAISE EXCEPTION 'volunteer_guest_definition_changed';END IF;END$$;
CREATE OR REPLACE FUNCTION public.org_signup(p_shift uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s zoi.org_shifts;r zoi.org_registrations;actor uuid:=zoi.org_actor();BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'sign_in_required'; END IF;
 PERFORM zoi.suite_lock_session();
 -- Serialise this volunteer across different shifts before locking capacity.
 PERFORM 1 FROM zoi.user_profiles WHERE id=actor FOR UPDATE;
 PERFORM 1 FROM zoi.org_programs p JOIN zoi.org_shifts x ON x.program_id=p.id WHERE x.id=p_shift FOR SHARE OF p;
 SELECT * INTO s FROM zoi.org_shifts WHERE id=p_shift FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'shift_unavailable'; END IF;
 SELECT * INTO r FROM zoi.org_registrations WHERE shift_id=p_shift AND profile_id=actor;
 PERFORM zoi.suite_lock_session();
 IF FOUND AND r.status='active' THEN RETURN jsonb_build_object('ok',true,'registration',(to_jsonb(r)-'attendance_note')); END IF;
 IF s.status<>'scheduled' OR s.starts_at<=clock_timestamp() OR NOT EXISTS(SELECT 1 FROM zoi.org_programs WHERE id=s.program_id AND status='published') THEN RAISE EXCEPTION 'shift_unavailable'; END IF;
 IF (SELECT count(*) FROM zoi.org_registrations WHERE shift_id=p_shift AND status='active')>=s.capacity THEN RAISE EXCEPTION 'shift_full'; END IF;
 IF EXISTS(SELECT 1 FROM zoi.org_registrations g JOIN zoi.org_shifts x ON x.id=g.shift_id WHERE g.profile_id=actor AND g.status='active' AND x.status='scheduled' AND x.starts_at<s.ends_at AND x.ends_at>s.starts_at) THEN RAISE EXCEPTION 'overlapping_shift'; END IF;
 INSERT INTO zoi.org_registrations(shift_id,profile_id,status,shift_snapshot) VALUES(p_shift,actor,'active',to_jsonb(s)) ON CONFLICT(shift_id,profile_id) DO UPDATE SET status='active',shift_snapshot=EXCLUDED.shift_snapshot,updated_at=clock_timestamp() RETURNING * INTO r;
 INSERT INTO zoi.org_audit(workspace_id,entity_id,action,actor_profile_id) VALUES(s.workspace_id,r.id,'volunteer_signed_up',actor);
 RETURN jsonb_build_object('ok',true,'registration',(to_jsonb(r)-'attendance_note'));END;$$;
DO $$BEGIN IF(SELECT md5(prosrc)FROM pg_proc WHERE oid='public.org_signup_cancel(uuid)'::regprocedure)IS DISTINCT FROM '4096a11e2c379fa383ee4c60887f6fbe'THEN RAISE EXCEPTION 'volunteer_guest_definition_changed';END IF;END$$;
CREATE OR REPLACE FUNCTION public.org_signup_cancel(p_shift uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s zoi.org_shifts;r zoi.org_registrations;actor uuid:=zoi.org_actor();BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'sign_in_required'; END IF;
 PERFORM zoi.suite_lock_session();
 SELECT * INTO s FROM zoi.org_shifts WHERE id=p_shift FOR UPDATE;
 SELECT * INTO r FROM zoi.org_registrations WHERE shift_id=p_shift AND profile_id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'registration_not_found'; END IF;
 PERFORM zoi.suite_lock_session();
 IF r.status='cancelled' THEN RETURN jsonb_build_object('ok',true,'registration',(to_jsonb(r)-'attendance_note')); END IF;
 IF s.starts_at<=clock_timestamp() THEN RAISE EXCEPTION 'started_shift_contact_organizer'; END IF;
 UPDATE zoi.org_registrations SET status='cancelled',updated_at=clock_timestamp() WHERE id=r.id RETURNING * INTO r;
 INSERT INTO zoi.org_audit(workspace_id,entity_id,action,actor_profile_id) VALUES(s.workspace_id,r.id,'volunteer_cancelled',actor);
 RETURN jsonb_build_object('ok',true,'registration',(to_jsonb(r)-'attendance_note'));END;$$;
DO $$BEGIN IF(SELECT md5(prosrc)FROM pg_proc WHERE oid='public.org_programs_list(uuid)'::regprocedure)IS DISTINCT FROM 'b3020c44fd42e353bbce3e61d37cca33'THEN RAISE EXCEPTION 'volunteer_list_definition_changed';END IF;END$$;
CREATE OR REPLACE FUNCTION public.org_programs_list(p_workspace uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r text:=zoi.workspace_locked_role(p_workspace);BEGIN
 IF r IS NULL THEN RAISE EXCEPTION 'not_authorized'; END IF;
 RETURN jsonb_build_object('ok',true,'workspace_id',p_workspace,'actor_profile_id',zoi.org_actor(),'capabilities',jsonb_build_object('volunteer_operations',1),'role',r,'programs',COALESCE((SELECT jsonb_agg(p ORDER BY p.created_at DESC) FROM zoi.org_programs p WHERE workspace_id=p_workspace),'[]'::jsonb),'shifts',COALESCE((SELECT jsonb_agg(s ORDER BY s.starts_at) FROM zoi.org_shifts s WHERE workspace_id=p_workspace),'[]'::jsonb));END;$$;
COMMIT;

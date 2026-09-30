-- Parish/nonprofit volunteer scheduling. Uses confirmed owner/admin/editor/viewer memberships.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE zoi.org_programs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id) ON DELETE CASCADE,title text NOT NULL CHECK(length(title) BETWEEN 1 AND 200),description text NOT NULL DEFAULT '' CHECK(length(description)<=10000),status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','published','archived')),version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(workspace_id,id));
CREATE TABLE zoi.org_shifts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id) ON DELETE CASCADE,program_id uuid NOT NULL,title text NOT NULL CHECK(length(title) BETWEEN 1 AND 200),location text NOT NULL DEFAULT '' CHECK(length(location)<=500),starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,timezone text NOT NULL DEFAULT 'UTC',capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 500),status text NOT NULL DEFAULT 'scheduled' CHECK(status IN('scheduled','cancelled')),version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(workspace_id,program_id) REFERENCES zoi.org_programs(workspace_id,id),CHECK(ends_at>starts_at),UNIQUE(workspace_id,id));
CREATE TABLE zoi.org_registrations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),shift_id uuid NOT NULL REFERENCES zoi.org_shifts(id),profile_id uuid NOT NULL REFERENCES zoi.user_profiles(id),status text NOT NULL CHECK(status IN('active','cancelled')),shift_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(shift_id,profile_id));
CREATE INDEX org_shifts_workspace_date ON zoi.org_shifts(workspace_id,starts_at);
CREATE INDEX org_registrations_profile ON zoi.org_registrations(profile_id,shift_id) WHERE status='active';
CREATE TABLE zoi.org_audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,workspace_id uuid NOT NULL,entity_id uuid NOT NULL,action text NOT NULL,actor_profile_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE zoi.org_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoi.org_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoi.org_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoi.org_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.org_programs,zoi.org_shifts,zoi.org_registrations,zoi.org_audit FROM PUBLIC,anon,authenticated;

CREATE FUNCTION zoi.org_role(p_workspace uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT m.role FROM zoi.workspace_members m JOIN zoi.user_profiles p ON p.id=m.profile_id WHERE m.workspace_id=p_workspace AND p.auth_user_id=auth.uid() LIMIT 1 $$;
REVOKE ALL ON FUNCTION zoi.org_role(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION zoi.org_actor() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT id FROM zoi.user_profiles WHERE auth_user_id=auth.uid() LIMIT 1 $$;
REVOKE ALL ON FUNCTION zoi.org_actor() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.org_programs_list(p_workspace uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r text:=zoi.org_role(p_workspace);BEGIN
 IF r IS NULL THEN RAISE EXCEPTION 'not_authorized'; END IF;
 RETURN jsonb_build_object('ok',true,'role',r,'programs',COALESCE((SELECT jsonb_agg(p ORDER BY p.created_at DESC) FROM zoi.org_programs p WHERE workspace_id=p_workspace),'[]'::jsonb),'shifts',COALESCE((SELECT jsonb_agg(s ORDER BY s.starts_at) FROM zoi.org_shifts s WHERE workspace_id=p_workspace),'[]'::jsonb));END;$$;

CREATE FUNCTION public.org_program_save(p_workspace uuid,p_title text,p_description text,p_status text,p_id uuid DEFAULT NULL,p_expected_version integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r zoi.org_programs;actor uuid:=zoi.org_actor();BEGIN
 IF COALESCE(zoi.org_role(p_workspace),'') NOT IN('owner','admin','editor') THEN RAISE EXCEPTION 'not_authorized'; END IF;
 IF p_id IS NULL THEN
  IF p_expected_version IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'version_conflict'; END IF;
  INSERT INTO zoi.org_programs(workspace_id,title,description,status) VALUES(p_workspace,btrim(p_title),COALESCE(p_description,''),p_status) RETURNING * INTO r;
 ELSE
  SELECT * INTO r FROM zoi.org_programs WHERE id=p_id AND workspace_id=p_workspace FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'program_not_found'; END IF;
  IF r.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version_conflict'; END IF;
  IF p_status<>'published' AND EXISTS(SELECT 1 FROM zoi.org_shifts s JOIN zoi.org_registrations g ON g.shift_id=s.id WHERE s.program_id=r.id AND g.status='active' AND s.ends_at>now()) THEN RAISE EXCEPTION 'cancel_registered_shifts_first'; END IF;
  UPDATE zoi.org_programs SET title=btrim(p_title),description=COALESCE(p_description,''),status=p_status,version=version+1,updated_at=now() WHERE id=r.id RETURNING * INTO r;
 END IF;
 INSERT INTO zoi.org_audit(workspace_id,entity_id,action,actor_profile_id) VALUES(p_workspace,r.id,'program_saved',actor);
 RETURN jsonb_build_object('ok',true,'program',to_jsonb(r));END;$$;

CREATE FUNCTION public.org_shift_save(p_workspace uuid,p_program uuid,p_title text,p_location text,p_starts_at timestamptz,p_ends_at timestamptz,p_timezone text,p_capacity integer,p_status text,p_id uuid DEFAULT NULL,p_expected_version integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r zoi.org_shifts;active_count integer;actor uuid:=zoi.org_actor();BEGIN
 IF COALESCE(zoi.org_role(p_workspace),'') NOT IN('owner','admin','editor') THEN RAISE EXCEPTION 'not_authorized'; END IF;
 PERFORM 1 FROM zoi.org_programs WHERE id=p_program AND workspace_id=p_workspace AND status<>'archived' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'program_not_found'; END IF;
 IF p_starts_at IS NULL OR p_ends_at IS NULL OR NOT isfinite(p_starts_at) OR NOT isfinite(p_ends_at) OR p_ends_at<=p_starts_at THEN RAISE EXCEPTION 'invalid_shift_times'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p_timezone) THEN RAISE EXCEPTION 'invalid_timezone'; END IF;
 IF p_id IS NULL THEN
  IF p_expected_version IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'version_conflict'; END IF;
  IF p_starts_at<=now() THEN RAISE EXCEPTION 'start_must_be_future'; END IF;
  INSERT INTO zoi.org_shifts(workspace_id,program_id,title,location,starts_at,ends_at,timezone,capacity,status) VALUES(p_workspace,p_program,btrim(p_title),COALESCE(p_location,''),p_starts_at,p_ends_at,p_timezone,p_capacity,p_status) RETURNING * INTO r;
 ELSE
  SELECT * INTO r FROM zoi.org_shifts WHERE id=p_id AND workspace_id=p_workspace FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'shift_not_found'; END IF;
  IF r.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version_conflict'; END IF;
  IF p_starts_at<=now() AND NOT(p_status='cancelled' AND r.starts_at<=now() AND p_starts_at=r.starts_at AND p_ends_at=r.ends_at) THEN RAISE EXCEPTION 'start_must_be_future'; END IF;
  IF r.program_id<>p_program THEN RAISE EXCEPTION 'shift_program_immutable'; END IF;
  SELECT count(*) INTO active_count FROM zoi.org_registrations WHERE shift_id=r.id AND status='active';
  IF p_capacity<active_count AND p_status<>'cancelled' THEN RAISE EXCEPTION 'capacity_below_registrations'; END IF;
  IF active_count>0 AND (r.starts_at<>p_starts_at OR r.ends_at<>p_ends_at OR r.program_id<>p_program) THEN RAISE EXCEPTION 'registered_shift_times_locked'; END IF;
  IF r.starts_at<=now() AND p_status<>'cancelled' THEN RAISE EXCEPTION 'started_shift_read_only'; END IF;
  IF r.status='cancelled' AND p_status<>'cancelled' THEN RAISE EXCEPTION 'cancelled_shift_cannot_reopen'; END IF;
  UPDATE zoi.org_shifts SET program_id=p_program,title=btrim(p_title),location=COALESCE(p_location,''),starts_at=p_starts_at,ends_at=p_ends_at,timezone=p_timezone,capacity=p_capacity,status=p_status,version=version+1,updated_at=now() WHERE id=r.id RETURNING * INTO r;
  IF p_status='cancelled' THEN UPDATE zoi.org_registrations SET status='cancelled',updated_at=now() WHERE shift_id=r.id AND status='active'; END IF;
 END IF;
 INSERT INTO zoi.org_audit(workspace_id,entity_id,action,actor_profile_id) VALUES(p_workspace,r.id,CASE WHEN p_status='cancelled' THEN 'shift_cancelled' ELSE 'shift_saved' END,actor);
 RETURN jsonb_build_object('ok',true,'shift',to_jsonb(r));END;$$;

CREATE FUNCTION public.org_opportunities(p_workspace uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('ok',true,
 'organization',COALESCE((SELECT name FROM zoi.workspaces WHERE id=p_workspace AND EXISTS(SELECT 1 FROM zoi.org_programs WHERE workspace_id=p_workspace AND status='published')),''),
 'programs',COALESCE((SELECT jsonb_agg(CASE WHEN p.status='published' THEN to_jsonb(p) ELSE jsonb_build_object('id',p.id,'workspace_id',p.workspace_id,'title','Program no longer published','description','','status',p.status) END)
 FROM zoi.org_programs p WHERE p.workspace_id=p_workspace AND (p.status='published' OR EXISTS(SELECT 1 FROM zoi.org_shifts x JOIN zoi.org_registrations g ON g.shift_id=x.id WHERE x.program_id=p.id AND g.profile_id=zoi.org_actor() AND (g.shift_snapshot->>'ends_at')::timestamptz>now()-interval '30 days'))),'[]'::jsonb),
 'shifts',COALESCE((SELECT jsonb_agg(
 (CASE WHEN p.status='published' THEN to_jsonb(s) ELSE COALESCE(own.shift_snapshot,'{}'::jsonb)||jsonb_build_object('status',s.status) END)
 ||jsonb_build_object('unavailable',p.status<>'published','available',CASE WHEN p.status='published' THEN s.capacity-(SELECT count(*) FROM zoi.org_registrations r WHERE r.shift_id=s.id AND r.status='active') ELSE 0 END,'registration_status',own.status,'registered',COALESCE(own.status='active',false)) ORDER BY s.starts_at)
 FROM zoi.org_shifts s JOIN zoi.org_programs p ON p.id=s.program_id LEFT JOIN zoi.org_registrations own ON own.shift_id=s.id AND own.profile_id=zoi.org_actor()
 WHERE s.workspace_id=p_workspace AND ((s.status='scheduled' AND s.starts_at>now() AND p.status='published') OR (own.id IS NOT NULL AND (own.shift_snapshot->>'ends_at')::timestamptz>now()-interval '30 days'))),'[]'::jsonb)) $$;

CREATE FUNCTION public.org_signup(p_shift uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s zoi.org_shifts;r zoi.org_registrations;actor uuid:=zoi.org_actor();BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'sign_in_required'; END IF;
 -- Serialise this volunteer across different shifts before locking capacity.
 PERFORM 1 FROM zoi.user_profiles WHERE id=actor FOR UPDATE;
 PERFORM 1 FROM zoi.org_programs p JOIN zoi.org_shifts x ON x.program_id=p.id WHERE x.id=p_shift FOR SHARE OF p;
 SELECT * INTO s FROM zoi.org_shifts WHERE id=p_shift FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'shift_unavailable'; END IF;
 SELECT * INTO r FROM zoi.org_registrations WHERE shift_id=p_shift AND profile_id=actor;
 IF FOUND AND r.status='active' THEN RETURN jsonb_build_object('ok',true,'registration',to_jsonb(r)); END IF;
 IF s.status<>'scheduled' OR s.starts_at<=now() OR NOT EXISTS(SELECT 1 FROM zoi.org_programs WHERE id=s.program_id AND status='published') THEN RAISE EXCEPTION 'shift_unavailable'; END IF;
 IF (SELECT count(*) FROM zoi.org_registrations WHERE shift_id=p_shift AND status='active')>=s.capacity THEN RAISE EXCEPTION 'shift_full'; END IF;
 IF EXISTS(SELECT 1 FROM zoi.org_registrations g JOIN zoi.org_shifts x ON x.id=g.shift_id WHERE g.profile_id=actor AND g.status='active' AND x.status='scheduled' AND x.starts_at<s.ends_at AND x.ends_at>s.starts_at) THEN RAISE EXCEPTION 'overlapping_shift'; END IF;
 INSERT INTO zoi.org_registrations(shift_id,profile_id,status,shift_snapshot) VALUES(p_shift,actor,'active',to_jsonb(s)) ON CONFLICT(shift_id,profile_id) DO UPDATE SET status='active',shift_snapshot=EXCLUDED.shift_snapshot,updated_at=now() RETURNING * INTO r;
 INSERT INTO zoi.org_audit(workspace_id,entity_id,action,actor_profile_id) VALUES(s.workspace_id,r.id,'volunteer_signed_up',actor);
 RETURN jsonb_build_object('ok',true,'registration',to_jsonb(r));END;$$;

CREATE FUNCTION public.org_signup_cancel(p_shift uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s zoi.org_shifts;r zoi.org_registrations;actor uuid:=zoi.org_actor();BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'sign_in_required'; END IF;
 SELECT * INTO s FROM zoi.org_shifts WHERE id=p_shift FOR UPDATE;
 SELECT * INTO r FROM zoi.org_registrations WHERE shift_id=p_shift AND profile_id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'registration_not_found'; END IF;
 IF r.status='cancelled' THEN RETURN jsonb_build_object('ok',true,'registration',to_jsonb(r)); END IF;
 IF s.starts_at<=now() THEN RAISE EXCEPTION 'started_shift_contact_organizer'; END IF;
 UPDATE zoi.org_registrations SET status='cancelled',updated_at=now() WHERE id=r.id RETURNING * INTO r;
 INSERT INTO zoi.org_audit(workspace_id,entity_id,action,actor_profile_id) VALUES(s.workspace_id,r.id,'volunteer_cancelled',actor);
 RETURN jsonb_build_object('ok',true,'registration',to_jsonb(r));END;$$;

CREATE FUNCTION public.org_roster(p_workspace uuid,p_shift uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF COALESCE(zoi.org_role(p_workspace),'') NOT IN('owner','admin','editor') OR NOT EXISTS(SELECT 1 FROM zoi.org_shifts WHERE id=p_shift AND workspace_id=p_workspace) THEN RAISE EXCEPTION 'not_authorized'; END IF;
 RETURN jsonb_build_object('ok',true,'registrations',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'profile_id',r.profile_id,'display_name',COALESCE(NULLIF(p.display_name,''),'Volunteer'),'status',r.status,'created_at',r.created_at)) FROM zoi.org_registrations r JOIN zoi.user_profiles p ON p.id=r.profile_id WHERE r.shift_id=p_shift),'[]'::jsonb));END;$$;

REVOKE ALL ON FUNCTION public.org_programs_list(uuid),public.org_program_save(uuid,text,text,text,uuid,integer),public.org_shift_save(uuid,uuid,text,text,timestamptz,timestamptz,text,integer,text,uuid,integer),public.org_opportunities(uuid),public.org_signup(uuid),public.org_signup_cancel(uuid),public.org_roster(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.org_programs_list(uuid),public.org_program_save(uuid,text,text,text,uuid,integer),public.org_shift_save(uuid,uuid,text,text,timestamptz,timestamptz,text,integer,text,uuid,integer),public.org_signup(uuid),public.org_signup_cancel(uuid),public.org_roster(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_opportunities(uuid) TO anon,authenticated;
COMMIT;

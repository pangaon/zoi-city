BEGIN;
SET LOCAL lock_timeout='5s';
-- External artwork URLs are references approved by the organiser, not byte-validated uploads.
CREATE TABLE zoi.festival_placement_scopes(event_id uuid NOT NULL REFERENCES zoi.listings(id),workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id),configuration text NOT NULL CHECK(configuration IN('front','side')),version integer NOT NULL CHECK(version>0),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(event_id,configuration));
CREATE TABLE zoi.festival_placements(id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id),event_id uuid NOT NULL REFERENCES zoi.listings(id),application_id uuid NOT NULL REFERENCES zoi.festival_applications(id),configuration text NOT NULL CHECK(configuration IN('front','side')),configuration_version integer NOT NULL CHECK(configuration_version>0),version integer NOT NULL CHECK(version>0),status text NOT NULL CHECK(status IN('draft','approved','revoked')),title text NOT NULL,description text NOT NULL,image_url text NOT NULL,destination_url text NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,approved_by uuid REFERENCES zoi.user_profiles(id),approved_at timestamptz,created_by uuid NOT NULL REFERENCES zoi.user_profiles(id),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),CHECK(isfinite(starts_at) AND isfinite(ends_at) AND ends_at>starts_at));
CREATE TABLE zoi.festival_placement_requests(actor uuid NOT NULL REFERENCES zoi.user_profiles(id),request uuid NOT NULL,workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id),event_id uuid NOT NULL REFERENCES zoi.listings(id),payload jsonb NOT NULL,receipt jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(actor,request));
CREATE TABLE zoi.festival_placement_audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor uuid NOT NULL REFERENCES zoi.user_profiles(id),workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id),event_id uuid NOT NULL REFERENCES zoi.listings(id),placement_id uuid,action text NOT NULL,before_state jsonb,after_state jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX festival_placement_public ON zoi.festival_placements(event_id,configuration,configuration_version,status,starts_at,ends_at);
CREATE INDEX festival_placement_actor_budget ON zoi.festival_placement_requests(actor,created_at);
ALTER TABLE zoi.festival_placement_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoi.festival_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoi.festival_placement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoi.festival_placement_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.festival_placement_scopes,zoi.festival_placements,zoi.festival_placement_requests,zoi.festival_placement_audit FROM PUBLIC,anon,authenticated;
CREATE FUNCTION zoi.festival_placement_authorize(p_workspace uuid,p_event uuid,p_manage boolean,p_public boolean DEFAULT true) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;member_role text;l zoi.listings;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'festival_permission_denied' USING ERRCODE='42501';END IF;
 SELECT id INTO actor FROM zoi.user_profiles WHERE auth_user_id=auth.uid();
 -- Match the legacy festival lock order: listing -> workspace -> package/application.
 SELECT * INTO l FROM zoi.listings WHERE id=p_event FOR SHARE;
 IF l.id IS NULL OR l.owner_workspace_id IS DISTINCT FROM p_workspace OR l.entity_type IS DISTINCT FROM 'event' THEN RAISE EXCEPTION 'festival_event_unavailable';END IF;
 IF p_public AND (l.publish_status IS DISTINCT FROM 'published' OR coalesce(l.marketplace_status,'')='hidden' OR coalesce(l.moderation_status,'') NOT IN('clean','cleared')) THEN RAISE EXCEPTION 'festival_event_unavailable';END IF;
 PERFORM 1 FROM zoi.workspaces WHERE id=p_workspace FOR UPDATE;
 SELECT role INTO member_role FROM zoi.workspace_members WHERE workspace_id=p_workspace AND profile_id=actor FOR SHARE;
 IF actor IS NULL OR coalesce(member_role,'') NOT IN('owner','admin','editor') OR (p_manage AND member_role NOT IN('owner','admin')) THEN RAISE EXCEPTION 'festival_permission_denied' USING ERRCODE='42501';END IF;
 RETURN actor;
END $$;
CREATE FUNCTION zoi.festival_placement_https(p_url text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(length(p_url) BETWEEN 12 AND 2048 AND p_url ~ '^https://([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?[.])+[A-Za-z]{2,63}(:443)?(/[A-Za-z0-9._~!$&()*+,;=:@%/?#-]*)?$' AND p_url !~* '%(0[0-9a-f]|1[0-9a-f]|7f)' AND p_url !~* '^https://([^.]+[.])*(localhost|local|internal|invalid)(:443)?(/|$)',false)
$$;
CREATE FUNCTION zoi.festival_placement_budget(p_actor uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF (SELECT count(*) FROM zoi.festival_placement_requests WHERE actor=p_actor AND created_at>clock_timestamp()-interval '1 day')>=300 THEN RAISE EXCEPTION 'festival_placement_limit';END IF;END $$;
CREATE FUNCTION public.festival_placement_scope_save(p_workspace uuid,p_event uuid,p_configuration text,p_expected_version integer,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;v_actor uuid;prior zoi.festival_placement_requests;s zoi.festival_placement_scopes;body jsonb;result jsonb;
BEGIN
 actor:=zoi.festival_placement_authorize(p_workspace,p_event,true);
 IF p_request IS NULL OR p_configuration IS NULL OR p_configuration NOT IN('front','side') OR p_expected_version IS NULL OR p_expected_version<0 THEN RAISE EXCEPTION 'invalid_placement_scope';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('festival-placement-actor:'||actor::text,0));
 v_actor:=zoi.festival_placement_authorize(p_workspace,p_event,true);IF v_actor IS DISTINCT FROM actor THEN RAISE EXCEPTION 'festival_permission_denied';END IF;
 body:=jsonb_build_object('kind','scope','workspace',p_workspace,'event',p_event,'configuration',p_configuration,'version',p_expected_version);
 SELECT * INTO prior FROM zoi.festival_placement_requests WHERE festival_placement_requests.actor=v_actor AND request=p_request;
 IF FOUND THEN IF prior.payload IS DISTINCT FROM body THEN RAISE EXCEPTION 'festival_request_conflict';END IF;RETURN prior.receipt;END IF;
 PERFORM zoi.festival_placement_budget(actor);
 SELECT * INTO s FROM zoi.festival_placement_scopes WHERE event_id=p_event AND configuration=p_configuration FOR UPDATE;
 IF s.event_id IS NOT NULL AND s.workspace_id IS DISTINCT FROM p_workspace THEN RAISE EXCEPTION 'placement_scope_ownership_changed';END IF;
 IF coalesce(s.version,0)<>p_expected_version THEN RAISE EXCEPTION 'festival_version_conflict';END IF;
 INSERT INTO zoi.festival_placement_scopes(event_id,workspace_id,configuration,version) VALUES(p_event,p_workspace,p_configuration,p_expected_version+1) ON CONFLICT(event_id,configuration) DO UPDATE SET version=excluded.version,updated_at=clock_timestamp() RETURNING * INTO s;
 result:=jsonb_build_object('ok',true,'scope',to_jsonb(s),'request_id',p_request);
 INSERT INTO zoi.festival_placement_requests VALUES(actor,p_request,p_workspace,p_event,body,result,clock_timestamp());
 INSERT INTO zoi.festival_placement_audit(actor,workspace_id,event_id,action,after_state) VALUES(actor,p_workspace,p_event,'scope_updated',to_jsonb(s));
 RETURN result;
END $$;
CREATE FUNCTION public.festival_placement_save(p_workspace uuid,p_event uuid,p_id uuid,p_expected_version integer,p_request uuid,p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;v_actor uuid;prior zoi.festival_placement_requests;old zoi.festival_placements;row_value zoi.festival_placements;application zoi.festival_applications;package zoi.festival_packages;scope zoi.festival_placement_scopes;body jsonb;result jsonb;app_id uuid;conf text;conf_version integer;starts timestamptz;ends timestamptz;
BEGIN
 actor:=zoi.festival_placement_authorize(p_workspace,p_event,true,p_action<>'revoke');
 IF p_request IS NULL OR p_id IS NULL OR p_action IS NULL OR p_action NOT IN('draft','approve','revoke') OR p_expected_version IS NULL OR p_expected_version<0 OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR octet_length(p_data::text)>10000 THEN RAISE EXCEPTION 'invalid_placement';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('festival-placement-actor:'||actor::text,0));
 v_actor:=zoi.festival_placement_authorize(p_workspace,p_event,true,p_action<>'revoke');IF v_actor IS DISTINCT FROM actor THEN RAISE EXCEPTION 'festival_permission_denied';END IF;
 body:=jsonb_build_object('kind','placement','workspace',p_workspace,'event',p_event,'id',p_id,'version',p_expected_version,'action',p_action,'data',p_data);
 SELECT * INTO prior FROM zoi.festival_placement_requests WHERE festival_placement_requests.actor=v_actor AND request=p_request;
 IF FOUND THEN IF prior.payload IS DISTINCT FROM body THEN RAISE EXCEPTION 'festival_request_conflict';END IF;RETURN prior.receipt;END IF;
 PERFORM zoi.festival_placement_budget(actor);
 PERFORM pg_advisory_xact_lock(hashtextextended('festival-placement-id:'||p_id::text,0));
 SELECT * INTO old FROM zoi.festival_placements WHERE id=p_id;
 IF old.id IS NOT NULL AND (old.workspace_id<>p_workspace OR old.event_id<>p_event) THEN RAISE EXCEPTION 'festival_permission_denied' USING ERRCODE='42501';END IF;
 IF p_action='draft' THEN
  IF (SELECT count(*) FROM jsonb_object_keys(p_data))<>9 OR NOT(p_data?'application_id' AND p_data?'configuration' AND p_data?'configuration_version' AND p_data?'title' AND p_data?'description' AND p_data?'image_url' AND p_data?'destination_url' AND p_data?'starts_at' AND p_data?'ends_at') OR jsonb_typeof(p_data->'title') IS DISTINCT FROM 'string' OR jsonb_typeof(p_data->'description') IS DISTINCT FROM 'string' OR jsonb_typeof(p_data->'image_url') IS DISTINCT FROM 'string' OR jsonb_typeof(p_data->'destination_url') IS DISTINCT FROM 'string' OR length(btrim(coalesce(p_data->>'title',''))) NOT BETWEEN 1 AND 120 OR length(coalesce(p_data->>'description',''))>600 OR NOT zoi.festival_placement_https(p_data->>'image_url') OR NOT zoi.festival_placement_https(p_data->>'destination_url') OR coalesce(p_data->>'starts_at','')!~'(Z|[+-][0-9]{2}:[0-9]{2})$' OR coalesce(p_data->>'ends_at','')!~'(Z|[+-][0-9]{2}:[0-9]{2})$' THEN RAISE EXCEPTION 'invalid_placement_artwork';END IF;
  BEGIN app_id:=(p_data->>'application_id')::uuid;conf:=p_data->>'configuration';conf_version:=(p_data->>'configuration_version')::integer;starts:=(p_data->>'starts_at')::timestamptz;ends:=(p_data->>'ends_at')::timestamptz;EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_placement_artwork';END;
 ELSE
  IF old.id IS NULL OR p_data<>'{}'::jsonb THEN RAISE EXCEPTION 'invalid_placement_transition';END IF;
  app_id:=old.application_id;conf:=old.configuration;conf_version:=old.configuration_version;starts:=old.starts_at;ends:=old.ends_at;
 END IF;
 IF p_action<>'revoke' THEN
  SELECT * INTO application FROM zoi.festival_applications WHERE id=app_id;
  SELECT * INTO package FROM zoi.festival_packages WHERE id=application.package_id FOR SHARE;
  SELECT * INTO application FROM zoi.festival_applications WHERE id=app_id FOR SHARE;
  IF application.id IS NULL OR application.workspace_id<>p_workspace OR application.event_id<>p_event OR application.status<>'approved' OR package.id IS NULL OR package.workspace_id<>p_workspace OR package.event_id<>p_event OR package.kind<>'sponsor' THEN RAISE EXCEPTION 'approved_sponsor_allocation_required';END IF;
  SELECT * INTO scope FROM zoi.festival_placement_scopes WHERE event_id=p_event AND configuration=conf;
  IF scope.event_id IS NULL OR scope.workspace_id<>p_workspace OR scope.version IS DISTINCT FROM conf_version THEN RAISE EXCEPTION 'placement_scope_changed';END IF;
  IF starts IS NULL OR ends IS NULL OR NOT isfinite(starts) OR NOT isfinite(ends) OR ends<=starts OR ends<=clock_timestamp() OR ends-starts>interval '366 days' THEN RAISE EXCEPTION 'invalid_placement_window';END IF;
 END IF;
 SELECT * INTO old FROM zoi.festival_placements WHERE id=p_id FOR UPDATE;
 IF coalesce(old.version,0)<>p_expected_version THEN RAISE EXCEPTION 'festival_version_conflict';END IF;
 IF p_action='draft' THEN
  IF old.id IS NULL AND (SELECT count(*) FROM zoi.festival_placements WHERE workspace_id=p_workspace)>=500 THEN RAISE EXCEPTION 'festival_placement_limit';END IF;
  INSERT INTO zoi.festival_placements(id,workspace_id,event_id,application_id,configuration,configuration_version,version,status,title,description,image_url,destination_url,starts_at,ends_at,created_by) VALUES(p_id,p_workspace,p_event,app_id,conf,conf_version,p_expected_version+1,'draft',btrim(p_data->>'title'),coalesce(p_data->>'description',''),p_data->>'image_url',p_data->>'destination_url',starts,ends,actor) ON CONFLICT(id) DO UPDATE SET application_id=excluded.application_id,configuration=excluded.configuration,configuration_version=excluded.configuration_version,version=excluded.version,status='draft',title=excluded.title,description=excluded.description,image_url=excluded.image_url,destination_url=excluded.destination_url,starts_at=excluded.starts_at,ends_at=excluded.ends_at,approved_by=NULL,approved_at=NULL,updated_at=clock_timestamp() RETURNING * INTO row_value;
 ELSIF p_action='approve' THEN
  IF old.status<>'draft' THEN RAISE EXCEPTION 'invalid_placement_transition';END IF;
  IF (SELECT count(*) FROM zoi.festival_placements occupied JOIN zoi.festival_applications allocated ON allocated.id=occupied.application_id AND allocated.status='approved' WHERE occupied.event_id=p_event AND occupied.workspace_id=p_workspace AND occupied.configuration=conf AND occupied.configuration_version=conf_version AND occupied.status='approved' AND occupied.starts_at<ends AND occupied.ends_at>starts)>=3 THEN RAISE EXCEPTION 'placement_slots_full';END IF;
  UPDATE zoi.festival_placements SET status='approved',version=version+1,approved_by=actor,approved_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=p_id RETURNING * INTO row_value;
 ELSE
  IF old.status='revoked' THEN RAISE EXCEPTION 'invalid_placement_transition';END IF;
  UPDATE zoi.festival_placements SET status='revoked',version=version+1,updated_at=clock_timestamp() WHERE id=p_id RETURNING * INTO row_value;
 END IF;
 result:=jsonb_build_object('ok',true,'placement',to_jsonb(row_value),'request_id',p_request,'artwork_source','external_image');
 INSERT INTO zoi.festival_placement_requests VALUES(actor,p_request,p_workspace,p_event,body,result,clock_timestamp());
 INSERT INTO zoi.festival_placement_audit(actor,workspace_id,event_id,placement_id,action,before_state,after_state) VALUES(actor,p_workspace,p_event,p_id,p_action,CASE WHEN old.id IS NULL THEN NULL ELSE to_jsonb(old) END,to_jsonb(row_value));RETURN result;
END $$;
CREATE FUNCTION public.festival_placement_operator(p_workspace uuid,p_event uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;scopes jsonb;placements jsonb;
BEGIN actor:=zoi.festival_placement_authorize(p_workspace,p_event,false,false);SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY configuration),'[]') INTO scopes FROM zoi.festival_placement_scopes s WHERE workspace_id=p_workspace AND event_id=p_event;SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY updated_at DESC),'[]') INTO placements FROM zoi.festival_placements p WHERE workspace_id=p_workspace AND event_id=p_event;RETURN jsonb_build_object('ok',true,'scopes',scopes,'placements',placements,'can_manage',zoi.ops_role(p_workspace) IN('owner','admin'),'artwork_source','external_image');END $$;
CREATE FUNCTION public.festival_placement_receipt(p_workspace uuid,p_event uuid,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid;r zoi.festival_placement_requests;
BEGIN v_actor:=zoi.festival_placement_authorize(p_workspace,p_event,true,false);PERFORM pg_advisory_xact_lock(hashtextextended('festival-placement-actor:'||v_actor::text,0));PERFORM zoi.festival_placement_authorize(p_workspace,p_event,true,false);SELECT * INTO r FROM zoi.festival_placement_requests WHERE festival_placement_requests.actor=v_actor AND request=p_request AND workspace_id=p_workspace AND event_id=p_event;RETURN jsonb_build_object('ok',true,'found',r.request IS NOT NULL,'receipt',r.receipt,'historical',true);END $$;
CREATE FUNCTION public.festival_placements_public(p_event uuid,p_configuration text,p_configuration_version integer) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('ok',true,'server_time',statement_timestamp(),'placements',coalesce((SELECT jsonb_agg(x ORDER BY x->>'id') FROM (SELECT jsonb_build_object('id',p.id,'event_id',p.event_id,'configuration',p.configuration,'configuration_version',p.configuration_version,'approval','approved','title',p.title,'description',p.description,'image_url',p.image_url,'destination_url',p.destination_url,'starts_at',p.starts_at,'ends_at',p.ends_at,'disclosure','Sponsored','artwork_source','external_image') x FROM zoi.festival_placements p JOIN zoi.listings l ON l.id=p.event_id AND l.owner_workspace_id=p.workspace_id JOIN zoi.festival_placement_scopes s ON s.event_id=p.event_id AND s.configuration=p.configuration AND s.workspace_id=p.workspace_id AND s.version=p.configuration_version JOIN zoi.festival_applications a ON a.id=p.application_id AND a.event_id=p.event_id AND a.workspace_id=p.workspace_id AND a.status='approved' JOIN zoi.festival_packages k ON k.id=a.package_id AND k.event_id=p.event_id AND k.workspace_id=p.workspace_id AND k.kind='sponsor' WHERE p.event_id=p_event AND p.configuration=p_configuration AND p.configuration_version=p_configuration_version AND p.status='approved' AND p.approved_by IS NOT NULL AND p.starts_at<=statement_timestamp() AND p.ends_at>statement_timestamp() AND l.entity_type='event' AND l.publish_status='published' AND coalesce(l.marketplace_status,'')<>'hidden' AND l.moderation_status IN('clean','cleared') ORDER BY p.id LIMIT 3) limited),'[]'))
$$;
REVOKE ALL ON FUNCTION zoi.festival_placement_authorize(uuid,uuid,boolean,boolean),zoi.festival_placement_https(text),zoi.festival_placement_budget(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.festival_placement_scope_save(uuid,uuid,text,integer,uuid),public.festival_placement_save(uuid,uuid,uuid,integer,uuid,text,jsonb),public.festival_placement_operator(uuid,uuid),public.festival_placement_receipt(uuid,uuid,uuid),public.festival_placements_public(uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.festival_placement_scope_save(uuid,uuid,text,integer,uuid),public.festival_placement_save(uuid,uuid,uuid,integer,uuid,text,jsonb),public.festival_placement_operator(uuid,uuid),public.festival_placement_receipt(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.festival_placements_public(uuid,text,integer) TO anon,authenticated;
COMMIT;

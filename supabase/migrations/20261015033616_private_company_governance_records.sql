-- Private governance records attached to canonical Company IDs. Named roles do not grant team access.
BEGIN;SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
CREATE TEMP TABLE company_private_expected(signature text,definition_hash text,owner_name text,acl text,config jsonb)ON COMMIT DROP;
INSERT INTO company_private_expected VALUES('zoi.suite_current_session()','8ceef7877aeb972d09d8694f6c85dff7','postgres','{postgres=X/postgres}','["search_path=\"\""]'::jsonb);
INSERT INTO company_private_expected VALUES('zoi.suite_lock_session()','04328c4d98e5f5671777a88435870c58','postgres','{postgres=X/postgres}','["search_path=\"\""]'::jsonb);
INSERT INTO company_private_expected VALUES('zoi.workspace_locked_role(uuid)','d335c58b5e4a8c5d53155eaa93b605b9','postgres','{postgres=X/postgres}','["search_path=\"\""]'::jsonb);
INSERT INTO company_private_expected VALUES('zoi.company_document_authority(uuid,text,uuid,boolean)','9f32ce6dda79d9308e16f82bc3badd38','postgres','{postgres=X/postgres}','["search_path=\"\""]'::jsonb);
DO $guard$DECLARE x record;p record;BEGIN
 FOR x IN SELECT*FROM company_private_expected LOOP
 SELECT md5(pg_get_functiondef(oid))AS definition_hash,pg_get_userbyid(proowner)AS owner_name,proacl::text AS acl,to_jsonb(proconfig)AS config INTO p FROM pg_proc WHERE oid=to_regprocedure(x.signature);
 IF p.definition_hash IS DISTINCT FROM x.definition_hash OR p.owner_name IS DISTINCT FROM x.owner_name OR p.acl IS DISTINCT FROM x.acl OR p.config IS DISTINCT FROM x.config THEN RAISE EXCEPTION 'company_private_foundation_definition_drift:%',x.signature;END IF;
 END LOOP;
 IF to_regclass('zoi.company_private_records')IS NOT NULL OR to_regprocedure('public.company_private_list(uuid,uuid,text,boolean,integer,integer)')IS NOT NULL THEN RAISE EXCEPTION 'company_private_candidate_already_exists';END IF;
END $guard$;

CREATE TABLE zoi.company_private_records(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id),company_id uuid NOT NULL REFERENCES zoi.ops_records(id),
 kind text NOT NULL CHECK(kind IN('minute','role','deadline')),data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'AND octet_length(data::text)<=24000),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),created_by uuid NOT NULL REFERENCES zoi.user_profiles(id),updated_by uuid NOT NULL REFERENCES zoi.user_profiles(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),archived_at timestamptz
);
CREATE INDEX company_private_records_scope ON zoi.company_private_records(workspace_id,company_id,updated_at DESC,id);
CREATE TABLE zoi.company_private_versions(
 record_id uuid NOT NULL REFERENCES zoi.company_private_records(id),version integer NOT NULL CHECK(version>0),workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id),company_id uuid NOT NULL REFERENCES zoi.ops_records(id),
 actor_profile_id uuid NOT NULL REFERENCES zoi.user_profiles(id),actor_name text NOT NULL,action text NOT NULL CHECK(action IN('save','archive','restore')),snapshot jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(record_id,version)
);
CREATE TABLE zoi.company_private_requests(
 account_id uuid NOT NULL,request_id uuid NOT NULL,actor_profile_id uuid NOT NULL REFERENCES zoi.user_profiles(id),workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id),company_id uuid NOT NULL REFERENCES zoi.ops_records(id),
 state text NOT NULL CHECK(state IN('saved','cancelled')),action text CHECK(action IN('save','archive','restore')),args_hash bytea,record_id uuid REFERENCES zoi.company_private_records(id),kind text,version integer,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(account_id,request_id)
);
CREATE INDEX company_private_requests_budget ON zoi.company_private_requests(account_id,created_at);
ALTER TABLE zoi.company_private_records OWNER TO postgres;ALTER TABLE zoi.company_private_versions OWNER TO postgres;ALTER TABLE zoi.company_private_requests OWNER TO postgres;
ALTER TABLE zoi.company_private_records ENABLE ROW LEVEL SECURITY;ALTER TABLE zoi.company_private_versions ENABLE ROW LEVEL SECURITY;ALTER TABLE zoi.company_private_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.company_private_records,zoi.company_private_versions,zoi.company_private_requests FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION zoi.company_private_immutable()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$BEGIN RAISE EXCEPTION 'company_private_history_immutable';END $fn$;
CREATE TRIGGER company_private_versions_immutable BEFORE UPDATE OR DELETE ON zoi.company_private_versions FOR EACH ROW EXECUTE FUNCTION zoi.company_private_immutable();
CREATE TRIGGER company_private_requests_immutable BEFORE UPDATE OR DELETE ON zoi.company_private_requests FOR EACH ROW EXECUTE FUNCTION zoi.company_private_immutable();
CREATE FUNCTION zoi.company_private_authority(p_workspace uuid,p_company uuid,p_write boolean,p_expected_actor uuid DEFAULT NULL)RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE actor uuid;c zoi.ops_records;
BEGIN
 actor:=zoi.company_document_authority(p_workspace,'ops_manage',p_expected_actor,true);
 SELECT * INTO c FROM zoi.ops_records WHERE id=p_company AND workspace_id=p_workspace AND kind='company'FOR SHARE;
 IF c.id IS NULL THEN RAISE EXCEPTION 'company_private_unavailable' USING errcode='42501';END IF;
 IF p_write AND c.archived_at IS NOT NULL THEN RAISE EXCEPTION 'company_private_company_archived';END IF;
 PERFORM zoi.company_document_authority(p_workspace,'ops_manage',actor,true);RETURN actor;
END $fn$;
CREATE FUNCTION zoi.company_private_validate(p_kind text,p_data jsonb)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE keys text[];local_time timestamp;start_date date;end_date date;
BEGIN
 IF p_kind IS NULL OR p_kind NOT IN('minute','role','deadline')OR jsonb_typeof(p_data)IS DISTINCT FROM'object'OR octet_length(p_data::text)>24000 THEN RAISE EXCEPTION 'invalid_company_private_record';END IF;
 keys:=CASE p_kind WHEN'minute'THEN ARRAY['title','local_at','timezone','participants','body']WHEN'role'THEN ARRAY['title','person','body','start_date','end_date']ELSE ARRAY['title','local_at','timezone','person','body','status']END;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_data)k WHERE k<>ALL(keys))OR EXISTS(SELECT 1 FROM jsonb_each(p_data)e WHERE jsonb_typeof(e.value)NOT IN('string','null'))OR length(btrim(coalesce(p_data->>'title','')))NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'invalid_company_private_record';END IF;
 IF length(coalesce(p_data->>'body',''))>16000 OR length(coalesce(p_data->>'participants',''))>2000 OR length(coalesce(p_data->>'person',''))>200 THEN RAISE EXCEPTION 'invalid_company_private_record';END IF;
 IF p_kind='minute'AND length(btrim(coalesce(p_data->>'body','')))=0 OR p_kind='role'AND length(btrim(coalesce(p_data->>'person','')))=0 THEN RAISE EXCEPTION 'invalid_company_private_record';END IF;
 IF p_kind IN('minute','deadline')THEN
  IF coalesce(p_data->>'local_at','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$'OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_data->>'timezone')THEN RAISE EXCEPTION 'invalid_company_private_time';END IF;
  BEGIN local_time:=(p_data->>'local_at')::timestamp;EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_company_private_time';END;
 END IF;
 IF p_kind='role'THEN
  BEGIN start_date:=nullif(p_data->>'start_date','')::date;end_date:=nullif(p_data->>'end_date','')::date;EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_company_private_time';END;
  IF start_date IS NOT NULL AND end_date<start_date THEN RAISE EXCEPTION 'invalid_company_private_time';END IF;
 END IF;
 IF p_kind='deadline'AND coalesce(p_data->>'status','')NOT IN('pending','completed')THEN RAISE EXCEPTION 'invalid_company_private_record';END IF;
 RETURN p_data||jsonb_build_object('title',btrim(p_data->>'title'));
END $fn$;
CREATE FUNCTION zoi.company_private_receipt(p_request zoi.company_private_requests)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_request.account_id IS DISTINCT FROM auth.uid()THEN RAISE EXCEPTION 'company_private_unavailable' USING errcode='42501';END IF;
 PERFORM zoi.company_private_authority(p_request.workspace_id,p_request.company_id,false,p_request.actor_profile_id);
 RETURN jsonb_build_object('ok',true,'schema_version',1,'account',p_request.account_id,'workspace',p_request.workspace_id,'company',p_request.company_id,'request',p_request.request_id,'state',p_request.state,'action',p_request.action,'record_id',p_request.record_id,'kind',p_request.kind,'version',p_request.version);
END $fn$;
CREATE FUNCTION public.company_private_list(p_workspace uuid,p_company uuid,p_kind text DEFAULT NULL,p_archived boolean DEFAULT false,p_limit integer DEFAULT 32,p_offset integer DEFAULT 0)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE actor uuid;rows jsonb;total bigint;c zoi.ops_records;
BEGIN
 actor:=zoi.company_private_authority(p_workspace,p_company,false);
 IF p_kind IS NOT NULL AND p_kind NOT IN('minute','role','deadline')OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 10000 OR p_archived IS NULL THEN RAISE EXCEPTION 'invalid_company_private_page';END IF;
 SELECT count(*)INTO total FROM zoi.company_private_records WHERE workspace_id=p_workspace AND company_id=p_company AND(p_kind IS NULL OR kind=p_kind)AND(p_archived OR archived_at IS NULL);
 SELECT coalesce(jsonb_agg(to_jsonb(r)ORDER BY r.updated_at DESC,r.id),'[]')INTO rows FROM(SELECT*FROM zoi.company_private_records WHERE workspace_id=p_workspace AND company_id=p_company AND(p_kind IS NULL OR kind=p_kind)AND(p_archived OR archived_at IS NULL)ORDER BY updated_at DESC,id LIMIT p_limit OFFSET p_offset)r;
 SELECT*INTO c FROM zoi.ops_records WHERE id=p_company;
 PERFORM zoi.company_private_authority(p_workspace,p_company,false,actor);
 RETURN jsonb_build_object('ok',true,'schema_version',1,'account',auth.uid(),'workspace',p_workspace,'company',jsonb_build_object('id',c.id,'title',c.title,'archived_at',c.archived_at),'records',rows,'total',total,'offset',p_offset,'limit',p_limit);
END $fn$;
CREATE FUNCTION public.company_private_get(p_workspace uuid,p_company uuid,p_id uuid,p_before_version integer DEFAULT NULL)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE actor uuid;r zoi.company_private_records;history jsonb;oldest integer;
BEGIN
 actor:=zoi.company_private_authority(p_workspace,p_company,false);
 IF p_before_version IS NOT NULL AND p_before_version<1 THEN RAISE EXCEPTION 'invalid_company_private_page';END IF;
 SELECT*INTO r FROM zoi.company_private_records WHERE id=p_id AND workspace_id=p_workspace AND company_id=p_company FOR SHARE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'company_private_unavailable' USING errcode='42501';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(v)ORDER BY v.version DESC),'[]'),min(v.version)INTO history,oldest FROM(SELECT*FROM zoi.company_private_versions WHERE record_id=p_id AND(p_before_version IS NULL OR version<p_before_version)ORDER BY version DESC LIMIT 20)v;
 PERFORM zoi.company_private_authority(p_workspace,p_company,false,actor);
 RETURN jsonb_build_object('ok',true,'schema_version',1,'account',auth.uid(),'workspace',p_workspace,'company',p_company,'record',to_jsonb(r),'history',history,'has_more',coalesce(oldest>1,false));
END $fn$;
CREATE FUNCTION public.company_private_request(p_workspace uuid,p_company uuid,p_request uuid,p_cancel_if_missing boolean DEFAULT false)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE actor uuid;r zoi.company_private_requests;
BEGIN
 actor:=zoi.company_private_authority(p_workspace,p_company,false);
 IF p_request IS NULL OR p_cancel_if_missing IS NULL THEN RAISE EXCEPTION 'invalid_company_private_request';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('company-private-request:'||auth.uid()::text||':'||p_request::text,0));
 SELECT*INTO r FROM zoi.company_private_requests WHERE account_id=auth.uid()AND request_id=p_request;
 IF r.request_id IS NOT NULL THEN
  IF r.workspace_id IS DISTINCT FROM p_workspace OR r.company_id IS DISTINCT FROM p_company OR r.actor_profile_id IS DISTINCT FROM actor THEN RAISE EXCEPTION 'company_private_unavailable' USING errcode='42501';END IF;
  RETURN zoi.company_private_receipt(r);
 END IF;
 IF NOT p_cancel_if_missing THEN PERFORM zoi.company_private_authority(p_workspace,p_company,false,actor);RETURN jsonb_build_object('ok',true,'schema_version',1,'account',auth.uid(),'workspace',p_workspace,'company',p_company,'request',p_request,'state','missing');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('company-private-budget:'||auth.uid()::text,0));
 IF(SELECT count(*)FROM zoi.company_private_requests WHERE account_id=auth.uid()AND created_at>clock_timestamp()-interval'24 hours')>=500 THEN RAISE EXCEPTION 'company_private_request_limit';END IF;
 INSERT INTO zoi.company_private_requests(account_id,request_id,actor_profile_id,workspace_id,company_id,state)VALUES(auth.uid(),p_request,actor,p_workspace,p_company,'cancelled')RETURNING*INTO r;
 RETURN zoi.company_private_receipt(r);
END $fn$;
CREATE FUNCTION public.company_private_mutate(p_workspace uuid,p_company uuid,p_request uuid,p_action text,p_args jsonb)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE actor uuid;receipt zoi.company_private_requests;r zoi.company_private_records;h bytea;record_id uuid;expected integer;new_data jsonb;
BEGIN
 -- Read authority allows recovery after company archive; new mutations below require active Company.
 actor:=zoi.company_private_authority(p_workspace,p_company,false);
 IF p_request IS NULL OR p_action IS NULL OR p_action NOT IN('save','archive','restore')OR jsonb_typeof(p_args)IS DISTINCT FROM'object'OR octet_length(p_args::text)>32000 THEN RAISE EXCEPTION 'invalid_company_private_request';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_args)k WHERE k<>ALL(CASE p_action WHEN'save'THEN ARRAY['id','expected_version','kind','data']ELSE ARRAY['id','expected_version']END))OR NOT(p_args?'id')OR jsonb_typeof(p_args->'expected_version')IS DISTINCT FROM'number'OR coalesce(p_args->>'expected_version','')!~'^[0-9]{1,9}$'THEN RAISE EXCEPTION 'invalid_company_private_request';END IF;
 h:=sha256(convert_to(jsonb_build_object('action',p_action,'args',p_args)::text,'UTF8'));
 PERFORM pg_advisory_xact_lock(hashtextextended('company-private-request:'||auth.uid()::text||':'||p_request::text,0));
 SELECT*INTO receipt FROM zoi.company_private_requests WHERE account_id=auth.uid()AND request_id=p_request;
 IF receipt.request_id IS NOT NULL THEN
  IF receipt.workspace_id IS DISTINCT FROM p_workspace OR receipt.company_id IS DISTINCT FROM p_company OR receipt.actor_profile_id IS DISTINCT FROM actor THEN RAISE EXCEPTION 'company_private_unavailable' USING errcode='42501';END IF;
  IF receipt.state='cancelled'THEN RAISE EXCEPTION 'company_private_request_cancelled';END IF;
  IF receipt.action IS DISTINCT FROM p_action OR receipt.args_hash IS DISTINCT FROM h THEN RAISE EXCEPTION 'company_private_request_conflict';END IF;
  RETURN zoi.company_private_receipt(receipt);
 END IF;
 PERFORM zoi.company_private_authority(p_workspace,p_company,true,actor);
 PERFORM pg_advisory_xact_lock(hashtextextended('company-private-budget:'||auth.uid()::text,0));
 IF(SELECT count(*)FROM zoi.company_private_requests WHERE account_id=auth.uid()AND created_at>clock_timestamp()-interval'24 hours')>=500 THEN RAISE EXCEPTION 'company_private_request_limit';END IF;
 expected:=(p_args->>'expected_version')::integer;
 BEGIN record_id:=(p_args->>'id')::uuid;EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_company_private_request';END;
 IF record_id IS NULL THEN
  IF p_action<>'save'OR expected<>0 THEN RAISE EXCEPTION 'company_private_version_conflict';END IF;
  new_data:=zoi.company_private_validate(p_args->>'kind',p_args->'data');
  INSERT INTO zoi.company_private_records(workspace_id,company_id,kind,data,created_by,updated_by)VALUES(p_workspace,p_company,p_args->>'kind',new_data,actor,actor)RETURNING*INTO r;
 ELSE
  SELECT*INTO r FROM zoi.company_private_records WHERE id=record_id AND workspace_id=p_workspace AND company_id=p_company FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'company_private_unavailable' USING errcode='42501';END IF;
  IF r.version IS DISTINCT FROM expected THEN RAISE EXCEPTION 'company_private_version_conflict';END IF;
  IF p_action='save'THEN
   IF r.archived_at IS NOT NULL THEN RAISE EXCEPTION 'company_private_record_archived';END IF;
   IF p_args->>'kind'IS DISTINCT FROM r.kind THEN RAISE EXCEPTION 'invalid_company_private_record';END IF;
   new_data:=zoi.company_private_validate(r.kind,p_args->'data');
   UPDATE zoi.company_private_records SET data=new_data,version=version+1,updated_at=clock_timestamp(),updated_by=actor WHERE id=r.id RETURNING*INTO r;
  ELSE
   IF(p_action='archive'AND r.archived_at IS NOT NULL)OR(p_action='restore'AND r.archived_at IS NULL)THEN RAISE EXCEPTION 'company_private_state_conflict';END IF;
   UPDATE zoi.company_private_records SET archived_at=CASE WHEN p_action='archive'THEN clock_timestamp()END,version=version+1,updated_at=clock_timestamp(),updated_by=actor WHERE id=r.id RETURNING*INTO r;
  END IF;
 END IF;
 INSERT INTO zoi.company_private_versions(record_id,version,workspace_id,company_id,actor_profile_id,actor_name,action,snapshot)VALUES(r.id,r.version,p_workspace,p_company,actor,left(coalesce(nullif((SELECT display_name FROM zoi.user_profiles WHERE id=actor),''),'Workspace team member'),160),p_action,to_jsonb(r));
 INSERT INTO zoi.company_private_requests(account_id,request_id,actor_profile_id,workspace_id,company_id,state,action,args_hash,record_id,kind,version)VALUES(auth.uid(),p_request,actor,p_workspace,p_company,'saved',p_action,h,r.id,r.kind,r.version)RETURNING*INTO receipt;
 PERFORM zoi.company_private_authority(p_workspace,p_company,true,actor);
 RETURN zoi.company_private_receipt(receipt);
END $fn$;
-- No private content is exposed through existing Operations records, audit, Documents or exports.
ALTER FUNCTION zoi.company_private_immutable() OWNER TO postgres;REVOKE ALL ON FUNCTION zoi.company_private_immutable() FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION zoi.company_private_authority(uuid,uuid,boolean,uuid) OWNER TO postgres;REVOKE ALL ON FUNCTION zoi.company_private_authority(uuid,uuid,boolean,uuid) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION zoi.company_private_validate(text,jsonb) OWNER TO postgres;REVOKE ALL ON FUNCTION zoi.company_private_validate(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION zoi.company_private_receipt(zoi.company_private_requests) OWNER TO postgres;REVOKE ALL ON FUNCTION zoi.company_private_receipt(zoi.company_private_requests) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION public.company_private_list(uuid,uuid,text,boolean,integer,integer) OWNER TO postgres;REVOKE ALL ON FUNCTION public.company_private_list(uuid,uuid,text,boolean,integer,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.company_private_list(uuid,uuid,text,boolean,integer,integer) TO authenticated;
ALTER FUNCTION public.company_private_get(uuid,uuid,uuid,integer) OWNER TO postgres;REVOKE ALL ON FUNCTION public.company_private_get(uuid,uuid,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.company_private_get(uuid,uuid,uuid,integer) TO authenticated;
ALTER FUNCTION public.company_private_request(uuid,uuid,uuid,boolean) OWNER TO postgres;REVOKE ALL ON FUNCTION public.company_private_request(uuid,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.company_private_request(uuid,uuid,uuid,boolean) TO authenticated;
ALTER FUNCTION public.company_private_mutate(uuid,uuid,uuid,text,jsonb) OWNER TO postgres;REVOKE ALL ON FUNCTION public.company_private_mutate(uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.company_private_mutate(uuid,uuid,uuid,text,jsonb) TO authenticated;
COMMIT;

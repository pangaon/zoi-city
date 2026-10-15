BEGIN;
SET LOCAL lock_timeout='5s';
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='zoi.social_channels'::regclass AND attname='connection_version' AND NOT attisdropped) OR to_regclass('zoi.social_connection_requests')IS NOT NULL OR to_regprocedure('public.social_connections_status(uuid)')IS NOT NULL OR to_regprocedure('public.social_connection_disconnect(uuid,bigint,bigint,uuid)')IS NOT NULL THEN RAISE EXCEPTION 'social_connection_schema_already_exists';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='zoi.social_channels'::regclass AND relkind='r' AND pg_get_userbyid(relowner)='postgres')THEN RAISE EXCEPTION 'social_connection_table_drift';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.assert_workspace_write(uuid,text[])'::regprocedure AND md5(prosrc)='0a1b64d6adee0e63726bab3c08b0be53'AND pg_get_userbyid(proowner)='postgres'AND proacl::text='{postgres=X/postgres}'AND prosecdef AND proconfig=ARRAY['search_path=""'])OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.workspace_locked_role(uuid)'::regprocedure AND md5(prosrc)='0c25b1e04d01e5866b58d009fa1f50b9'AND pg_get_userbyid(proowner)='postgres'AND proacl::text='{postgres=X/postgres}'AND prosecdef AND proconfig=ARRAY['search_path=""'])OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.suite_lock_session()'::regprocedure AND md5(prosrc)='ab5f8703ced5f96c0ac69257281ffe00'AND pg_get_userbyid(proowner)='postgres'AND proacl::text='{postgres=X/postgres}'AND prosecdef AND proconfig=ARRAY['search_path=""'])THEN RAISE EXCEPTION 'social_connection_authority_drift';END IF;
END $guard$;
ALTER TABLE zoi.social_channels ADD COLUMN connection_version bigint NOT NULL DEFAULT 1 CHECK(connection_version>0);
CREATE FUNCTION zoi.social_connection_version_guard()RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN NEW.connection_version:=OLD.connection_version+1;RETURN NEW;END$$;
REVOKE ALL ON FUNCTION zoi.social_connection_version_guard()FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER social_connection_version_guard BEFORE UPDATE ON zoi.social_channels FOR EACH ROW EXECUTE FUNCTION zoi.social_connection_version_guard();
CREATE TABLE zoi.social_connection_requests(account_id uuid NOT NULL,actor_id uuid NOT NULL REFERENCES zoi.user_profiles(id),workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id),request_id uuid NOT NULL,channel_id bigint NOT NULL,expected_version bigint NOT NULL,receipt jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(account_id,actor_id,workspace_id,request_id));
CREATE INDEX social_connection_requests_history ON zoi.social_connection_requests(workspace_id,created_at DESC,request_id);
CREATE INDEX social_connection_requests_account_time ON zoi.social_connection_requests(account_id,created_at DESC);
ALTER TABLE zoi.social_connection_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.social_connection_requests FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION zoi.social_connection_actor(p_workspace uuid)RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE actor uuid;BEGIN
 PERFORM zoi.assert_workspace_write(p_workspace,ARRAY['owner','admin']);
 SELECT id INTO actor FROM zoi.user_profiles WHERE auth_user_id=auth.uid()FOR SHARE;
 IF actor IS NULL THEN RAISE EXCEPTION 'social_connection_actor_unavailable' USING ERRCODE='42501';END IF;
 RETURN actor;
END$$;
REVOKE ALL ON FUNCTION zoi.social_connection_actor(uuid)FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.social_connections_status(p_workspace uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE actor uuid;rows jsonb;BEGIN
 actor:=zoi.social_connection_actor(p_workspace);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id::text,'platform',platform,'handle',handle,'display_name',display_name,'connected',coalesce(connected,false),'status',CASE WHEN status IN('connected','pending','disconnected','expired','error')THEN status ELSE 'unavailable' END,'connection_version',connection_version::text,'expires_at',token_expires_at)ORDER BY id),'[]')INTO rows FROM zoi.social_channels WHERE workspace_id=p_workspace;
 RETURN jsonb_build_object('ok',true,'schema_version',1,'workspace',p_workspace,'account',auth.uid(),'actor',actor,'immutable_receipts',true,'channels',rows);
END$$;
CREATE FUNCTION public.social_connection_disconnect(p_workspace uuid,p_channel bigint,p_expected_version bigint,p_request uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE actor uuid;prior zoi.social_connection_requests;c zoi.social_channels;result jsonb;BEGIN
 actor:=zoi.social_connection_actor(p_workspace);
 IF p_channel IS NULL OR p_channel<=0 OR p_expected_version IS NULL OR p_expected_version<=0 OR p_request IS NULL THEN RAISE EXCEPTION 'invalid_social_disconnect';END IF;
 -- Workspace authority locks precede nonce and channel locks. Successful receipts
 -- remain immutable, but every replay first proves current account/role/session.
 PERFORM pg_advisory_xact_lock(hashtextextended('social-connection-account:'||auth.uid()::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('social-disconnect:'||auth.uid()::text||':'||p_workspace::text||':'||p_request::text,0));
 SELECT *INTO prior FROM zoi.social_connection_requests WHERE account_id=auth.uid()AND actor_id=actor AND workspace_id=p_workspace AND request_id=p_request;
 IF FOUND THEN IF prior.channel_id<>p_channel OR prior.expected_version<>p_expected_version THEN RAISE EXCEPTION 'social_disconnect_request_conflict';END IF;RETURN prior.receipt;END IF;
 SELECT *INTO c FROM zoi.social_channels WHERE id=p_channel AND workspace_id=p_workspace FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'social_channel_unavailable' USING ERRCODE='42501';END IF;
 IF c.connection_version<>p_expected_version THEN RAISE EXCEPTION 'social_connection_version_conflict';END IF;
 IF c.connected IS NOT TRUE AND c.status='disconnected'AND c.access_token IS NULL AND c.refresh_token IS NULL THEN RAISE EXCEPTION 'social_channel_already_disconnected';END IF;
 IF(SELECT count(*)FROM(SELECT 1 FROM zoi.social_connection_requests WHERE account_id=auth.uid()AND created_at>clock_timestamp()-interval'24 hours'LIMIT 500)q)>=500 THEN RAISE EXCEPTION 'social_connection_request_limit';END IF;
 UPDATE zoi.social_channels SET connected=false,status='disconnected',access_token=NULL,refresh_token=NULL,token_expires_at=NULL,scopes=NULL,meta='{}',last_error=NULL,connected_by=NULL,updated_at=clock_timestamp()WHERE id=c.id RETURNING *INTO c;
 result:=jsonb_build_object('ok',true,'schema_version',1,'workspace',p_workspace,'account',auth.uid(),'actor',actor,'request',p_request,'channel',c.id::text,'expected_version',p_expected_version::text,'version',c.connection_version::text,'connected',false,'status','disconnected','local_credentials_removed',true,'provider_revoked',false);
 INSERT INTO zoi.social_connection_requests(account_id,actor_id,workspace_id,request_id,channel_id,expected_version,receipt)VALUES(auth.uid(),actor,p_workspace,p_request,c.id,p_expected_version,result);
 RETURN result;
END$$;
CREATE FUNCTION public.social_connection_history(p_workspace uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE actor uuid;rows jsonb;BEGIN
 actor:=zoi.social_connection_actor(p_workspace);
 SELECT coalesce(jsonb_agg(jsonb_build_object('request',request_id,'channel',channel_id::text,'actor',actor_id,'at',created_at,'action','local_disconnect','version',receipt->>'version','provider_revoked',false)ORDER BY created_at DESC,request_id),'[]')INTO rows FROM(SELECT *FROM zoi.social_connection_requests WHERE workspace_id=p_workspace ORDER BY created_at DESC,request_id LIMIT 100)q;
 RETURN jsonb_build_object('ok',true,'schema_version',1,'workspace',p_workspace,'history',rows);
END$$;
REVOKE ALL ON FUNCTION public.social_connections_status(uuid),public.social_connection_disconnect(uuid,bigint,bigint,uuid),public.social_connection_history(uuid)FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.social_connections_status(uuid),public.social_connection_disconnect(uuid,bigint,bigint,uuid),public.social_connection_history(uuid)TO authenticated;
COMMIT;

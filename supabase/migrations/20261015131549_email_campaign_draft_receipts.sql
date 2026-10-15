BEGIN;
SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='20s';
-- Preserve the existing canonical writer, its ACL and current-session authority.
DO $guard$BEGIN
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.email_campaign_save(uuid,text,text,text,text,text,uuid)'::regprocedure AND md5(prosrc)='91627dfcb5390940fba920a932dfc2fa' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}' AND proconfig=ARRAY['search_path=zoi, public'] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'email_draft_dependency_changed: email_campaign_save(uuid,text,text,text,text,text,uuid)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.assert_workspace_write(uuid,text[])'::regprocedure AND md5(prosrc)='0a1b64d6adee0e63726bab3c08b0be53' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig=ARRAY['search_path=""'] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'email_draft_dependency_changed: zoi.assert_workspace_write(uuid,text[])';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.workspace_locked_role(uuid)'::regprocedure AND md5(prosrc)='0c25b1e04d01e5866b58d009fa1f50b9' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig=ARRAY['search_path=""'] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'email_draft_dependency_changed: zoi.workspace_locked_role(uuid)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.suite_current_session()'::regprocedure AND md5(prosrc)='70cb927f126f251f229c450bf9f792e8' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig=ARRAY['search_path=""'] AND prosecdef=true AND provolatile='s')THEN RAISE EXCEPTION 'email_draft_dependency_changed: zoi.suite_current_session()';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.suite_lock_session()'::regprocedure AND md5(prosrc)='ab5f8703ced5f96c0ac69257281ffe00' AND proowner='postgres'::regrole AND proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}' AND proconfig=ARRAY['search_path=""'] AND prosecdef=true AND provolatile='v')THEN RAISE EXCEPTION 'email_draft_dependency_changed: zoi.suite_lock_session()';END IF;
END$guard$;
CREATE TABLE zoi.email_draft_requests(
 actor_id uuid NOT NULL,request_id uuid NOT NULL,workspace_id uuid NOT NULL,
 state text NOT NULL CHECK(state IN('saved','cancelled')),payload jsonb,
 campaign_id uuid,snapshot jsonb,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(request_id),
 CHECK((state='saved' AND payload IS NOT NULL AND campaign_id IS NOT NULL AND snapshot IS NOT NULL)
 OR(state='cancelled' AND payload IS NULL AND campaign_id IS NULL AND snapshot IS NULL))
);
ALTER TABLE zoi.email_draft_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.email_draft_requests FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION zoi.email_draft_request_immutable()RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'email_draft_request_immutable';END$$;
REVOKE ALL ON FUNCTION zoi.email_draft_request_immutable()FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER email_draft_request_immutable BEFORE UPDATE OR DELETE ON zoi.email_draft_requests FOR EACH ROW EXECUTE FUNCTION zoi.email_draft_request_immutable();

CREATE FUNCTION zoi.email_draft_receipt(p_actor uuid,p_workspace uuid,p_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r zoi.email_draft_requests;c jsonb;
BEGIN
 SELECT * INTO r FROM zoi.email_draft_requests WHERE request_id=p_request;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'actor_id',p_actor,'workspace_id',p_workspace,'request_id',p_request,'state','missing');END IF;
 IF r.actor_id IS DISTINCT FROM p_actor OR r.workspace_id IS DISTINCT FROM p_workspace THEN RAISE EXCEPTION 'email_draft_request_scope_conflict';END IF;
 IF r.campaign_id IS NOT NULL THEN SELECT to_jsonb(x)INTO c FROM zoi.email_campaigns x WHERE id=r.campaign_id AND workspace_id=p_workspace;END IF;
 RETURN jsonb_build_object('ok',true,'actor_id',p_actor,'workspace_id',p_workspace,'request_id',p_request,'state',CASE WHEN r.state='saved'AND c IS NULL THEN 'removed'ELSE r.state END,'campaign_id',r.campaign_id,'snapshot',r.snapshot,'campaign',c);
END$$;
REVOKE ALL ON FUNCTION zoi.email_draft_receipt(uuid,uuid,uuid)FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.email_campaign_draft_save(p_workspace uuid,p_request uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();prior zoi.email_draft_requests;campaign uuid;k text;original_id uuid;snapshot jsonb;
BEGIN
 PERFORM zoi.assert_workspace_write(p_workspace);
 IF p_request IS NULL THEN RAISE EXCEPTION 'email_draft_request_required';END IF;
 -- Workspace/member/session locks use the existing writer order, then serialize
 -- this nonce across actors and tenants. Authority is checked again after every wait.
 PERFORM pg_advisory_xact_lock(hashtextextended('email-draft:'||p_request::text,0));
 PERFORM zoi.assert_workspace_write(p_workspace);
 SELECT *INTO prior FROM zoi.email_draft_requests WHERE request_id=p_request;
 IF FOUND THEN
  IF prior.actor_id IS DISTINCT FROM actor OR prior.workspace_id IS DISTINCT FROM p_workspace THEN RAISE EXCEPTION 'email_draft_request_scope_conflict';END IF;
  IF prior.state='cancelled'THEN RAISE EXCEPTION 'email_draft_request_cancelled';END IF;
  IF prior.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'email_draft_request_payload_conflict';END IF;
  RETURN zoi.email_draft_receipt(actor,p_workspace,p_request);
 END IF;
 IF jsonb_typeof(p_payload)IS DISTINCT FROM 'object'OR octet_length(p_payload::text)>200000 OR NOT(p_payload ?& ARRAY['subject','body','preheader','from_name','audience','id'])THEN RAISE EXCEPTION 'email_draft_invalid_payload';END IF;
 FOR k IN SELECT jsonb_object_keys(p_payload)LOOP
  IF k NOT IN('subject','body','preheader','from_name','audience','id')OR jsonb_typeof(p_payload->k)NOT IN('string','null')THEN RAISE EXCEPTION 'email_draft_invalid_payload';END IF;
 END LOOP;
 IF length(btrim(coalesce(p_payload->>'subject',''))) =0 OR length(btrim(coalesce(p_payload->>'body','')))=0 THEN RAISE EXCEPTION 'email_draft_content_required';END IF;
 BEGIN original_id:=(p_payload->>'id')::uuid;EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'email_draft_invalid_payload';END;
 campaign:=public.email_campaign_save(p_workspace,p_payload->>'subject',p_payload->>'body',p_payload->>'preheader',p_payload->>'from_name',p_payload->>'audience',original_id);
 -- Canonical UPDATE can wait for a campaign lock after initial authorization.
 -- Refuse an expired/revoked session before retaining any factual change.
 PERFORM zoi.assert_workspace_write(p_workspace);
 SELECT to_jsonb(c)INTO snapshot FROM zoi.email_campaigns c WHERE c.id=campaign AND c.workspace_id=p_workspace AND c.status='draft';
 IF snapshot IS NULL THEN RAISE EXCEPTION 'email_draft_save_unconfirmed';END IF;
 INSERT INTO zoi.email_draft_requests(actor_id,request_id,workspace_id,state,payload,campaign_id,snapshot)VALUES(actor,p_request,p_workspace,'saved',p_payload,campaign,snapshot);
 RETURN zoi.email_draft_receipt(actor,p_workspace,p_request);
END$$;
REVOKE ALL ON FUNCTION public.email_campaign_draft_save(uuid,uuid,jsonb)FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.email_campaign_draft_save(uuid,uuid,jsonb)TO authenticated;

CREATE FUNCTION public.email_campaign_draft_status(p_workspace uuid,p_request uuid,p_cancel_if_missing boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();r jsonb;
BEGIN
 PERFORM zoi.assert_workspace_write(p_workspace);
 IF p_request IS NULL THEN RAISE EXCEPTION 'email_draft_request_required';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('email-draft:'||p_request::text,0));
 PERFORM zoi.assert_workspace_write(p_workspace);
 r:=zoi.email_draft_receipt(actor,p_workspace,p_request);
 IF r->>'state'='missing'AND p_cancel_if_missing THEN
  INSERT INTO zoi.email_draft_requests(actor_id,request_id,workspace_id,state)VALUES(actor,p_request,p_workspace,'cancelled');
  RETURN zoi.email_draft_receipt(actor,p_workspace,p_request);
 END IF;
 RETURN r;
END$$;
REVOKE ALL ON FUNCTION public.email_campaign_draft_status(uuid,uuid,boolean)FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.email_campaign_draft_status(uuid,uuid,boolean)TO authenticated;
COMMIT;

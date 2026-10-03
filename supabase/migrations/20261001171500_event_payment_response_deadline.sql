BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$BEGIN IF md5(pg_get_functiondef('zoi.event_payment_policy_view(uuid,uuid)'::regprocedure))<>'e47614082fc35f473da4481caa59e108' THEN RAISE EXCEPTION 'payment_definition_changed: zoi.event_payment_policy_view(uuid,uuid)';END IF;END$$;
DO $$BEGIN IF md5(pg_get_functiondef('public.event_payment_policy_get(uuid,uuid)'::regprocedure))<>'950a2c73162310a0d9946a72724216ee' THEN RAISE EXCEPTION 'payment_definition_changed: public.event_payment_policy_get(uuid,uuid)';END IF;END$$;
DO $$BEGIN IF md5(pg_get_functiondef('public.event_payment_policy_save(uuid,uuid,integer,uuid,boolean,boolean)'::regprocedure))<>'86a0dc9c8010b8e280f9ff710a42110a' THEN RAISE EXCEPTION 'payment_definition_changed: public.event_payment_policy_save(uuid,uuid,integer,uuid,boolean,boolean)';END IF;END$$;
DO $$BEGIN IF md5(pg_get_functiondef('public.event_guest_payment_options(uuid)'::regprocedure))<>'549cbca2f79c10cdb3bbb88863e89f6d' THEN RAISE EXCEPTION 'payment_definition_changed: public.event_guest_payment_options(uuid)';END IF;END$$;
DO $$BEGIN IF md5(pg_get_functiondef('public.event_guest_payment_choose(uuid,text,integer,integer,uuid)'::regprocedure))<>'8c3ccf3cb146a546fbd4c0940a9e3031' THEN RAISE EXCEPTION 'payment_definition_changed: public.event_guest_payment_choose(uuid,text,integer,integer,uuid)';END IF;END$$;
DO $$BEGIN IF md5(pg_get_functiondef('public.event_payment_operator_report(uuid,uuid)'::regprocedure))<>'456aa9e77ced13851af4469d4b3547cf' THEN RAISE EXCEPTION 'payment_definition_changed: public.event_payment_operator_report(uuid,uuid)';END IF;END$$;
ALTER TABLE zoi.event_payment_policies ADD COLUMN response_deadline timestamptz;
CREATE OR REPLACE FUNCTION zoi.event_payment_policy_view(p_event uuid,p_workspace uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('event_id',p_event,'version',coalesce(p.version,0),'allow_pay_at_door',coalesce(p.allow_pay_at_door,false),'allow_pay_online',false,'online_connected',false,'response_deadline',p.response_deadline,'response_open',p.response_deadline IS NULL OR p.response_deadline>clock_timestamp()) FROM (SELECT 1) seed LEFT JOIN zoi.event_payment_policies p ON p.event_id=p_event AND p.workspace_id=p_workspace
$$;
CREATE FUNCTION zoi.event_payment_operator_current(p_workspace uuid,p_event uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE a uuid;r text;BEGIN
 PERFORM 1 FROM zoi.workspaces WHERE id=p_workspace FOR SHARE;
 a:=zoi.table_inventory_operator(p_workspace,p_event);
 r:=zoi.workspace_current_role(p_workspace);IF coalesce(r,'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'not_authorized' USING errcode='42501';END IF;
 PERFORM zoi.suite_lock_session();RETURN a;
END$$;
CREATE FUNCTION zoi.event_payment_cancelled(p_actor uuid,p_request uuid,p_kind text,p_scope jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE r zoi.event_host_requests;BEGIN
 SELECT * INTO r FROM zoi.event_host_requests WHERE actor=p_actor AND request=p_request;
 IF FOUND AND r.payload->>'kind'='cancelled' THEN
  IF r.payload->>'operation' IS DISTINCT FROM p_kind OR r.payload->'scope' IS DISTINCT FROM p_scope THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN r.receipt;
 END IF;RETURN NULL;
END$$;
CREATE OR REPLACE FUNCTION public.event_payment_policy_get(p_workspace uuid,p_event uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM zoi.event_payment_operator_current(p_workspace,p_event);IF NOT EXISTS(SELECT 1 FROM zoi.event_table_settings WHERE event_id=p_event AND workspace_id=p_workspace) THEN RAISE EXCEPTION 'inventory_unavailable';END IF;RETURN jsonb_build_object('ok',true,'policy',zoi.event_payment_policy_view(p_event,p_workspace),'payment_collected',false,'ticket_issued',false);END $$;
CREATE OR REPLACE FUNCTION public.event_payment_policy_save(p_workspace uuid,p_event uuid,p_expected_version integer,p_request uuid,p_allow_pay_at_door boolean,p_allow_pay_online boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor_id uuid:=zoi.table_inventory_actor();prior zoi.event_host_requests;payload jsonb;policy zoi.event_payment_policies;receipt jsonb;
BEGIN
 IF p_request IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR p_allow_pay_at_door IS NULL OR p_allow_pay_online IS NULL THEN RAISE EXCEPTION 'invalid_payment_policy';END IF;
 IF p_allow_pay_online THEN RAISE EXCEPTION 'online_provider_unavailable';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||actor_id::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||actor_id::text,0));
 PERFORM zoi.event_payment_operator_current(p_workspace,p_event);
 PERFORM 1 FROM zoi.event_table_settings WHERE event_id=p_event AND workspace_id=p_workspace FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'inventory_unavailable';END IF;
 PERFORM zoi.event_payment_operator_current(p_workspace,p_event);
 receipt:=zoi.event_payment_cancelled(actor_id,p_request,'payment_policy',jsonb_build_object('workspace',p_workspace,'event',p_event));IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 payload:=jsonb_build_object('kind','payment_policy','workspace',p_workspace,'event',p_event,'version',p_expected_version,'allow_pay_at_door',p_allow_pay_at_door,'allow_pay_online',p_allow_pay_online);
 SELECT * INTO prior FROM zoi.event_host_requests WHERE actor=actor_id AND request=p_request;IF FOUND THEN IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN prior.receipt||jsonb_build_object('request_id',p_request,'scope',CASE WHEN payload->>'kind'='payment_policy' THEN jsonb_build_object('workspace',payload->'workspace','event',payload->'event') ELSE jsonb_build_object('guest',payload->'guest') END);END IF;
 PERFORM zoi.event_host_budget(actor_id);
 SELECT * INTO policy FROM zoi.event_payment_policies WHERE event_id=p_event FOR UPDATE;
 IF policy.event_id IS NOT NULL AND policy.workspace_id IS DISTINCT FROM p_workspace THEN RAISE EXCEPTION 'payment_policy_ownership_changed';END IF;
 IF coalesce(policy.version,0)<>p_expected_version THEN RAISE EXCEPTION 'version_conflict';END IF;
 INSERT INTO zoi.event_payment_policies(event_id,workspace_id,version,allow_pay_at_door) VALUES(p_event,p_workspace,p_expected_version+1,p_allow_pay_at_door) ON CONFLICT(event_id) DO UPDATE SET version=excluded.version,allow_pay_at_door=excluded.allow_pay_at_door,updated_at=clock_timestamp();
 receipt:=jsonb_build_object('request_id',p_request,'scope',jsonb_build_object('workspace',p_workspace,'event',p_event),'ok',true,'policy',zoi.event_payment_policy_view(p_event,p_workspace),'payment_collected',false,'ticket_issued',false);INSERT INTO zoi.event_host_requests(actor,request,payload,receipt) VALUES(actor_id,p_request,payload,receipt);RETURN receipt;
END $$;
CREATE OR REPLACE FUNCTION public.event_payment_policy_configure(p_workspace uuid,p_event uuid,p_expected_version integer,p_request uuid,p_allow_pay_at_door boolean,p_allow_pay_online boolean,p_response_deadline timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor_id uuid:=zoi.table_inventory_actor();prior zoi.event_host_requests;payload jsonb;policy zoi.event_payment_policies;receipt jsonb;
BEGIN
 IF p_request IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR p_allow_pay_at_door IS NULL OR p_allow_pay_online IS NULL THEN RAISE EXCEPTION 'invalid_payment_policy';END IF;
 IF p_allow_pay_online THEN RAISE EXCEPTION 'online_provider_unavailable';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||actor_id::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||actor_id::text,0));
 PERFORM zoi.event_payment_operator_current(p_workspace,p_event);
 PERFORM 1 FROM zoi.event_table_settings WHERE event_id=p_event AND workspace_id=p_workspace FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'inventory_unavailable';END IF;
 PERFORM zoi.event_payment_operator_current(p_workspace,p_event);
 receipt:=zoi.event_payment_cancelled(actor_id,p_request,'payment_policy',jsonb_build_object('workspace',p_workspace,'event',p_event));IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 payload:=jsonb_build_object('kind','payment_policy','workspace',p_workspace,'event',p_event,'version',p_expected_version,'allow_pay_at_door',p_allow_pay_at_door,'allow_pay_online',p_allow_pay_online,'response_deadline',p_response_deadline);
 SELECT * INTO prior FROM zoi.event_host_requests WHERE actor=actor_id AND request=p_request;IF FOUND THEN IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN prior.receipt||jsonb_build_object('request_id',p_request,'scope',CASE WHEN payload->>'kind'='payment_policy' THEN jsonb_build_object('workspace',payload->'workspace','event',payload->'event') ELSE jsonb_build_object('guest',payload->'guest') END);END IF;
 PERFORM zoi.event_host_budget(actor_id);
 SELECT * INTO policy FROM zoi.event_payment_policies WHERE event_id=p_event FOR UPDATE;
 IF policy.event_id IS NOT NULL AND policy.workspace_id IS DISTINCT FROM p_workspace THEN RAISE EXCEPTION 'payment_policy_ownership_changed';END IF;
 IF coalesce(policy.version,0)<>p_expected_version THEN RAISE EXCEPTION 'version_conflict';END IF;
 IF p_response_deadline IS NOT NULL AND (NOT isfinite(p_response_deadline) OR p_response_deadline<=clock_timestamp() OR NOT EXISTS(SELECT 1 FROM zoi.event_table_settings WHERE event_id=p_event AND workspace_id=p_workspace AND starts_at IS NOT NULL AND isfinite(starts_at) AND p_response_deadline<=starts_at)) THEN RAISE EXCEPTION 'invalid_response_deadline';END IF;
 INSERT INTO zoi.event_payment_policies(event_id,workspace_id,version,allow_pay_at_door,response_deadline) VALUES(p_event,p_workspace,p_expected_version+1,p_allow_pay_at_door,p_response_deadline) ON CONFLICT(event_id) DO UPDATE SET version=excluded.version,allow_pay_at_door=excluded.allow_pay_at_door,response_deadline=excluded.response_deadline,updated_at=clock_timestamp();
 receipt:=jsonb_build_object('request_id',p_request,'scope',jsonb_build_object('workspace',p_workspace,'event',p_event),'ok',true,'policy',zoi.event_payment_policy_view(p_event,p_workspace),'payment_collected',false,'ticket_issued',false);INSERT INTO zoi.event_host_requests(actor,request,payload,receipt) VALUES(actor_id,p_request,payload,receipt);RETURN receipt;
END $$;
CREATE OR REPLACE FUNCTION public.event_guest_payment_choose(p_guest uuid,p_method text,p_expected_policy_version integer,p_expected_version integer,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor_id uuid:=zoi.table_inventory_actor();guest zoi.event_host_guests;allocation zoi.event_host_allocations;policy zoi.event_payment_policies;choice zoi.event_guest_payment_preferences;prior zoi.event_host_requests;payload jsonb;receipt jsonb;v_event uuid;
BEGIN
 IF p_request IS NULL OR p_guest IS NULL OR p_method IS NULL OR p_expected_policy_version IS NULL OR p_expected_policy_version<1 OR p_expected_version IS NULL OR p_expected_version<0 THEN RAISE EXCEPTION 'invalid_payment_choice';END IF;
 IF p_method='pay_online' THEN RAISE EXCEPTION 'online_provider_unavailable';END IF;IF p_method<>'pay_at_door' THEN RAISE EXCEPTION 'payment_method_unavailable';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||actor_id::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||actor_id::text,0));
 SELECT a.event_id INTO v_event FROM zoi.event_host_guests g JOIN zoi.event_host_allocations a ON a.id=g.event_allocation_id WHERE g.id=p_guest;
 PERFORM 1 FROM zoi.event_table_settings s WHERE s.event_id=v_event FOR UPDATE;
 allocation:=zoi.event_payment_guest_authorize(p_guest,actor_id);SELECT * INTO guest FROM zoi.event_host_guests WHERE id=p_guest FOR UPDATE;
 PERFORM zoi.suite_lock_session();
 receipt:=zoi.event_payment_cancelled(actor_id,p_request,'payment_choice',jsonb_build_object('guest',p_guest));IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 payload:=jsonb_build_object('kind','payment_choice','guest',p_guest,'method',p_method,'policy_version',p_expected_policy_version,'version',p_expected_version);
 SELECT * INTO prior FROM zoi.event_host_requests WHERE actor=actor_id AND request=p_request;IF FOUND THEN IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN prior.receipt||jsonb_build_object('request_id',p_request,'scope',CASE WHEN payload->>'kind'='payment_policy' THEN jsonb_build_object('workspace',payload->'workspace','event',payload->'event') ELSE jsonb_build_object('guest',payload->'guest') END);END IF;
 PERFORM zoi.event_host_budget(actor_id);
 SELECT * INTO policy FROM zoi.event_payment_policies WHERE event_payment_policies.event_id=allocation.event_id FOR UPDATE;
 IF policy.workspace_id IS DISTINCT FROM allocation.workspace_id OR NOT coalesce(policy.allow_pay_at_door,false) THEN RAISE EXCEPTION 'payment_method_unavailable';END IF;
 IF policy.version<>p_expected_policy_version THEN RAISE EXCEPTION 'payment_policy_changed';END IF;
 SELECT * INTO choice FROM zoi.event_guest_payment_preferences WHERE guest_id=p_guest FOR UPDATE;
 PERFORM zoi.suite_lock_session();
 IF policy.response_deadline IS NOT NULL AND policy.response_deadline<=clock_timestamp() THEN RAISE EXCEPTION 'payment_response_closed';END IF;
 IF coalesce(choice.version,0)<>p_expected_version THEN RAISE EXCEPTION 'version_conflict';END IF;
 INSERT INTO zoi.event_guest_payment_preferences(guest_id,actor,policy_version,version,method) VALUES(p_guest,actor_id,policy.version,p_expected_version+1,p_method) ON CONFLICT(guest_id) DO UPDATE SET actor=excluded.actor,policy_version=excluded.policy_version,version=excluded.version,method=excluded.method,updated_at=clock_timestamp();
 receipt:=jsonb_build_object('request_id',p_request,'scope',jsonb_build_object('guest',p_guest),'ok',true,'guest_id',guest.id,'event_id',allocation.event_id,'quantity',guest.quantity,'price_per_guest_cents',allocation.price_per_guest_cents,'currency',allocation.currency,'choice',jsonb_build_object('method',p_method,'policy_version',policy.version,'version',p_expected_version+1,'status','unpaid'),'payment_collected',false,'ticket_issued',false);
 INSERT INTO zoi.event_host_requests(actor,request,payload,receipt) VALUES(actor_id,p_request,payload,receipt);RETURN receipt;
END $$;
CREATE OR REPLACE FUNCTION public.event_guest_payment_options(p_event uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor_id uuid:=zoi.table_inventory_actor();rows jsonb;total integer;
BEGIN
 PERFORM zoi.suite_lock_session();
 SELECT count(*) INTO total FROM zoi.event_host_guests g JOIN zoi.event_host_allocations a ON a.id=g.event_allocation_id WHERE g.claimed_by=actor_id AND g.status='accepted' AND (p_event IS NULL OR a.event_id=p_event) AND zoi.event_host_valid(a);
 SELECT coalesce(jsonb_agg(x ORDER BY x->>'expires_at',x->>'guest_id'),'[]') INTO rows FROM (
 SELECT jsonb_build_object('guest_id',g.id,'event_id',a.event_id,'event_name',l.name,'table_id',a.table_id,'table_label',a.label,'quantity',g.quantity,'price_per_guest_cents',a.price_per_guest_cents,'currency',a.currency,'expires_at',a.expires_at,'policy',zoi.event_payment_policy_view(a.event_id,a.workspace_id),'choice',CASE WHEN c.guest_id IS NULL THEN NULL ELSE jsonb_build_object('method',c.method,'version',c.version,'policy_version',c.policy_version,'status',CASE WHEN p.workspace_id=a.workspace_id AND p.allow_pay_at_door AND p.version=c.policy_version THEN 'unpaid' ELSE 'needs_review' END) END) x
 FROM zoi.event_host_guests g JOIN zoi.event_host_allocations a ON a.id=g.event_allocation_id JOIN zoi.listings l ON l.id=a.event_id LEFT JOIN zoi.event_guest_payment_preferences c ON c.guest_id=g.id AND c.actor=actor_id LEFT JOIN zoi.event_payment_policies p ON p.event_id=a.event_id
 WHERE g.claimed_by=actor_id AND g.status='accepted' AND (p_event IS NULL OR a.event_id=p_event) AND zoi.event_host_valid(a) ORDER BY a.expires_at,g.id LIMIT 100) limited;
 RETURN jsonb_build_object('ok',true,'guests',rows,'total',total,'payment_collected',false,'ticket_issued',false);
END $$;
CREATE OR REPLACE FUNCTION public.event_payment_operator_report(p_workspace uuid,p_event uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb;total integer;
BEGIN PERFORM zoi.event_payment_operator_current(p_workspace,p_event);
 SELECT count(*) INTO total FROM zoi.event_host_guests g JOIN zoi.event_host_allocations a ON a.id=g.event_allocation_id JOIN zoi.event_guest_payment_preferences c ON c.guest_id=g.id AND c.actor=g.claimed_by WHERE a.event_id=p_event AND a.workspace_id=p_workspace AND g.status='accepted' AND zoi.event_host_valid(a);
 SELECT coalesce(jsonb_agg(x ORDER BY x->>'table_label',x->>'guest_id'),'[]') INTO rows FROM (
 SELECT jsonb_build_object('guest_id',g.id,'guest_label',g.label,'table_label',a.label,'quantity',g.quantity,'currency',a.currency,'unpaid_preference_cents',g.quantity::bigint*a.price_per_guest_cents,'method',c.method,'status',CASE WHEN p.workspace_id=a.workspace_id AND p.allow_pay_at_door AND p.version=c.policy_version THEN 'unpaid' ELSE 'needs_review' END) x FROM zoi.event_host_guests g JOIN zoi.event_host_allocations a ON a.id=g.event_allocation_id JOIN zoi.event_guest_payment_preferences c ON c.guest_id=g.id AND c.actor=g.claimed_by LEFT JOIN zoi.event_payment_policies p ON p.event_id=a.event_id WHERE a.event_id=p_event AND a.workspace_id=p_workspace AND g.status='accepted' AND zoi.event_host_valid(a) ORDER BY a.label,g.id LIMIT 1000) limited;
 RETURN jsonb_build_object('ok',true,'event_id',p_event,'preferences',rows,'total',total,'payment_collected',false,'ticket_issued',false,'settlement_ledger',false);
END $$;
CREATE FUNCTION public.event_payment_request(p_request uuid,p_kind text,p_scope jsonb,p_cancel_if_missing boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE a uuid:=zoi.table_inventory_actor();r zoi.event_host_requests;result jsonb;allocation zoi.event_host_allocations;BEGIN
 IF p_request IS NULL OR p_kind IS NULL OR p_kind NOT IN('payment_policy','payment_choice') OR jsonb_typeof(p_scope) IS DISTINCT FROM 'object' OR p_cancel_if_missing IS NULL THEN RAISE EXCEPTION 'invalid_request';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||a::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||a::text,0));
 IF p_kind='payment_policy' THEN
  IF (SELECT count(*)FROM jsonb_object_keys(p_scope))<>2 OR NOT(p_scope?'workspace' AND p_scope?'event') THEN RAISE EXCEPTION 'invalid_request';END IF;
  PERFORM zoi.event_payment_operator_current((p_scope->>'workspace')::uuid,(p_scope->>'event')::uuid);
  PERFORM 1 FROM zoi.event_table_settings WHERE event_id=(p_scope->>'event')::uuid AND workspace_id=(p_scope->>'workspace')::uuid FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'inventory_unavailable';END IF;
  PERFORM zoi.event_payment_operator_current((p_scope->>'workspace')::uuid,(p_scope->>'event')::uuid);
 ELSE
  IF (SELECT count(*)FROM jsonb_object_keys(p_scope))<>1 OR NOT(p_scope?'guest') THEN RAISE EXCEPTION 'invalid_request';END IF;
  allocation:=zoi.event_payment_guest_authorize((p_scope->>'guest')::uuid,a);
  PERFORM 1 FROM zoi.event_table_settings WHERE event_id=allocation.event_id FOR UPDATE;
  allocation:=zoi.event_payment_guest_authorize((p_scope->>'guest')::uuid,a);
 END IF;
 PERFORM zoi.suite_lock_session();
 SELECT * INTO r FROM zoi.event_host_requests WHERE actor=a AND request=p_request;
 IF FOUND THEN
  IF r.payload->>'kind'='cancelled' THEN result:=zoi.event_payment_cancelled(a,p_request,p_kind,p_scope);
  ELSE
   IF r.payload->>'kind' IS DISTINCT FROM p_kind OR (p_kind='payment_policy' AND (r.payload->>'workspace' IS DISTINCT FROM p_scope->>'workspace' OR r.payload->>'event' IS DISTINCT FROM p_scope->>'event')) OR (p_kind='payment_choice' AND r.payload->>'guest' IS DISTINCT FROM p_scope->>'guest') THEN RAISE EXCEPTION 'request_conflict';END IF;
   result:=r.receipt||jsonb_build_object('request_id',p_request,'scope',p_scope);
  END IF;
  RETURN jsonb_build_object('request_id',p_request,'kind',p_kind,'scope',p_scope,'ok',true,'found',true,'receipt',result,'historical',true);
 END IF;
 IF NOT p_cancel_if_missing THEN RETURN jsonb_build_object('request_id',p_request,'kind',p_kind,'scope',p_scope,'ok',true,'found',false,'receipt',null);END IF;
 PERFORM zoi.event_host_budget(a);
 result:=jsonb_build_object('ok',true,'status','cancelled','request_id',p_request,'kind',p_kind,'scope',p_scope,'payment_collected',false,'ticket_issued',false);
 INSERT INTO zoi.event_host_requests(actor,request,payload,receipt)VALUES(a,p_request,jsonb_build_object('kind','cancelled','operation',p_kind,'scope',p_scope),result);
 RETURN jsonb_build_object('request_id',p_request,'kind',p_kind,'scope',p_scope,'ok',true,'found',true,'receipt',result,'historical',true);
END$$;
REVOKE ALL ON FUNCTION zoi.event_payment_operator_current(uuid,uuid),zoi.event_payment_cancelled(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.event_payment_policy_configure(uuid,uuid,integer,uuid,boolean,boolean,timestamptz),public.event_payment_request(uuid,text,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.event_payment_policy_configure(uuid,uuid,integer,uuid,boolean,boolean,timestamptz),public.event_payment_request(uuid,text,jsonb,boolean) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

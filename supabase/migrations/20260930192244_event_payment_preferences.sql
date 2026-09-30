BEGIN;
SET LOCAL lock_timeout='5s';
-- Payment intent only. No online provider, monetary settlement or admission issuance.
CREATE TABLE zoi.event_payment_policies(event_id uuid PRIMARY KEY REFERENCES zoi.event_table_settings(event_id),workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id),version integer NOT NULL CHECK(version>0),allow_pay_at_door boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE zoi.event_guest_payment_preferences(guest_id uuid PRIMARY KEY REFERENCES zoi.event_host_guests(id),actor uuid NOT NULL REFERENCES zoi.user_profiles(id),policy_version integer NOT NULL CHECK(policy_version>0),version integer NOT NULL CHECK(version>0),method text NOT NULL CHECK(method='pay_at_door'),updated_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE zoi.event_payment_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoi.event_guest_payment_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.event_payment_policies,zoi.event_guest_payment_preferences FROM PUBLIC,anon,authenticated;
CREATE FUNCTION zoi.event_payment_policy_view(p_event uuid,p_workspace uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('event_id',p_event,'version',coalesce(p.version,0),'allow_pay_at_door',coalesce(p.allow_pay_at_door,false),'allow_pay_online',false,'online_connected',false) FROM (SELECT 1) seed LEFT JOIN zoi.event_payment_policies p ON p.event_id=p_event AND p.workspace_id=p_workspace
$$;
CREATE FUNCTION public.event_payment_policy_get(p_workspace uuid,p_event uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM zoi.table_inventory_operator(p_workspace,p_event);IF NOT EXISTS(SELECT 1 FROM zoi.event_table_settings WHERE event_id=p_event AND workspace_id=p_workspace) THEN RAISE EXCEPTION 'inventory_unavailable';END IF;RETURN jsonb_build_object('ok',true,'policy',zoi.event_payment_policy_view(p_event,p_workspace),'payment_collected',false,'ticket_issued',false);END $$;
CREATE FUNCTION public.event_payment_policy_save(p_workspace uuid,p_event uuid,p_expected_version integer,p_request uuid,p_allow_pay_at_door boolean,p_allow_pay_online boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor_id uuid:=zoi.table_inventory_actor();prior zoi.event_host_requests;payload jsonb;policy zoi.event_payment_policies;receipt jsonb;
BEGIN
 IF p_request IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR p_allow_pay_at_door IS NULL OR p_allow_pay_online IS NULL THEN RAISE EXCEPTION 'invalid_payment_policy';END IF;
 IF p_allow_pay_online THEN RAISE EXCEPTION 'online_provider_unavailable';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||actor_id::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||actor_id::text,0));
 PERFORM 1 FROM zoi.event_table_settings WHERE event_id=p_event AND workspace_id=p_workspace FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'inventory_unavailable';END IF;
 PERFORM zoi.table_inventory_operator(p_workspace,p_event);
 payload:=jsonb_build_object('kind','payment_policy','workspace',p_workspace,'event',p_event,'version',p_expected_version,'allow_pay_at_door',p_allow_pay_at_door,'allow_pay_online',p_allow_pay_online);
 SELECT * INTO prior FROM zoi.event_host_requests WHERE actor=actor_id AND request=p_request;IF FOUND THEN IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN prior.receipt;END IF;
 PERFORM zoi.event_host_budget(actor_id);
 SELECT * INTO policy FROM zoi.event_payment_policies WHERE event_id=p_event FOR UPDATE;
 IF policy.event_id IS NOT NULL AND policy.workspace_id IS DISTINCT FROM p_workspace THEN RAISE EXCEPTION 'payment_policy_ownership_changed';END IF;
 IF coalesce(policy.version,0)<>p_expected_version THEN RAISE EXCEPTION 'version_conflict';END IF;
 INSERT INTO zoi.event_payment_policies(event_id,workspace_id,version,allow_pay_at_door) VALUES(p_event,p_workspace,p_expected_version+1,p_allow_pay_at_door) ON CONFLICT(event_id) DO UPDATE SET version=excluded.version,allow_pay_at_door=excluded.allow_pay_at_door,updated_at=clock_timestamp();
 receipt:=jsonb_build_object('ok',true,'policy',zoi.event_payment_policy_view(p_event,p_workspace),'payment_collected',false,'ticket_issued',false);INSERT INTO zoi.event_host_requests(actor,request,payload,receipt) VALUES(actor_id,p_request,payload,receipt);RETURN receipt;
END $$;
CREATE FUNCTION zoi.event_payment_guest_authorize(p_guest uuid,p_actor uuid) RETURNS zoi.event_host_allocations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE guest zoi.event_host_guests;allocation zoi.event_host_allocations;
BEGIN SELECT * INTO guest FROM zoi.event_host_guests WHERE id=p_guest;SELECT * INTO allocation FROM zoi.event_host_allocations WHERE id=guest.event_allocation_id;
 IF guest.id IS NULL OR guest.status<>'accepted' OR guest.claimed_by IS DISTINCT FROM p_actor OR NOT zoi.event_host_valid(allocation) THEN RAISE EXCEPTION 'claim_unavailable';END IF;RETURN allocation;END $$;
CREATE FUNCTION public.event_guest_payment_options(p_event uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor_id uuid:=zoi.table_inventory_actor();rows jsonb;total integer;
BEGIN
 SELECT count(*) INTO total FROM zoi.event_host_guests g JOIN zoi.event_host_allocations a ON a.id=g.event_allocation_id WHERE g.claimed_by=actor_id AND g.status='accepted' AND (p_event IS NULL OR a.event_id=p_event) AND zoi.event_host_valid(a);
 SELECT coalesce(jsonb_agg(x ORDER BY x->>'expires_at',x->>'guest_id'),'[]') INTO rows FROM (
 SELECT jsonb_build_object('guest_id',g.id,'event_id',a.event_id,'event_name',l.name,'table_id',a.table_id,'table_label',a.label,'quantity',g.quantity,'price_per_guest_cents',a.price_per_guest_cents,'currency',a.currency,'expires_at',a.expires_at,'policy',zoi.event_payment_policy_view(a.event_id,a.workspace_id),'choice',CASE WHEN c.guest_id IS NULL THEN NULL ELSE jsonb_build_object('method',c.method,'version',c.version,'policy_version',c.policy_version,'status',CASE WHEN p.workspace_id=a.workspace_id AND p.allow_pay_at_door AND p.version=c.policy_version THEN 'unpaid' ELSE 'needs_review' END) END) x
 FROM zoi.event_host_guests g JOIN zoi.event_host_allocations a ON a.id=g.event_allocation_id JOIN zoi.listings l ON l.id=a.event_id LEFT JOIN zoi.event_guest_payment_preferences c ON c.guest_id=g.id AND c.actor=actor_id LEFT JOIN zoi.event_payment_policies p ON p.event_id=a.event_id
 WHERE g.claimed_by=actor_id AND g.status='accepted' AND (p_event IS NULL OR a.event_id=p_event) AND zoi.event_host_valid(a) ORDER BY a.expires_at,g.id LIMIT 100) limited;
 RETURN jsonb_build_object('ok',true,'guests',rows,'total',total,'payment_collected',false,'ticket_issued',false);
END $$;
CREATE FUNCTION public.event_guest_payment_choose(p_guest uuid,p_method text,p_expected_policy_version integer,p_expected_version integer,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor_id uuid:=zoi.table_inventory_actor();guest zoi.event_host_guests;allocation zoi.event_host_allocations;policy zoi.event_payment_policies;choice zoi.event_guest_payment_preferences;prior zoi.event_host_requests;payload jsonb;receipt jsonb;v_event uuid;
BEGIN
 IF p_request IS NULL OR p_guest IS NULL OR p_method IS NULL OR p_expected_policy_version IS NULL OR p_expected_policy_version<1 OR p_expected_version IS NULL OR p_expected_version<0 THEN RAISE EXCEPTION 'invalid_payment_choice';END IF;
 IF p_method='pay_online' THEN RAISE EXCEPTION 'online_provider_unavailable';END IF;IF p_method<>'pay_at_door' THEN RAISE EXCEPTION 'payment_method_unavailable';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||actor_id::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||actor_id::text,0));
 SELECT a.event_id INTO v_event FROM zoi.event_host_guests g JOIN zoi.event_host_allocations a ON a.id=g.event_allocation_id WHERE g.id=p_guest;
 PERFORM 1 FROM zoi.event_table_settings s WHERE s.event_id=v_event FOR UPDATE;
 allocation:=zoi.event_payment_guest_authorize(p_guest,actor_id);SELECT * INTO guest FROM zoi.event_host_guests WHERE id=p_guest FOR UPDATE;
 payload:=jsonb_build_object('kind','payment_choice','guest',p_guest,'method',p_method,'policy_version',p_expected_policy_version,'version',p_expected_version);
 SELECT * INTO prior FROM zoi.event_host_requests WHERE actor=actor_id AND request=p_request;IF FOUND THEN IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN prior.receipt;END IF;
 PERFORM zoi.event_host_budget(actor_id);
 SELECT * INTO policy FROM zoi.event_payment_policies WHERE event_payment_policies.event_id=allocation.event_id FOR UPDATE;
 IF policy.workspace_id IS DISTINCT FROM allocation.workspace_id OR NOT coalesce(policy.allow_pay_at_door,false) THEN RAISE EXCEPTION 'payment_method_unavailable';END IF;
 IF policy.version<>p_expected_policy_version THEN RAISE EXCEPTION 'payment_policy_changed';END IF;
 SELECT * INTO choice FROM zoi.event_guest_payment_preferences WHERE guest_id=p_guest FOR UPDATE;
 IF coalesce(choice.version,0)<>p_expected_version THEN RAISE EXCEPTION 'version_conflict';END IF;
 INSERT INTO zoi.event_guest_payment_preferences(guest_id,actor,policy_version,version,method) VALUES(p_guest,actor_id,policy.version,p_expected_version+1,p_method) ON CONFLICT(guest_id) DO UPDATE SET actor=excluded.actor,policy_version=excluded.policy_version,version=excluded.version,method=excluded.method,updated_at=clock_timestamp();
 receipt:=jsonb_build_object('ok',true,'guest_id',guest.id,'event_id',allocation.event_id,'quantity',guest.quantity,'price_per_guest_cents',allocation.price_per_guest_cents,'currency',allocation.currency,'choice',jsonb_build_object('method',p_method,'policy_version',policy.version,'version',p_expected_version+1,'status','unpaid'),'payment_collected',false,'ticket_issued',false);
 INSERT INTO zoi.event_host_requests(actor,request,payload,receipt) VALUES(actor_id,p_request,payload,receipt);RETURN receipt;
END $$;
CREATE FUNCTION public.event_payment_operator_report(p_workspace uuid,p_event uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb;total integer;
BEGIN PERFORM zoi.table_inventory_operator(p_workspace,p_event);
 SELECT count(*) INTO total FROM zoi.event_host_guests g JOIN zoi.event_host_allocations a ON a.id=g.event_allocation_id JOIN zoi.event_guest_payment_preferences c ON c.guest_id=g.id AND c.actor=g.claimed_by WHERE a.event_id=p_event AND a.workspace_id=p_workspace AND g.status='accepted' AND zoi.event_host_valid(a);
 SELECT coalesce(jsonb_agg(x ORDER BY x->>'table_label',x->>'guest_id'),'[]') INTO rows FROM (
 SELECT jsonb_build_object('guest_id',g.id,'guest_label',g.label,'table_label',a.label,'quantity',g.quantity,'currency',a.currency,'unpaid_preference_cents',g.quantity::bigint*a.price_per_guest_cents,'method',c.method,'status',CASE WHEN p.workspace_id=a.workspace_id AND p.allow_pay_at_door AND p.version=c.policy_version THEN 'unpaid' ELSE 'needs_review' END) x FROM zoi.event_host_guests g JOIN zoi.event_host_allocations a ON a.id=g.event_allocation_id JOIN zoi.event_guest_payment_preferences c ON c.guest_id=g.id AND c.actor=g.claimed_by LEFT JOIN zoi.event_payment_policies p ON p.event_id=a.event_id WHERE a.event_id=p_event AND a.workspace_id=p_workspace AND g.status='accepted' AND zoi.event_host_valid(a) ORDER BY a.label,g.id LIMIT 1000) limited;
 RETURN jsonb_build_object('ok',true,'event_id',p_event,'preferences',rows,'total',total,'payment_collected',false,'ticket_issued',false,'settlement_ledger',false);
END $$;
REVOKE ALL ON FUNCTION public.event_payment_operator_report(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.event_payment_operator_report(uuid,uuid) TO authenticated;
-- Extend existing recovery; current authorization applies to historical receipts too.
CREATE OR REPLACE FUNCTION public.event_host_receipt(p_request uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=zoi.table_inventory_actor();r zoi.event_host_requests;a zoi.event_host_allocations;
BEGIN PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||v_actor::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||v_actor::text,0));SELECT * INTO r FROM zoi.event_host_requests WHERE actor=v_actor AND request=p_request;IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'found',false,'receipt',NULL);END IF;
 IF r.payload->>'kind' IN('allocate','payment_policy') THEN PERFORM zoi.table_inventory_operator((r.payload->>'workspace')::uuid,(r.payload->>'event')::uuid);
 ELSIF r.payload->>'kind'='payment_choice' THEN PERFORM zoi.event_payment_guest_authorize((r.payload->>'guest')::uuid,v_actor);
 ELSIF r.payload->>'kind' IN('guest','release') THEN SELECT * INTO a FROM zoi.event_host_allocations WHERE id=(r.payload->>'allocation')::uuid;IF r.payload->>'kind'='release' THEN PERFORM zoi.table_inventory_operator(a.workspace_id,a.event_id);ELSIF a.host_profile_id IS DISTINCT FROM v_actor OR NOT EXISTS(SELECT 1 FROM zoi.listings WHERE id=a.event_id AND owner_workspace_id=a.workspace_id) THEN RAISE EXCEPTION 'allocation_unavailable';END IF;
 END IF;RETURN jsonb_build_object('ok',true,'found',true,'receipt',r.receipt,'historical',true);
END $$;
REVOKE ALL ON FUNCTION zoi.event_payment_policy_view(uuid,uuid),zoi.event_payment_guest_authorize(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.event_payment_policy_get(uuid,uuid),public.event_payment_policy_save(uuid,uuid,integer,uuid,boolean,boolean),public.event_guest_payment_options(uuid),public.event_guest_payment_choose(uuid,text,integer,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.event_payment_policy_get(uuid,uuid),public.event_payment_policy_save(uuid,uuid,integer,uuid,boolean,boolean),public.event_guest_payment_options(uuid),public.event_guest_payment_choose(uuid,text,integer,integer,uuid) TO authenticated;
COMMIT;

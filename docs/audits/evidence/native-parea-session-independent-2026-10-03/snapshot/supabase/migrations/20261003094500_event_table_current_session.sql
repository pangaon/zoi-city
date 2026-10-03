-- Draft only: current-session authority for the shared table/host suite.
-- Generated from retained installed definitions; no customer rows are changed.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TEMP TABLE event_authority_expected(signature text PRIMARY KEY,definition_hash text NOT NULL,acl text NOT NULL) ON COMMIT DROP;
INSERT INTO event_authority_expected VALUES
('public.event_guest_payment_choose(uuid,text,integer,integer,uuid)','c27dcd9cd703fd5a6dabd24fc36d9462','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.event_guest_payment_options(uuid)','15cf45c84c3e684c85ace0a677eb5dcd','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.event_host_allocate(uuid,uuid,uuid,uuid,integer,timestamp with time zone,integer,uuid)','a73bcbebcab34c48a5315a1a9c706a0e','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.event_host_claim(text,uuid)','93224e3071b4b0303e21649b473f6508','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.event_host_claim_preview(text)','0ea5a3b4109c0165bd5604fc78747978','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.event_host_get(uuid)','d1e784e96e5511d5a460c9f226ac813c','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.event_host_guest_save(uuid,uuid,integer,uuid,text,integer,text)','7dc0e37c687c7ca3c421b44adacbe5d2','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.event_host_list(uuid,uuid)','052996214877fe85fd4aba0fa2d21bdb','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.event_host_receipt(uuid)','3b3f21640523ecce89a7b2a33eaa5122','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.event_host_release(uuid,integer,uuid)','bc99a4302817e46c6666b196478481a2','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.event_host_request_cancel(uuid,text)','2bb754da0535e6579dccbc74404023c2','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.event_payment_policy_configure(uuid,uuid,integer,uuid,boolean,boolean,timestamp with time zone)','c008242ba0a20e516b9772f6b782c5e2','{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'),
('public.event_payment_policy_save(uuid,uuid,integer,uuid,boolean,boolean)','07ffac87a98e8e4f01a32e07131b7df3','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.event_payment_request(uuid,text,jsonb,boolean)','2d9943dc9fb5c068ce2c2f9eaad0f2ae','{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'),
('public.table_hold_create(uuid,uuid,integer,integer,uuid)','9041aa5053aa2238b5eb80d248a4e009','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.table_hold_release(uuid)','15d1d3b7e168dbdcf02c0cc42b683a08','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.table_hold_status(uuid,uuid)','8b38a21c043b6dcdd3b16d54def57969','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.table_identity_get(uuid,uuid)','edce2c9e9536fc69ebaabf22fa1beaf6','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.table_identity_receipt(uuid,uuid,uuid)','fffd91bc8a8f51cce966a91d1bfa98ca','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.table_identity_save(uuid,uuid,integer,uuid,jsonb)','a96af4364f48453eaf305b5cf5e413f6','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.table_inventory_configure(uuid,uuid,integer,uuid,jsonb)','46747e4d05f68405f1e0e10fe07b9145','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('public.table_inventory_configure_receipt(uuid,uuid,uuid)','4cbb0318bd4615c6b1656ebfe0df1f63','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
('zoi.event_host_cancelled(uuid,uuid,text)','a903531ad13b275426c18f25d442ba73','{postgres=X/postgres}'),
('zoi.event_host_valid(zoi.event_host_allocations)','06ff045cd0f87ca67b5d1e6dec067a35','{postgres=X/postgres}'),
('zoi.event_payment_operator_current(uuid,uuid)','d96eff6599b21f65bef8d68bdeb5e115','{postgres=X/postgres}'),
('zoi.suite_current_session()','8ceef7877aeb972d09d8694f6c85dff7','{postgres=X/postgres}'),
('zoi.suite_lock_session()','04328c4d98e5f5671777a88435870c58','{postgres=X/postgres}'),
('zoi.table_inventory_actor()','f6a94934d4233ae00ad8233a7b11d2fc','{postgres=X/postgres}'),
('zoi.table_inventory_operator(uuid,uuid)','faaef08699e8574965067d2485528be9','{postgres=X/postgres}');
DO $guard$ DECLARE x record;p pg_proc; BEGIN
 FOR x IN SELECT * FROM event_authority_expected LOOP
  SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(x.signature);
  IF p.oid IS NULL OR md5(pg_get_functiondef(p.oid)) IS DISTINCT FROM x.definition_hash
   OR pg_get_userbyid(p.proowner) IS DISTINCT FROM 'postgres' OR NOT p.prosecdef
   OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[] OR p.proacl::text IS DISTINCT FROM x.acl
  THEN RAISE EXCEPTION 'event_authority_preflight_changed: %',x.signature;END IF;
 END LOOP;
END $guard$;
CREATE OR REPLACE FUNCTION public.event_host_allocate(p_workspace uuid, p_event uuid, p_table uuid, p_host uuid, p_quota integer, p_expires_at timestamp with time zone, p_expected_pricing_version integer, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_actor uuid;c zoi.event_table_settings;i zoi.event_table_inventory;a zoi.event_host_allocations;payload jsonb;prior zoi.event_host_requests;r jsonb;
BEGIN v_actor:=zoi.table_inventory_operator(p_workspace,p_event);IF p_request IS NULL OR p_host IS NULL OR p_quota IS NULL OR p_expires_at IS NULL OR p_expected_pricing_version IS NULL THEN RAISE EXCEPTION 'invalid_allocation';END IF;
 payload:=jsonb_build_object('kind','allocate','workspace',p_workspace,'event',p_event,'table',p_table,'host',p_host,'quota',p_quota,'expires_at',p_expires_at,'pricing_version',p_expected_pricing_version);
 PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||v_actor::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||v_actor::text,0));r:=zoi.event_host_cancelled(v_actor,p_request,'allocate');IF r IS NOT NULL THEN PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN r;END IF;PERFORM zoi.table_inventory_operator(p_workspace,p_event);SELECT * INTO prior FROM zoi.event_host_requests WHERE event_host_requests.actor=v_actor AND request=p_request;
 IF FOUND THEN IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN prior.receipt;END IF;PERFORM zoi.event_host_budget(v_actor);
 SELECT * INTO c FROM zoi.event_table_settings WHERE event_id=p_event FOR UPDATE;
 IF c.workspace_id IS DISTINCT FROM p_workspace OR NOT zoi.table_inventory_public(p_event) THEN RAISE EXCEPTION 'inventory_unavailable';END IF;
 IF c.version<>p_expected_pricing_version THEN RAISE EXCEPTION 'pricing_version_conflict';END IF;
 SELECT * INTO i FROM zoi.event_table_inventory WHERE event_id=p_event AND table_id=p_table;
 IF i.table_id IS NULL OR p_quota NOT BETWEEN i.min_party_size AND i.capacity OR p_expires_at<=clock_timestamp() OR p_expires_at>c.starts_at OR p_expires_at>clock_timestamp()+interval '90 days' THEN RAISE EXCEPTION 'invalid_allocation';END IF;
 PERFORM 1 FROM public.venue_tables_zones t JOIN public.event_venues v ON v.id=t.venue_id WHERE t.id=p_table AND t.capacity>=p_quota AND v.event_id=p_event AND v.workspace_id=p_workspace FOR SHARE OF t,v;IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;IF NOT FOUND THEN RAISE EXCEPTION 'inventory_unavailable';END IF;
 IF NOT EXISTS(SELECT 1 FROM zoi.user_profiles WHERE id=p_host) THEN RAISE EXCEPTION 'host_unavailable';END IF;
 IF EXISTS(SELECT 1 FROM zoi.event_table_holds WHERE event_id=p_event AND table_id=p_table AND status='active' AND expires_at>clock_timestamp()) OR EXISTS(SELECT 1 FROM zoi.event_host_allocations x WHERE x.event_id=p_event AND x.table_id=p_table AND zoi.event_host_valid(x)) THEN RAISE EXCEPTION 'table_unavailable';END IF;
 INSERT INTO zoi.event_host_allocations(event_id,table_id,workspace_id,host_profile_id,label,quota,pricing_version,price_per_guest_cents,currency,expires_at)VALUES(p_event,p_table,p_workspace,p_host,i.source_label,p_quota,c.version,i.price_per_guest_cents,i.currency,p_expires_at)RETURNING * INTO a;
 r:=jsonb_build_object('ok',true,'allocation',zoi.event_host_view(a),'payment_collected',false,'delivery_configured',false);INSERT INTO zoi.event_host_requests(actor,request,payload,receipt) VALUES(v_actor,p_request,payload,r);PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN r;
END $function$;

CREATE OR REPLACE FUNCTION public.event_host_claim(p_token text, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_actor uuid:=zoi.table_inventory_actor();g zoi.event_host_guests;a zoi.event_host_allocations;ev uuid;hash text;prior zoi.event_host_requests;payload jsonb;r jsonb;
BEGIN IF p_request IS NULL OR coalesce(p_token,'')!~'^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'claim_unavailable';END IF;hash:=encode(extensions.digest(p_token,'sha256'),'hex');payload:=jsonb_build_object('kind','claim','token_hash',hash);
 PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||v_actor::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||v_actor::text,0));r:=zoi.event_host_cancelled(v_actor,p_request,'claim');IF r IS NOT NULL THEN PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN r;END IF;SELECT a0.event_id INTO ev FROM zoi.event_host_guests g0 JOIN zoi.event_host_allocations a0 ON a0.id=g0.event_allocation_id WHERE g0.token_hash=hash;PERFORM 1 FROM zoi.event_table_settings WHERE event_id=ev FOR UPDATE;SELECT * INTO g FROM zoi.event_host_guests WHERE token_hash=hash FOR UPDATE;SELECT * INTO a FROM zoi.event_host_allocations WHERE id=g.event_allocation_id;
 PERFORM 1 FROM zoi.listings WHERE id=a.event_id AND owner_workspace_id=a.workspace_id FOR SHARE;IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;IF NOT FOUND THEN RAISE EXCEPTION 'claim_unavailable';END IF;
 IF g.id IS NULL OR NOT zoi.event_host_valid(a) OR g.status='revoked' OR(g.claimed_by IS NOT NULL AND g.claimed_by<>v_actor) THEN RAISE EXCEPTION 'claim_unavailable';END IF;
 SELECT * INTO prior FROM zoi.event_host_requests WHERE event_host_requests.actor=v_actor AND request=p_request;IF FOUND THEN IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN prior.receipt;END IF;PERFORM zoi.event_host_budget(v_actor);
 IF g.claimed_by IS NULL THEN UPDATE zoi.event_host_guests SET claimed_by=v_actor,status='accepted',version=version+1 WHERE id=g.id RETURNING * INTO g;END IF;
 r:=jsonb_build_object('ok',true,'event_id',a.event_id,'table_id',a.table_id,'guest_id',g.id,'quantity',g.quantity,'status','accepted','price_per_guest_cents',a.price_per_guest_cents,'currency',a.currency,'payment_collected',false,'ticket_issued',false);INSERT INTO zoi.event_host_requests(actor,request,payload,receipt) VALUES(v_actor,p_request,payload,r);PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN r;
END $function$;

CREATE OR REPLACE FUNCTION public.event_host_claim_preview(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_actor uuid:=zoi.table_inventory_actor();g zoi.event_host_guests;a zoi.event_host_allocations;event_name text;
BEGIN
 IF coalesce(p_token,'')!~'^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'claim_unavailable';END IF;
 SELECT * INTO g FROM zoi.event_host_guests WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 SELECT * INTO a FROM zoi.event_host_allocations WHERE id=g.event_allocation_id;
 IF g.id IS NULL OR a.id IS NULL OR NOT zoi.event_host_valid(a) OR g.status NOT IN('invited','accepted') OR(g.claimed_by IS NOT NULL AND g.claimed_by<>v_actor) THEN RAISE EXCEPTION 'claim_unavailable';END IF;
 SELECT name INTO event_name FROM zoi.listings WHERE id=a.event_id AND owner_workspace_id=a.workspace_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'claim_unavailable';END IF;
 PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN jsonb_build_object('ok',true,'event_id',a.event_id,'event_name',coalesce(event_name,'Event'),'table_id',a.table_id,'table_label',a.label,'quantity',g.quantity,'price_per_guest_cents',a.price_per_guest_cents,'currency',a.currency,'expires_at',a.expires_at,'status',g.status,'payment_collected',false,'ticket_issued',false);
END $function$;

CREATE OR REPLACE FUNCTION public.event_host_get(p_allocation uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_actor uuid:=zoi.table_inventory_actor();a zoi.event_host_allocations;guests jsonb;
BEGIN SELECT * INTO a FROM zoi.event_host_allocations WHERE id=p_allocation;IF a.id IS NULL THEN RAISE EXCEPTION 'allocation_unavailable';END IF;
 IF v_actor IS DISTINCT FROM a.host_profile_id THEN PERFORM zoi.table_inventory_operator(a.workspace_id,a.event_id);END IF;
 IF NOT EXISTS(SELECT 1 FROM zoi.listings WHERE id=a.event_id AND owner_workspace_id=a.workspace_id) THEN RAISE EXCEPTION 'allocation_unavailable';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'quantity',quantity,'status',status,'version',version) ORDER BY id),'[]') INTO guests FROM zoi.event_host_guests WHERE event_allocation_id=a.id;
 PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN jsonb_build_object('ok',true,'allocation',zoi.event_host_view(a),'guests',guests,'payment_collected',false,'delivery_configured',false);
END $function$;

CREATE OR REPLACE FUNCTION public.event_host_guest_save(p_allocation uuid, p_guest uuid, p_expected_version integer, p_request uuid, p_label text, p_quantity integer, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_actor uuid:=zoi.table_inventory_actor();a zoi.event_host_allocations;g zoi.event_host_guests;payload jsonb;prior zoi.event_host_requests;hash text;r jsonb;ev uuid;
BEGIN IF p_request IS NULL OR p_guest IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 100 OR length(btrim(coalesce(p_label,''))) NOT BETWEEN 1 AND 80 OR p_label~'[[:cntrl:]]' OR coalesce(p_token,'')!~'^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid_guest';END IF;
 hash:=encode(extensions.digest(p_token,'sha256'),'hex');payload:=jsonb_build_object('kind','guest','allocation',p_allocation,'guest',p_guest,'version',p_expected_version,'label',btrim(p_label),'quantity',p_quantity,'token_hash',hash);
 PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||v_actor::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||v_actor::text,0));r:=zoi.event_host_cancelled(v_actor,p_request,'guest');IF r IS NOT NULL THEN PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN r;END IF;SELECT event_id INTO ev FROM zoi.event_host_allocations WHERE id=p_allocation;PERFORM 1 FROM zoi.event_table_settings WHERE event_id=ev FOR UPDATE;SELECT * INTO a FROM zoi.event_host_allocations WHERE id=p_allocation FOR UPDATE;
 PERFORM 1 FROM zoi.listings WHERE id=a.event_id AND owner_workspace_id=a.workspace_id FOR SHARE;IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;IF NOT FOUND THEN RAISE EXCEPTION 'allocation_unavailable';END IF;
 IF a.id IS NULL OR a.host_profile_id IS DISTINCT FROM v_actor OR NOT zoi.event_host_valid(a) THEN RAISE EXCEPTION 'allocation_unavailable';END IF;
 SELECT * INTO prior FROM zoi.event_host_requests WHERE event_host_requests.actor=v_actor AND request=p_request;IF FOUND THEN IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN prior.receipt;END IF;PERFORM zoi.event_host_budget(v_actor);
 SELECT * INTO g FROM zoi.event_host_guests WHERE id=p_guest FOR UPDATE;IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;
 IF g.id IS NOT NULL AND(g.event_allocation_id IS DISTINCT FROM a.id OR g.status<>'invited') THEN RAISE EXCEPTION 'guest_not_editable';END IF;
 IF coalesce(g.version,0)<>p_expected_version THEN RAISE EXCEPTION 'version_conflict';END IF;
 IF coalesce((SELECT sum(quantity) FROM zoi.event_host_guests WHERE event_allocation_id=a.id AND status<>'revoked' AND id<>p_guest),0)+p_quantity>a.quota THEN RAISE EXCEPTION 'allocation_quota_exceeded';END IF;
 INSERT INTO zoi.event_host_guests(id,event_allocation_id,label,quantity,token_hash)VALUES(p_guest,a.id,btrim(p_label),p_quantity,hash)ON CONFLICT(id)DO UPDATE SET label=excluded.label,quantity=excluded.quantity,token_hash=excluded.token_hash,version=event_host_guests.version+1 RETURNING * INTO g;
 r:=jsonb_build_object('ok',true,'guest',jsonb_build_object('id',g.id,'quantity',g.quantity,'label',g.label,'status',g.status,'version',g.version),'delivery_configured',false,'payment_collected',false);INSERT INTO zoi.event_host_requests(actor,request,payload,receipt) VALUES(v_actor,p_request,payload,r);PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN r;
END $function$;

CREATE OR REPLACE FUNCTION public.event_host_list(p_workspace uuid DEFAULT NULL::uuid, p_event uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_actor uuid:=zoi.table_inventory_actor();rows jsonb;
BEGIN IF p_workspace IS NOT NULL THEN IF p_event IS NULL THEN RAISE EXCEPTION 'event_required';END IF;PERFORM zoi.table_inventory_operator(p_workspace,p_event);END IF;
 SELECT coalesce(jsonb_agg(zoi.event_host_view(x) ORDER BY x.created_at DESC),'[]')INTO rows FROM(SELECT a.* FROM zoi.event_host_allocations a JOIN zoi.listings l ON l.id=a.event_id AND l.owner_workspace_id=a.workspace_id WHERE (p_event IS NULL OR a.event_id=p_event) AND ((p_workspace IS NULL AND a.host_profile_id=v_actor)OR(a.workspace_id=p_workspace)) ORDER BY a.created_at DESC LIMIT 100)x;
 PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN jsonb_build_object('ok',true,'allocations',rows,'delivery_configured',false,'payment_collected',false);
END $function$;

CREATE OR REPLACE FUNCTION public.event_host_receipt(p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_actor uuid:=zoi.table_inventory_actor();r zoi.event_host_requests;a zoi.event_host_allocations;g zoi.event_host_guests;
BEGIN PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||v_actor::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||v_actor::text,0));IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized';END IF;SELECT * INTO r FROM zoi.event_host_requests WHERE actor=v_actor AND request=p_request;IF NOT FOUND THEN PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN jsonb_build_object('ok',true,'found',false,'receipt',NULL);END IF;
 IF r.payload->>'kind' IN('allocate','payment_policy') THEN PERFORM zoi.table_inventory_operator((r.payload->>'workspace')::uuid,(r.payload->>'event')::uuid);
 ELSIF r.payload->>'kind'='payment_choice' THEN PERFORM zoi.event_payment_guest_authorize((r.payload->>'guest')::uuid,v_actor);
 ELSIF r.payload->>'kind' IN('guest','release') THEN SELECT * INTO a FROM zoi.event_host_allocations WHERE id=(r.payload->>'allocation')::uuid;IF r.payload->>'kind'='release' THEN PERFORM zoi.table_inventory_operator(a.workspace_id,a.event_id);ELSIF a.host_profile_id IS DISTINCT FROM v_actor OR NOT EXISTS(SELECT 1 FROM zoi.listings WHERE id=a.event_id AND owner_workspace_id=a.workspace_id) THEN RAISE EXCEPTION 'allocation_unavailable';END IF;
 ELSIF r.payload->>'kind'='claim' THEN
 SELECT * INTO g FROM zoi.event_host_guests WHERE token_hash=r.payload->>'token_hash';
 SELECT * INTO a FROM zoi.event_host_allocations WHERE id=g.event_allocation_id;
 IF g.id IS NULL OR g.claimed_by IS DISTINCT FROM v_actor OR g.status<>'accepted' OR NOT EXISTS(SELECT 1 FROM zoi.listings WHERE id=a.event_id AND owner_workspace_id=a.workspace_id) THEN RAISE EXCEPTION 'claim_unavailable';END IF;
 END IF;PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN jsonb_build_object('ok',true,'found',true,'receipt',r.receipt,'historical',true);
END $function$;

CREATE OR REPLACE FUNCTION public.event_host_release(p_allocation uuid, p_expected_version integer, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_actor uuid:=zoi.table_inventory_actor();a zoi.event_host_allocations;prior zoi.event_host_requests;payload jsonb;r jsonb;ev uuid;
BEGIN IF p_request IS NULL OR p_expected_version IS NULL THEN RAISE EXCEPTION 'invalid_request';END IF;PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||v_actor::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||v_actor::text,0));r:=zoi.event_host_cancelled(v_actor,p_request,'release');IF r IS NOT NULL THEN PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN r;END IF;SELECT event_id INTO ev FROM zoi.event_host_allocations WHERE id=p_allocation;PERFORM 1 FROM zoi.event_table_settings WHERE event_id=ev FOR UPDATE;SELECT * INTO a FROM zoi.event_host_allocations WHERE id=p_allocation FOR UPDATE;IF a.id IS NULL THEN RAISE EXCEPTION 'allocation_unavailable';END IF;
 PERFORM zoi.table_inventory_operator(a.workspace_id,a.event_id);
 payload:=jsonb_build_object('kind','release','allocation',p_allocation,'version',p_expected_version);PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||v_actor::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||v_actor::text,0));SELECT * INTO prior FROM zoi.event_host_requests WHERE event_host_requests.actor=v_actor AND request=p_request;IF FOUND THEN IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN prior.receipt;END IF;
 IF a.status='released' THEN RAISE EXCEPTION 'allocation_already_released';END IF;IF a.version<>p_expected_version THEN RAISE EXCEPTION 'version_conflict';END IF;UPDATE zoi.event_host_allocations SET status='released',version=version+1 WHERE id=a.id RETURNING * INTO a;r:=jsonb_build_object('ok',true,'allocation',zoi.event_host_view(a),'payment_collected',false);INSERT INTO zoi.event_host_requests(actor,request,payload,receipt) VALUES(v_actor,p_request,payload,r);PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN r;
END $function$;

CREATE OR REPLACE FUNCTION public.event_host_request_cancel(p_request uuid, p_kind text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid:=zoi.table_inventory_actor(); prior zoi.event_host_requests; result jsonb;
begin
 if p_request is null or p_kind is null or p_kind not in ('allocate','guest','claim','release') then raise exception 'invalid_request'; end if;
 perform pg_advisory_xact_lock(hashtextextended('event-host-request:'||v_actor::text||':'||p_request::text,0));
 perform pg_advisory_xact_lock(hashtextextended('event-host-actor:'||v_actor::text,0));
 if zoi.table_inventory_actor() is distinct from v_actor then raise exception 'not_authorized'; end if;
 select * into prior from zoi.event_host_requests where actor=v_actor and request=p_request;
 if found then
  if (prior.payload->>'kind'='cancelled' and prior.payload->>'operation' is distinct from p_kind)
    or (prior.payload->>'kind'<>'cancelled' and prior.payload->>'kind' is distinct from p_kind) then raise exception 'request_conflict'; end if;
  -- Existing result is only returned through current domain authorization.
  PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;return public.event_host_receipt(p_request);
 end if;
 perform zoi.event_host_budget(v_actor);
 result:=jsonb_build_object('ok',false,'error','request_cancelled','request_id',p_request,'kind',p_kind,'payment_collected',false,'ticket_issued',false);
 insert into zoi.event_host_requests(actor,request,payload,receipt)
 values(v_actor,p_request,jsonb_build_object('kind','cancelled','operation',p_kind),result);
 PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;return jsonb_build_object('ok',true,'found',true,'receipt',result,'historical',true);
end; $function$;

CREATE OR REPLACE FUNCTION public.table_hold_create(p_event uuid, p_table uuid, p_party_size integer, p_expected_version integer, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a uuid:=zoi.table_inventory_actor();c zoi.event_table_settings;i zoi.event_table_inventory;h zoi.event_table_holds;payload jsonb;
BEGIN
 IF p_request IS NULL OR p_event IS NULL OR p_table IS NULL OR p_party_size IS NULL OR p_expected_version IS NULL THEN RAISE EXCEPTION 'invalid_request';END IF;
 payload:=jsonb_build_object('event',p_event,'table',p_table,'party_size',p_party_size,'version',p_expected_version);
 PERFORM pg_advisory_xact_lock(hashtextextended('table-hold-actor:'||a::text,0));IF zoi.table_inventory_actor() IS DISTINCT FROM a THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;
 SELECT * INTO h FROM zoi.event_table_holds WHERE profile_id=a AND request_id=p_request;
 IF h.id IS NOT NULL THEN IF h.request_data IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM a THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN jsonb_build_object('ok',true,'hold',zoi.table_hold_view(h),'server_time',clock_timestamp(),'payment_collected',false);END IF;
 SELECT * INTO c FROM zoi.event_table_settings WHERE event_id=p_event FOR UPDATE;
 IF c.event_id IS NULL OR NOT zoi.table_inventory_public(p_event) THEN RAISE EXCEPTION 'table_inventory_unavailable';END IF;
 PERFORM 1 FROM zoi.listings WHERE id=p_event AND owner_workspace_id=c.workspace_id AND publish_status='published' AND moderation_status IN('clean','cleared') AND coalesce(marketplace_status,'')<>'hidden' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'table_inventory_unavailable';END IF;
 IF c.version<>p_expected_version THEN RAISE EXCEPTION 'pricing_version_conflict';END IF;
 SELECT * INTO i FROM zoi.event_table_inventory WHERE event_id=p_event AND table_id=p_table;
 IF i.table_id IS NULL OR p_party_size<i.min_party_size OR p_party_size>i.capacity THEN RAISE EXCEPTION 'invalid_party_size';END IF;
 PERFORM 1 FROM public.venue_tables_zones t JOIN public.event_venues v ON v.id=t.venue_id WHERE t.id=p_table AND t.capacity>=i.capacity AND v.workspace_id=c.workspace_id AND v.event_id=p_event FOR SHARE OF t,v;IF zoi.table_inventory_actor() IS DISTINCT FROM a THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'table_inventory_unavailable';END IF;
 UPDATE zoi.event_table_holds SET status='expired' WHERE event_id=p_event AND status='active' AND expires_at<=clock_timestamp();IF zoi.table_inventory_actor() IS DISTINCT FROM a THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM zoi.event_table_holds WHERE event_id=p_event AND profile_id=a AND status='active' AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'active_hold_exists';END IF;
 IF EXISTS(SELECT 1 FROM zoi.event_table_holds WHERE event_id=p_event AND table_id=p_table AND status='active' AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'table_unavailable';END IF;
 IF (SELECT count(*) FROM zoi.event_table_holds WHERE profile_id=a AND created_at>clock_timestamp()-interval '1 hour')>=20 THEN RAISE EXCEPTION 'hold_rate_limited';END IF;
 INSERT INTO zoi.event_table_holds(event_id,table_id,profile_id,request_id,request_data,party_size,pricing_version,price_per_guest_cents,currency,total_cents,expires_at)VALUES(p_event,p_table,a,p_request,payload,p_party_size,c.version,i.price_per_guest_cents,i.currency,i.price_per_guest_cents::bigint*p_party_size,least(clock_timestamp()+interval '5 minutes',c.starts_at))RETURNING * INTO h;
 PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM a THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN jsonb_build_object('ok',true,'hold',zoi.table_hold_view(h),'server_time',clock_timestamp(),'payment_collected',false);
END $function$;

CREATE OR REPLACE FUNCTION public.table_hold_release(p_hold uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a uuid:=zoi.table_inventory_actor();h zoi.event_table_holds;event uuid;BEGIN
 SELECT event_id INTO event FROM zoi.event_table_holds WHERE id=p_hold AND profile_id=a;IF event IS NULL THEN RAISE EXCEPTION 'hold_not_owned' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM zoi.event_table_settings WHERE event_id=event FOR UPDATE;
 SELECT * INTO h FROM zoi.event_table_holds WHERE id=p_hold AND profile_id=a FOR UPDATE;IF zoi.table_inventory_actor() IS DISTINCT FROM a THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;
 IF h.status='active' THEN UPDATE zoi.event_table_holds SET status=CASE WHEN expires_at<=clock_timestamp() THEN 'expired' ELSE 'released' END WHERE id=p_hold RETURNING * INTO h;END IF;
 PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM a THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN jsonb_build_object('ok',true,'hold',zoi.table_hold_view(h),'server_time',clock_timestamp(),'payment_collected',false);END $function$;

CREATE OR REPLACE FUNCTION public.table_hold_status(p_event uuid, p_request uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a uuid:=zoi.table_inventory_actor();rows jsonb;BEGIN SELECT coalesce(jsonb_agg(zoi.table_hold_view(x) ORDER BY x.created_at DESC),'[]') INTO rows FROM(SELECT h.* FROM zoi.event_table_holds h WHERE h.profile_id=a AND h.event_id=p_event AND(p_request IS NULL OR h.request_id=p_request)ORDER BY h.created_at DESC LIMIT 20)x;PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM a THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN jsonb_build_object('ok',true,'holds',rows,'server_time',clock_timestamp(),'payment_collected',false);END $function$;

CREATE OR REPLACE FUNCTION public.table_identity_get(p_workspace uuid, p_event uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor uuid;s zoi.event_table_identity_settings;rows jsonb;
BEGIN actor:=zoi.table_inventory_operator(p_workspace,p_event);
 SELECT * INTO s FROM zoi.event_table_identity_settings WHERE event_id=p_event;
 IF s.event_id IS NOT NULL AND s.workspace_id IS DISTINCT FROM p_workspace THEN RAISE EXCEPTION 'inventory_owner_changed';END IF;
 IF s.venue_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.event_venues WHERE id=s.venue_id AND event_id=p_event AND workspace_id=p_workspace) THEN RAISE EXCEPTION 'event_not_owned';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'label',t.name,'capacity',t.capacity) ORDER BY t.id),'[]') INTO rows FROM public.venue_tables_zones t JOIN public.event_venues v ON v.id=t.venue_id WHERE v.id=s.venue_id AND v.event_id=p_event AND v.workspace_id=p_workspace;
 PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN jsonb_build_object('ok',true,'event_id',p_event,'version',coalesce(s.version,0),'venue_id',s.venue_id,'tables',rows);
END $function$;

CREATE OR REPLACE FUNCTION public.table_identity_receipt(p_workspace uuid, p_event uuid, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor uuid;r zoi.event_table_identity_requests;
BEGIN actor:=zoi.table_inventory_operator(p_workspace,p_event);IF p_request IS NULL THEN RAISE EXCEPTION 'invalid_request';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('table-identity-request:'||actor::text||':'||p_request::text,0));IF zoi.table_inventory_actor() IS DISTINCT FROM actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM zoi.event_table_identity_requests WHERE profile_id=actor AND request_id=p_request AND payload->>'workspace'=p_workspace::text AND payload->>'event'=p_event::text;
 PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN jsonb_build_object('ok',true,'found',r.request_id IS NOT NULL,'receipt',r.receipt);
END $function$;

CREATE OR REPLACE FUNCTION public.table_identity_save(p_workspace uuid, p_event uuid, p_expected_version integer, p_request uuid, p_tables jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor uuid;s zoi.event_table_identity_settings;prior zoi.event_table_identity_requests;payload jsonb;result jsonb;item jsonb;tid uuid;label text;v_capacity integer;existing public.venue_tables_zones;v uuid;total integer;
BEGIN
 actor:=zoi.table_inventory_operator(p_workspace,p_event);
 IF p_request IS NULL OR p_expected_version IS NULL OR p_expected_version<0 THEN RAISE EXCEPTION 'invalid_request';END IF;
 payload:=jsonb_build_object('workspace',p_workspace,'event',p_event,'version',p_expected_version,'tables',p_tables);
 PERFORM pg_advisory_xact_lock(hashtextextended('table-identity-request:'||actor::text||':'||p_request::text,0));IF zoi.table_inventory_actor() IS DISTINCT FROM actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;
 SELECT * INTO prior FROM zoi.event_table_identity_requests WHERE profile_id=actor AND request_id=p_request;
 IF prior.request_id IS NOT NULL THEN IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN prior.receipt;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('table-identity-actor:'||actor::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('event-table-mode:'||p_event::text,0));
 SELECT * INTO s FROM zoi.event_table_identity_settings WHERE event_id=p_event FOR UPDATE;
 IF s.event_id IS NOT NULL AND s.workspace_id IS DISTINCT FROM p_workspace THEN RAISE EXCEPTION 'inventory_owner_changed';END IF;
 IF coalesce(s.version,0)<>p_expected_version THEN RAISE EXCEPTION 'version_conflict';END IF;
 IF jsonb_typeof(p_tables) IS DISTINCT FROM 'array' OR octet_length(p_tables::text)>50000 THEN RAISE EXCEPTION 'invalid_tables';END IF;
 IF jsonb_array_length(p_tables) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid_tables';END IF;
 -- Share the existing price/hold serialization boundary; adding inventory never enables sales.
 PERFORM 1 FROM zoi.event_table_settings WHERE event_id=p_event FOR UPDATE;IF zoi.table_inventory_actor() IS DISTINCT FROM actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM zoi.event_table_holds WHERE event_id=p_event AND status='active' AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'active_holds';END IF;
 IF EXISTS(SELECT 1 FROM zoi.event_table_settings WHERE event_id=p_event AND enabled) THEN RAISE EXCEPTION 'disable_inventory_first';END IF;
 IF (SELECT count(*) FROM zoi.event_table_identity_requests WHERE profile_id=actor AND created_at>clock_timestamp()-interval '1 day')>=30 THEN RAISE EXCEPTION 'setup_daily_limit';END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_tables) LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(item)k WHERE k NOT IN('id','label','capacity')) OR jsonb_typeof(item->'id') IS DISTINCT FROM 'string' OR coalesce(item->>'id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR jsonb_typeof(item->'label') IS DISTINCT FROM 'string' OR length(btrim(item->>'label')) NOT BETWEEN 1 AND 80 OR (item->>'label')~'[[:cntrl:]]' OR jsonb_typeof(item->'capacity') IS DISTINCT FROM 'number' OR coalesce(item->>'capacity','')!~'^[0-9]+$' THEN RAISE EXCEPTION 'invalid_tables';END IF;
  IF (item->>'capacity')::numeric NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'invalid_tables';END IF;
 END LOOP;
 IF (SELECT count(DISTINCT (x->>'id')::uuid) FROM jsonb_array_elements(p_tables)x)<>jsonb_array_length(p_tables) OR (SELECT count(DISTINCT lower(btrim(x->>'label'))) FROM jsonb_array_elements(p_tables)x)<>jsonb_array_length(p_tables) THEN RAISE EXCEPTION 'duplicate_table';END IF;
 IF EXISTS(SELECT 1 FROM public.venue_tables_zones t WHERE t.venue_id=s.venue_id AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_tables)x WHERE (x->>'id')::uuid=t.id)) THEN RAISE EXCEPTION 'table_removal_not_supported';END IF;
 SELECT count(*) INTO total FROM public.venue_tables_zones t JOIN public.event_venues v ON v.id=t.venue_id WHERE v.event_id=p_event AND v.workspace_id=p_workspace AND v.id IS DISTINCT FROM s.venue_id;
 IF total+jsonb_array_length(p_tables)>200 THEN RAISE EXCEPTION 'table_limit';END IF;
 v:=s.venue_id;
 IF v IS NULL THEN INSERT INTO public.event_venues(event_id,workspace_id,name,dimensions_w,dimensions_d,scale_meters_per_px)VALUES(p_event,p_workspace,'Event table inventory',NULL,NULL,NULL) RETURNING id INTO v;
 ELSE PERFORM 1 FROM public.event_venues WHERE id=v AND event_id=p_event AND workspace_id=p_workspace FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'event_not_owned';END IF;END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_tables) LOOP
  tid:=(item->>'id')::uuid;label:=btrim(item->>'label');v_capacity:=(item->>'capacity')::integer;
  SELECT * INTO existing FROM public.venue_tables_zones WHERE id=tid FOR UPDATE;IF zoi.table_inventory_actor() IS DISTINCT FROM actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;
  IF existing.id IS NOT NULL THEN
   IF existing.venue_id IS DISTINCT FROM v THEN RAISE EXCEPTION 'table_not_owned';END IF;
   IF (existing.name IS DISTINCT FROM label OR existing.capacity IS DISTINCT FROM v_capacity) AND EXISTS(SELECT 1 FROM zoi.event_table_inventory WHERE table_id=tid) THEN RAISE EXCEPTION 'table_already_priced';END IF;
   UPDATE public.venue_tables_zones SET name=label,capacity=v_capacity WHERE id=tid;
  ELSE INSERT INTO public.venue_tables_zones(id,venue_id,name,capacity,zone_type,shape)VALUES(tid,v,label,v_capacity,'inventory',NULL);END IF;
 END LOOP;
 INSERT INTO zoi.event_table_identity_settings VALUES(p_event,p_workspace,v,coalesce(s.version,0)+1) ON CONFLICT(event_id)DO UPDATE SET version=excluded.version;
 result:=jsonb_build_object('ok',true,'event_id',p_event,'venue_id',v,'version',coalesce(s.version,0)+1,'table_ids',(SELECT jsonb_agg((x->>'id')::uuid ORDER BY (x->>'id')::uuid)FROM jsonb_array_elements(p_tables)x),'enabled',false);
 INSERT INTO zoi.event_table_identity_requests(profile_id,request_id,payload,receipt)VALUES(actor,p_request,payload,result);
 PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN result;
END $function$;

CREATE OR REPLACE FUNCTION public.table_inventory_configure(p_workspace uuid, p_event uuid, p_expected_version integer, p_request uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a uuid;c zoi.event_table_settings;req zoi.event_table_config_requests;payload jsonb;item jsonb;starts timestamptz;enabled boolean;tid uuid;cap integer;minimum integer;price integer;curr text;label text;vversion integer;receipt jsonb;
BEGIN
 a:=zoi.table_inventory_operator(p_workspace,p_event);
 IF p_request IS NULL OR p_expected_version IS NULL OR p_expected_version<0 THEN RAISE EXCEPTION 'invalid_request';END IF;
 payload:=jsonb_build_object('workspace',p_workspace,'event',p_event,'version',p_expected_version,'data',p_data);
 PERFORM pg_advisory_xact_lock(hashtextextended('table-config-request:'||a::text||':'||p_request::text,0));IF zoi.table_inventory_actor() IS DISTINCT FROM a THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;
 SELECT * INTO req FROM zoi.event_table_config_requests WHERE profile_id=a AND request_id=p_request;
 IF req.request_id IS NOT NULL THEN IF req.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM a THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN req.receipt;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('event-table-mode:'||p_event::text,0));
 SELECT * INTO c FROM zoi.event_table_settings WHERE event_id=p_event FOR UPDATE;IF zoi.table_inventory_actor() IS DISTINCT FROM a THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;
 IF c.event_id IS NOT NULL AND c.workspace_id IS DISTINCT FROM p_workspace THEN RAISE EXCEPTION 'inventory_owner_changed';END IF;
 IF coalesce(c.version,0)<>p_expected_version THEN RAISE EXCEPTION 'version_conflict';END IF;
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR length(p_data::text)>100000 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_data)k WHERE k NOT IN('starts_at','enabled','tables')) OR jsonb_typeof(p_data->'enabled') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p_data->'starts_at') IS DISTINCT FROM 'string' OR jsonb_typeof(p_data->'tables') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_configuration';END IF;
 IF jsonb_array_length(p_data->'tables') NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid_configuration';END IF;
 IF (p_data->>'starts_at')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' THEN RAISE EXCEPTION 'invalid_event_time';END IF;
 starts:=(p_data->>'starts_at')::timestamptz;enabled:=(p_data->>'enabled')::boolean;
 IF NOT isfinite(starts) OR starts<=clock_timestamp() OR starts>clock_timestamp()+interval '2 years' THEN RAISE EXCEPTION 'invalid_event_time';END IF;
 IF EXISTS(SELECT 1 FROM zoi.event_table_holds WHERE event_id=p_event AND status='active' AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'active_holds';END IF;
 IF enabled AND (EXISTS(SELECT 1 FROM zoi.ticket_types WHERE event_id=p_event) OR EXISTS(SELECT 1 FROM zoi.seating_sessions WHERE event_id=p_event)) THEN RAISE EXCEPTION 'incompatible_ticket_inventory';END IF;
 IF (SELECT count(DISTINCT x->>'table_id') FROM jsonb_array_elements(p_data->'tables')x)<>jsonb_array_length(p_data->'tables') OR (SELECT count(DISTINCT btrim(x->>'source_label')) FROM jsonb_array_elements(p_data->'tables')x)<>jsonb_array_length(p_data->'tables') THEN RAISE EXCEPTION 'duplicate_table';END IF;
 vversion:=coalesce(c.version,0)+1;
 INSERT INTO zoi.event_table_settings(event_id,workspace_id,version,starts_at,enabled)VALUES(p_event,p_workspace,vversion,starts,enabled)ON CONFLICT(event_id)DO UPDATE SET version=excluded.version,starts_at=excluded.starts_at,enabled=excluded.enabled,updated_at=now();
 DELETE FROM zoi.event_table_inventory WHERE event_id=p_event;
 FOR item IN SELECT * FROM jsonb_array_elements(p_data->'tables') LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(item)k WHERE k NOT IN('table_id','source_label','capacity','min_party_size','price_per_guest_cents','currency','fees_included')) OR item->'fees_included' IS DISTINCT FROM 'true'::jsonb OR jsonb_typeof(item->'source_label') IS DISTINCT FROM 'string' OR jsonb_typeof(item->'currency') IS DISTINCT FROM 'string' OR coalesce(item->>'capacity','')!~'^[0-9]+$' OR jsonb_typeof(item->'capacity') IS DISTINCT FROM 'number' OR coalesce(item->>'min_party_size','')!~'^[0-9]+$' OR jsonb_typeof(item->'min_party_size') IS DISTINCT FROM 'number' OR coalesce(item->>'price_per_guest_cents','')!~'^[0-9]+$' OR jsonb_typeof(item->'price_per_guest_cents') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'invalid_table';END IF;
  tid:=(item->>'table_id')::uuid;cap:=(item->>'capacity')::integer;minimum:=(item->>'min_party_size')::integer;price:=(item->>'price_per_guest_cents')::integer;curr:=item->>'currency';label:=btrim(item->>'source_label');
  IF tid IS NULL OR cap NOT BETWEEN 1 AND 100 OR minimum NOT BETWEEN 1 AND cap OR price NOT BETWEEN 0 AND 10000000 OR curr NOT IN('CAD','USD','EUR','GBP','AUD','NZD','CHF') OR length(label) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'invalid_table';END IF;
  PERFORM 1 FROM public.venue_tables_zones t JOIN public.event_venues v ON v.id=t.venue_id WHERE t.id=tid AND v.workspace_id=p_workspace AND v.event_id=p_event AND t.capacity>=cap FOR SHARE OF t,v;IF zoi.table_inventory_actor() IS DISTINCT FROM a THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'table_not_owned';END IF;
  INSERT INTO zoi.event_table_inventory VALUES(p_event,tid,label,cap,minimum,price,curr);
 END LOOP;
 receipt:=jsonb_build_object('ok',true,'event_id',p_event,'version',vversion,'enabled',enabled,'payment_enabled',false);
 INSERT INTO zoi.event_table_config_requests(profile_id,request_id,payload,receipt)VALUES(a,p_request,payload,receipt);PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM a THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN receipt;
END $function$;

CREATE OR REPLACE FUNCTION public.table_inventory_configure_receipt(p_workspace uuid, p_event uuid, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a uuid;r zoi.event_table_config_requests;
BEGIN
 a:=zoi.table_inventory_operator(p_workspace,p_event);
 IF p_request IS NULL THEN RAISE EXCEPTION 'invalid_request';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('table-config-request:'||a::text||':'||p_request::text,0));IF zoi.table_inventory_actor() IS DISTINCT FROM a THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM zoi.event_table_config_requests WHERE profile_id=a AND request_id=p_request;
 IF r.request_id IS NULL THEN PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM a THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN jsonb_build_object('ok',true,'found',false);END IF;
 IF r.payload->>'workspace' IS DISTINCT FROM p_workspace::text OR r.payload->>'event' IS DISTINCT FROM p_event::text THEN PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM a THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN jsonb_build_object('ok',true,'found',false);END IF;
 PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM a THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN jsonb_build_object('ok',true,'found',true,'receipt',r.receipt);
END $function$;

CREATE OR REPLACE FUNCTION zoi.event_host_cancelled(p_actor uuid, p_request uuid, p_kind text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare prior zoi.event_host_requests;
begin
 if zoi.table_inventory_actor() is distinct from p_actor then raise exception 'not_authorized'; end if;
 select * into prior from zoi.event_host_requests where actor=p_actor and request=p_request;
 if found and prior.payload->>'kind'='cancelled' then
  if prior.payload->>'operation' is distinct from p_kind then raise exception 'request_conflict'; end if;
  PERFORM zoi.suite_lock_session();IF zoi.table_inventory_actor() IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;return prior.receipt;
 end if;
 return null;
end; $function$;

CREATE OR REPLACE FUNCTION zoi.table_inventory_actor()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a uuid;BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_signed_in' USING ERRCODE='42501';END IF;PERFORM zoi.suite_current_session();a:=zoi.ensure_profile();IF a IS NULL THEN RAISE EXCEPTION 'not_signed_in' USING ERRCODE='42501';END IF;RETURN a;END $function$;

CREATE OR REPLACE FUNCTION zoi.table_inventory_operator(p_workspace uuid, p_event uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a uuid:=zoi.table_inventory_actor();r text;o uuid;k text;BEGIN
 SELECT role INTO r FROM zoi.workspace_members WHERE workspace_id=p_workspace AND profile_id=a FOR SHARE;
 IF coalesce(r,'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;
 SELECT owner_workspace_id,entity_type INTO o,k FROM zoi.listings WHERE id=p_event FOR SHARE;
 IF o IS DISTINCT FROM p_workspace OR k IS DISTINCT FROM 'event' THEN RAISE EXCEPTION 'event_not_owned' USING ERRCODE='42501';END IF;IF zoi.table_inventory_actor() IS DISTINCT FROM a THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;RETURN a;END $function$;
DO $guard$ DECLARE x record;p pg_proc; BEGIN
 FOR x IN SELECT * FROM event_authority_expected LOOP
  SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(x.signature);
  IF pg_get_userbyid(p.proowner) IS DISTINCT FROM 'postgres' OR NOT p.prosecdef
   OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[] OR p.proacl::text IS DISTINCT FROM x.acl
  THEN RAISE EXCEPTION 'event_authority_permissions_changed: %',x.signature;END IF;
 END LOOP;
END $guard$;
COMMIT;

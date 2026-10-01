begin;
set local lock_timeout='5s';
-- Private, called while holding the existing request then actor advisory locks.
create or replace function zoi.event_host_cancelled(p_actor uuid,p_request uuid,p_kind text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prior zoi.event_host_requests;
begin
 if zoi.table_inventory_actor() is distinct from p_actor then raise exception 'not_authorized'; end if;
 select * into prior from zoi.event_host_requests where actor=p_actor and request=p_request;
 if found and prior.payload->>'kind'='cancelled' then
  if prior.payload->>'operation' is distinct from p_kind then raise exception 'request_conflict'; end if;
  return prior.receipt;
 end if;
 return null;
end; $$;
revoke all on function zoi.event_host_cancelled(uuid,uuid,text) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.event_host_allocate(p_workspace uuid, p_event uuid, p_table uuid, p_host uuid, p_quota integer, p_expires_at timestamp with time zone, p_expected_pricing_version integer, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_actor uuid;c zoi.event_table_settings;i zoi.event_table_inventory;a zoi.event_host_allocations;payload jsonb;prior zoi.event_host_requests;r jsonb;
BEGIN v_actor:=zoi.table_inventory_operator(p_workspace,p_event);IF p_request IS NULL OR p_host IS NULL OR p_quota IS NULL OR p_expires_at IS NULL OR p_expected_pricing_version IS NULL THEN RAISE EXCEPTION 'invalid_allocation';END IF;
 payload:=jsonb_build_object('kind','allocate','workspace',p_workspace,'event',p_event,'table',p_table,'host',p_host,'quota',p_quota,'expires_at',p_expires_at,'pricing_version',p_expected_pricing_version);
 PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||v_actor::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||v_actor::text,0));r:=zoi.event_host_cancelled(v_actor,p_request,'allocate');IF r IS NOT NULL THEN RETURN r;END IF;PERFORM zoi.table_inventory_operator(p_workspace,p_event);SELECT * INTO prior FROM zoi.event_host_requests WHERE event_host_requests.actor=v_actor AND request=p_request;
 IF FOUND THEN IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN prior.receipt;END IF;PERFORM zoi.event_host_budget(v_actor);
 SELECT * INTO c FROM zoi.event_table_settings WHERE event_id=p_event FOR UPDATE;
 IF c.workspace_id IS DISTINCT FROM p_workspace OR NOT zoi.table_inventory_public(p_event) THEN RAISE EXCEPTION 'inventory_unavailable';END IF;
 IF c.version<>p_expected_pricing_version THEN RAISE EXCEPTION 'pricing_version_conflict';END IF;
 SELECT * INTO i FROM zoi.event_table_inventory WHERE event_id=p_event AND table_id=p_table;
 IF i.table_id IS NULL OR p_quota NOT BETWEEN i.min_party_size AND i.capacity OR p_expires_at<=clock_timestamp() OR p_expires_at>c.starts_at OR p_expires_at>clock_timestamp()+interval '90 days' THEN RAISE EXCEPTION 'invalid_allocation';END IF;
 PERFORM 1 FROM public.venue_tables_zones t JOIN public.event_venues v ON v.id=t.venue_id WHERE t.id=p_table AND t.capacity>=p_quota AND v.event_id=p_event AND v.workspace_id=p_workspace FOR SHARE OF t,v;IF NOT FOUND THEN RAISE EXCEPTION 'inventory_unavailable';END IF;
 IF NOT EXISTS(SELECT 1 FROM zoi.user_profiles WHERE id=p_host) THEN RAISE EXCEPTION 'host_unavailable';END IF;
 IF EXISTS(SELECT 1 FROM zoi.event_table_holds WHERE event_id=p_event AND table_id=p_table AND status='active' AND expires_at>clock_timestamp()) OR EXISTS(SELECT 1 FROM zoi.event_host_allocations x WHERE x.event_id=p_event AND x.table_id=p_table AND zoi.event_host_valid(x)) THEN RAISE EXCEPTION 'table_unavailable';END IF;
 INSERT INTO zoi.event_host_allocations(event_id,table_id,workspace_id,host_profile_id,label,quota,pricing_version,price_per_guest_cents,currency,expires_at)VALUES(p_event,p_table,p_workspace,p_host,i.source_label,p_quota,c.version,i.price_per_guest_cents,i.currency,p_expires_at)RETURNING * INTO a;
 r:=jsonb_build_object('ok',true,'allocation',zoi.event_host_view(a),'payment_collected',false,'delivery_configured',false);INSERT INTO zoi.event_host_requests(actor,request,payload,receipt) VALUES(v_actor,p_request,payload,r);RETURN r;
END $function$
;

CREATE OR REPLACE FUNCTION public.event_host_claim(p_token text, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_actor uuid:=zoi.table_inventory_actor();g zoi.event_host_guests;a zoi.event_host_allocations;ev uuid;hash text;prior zoi.event_host_requests;payload jsonb;r jsonb;
BEGIN IF p_request IS NULL OR coalesce(p_token,'')!~'^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'claim_unavailable';END IF;hash:=encode(extensions.digest(p_token,'sha256'),'hex');payload:=jsonb_build_object('kind','claim','token_hash',hash);
 PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||v_actor::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||v_actor::text,0));r:=zoi.event_host_cancelled(v_actor,p_request,'claim');IF r IS NOT NULL THEN RETURN r;END IF;SELECT a0.event_id INTO ev FROM zoi.event_host_guests g0 JOIN zoi.event_host_allocations a0 ON a0.id=g0.event_allocation_id WHERE g0.token_hash=hash;PERFORM 1 FROM zoi.event_table_settings WHERE event_id=ev FOR UPDATE;SELECT * INTO g FROM zoi.event_host_guests WHERE token_hash=hash FOR UPDATE;SELECT * INTO a FROM zoi.event_host_allocations WHERE id=g.event_allocation_id;
 PERFORM 1 FROM zoi.listings WHERE id=a.event_id AND owner_workspace_id=a.workspace_id FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'claim_unavailable';END IF;
 IF g.id IS NULL OR NOT zoi.event_host_valid(a) OR g.status='revoked' OR(g.claimed_by IS NOT NULL AND g.claimed_by<>v_actor) THEN RAISE EXCEPTION 'claim_unavailable';END IF;
 SELECT * INTO prior FROM zoi.event_host_requests WHERE event_host_requests.actor=v_actor AND request=p_request;IF FOUND THEN IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN prior.receipt;END IF;PERFORM zoi.event_host_budget(v_actor);
 IF g.claimed_by IS NULL THEN UPDATE zoi.event_host_guests SET claimed_by=v_actor,status='accepted',version=version+1 WHERE id=g.id RETURNING * INTO g;END IF;
 r:=jsonb_build_object('ok',true,'event_id',a.event_id,'table_id',a.table_id,'guest_id',g.id,'quantity',g.quantity,'status','accepted','price_per_guest_cents',a.price_per_guest_cents,'currency',a.currency,'payment_collected',false,'ticket_issued',false);INSERT INTO zoi.event_host_requests(actor,request,payload,receipt) VALUES(v_actor,p_request,payload,r);RETURN r;
END $function$
;

CREATE OR REPLACE FUNCTION public.event_host_guest_save(p_allocation uuid, p_guest uuid, p_expected_version integer, p_request uuid, p_label text, p_quantity integer, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_actor uuid:=zoi.table_inventory_actor();a zoi.event_host_allocations;g zoi.event_host_guests;payload jsonb;prior zoi.event_host_requests;hash text;r jsonb;ev uuid;
BEGIN IF p_request IS NULL OR p_guest IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 100 OR length(btrim(coalesce(p_label,''))) NOT BETWEEN 1 AND 80 OR p_label~'[[:cntrl:]]' OR coalesce(p_token,'')!~'^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid_guest';END IF;
 hash:=encode(extensions.digest(p_token,'sha256'),'hex');payload:=jsonb_build_object('kind','guest','allocation',p_allocation,'guest',p_guest,'version',p_expected_version,'label',btrim(p_label),'quantity',p_quantity,'token_hash',hash);
 PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||v_actor::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||v_actor::text,0));r:=zoi.event_host_cancelled(v_actor,p_request,'guest');IF r IS NOT NULL THEN RETURN r;END IF;SELECT event_id INTO ev FROM zoi.event_host_allocations WHERE id=p_allocation;PERFORM 1 FROM zoi.event_table_settings WHERE event_id=ev FOR UPDATE;SELECT * INTO a FROM zoi.event_host_allocations WHERE id=p_allocation FOR UPDATE;
 PERFORM 1 FROM zoi.listings WHERE id=a.event_id AND owner_workspace_id=a.workspace_id FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'allocation_unavailable';END IF;
 IF a.id IS NULL OR a.host_profile_id IS DISTINCT FROM v_actor OR NOT zoi.event_host_valid(a) THEN RAISE EXCEPTION 'allocation_unavailable';END IF;
 SELECT * INTO prior FROM zoi.event_host_requests WHERE event_host_requests.actor=v_actor AND request=p_request;IF FOUND THEN IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN prior.receipt;END IF;PERFORM zoi.event_host_budget(v_actor);
 SELECT * INTO g FROM zoi.event_host_guests WHERE id=p_guest FOR UPDATE;
 IF g.id IS NOT NULL AND(g.event_allocation_id IS DISTINCT FROM a.id OR g.status<>'invited') THEN RAISE EXCEPTION 'guest_not_editable';END IF;
 IF coalesce(g.version,0)<>p_expected_version THEN RAISE EXCEPTION 'version_conflict';END IF;
 IF coalesce((SELECT sum(quantity) FROM zoi.event_host_guests WHERE event_allocation_id=a.id AND status<>'revoked' AND id<>p_guest),0)+p_quantity>a.quota THEN RAISE EXCEPTION 'allocation_quota_exceeded';END IF;
 INSERT INTO zoi.event_host_guests(id,event_allocation_id,label,quantity,token_hash)VALUES(p_guest,a.id,btrim(p_label),p_quantity,hash)ON CONFLICT(id)DO UPDATE SET label=excluded.label,quantity=excluded.quantity,token_hash=excluded.token_hash,version=event_host_guests.version+1 RETURNING * INTO g;
 r:=jsonb_build_object('ok',true,'guest',jsonb_build_object('id',g.id,'quantity',g.quantity,'label',g.label,'status',g.status,'version',g.version),'delivery_configured',false,'payment_collected',false);INSERT INTO zoi.event_host_requests(actor,request,payload,receipt) VALUES(v_actor,p_request,payload,r);RETURN r;
END $function$
;

CREATE OR REPLACE FUNCTION public.event_host_receipt(p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_actor uuid:=zoi.table_inventory_actor();r zoi.event_host_requests;a zoi.event_host_allocations;g zoi.event_host_guests;
BEGIN PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||v_actor::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||v_actor::text,0));IF zoi.table_inventory_actor() IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'not_authorized';END IF;SELECT * INTO r FROM zoi.event_host_requests WHERE actor=v_actor AND request=p_request;IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'found',false,'receipt',NULL);END IF;
 IF r.payload->>'kind' IN('allocate','payment_policy') THEN PERFORM zoi.table_inventory_operator((r.payload->>'workspace')::uuid,(r.payload->>'event')::uuid);
 ELSIF r.payload->>'kind'='payment_choice' THEN PERFORM zoi.event_payment_guest_authorize((r.payload->>'guest')::uuid,v_actor);
 ELSIF r.payload->>'kind' IN('guest','release') THEN SELECT * INTO a FROM zoi.event_host_allocations WHERE id=(r.payload->>'allocation')::uuid;IF r.payload->>'kind'='release' THEN PERFORM zoi.table_inventory_operator(a.workspace_id,a.event_id);ELSIF a.host_profile_id IS DISTINCT FROM v_actor OR NOT EXISTS(SELECT 1 FROM zoi.listings WHERE id=a.event_id AND owner_workspace_id=a.workspace_id) THEN RAISE EXCEPTION 'allocation_unavailable';END IF;
 ELSIF r.payload->>'kind'='claim' THEN
 SELECT * INTO g FROM zoi.event_host_guests WHERE token_hash=r.payload->>'token_hash';
 SELECT * INTO a FROM zoi.event_host_allocations WHERE id=g.event_allocation_id;
 IF g.id IS NULL OR g.claimed_by IS DISTINCT FROM v_actor OR g.status<>'accepted' OR NOT EXISTS(SELECT 1 FROM zoi.listings WHERE id=a.event_id AND owner_workspace_id=a.workspace_id) THEN RAISE EXCEPTION 'claim_unavailable';END IF;
 END IF;RETURN jsonb_build_object('ok',true,'found',true,'receipt',r.receipt,'historical',true);
END $function$
;

CREATE OR REPLACE FUNCTION public.event_host_release(p_allocation uuid, p_expected_version integer, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_actor uuid:=zoi.table_inventory_actor();a zoi.event_host_allocations;prior zoi.event_host_requests;payload jsonb;r jsonb;ev uuid;
BEGIN IF p_request IS NULL OR p_expected_version IS NULL THEN RAISE EXCEPTION 'invalid_request';END IF;PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||v_actor::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||v_actor::text,0));r:=zoi.event_host_cancelled(v_actor,p_request,'release');IF r IS NOT NULL THEN RETURN r;END IF;SELECT event_id INTO ev FROM zoi.event_host_allocations WHERE id=p_allocation;PERFORM 1 FROM zoi.event_table_settings WHERE event_id=ev FOR UPDATE;SELECT * INTO a FROM zoi.event_host_allocations WHERE id=p_allocation FOR UPDATE;IF a.id IS NULL THEN RAISE EXCEPTION 'allocation_unavailable';END IF;
 PERFORM zoi.table_inventory_operator(a.workspace_id,a.event_id);
 payload:=jsonb_build_object('kind','release','allocation',p_allocation,'version',p_expected_version);PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||v_actor::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||v_actor::text,0));SELECT * INTO prior FROM zoi.event_host_requests WHERE event_host_requests.actor=v_actor AND request=p_request;IF FOUND THEN IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN prior.receipt;END IF;
 IF a.status='released' THEN RAISE EXCEPTION 'allocation_already_released';END IF;IF a.version<>p_expected_version THEN RAISE EXCEPTION 'version_conflict';END IF;UPDATE zoi.event_host_allocations SET status='released',version=version+1 WHERE id=a.id RETURNING * INTO a;r:=jsonb_build_object('ok',true,'allocation',zoi.event_host_view(a),'payment_collected',false);INSERT INTO zoi.event_host_requests(actor,request,payload,receipt) VALUES(v_actor,p_request,payload,r);RETURN r;
END $function$
;

create or replace function public.event_host_request_cancel(p_request uuid,p_kind text)
returns jsonb language plpgsql security definer set search_path='' as $$
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
  return public.event_host_receipt(p_request);
 end if;
 perform zoi.event_host_budget(v_actor);
 result:=jsonb_build_object('ok',false,'error','request_cancelled','request_id',p_request,'kind',p_kind,'payment_collected',false,'ticket_issued',false);
 insert into zoi.event_host_requests(actor,request,payload,receipt)
 values(v_actor,p_request,jsonb_build_object('kind','cancelled','operation',p_kind),result);
 return jsonb_build_object('ok',true,'found',true,'receipt',result,'historical',true);
end; $$;
revoke all on function public.event_host_request_cancel(uuid,text) from public,anon,authenticated;
grant execute on function public.event_host_request_cancel(uuid,text) to authenticated;
commit;

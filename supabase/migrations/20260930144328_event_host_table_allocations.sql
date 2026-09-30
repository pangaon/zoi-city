BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE zoi.event_host_allocations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL REFERENCES zoi.event_table_settings(event_id),table_id uuid NOT NULL REFERENCES public.venue_tables_zones(id),workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id),host_profile_id uuid NOT NULL REFERENCES zoi.user_profiles(id),label text NOT NULL,quota integer NOT NULL CHECK(quota BETWEEN 1 AND 100),pricing_version integer NOT NULL,price_per_guest_cents integer NOT NULL,currency text NOT NULL,expires_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'active' CHECK(status IN('active','released')),version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX event_host_allocation_active ON zoi.event_host_allocations(event_id,table_id,expires_at) WHERE status='active';
CREATE TABLE zoi.event_host_guests(id uuid PRIMARY KEY,event_allocation_id uuid NOT NULL REFERENCES zoi.event_host_allocations(id),label text NOT NULL,quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 100),token_hash text NOT NULL UNIQUE,claimed_by uuid REFERENCES zoi.user_profiles(id),status text NOT NULL DEFAULT 'invited' CHECK(status IN('invited','accepted','revoked')),version integer NOT NULL DEFAULT 1);
CREATE TABLE zoi.event_host_requests(actor uuid NOT NULL REFERENCES zoi.user_profiles(id),request uuid NOT NULL,payload jsonb NOT NULL,receipt jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(actor,request));
CREATE INDEX event_host_request_budget ON zoi.event_host_requests(actor,created_at);
ALTER TABLE zoi.event_host_allocations ENABLE ROW LEVEL SECURITY;ALTER TABLE zoi.event_host_guests ENABLE ROW LEVEL SECURITY;ALTER TABLE zoi.event_host_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.event_host_allocations,zoi.event_host_guests,zoi.event_host_requests FROM PUBLIC,anon,authenticated;
CREATE FUNCTION zoi.event_host_valid(a zoi.event_host_allocations)RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$SELECT a.status='active' AND a.expires_at>clock_timestamp() AND EXISTS(SELECT 1 FROM zoi.event_table_settings s WHERE s.event_id=a.event_id AND s.workspace_id=a.workspace_id AND s.version=a.pricing_version AND zoi.table_inventory_public(a.event_id) AND EXISTS(SELECT 1 FROM public.venue_tables_zones t JOIN public.event_venues v ON v.id=t.venue_id WHERE t.id=a.table_id AND t.capacity>=a.quota AND v.event_id=a.event_id AND v.workspace_id=a.workspace_id))$$;
CREATE FUNCTION zoi.event_host_view(a zoi.event_host_allocations)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$SELECT jsonb_build_object('id',a.id,'event_id',a.event_id,'table_id',a.table_id,'host_profile_id',a.host_profile_id,'label',a.label,'quota',a.quota,'pricing_version',a.pricing_version,'price_per_guest_cents',a.price_per_guest_cents,'currency',a.currency,'expires_at',a.expires_at,'version',a.version,'status',CASE WHEN a.status='released' THEN 'released' WHEN a.expires_at<=clock_timestamp() THEN 'expired' WHEN zoi.event_host_valid(a) THEN 'active' ELSE 'invalidated' END)$$;
CREATE FUNCTION zoi.event_host_budget(p_actor uuid)RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN IF(SELECT count(*) FROM zoi.event_host_requests WHERE actor=p_actor AND created_at>clock_timestamp()-interval '1 day')>=300 THEN RAISE EXCEPTION 'host_request_limit';END IF;END $$;
REVOKE ALL ON FUNCTION zoi.event_host_budget(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.event_host_allocate(p_workspace uuid,p_event uuid,p_table uuid,p_host uuid,p_quota integer,p_expires_at timestamptz,p_expected_pricing_version integer,p_request uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid;c zoi.event_table_settings;i zoi.event_table_inventory;a zoi.event_host_allocations;payload jsonb;prior zoi.event_host_requests;r jsonb;
BEGIN v_actor:=zoi.table_inventory_operator(p_workspace,p_event);IF p_request IS NULL OR p_host IS NULL OR p_quota IS NULL OR p_expires_at IS NULL OR p_expected_pricing_version IS NULL THEN RAISE EXCEPTION 'invalid_allocation';END IF;
 payload:=jsonb_build_object('kind','allocate','workspace',p_workspace,'event',p_event,'table',p_table,'host',p_host,'quota',p_quota,'expires_at',p_expires_at,'pricing_version',p_expected_pricing_version);
 PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||v_actor::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||v_actor::text,0));SELECT * INTO prior FROM zoi.event_host_requests WHERE event_host_requests.actor=v_actor AND request=p_request;
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
END $$;
CREATE FUNCTION public.event_host_get(p_allocation uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=zoi.table_inventory_actor();a zoi.event_host_allocations;guests jsonb;
BEGIN SELECT * INTO a FROM zoi.event_host_allocations WHERE id=p_allocation;IF a.id IS NULL THEN RAISE EXCEPTION 'allocation_unavailable';END IF;
 IF v_actor IS DISTINCT FROM a.host_profile_id THEN PERFORM zoi.table_inventory_operator(a.workspace_id,a.event_id);END IF;
 IF NOT EXISTS(SELECT 1 FROM zoi.listings WHERE id=a.event_id AND owner_workspace_id=a.workspace_id) THEN RAISE EXCEPTION 'allocation_unavailable';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'quantity',quantity,'status',status,'version',version) ORDER BY id),'[]') INTO guests FROM zoi.event_host_guests WHERE event_allocation_id=a.id;
 RETURN jsonb_build_object('ok',true,'allocation',zoi.event_host_view(a),'guests',guests,'payment_collected',false,'delivery_configured',false);
END $$;
CREATE FUNCTION public.event_host_guest_save(p_allocation uuid,p_guest uuid,p_expected_version integer,p_request uuid,p_label text,p_quantity integer,p_token text)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=zoi.table_inventory_actor();a zoi.event_host_allocations;g zoi.event_host_guests;payload jsonb;prior zoi.event_host_requests;hash text;r jsonb;ev uuid;
BEGIN IF p_request IS NULL OR p_guest IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 100 OR length(btrim(coalesce(p_label,''))) NOT BETWEEN 1 AND 80 OR p_label~'[[:cntrl:]]' OR coalesce(p_token,'')!~'^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid_guest';END IF;
 hash:=encode(extensions.digest(p_token,'sha256'),'hex');payload:=jsonb_build_object('kind','guest','allocation',p_allocation,'guest',p_guest,'version',p_expected_version,'label',btrim(p_label),'quantity',p_quantity,'token_hash',hash);
 PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||v_actor::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||v_actor::text,0));SELECT event_id INTO ev FROM zoi.event_host_allocations WHERE id=p_allocation;PERFORM 1 FROM zoi.event_table_settings WHERE event_id=ev FOR UPDATE;SELECT * INTO a FROM zoi.event_host_allocations WHERE id=p_allocation FOR UPDATE;
 PERFORM 1 FROM zoi.listings WHERE id=a.event_id AND owner_workspace_id=a.workspace_id FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'allocation_unavailable';END IF;
 IF a.id IS NULL OR a.host_profile_id IS DISTINCT FROM v_actor OR NOT zoi.event_host_valid(a) THEN RAISE EXCEPTION 'allocation_unavailable';END IF;
 SELECT * INTO prior FROM zoi.event_host_requests WHERE event_host_requests.actor=v_actor AND request=p_request;IF FOUND THEN IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN prior.receipt;END IF;PERFORM zoi.event_host_budget(v_actor);
 SELECT * INTO g FROM zoi.event_host_guests WHERE id=p_guest FOR UPDATE;
 IF g.id IS NOT NULL AND(g.event_allocation_id IS DISTINCT FROM a.id OR g.status<>'invited') THEN RAISE EXCEPTION 'guest_not_editable';END IF;
 IF coalesce(g.version,0)<>p_expected_version THEN RAISE EXCEPTION 'version_conflict';END IF;
 IF coalesce((SELECT sum(quantity) FROM zoi.event_host_guests WHERE event_allocation_id=a.id AND status<>'revoked' AND id<>p_guest),0)+p_quantity>a.quota THEN RAISE EXCEPTION 'allocation_quota_exceeded';END IF;
 INSERT INTO zoi.event_host_guests(id,event_allocation_id,label,quantity,token_hash)VALUES(p_guest,a.id,btrim(p_label),p_quantity,hash)ON CONFLICT(id)DO UPDATE SET label=excluded.label,quantity=excluded.quantity,token_hash=excluded.token_hash,version=event_host_guests.version+1 RETURNING * INTO g;
 r:=jsonb_build_object('ok',true,'guest',jsonb_build_object('id',g.id,'quantity',g.quantity,'label',g.label,'status',g.status,'version',g.version),'delivery_configured',false,'payment_collected',false);INSERT INTO zoi.event_host_requests(actor,request,payload,receipt) VALUES(v_actor,p_request,payload,r);RETURN r;
END $$;
-- Read-only, authenticated capability preview. Never returns private host/guest labels.
CREATE FUNCTION public.event_host_claim_preview(p_token text)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=zoi.table_inventory_actor();g zoi.event_host_guests;a zoi.event_host_allocations;event_name text;
BEGIN
 IF coalesce(p_token,'')!~'^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'claim_unavailable';END IF;
 SELECT * INTO g FROM zoi.event_host_guests WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 SELECT * INTO a FROM zoi.event_host_allocations WHERE id=g.event_allocation_id;
 IF g.id IS NULL OR a.id IS NULL OR NOT zoi.event_host_valid(a) OR g.status NOT IN('invited','accepted') OR(g.claimed_by IS NOT NULL AND g.claimed_by<>v_actor) THEN RAISE EXCEPTION 'claim_unavailable';END IF;
 SELECT name INTO event_name FROM zoi.listings WHERE id=a.event_id AND owner_workspace_id=a.workspace_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'claim_unavailable';END IF;
 RETURN jsonb_build_object('ok',true,'event_id',a.event_id,'event_name',coalesce(event_name,'Event'),'table_id',a.table_id,'table_label',a.label,'quantity',g.quantity,'price_per_guest_cents',a.price_per_guest_cents,'currency',a.currency,'expires_at',a.expires_at,'status',g.status,'payment_collected',false,'ticket_issued',false);
END $$;
REVOKE ALL ON FUNCTION public.event_host_claim_preview(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.event_host_claim_preview(text) TO authenticated;
CREATE FUNCTION public.event_host_claim(p_token text,p_request uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=zoi.table_inventory_actor();g zoi.event_host_guests;a zoi.event_host_allocations;ev uuid;hash text;prior zoi.event_host_requests;payload jsonb;r jsonb;
BEGIN IF p_request IS NULL OR coalesce(p_token,'')!~'^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'claim_unavailable';END IF;hash:=encode(extensions.digest(p_token,'sha256'),'hex');payload:=jsonb_build_object('kind','claim','token_hash',hash);
 PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||v_actor::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||v_actor::text,0));SELECT a0.event_id INTO ev FROM zoi.event_host_guests g0 JOIN zoi.event_host_allocations a0 ON a0.id=g0.event_allocation_id WHERE g0.token_hash=hash;PERFORM 1 FROM zoi.event_table_settings WHERE event_id=ev FOR UPDATE;SELECT * INTO g FROM zoi.event_host_guests WHERE token_hash=hash FOR UPDATE;SELECT * INTO a FROM zoi.event_host_allocations WHERE id=g.event_allocation_id;
 PERFORM 1 FROM zoi.listings WHERE id=a.event_id AND owner_workspace_id=a.workspace_id FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'claim_unavailable';END IF;
 IF g.id IS NULL OR NOT zoi.event_host_valid(a) OR g.status='revoked' OR(g.claimed_by IS NOT NULL AND g.claimed_by<>v_actor) THEN RAISE EXCEPTION 'claim_unavailable';END IF;
 SELECT * INTO prior FROM zoi.event_host_requests WHERE event_host_requests.actor=v_actor AND request=p_request;IF FOUND THEN IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN prior.receipt;END IF;PERFORM zoi.event_host_budget(v_actor);
 IF g.claimed_by IS NULL THEN UPDATE zoi.event_host_guests SET claimed_by=v_actor,status='accepted',version=version+1 WHERE id=g.id RETURNING * INTO g;END IF;
 r:=jsonb_build_object('ok',true,'event_id',a.event_id,'table_id',a.table_id,'guest_id',g.id,'quantity',g.quantity,'status','accepted','price_per_guest_cents',a.price_per_guest_cents,'currency',a.currency,'payment_collected',false,'ticket_issued',false);INSERT INTO zoi.event_host_requests(actor,request,payload,receipt) VALUES(v_actor,p_request,payload,r);RETURN r;
END $$;
CREATE FUNCTION public.event_host_release(p_allocation uuid,p_expected_version integer,p_request uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=zoi.table_inventory_actor();a zoi.event_host_allocations;prior zoi.event_host_requests;payload jsonb;r jsonb;ev uuid;
BEGIN IF p_request IS NULL OR p_expected_version IS NULL THEN RAISE EXCEPTION 'invalid_request';END IF;PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||v_actor::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||v_actor::text,0));SELECT event_id INTO ev FROM zoi.event_host_allocations WHERE id=p_allocation;PERFORM 1 FROM zoi.event_table_settings WHERE event_id=ev FOR UPDATE;SELECT * INTO a FROM zoi.event_host_allocations WHERE id=p_allocation FOR UPDATE;IF a.id IS NULL THEN RAISE EXCEPTION 'allocation_unavailable';END IF;
 PERFORM zoi.table_inventory_operator(a.workspace_id,a.event_id);
 payload:=jsonb_build_object('kind','release','allocation',p_allocation,'version',p_expected_version);PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||v_actor::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||v_actor::text,0));SELECT * INTO prior FROM zoi.event_host_requests WHERE event_host_requests.actor=v_actor AND request=p_request;IF FOUND THEN IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN prior.receipt;END IF;
 IF a.status='released' THEN RAISE EXCEPTION 'allocation_already_released';END IF;IF a.version<>p_expected_version THEN RAISE EXCEPTION 'version_conflict';END IF;UPDATE zoi.event_host_allocations SET status='released',version=version+1 WHERE id=a.id RETURNING * INTO a;r:=jsonb_build_object('ok',true,'allocation',zoi.event_host_view(a),'payment_collected',false);INSERT INTO zoi.event_host_requests(actor,request,payload,receipt) VALUES(v_actor,p_request,payload,r);RETURN r;
END $$;
ALTER FUNCTION public.table_inventory_map(uuid) RENAME TO table_inventory_map_before_host;
REVOKE ALL ON FUNCTION public.table_inventory_map_before_host(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.table_inventory_map(p_event uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb;rows jsonb;
BEGIN r:=public.table_inventory_map_before_host(p_event);IF r->>'configured'='true' THEN SELECT coalesce(jsonb_agg(CASE WHEN EXISTS(SELECT 1 FROM zoi.event_host_allocations a WHERE a.event_id=p_event AND a.table_id=(t->>'table_id')::uuid AND zoi.event_host_valid(a)) THEN jsonb_set(t,'{availability}','"unavailable"') ELSE t END),'[]') INTO rows FROM jsonb_array_elements(r->'tables')t;r:=jsonb_set(r,'{tables}',rows);END IF;RETURN r;END $$;
REVOKE ALL ON FUNCTION public.table_inventory_map(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.table_inventory_map(uuid) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.event_host_release(uuid,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.event_host_release(uuid,integer,uuid) TO authenticated;
CREATE FUNCTION public.event_host_list(p_workspace uuid DEFAULT NULL,p_event uuid DEFAULT NULL)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=zoi.table_inventory_actor();rows jsonb;
BEGIN IF p_workspace IS NOT NULL THEN IF p_event IS NULL THEN RAISE EXCEPTION 'event_required';END IF;PERFORM zoi.table_inventory_operator(p_workspace,p_event);END IF;
 SELECT coalesce(jsonb_agg(zoi.event_host_view(x) ORDER BY x.created_at DESC),'[]')INTO rows FROM(SELECT a.* FROM zoi.event_host_allocations a JOIN zoi.listings l ON l.id=a.event_id AND l.owner_workspace_id=a.workspace_id WHERE (p_event IS NULL OR a.event_id=p_event) AND ((p_workspace IS NULL AND a.host_profile_id=v_actor)OR(a.workspace_id=p_workspace)) ORDER BY a.created_at DESC LIMIT 100)x;
 RETURN jsonb_build_object('ok',true,'allocations',rows,'delivery_configured',false,'payment_collected',false);
END $$;
CREATE FUNCTION public.event_host_receipt(p_request uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=zoi.table_inventory_actor();r zoi.event_host_requests;a zoi.event_host_allocations;
BEGIN PERFORM pg_advisory_xact_lock(hashtextextended('event-host-request:'||v_actor::text||':'||p_request::text,0));PERFORM pg_advisory_xact_lock(hashtextextended('event-host-actor:'||v_actor::text,0));SELECT * INTO r FROM zoi.event_host_requests WHERE actor=v_actor AND request=p_request;IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'found',false,'receipt',NULL);END IF;
 IF r.payload->>'kind'='allocate' THEN PERFORM zoi.table_inventory_operator((r.payload->>'workspace')::uuid,(r.payload->>'event')::uuid);
 ELSIF r.payload->>'kind' IN('guest','release') THEN SELECT * INTO a FROM zoi.event_host_allocations WHERE id=(r.payload->>'allocation')::uuid;IF r.payload->>'kind'='release' THEN PERFORM zoi.table_inventory_operator(a.workspace_id,a.event_id);ELSIF a.host_profile_id IS DISTINCT FROM v_actor OR NOT EXISTS(SELECT 1 FROM zoi.listings WHERE id=a.event_id AND owner_workspace_id=a.workspace_id) THEN RAISE EXCEPTION 'allocation_unavailable';END IF;
 END IF;
 RETURN jsonb_build_object('ok',true,'found',true,'receipt',r.receipt,'historical',true);
END $$;
REVOKE ALL ON FUNCTION public.event_host_list(uuid,uuid),public.event_host_receipt(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.event_host_list(uuid,uuid),public.event_host_receipt(uuid) TO authenticated;
-- All existing hold writes share the settings row lock before this trigger.
CREATE FUNCTION zoi.event_host_hold_guard()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN PERFORM 1 FROM zoi.event_table_settings WHERE event_id=NEW.event_id FOR UPDATE;IF NEW.status='active' AND NEW.expires_at>clock_timestamp() AND EXISTS(SELECT 1 FROM zoi.event_host_allocations a WHERE a.event_id=NEW.event_id AND a.table_id=NEW.table_id AND zoi.event_host_valid(a)) THEN RAISE EXCEPTION 'table_unavailable';END IF;RETURN NEW;END $$;
CREATE TRIGGER event_host_hold_guard BEFORE INSERT OR UPDATE ON zoi.event_table_holds FOR EACH ROW EXECUTE FUNCTION zoi.event_host_hold_guard();
CREATE FUNCTION zoi.event_host_config_guard()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN IF EXISTS(SELECT 1 FROM zoi.event_host_allocations a WHERE a.event_id=OLD.event_id AND a.status='active' AND a.expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'active_host_allocations';END IF;RETURN NEW;END $$;
CREATE TRIGGER event_host_config_guard BEFORE UPDATE ON zoi.event_table_settings FOR EACH ROW EXECUTE FUNCTION zoi.event_host_config_guard();
REVOKE ALL ON FUNCTION zoi.event_host_valid(zoi.event_host_allocations),zoi.event_host_view(zoi.event_host_allocations),zoi.event_host_hold_guard(),zoi.event_host_config_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.event_host_allocate(uuid,uuid,uuid,uuid,integer,timestamptz,integer,uuid),public.event_host_get(uuid),public.event_host_guest_save(uuid,uuid,integer,uuid,text,integer,text),public.event_host_claim(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.event_host_allocate(uuid,uuid,uuid,uuid,integer,timestamptz,integer,uuid),public.event_host_get(uuid),public.event_host_guest_save(uuid,uuid,integer,uuid,text,integer,text),public.event_host_claim(text,uuid) TO authenticated;
COMMIT;

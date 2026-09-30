BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE zoi.event_table_settings(
 event_id uuid PRIMARY KEY REFERENCES zoi.listings(id),workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id),
 version integer NOT NULL CHECK(version>0),starts_at timestamptz NOT NULL,enabled boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE zoi.event_table_inventory(
 event_id uuid NOT NULL REFERENCES zoi.event_table_settings(event_id),table_id uuid NOT NULL REFERENCES public.venue_tables_zones(id),
 source_label text NOT NULL CHECK(length(source_label) BETWEEN 1 AND 80),capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 100),
 min_party_size integer NOT NULL CHECK(min_party_size BETWEEN 1 AND capacity),price_per_guest_cents integer NOT NULL CHECK(price_per_guest_cents BETWEEN 0 AND 10000000),
 currency text NOT NULL CHECK(currency IN('CAD','USD','EUR','GBP','AUD','NZD','CHF')),PRIMARY KEY(event_id,table_id),UNIQUE(event_id,source_label));
CREATE TABLE zoi.event_table_holds(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL REFERENCES zoi.event_table_settings(event_id),table_id uuid NOT NULL REFERENCES public.venue_tables_zones(id),
 profile_id uuid NOT NULL REFERENCES zoi.user_profiles(id),request_id uuid NOT NULL,request_data jsonb NOT NULL,
 party_size integer NOT NULL CHECK(party_size BETWEEN 1 AND 100),pricing_version integer NOT NULL,
 price_per_guest_cents integer NOT NULL,currency text NOT NULL,total_cents bigint NOT NULL,
 status text NOT NULL DEFAULT 'active' CHECK(status IN('active','released','expired')),expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(profile_id,request_id));
CREATE INDEX event_table_holds_live ON zoi.event_table_holds(event_id,table_id,expires_at) WHERE status='active';
CREATE INDEX event_table_holds_actor ON zoi.event_table_holds(profile_id,event_id,created_at DESC);
CREATE TABLE zoi.event_table_config_requests(profile_id uuid NOT NULL REFERENCES zoi.user_profiles(id),request_id uuid NOT NULL,payload jsonb NOT NULL,receipt jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(profile_id,request_id));
ALTER TABLE zoi.event_table_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoi.event_table_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoi.event_table_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoi.event_table_config_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.event_table_settings,zoi.event_table_inventory,zoi.event_table_holds,zoi.event_table_config_requests FROM PUBLIC,anon,authenticated;

CREATE FUNCTION zoi.table_inventory_actor()RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE a uuid;BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_signed_in' USING ERRCODE='42501';END IF;a:=zoi.ensure_profile();IF a IS NULL THEN RAISE EXCEPTION 'not_signed_in' USING ERRCODE='42501';END IF;RETURN a;END $$;
CREATE FUNCTION zoi.table_inventory_operator(p_workspace uuid,p_event uuid)RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE a uuid:=zoi.table_inventory_actor();r text;o uuid;k text;BEGIN
 SELECT role INTO r FROM zoi.workspace_members WHERE workspace_id=p_workspace AND profile_id=a FOR SHARE;
 IF coalesce(r,'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;
 SELECT owner_workspace_id,entity_type INTO o,k FROM zoi.listings WHERE id=p_event FOR SHARE;
 IF o IS DISTINCT FROM p_workspace OR k IS DISTINCT FROM 'event' THEN RAISE EXCEPTION 'event_not_owned' USING ERRCODE='42501';END IF;RETURN a;END $$;
CREATE FUNCTION zoi.table_inventory_public(p_event uuid)RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path TO '' AS $$
 SELECT EXISTS(SELECT 1 FROM zoi.event_table_settings s JOIN zoi.listings l ON l.id=s.event_id WHERE s.event_id=p_event AND s.enabled AND s.starts_at>clock_timestamp() AND l.owner_workspace_id=s.workspace_id AND l.entity_type='event' AND l.publish_status='published' AND l.moderation_status IN('clean','cleared') AND coalesce(l.marketplace_status,'')<>'hidden');$$;
CREATE FUNCTION zoi.table_hold_view(h zoi.event_table_holds)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path TO '' AS $$
 SELECT jsonb_build_object('id',h.id,'event_id',h.event_id,'table_id',h.table_id,'request_id',h.request_id,'party_size',h.party_size,'pricing_version',h.pricing_version,'price_per_guest_cents',h.price_per_guest_cents,'currency',h.currency,'total_cents',h.total_cents,'expires_at',h.expires_at,'fees_included',true,'exclusive_table',true,'status',CASE WHEN h.status<>'active' THEN h.status WHEN h.expires_at<=clock_timestamp() THEN 'expired' WHEN NOT zoi.table_inventory_public(h.event_id) OR NOT EXISTS(SELECT 1 FROM zoi.event_table_settings s JOIN zoi.event_table_inventory i ON i.event_id=s.event_id JOIN public.venue_tables_zones t ON t.id=i.table_id JOIN public.event_venues v ON v.id=t.venue_id WHERE s.event_id=h.event_id AND s.version=h.pricing_version AND i.table_id=h.table_id AND v.workspace_id=s.workspace_id AND v.event_id=s.event_id AND t.capacity>=i.capacity) THEN 'invalidated' ELSE 'active' END);$$;

CREATE FUNCTION public.table_inventory_configure(p_workspace uuid,p_event uuid,p_expected_version integer,p_request uuid,p_data jsonb)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE a uuid;c zoi.event_table_settings;req zoi.event_table_config_requests;payload jsonb;item jsonb;starts timestamptz;enabled boolean;tid uuid;cap integer;minimum integer;price integer;curr text;label text;vversion integer;receipt jsonb;
BEGIN
 a:=zoi.table_inventory_operator(p_workspace,p_event);
 IF p_request IS NULL OR p_expected_version IS NULL OR p_expected_version<0 THEN RAISE EXCEPTION 'invalid_request';END IF;
 payload:=jsonb_build_object('workspace',p_workspace,'event',p_event,'version',p_expected_version,'data',p_data);
 PERFORM pg_advisory_xact_lock(hashtextextended('table-config-request:'||a::text||':'||p_request::text,0));
 SELECT * INTO req FROM zoi.event_table_config_requests WHERE profile_id=a AND request_id=p_request;
 IF req.request_id IS NOT NULL THEN IF req.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN req.receipt;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('event-table-mode:'||p_event::text,0));
 SELECT * INTO c FROM zoi.event_table_settings WHERE event_id=p_event FOR UPDATE;
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
  PERFORM 1 FROM public.venue_tables_zones t JOIN public.event_venues v ON v.id=t.venue_id WHERE t.id=tid AND v.workspace_id=p_workspace AND v.event_id=p_event AND t.capacity>=cap FOR SHARE OF t,v;
  IF NOT FOUND THEN RAISE EXCEPTION 'table_not_owned';END IF;
  INSERT INTO zoi.event_table_inventory VALUES(p_event,tid,label,cap,minimum,price,curr);
 END LOOP;
 receipt:=jsonb_build_object('ok',true,'event_id',p_event,'version',vversion,'enabled',enabled,'payment_enabled',false);
 INSERT INTO zoi.event_table_config_requests(profile_id,request_id,payload,receipt)VALUES(a,p_request,payload,receipt);RETURN receipt;
END $$;

CREATE FUNCTION public.table_inventory_operator(p_workspace uuid,p_event uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE c zoi.event_table_settings;items jsonb;available jsonb;
BEGIN PERFORM zoi.table_inventory_operator(p_workspace,p_event);SELECT * INTO c FROM zoi.event_table_settings WHERE event_id=p_event;
 IF c.event_id IS NOT NULL AND c.workspace_id IS DISTINCT FROM p_workspace THEN RAISE EXCEPTION 'inventory_owner_changed';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.source_label),'[]') INTO items FROM zoi.event_table_inventory i WHERE event_id=p_event;
 SELECT coalesce(jsonb_agg(x),'[]') INTO available FROM(SELECT t.id table_id,t.name label,t.capacity FROM public.venue_tables_zones t JOIN public.event_venues v ON v.id=t.venue_id WHERE v.workspace_id=p_workspace AND v.event_id=p_event ORDER BY t.id LIMIT 201)x;
 RETURN jsonb_build_object('ok',true,'event_id',p_event,'version',coalesce(c.version,0),'enabled',coalesce(c.enabled,false),'starts_at',c.starts_at,'tables',items,'available_tables',available,'payment_enabled',false);END $$;
CREATE FUNCTION public.table_inventory_map(p_event uuid)RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE rows jsonb;
BEGIN
 IF NOT zoi.table_inventory_public(p_event) THEN RETURN jsonb_build_object('ok',true,'configured',false,'event_id',p_event,'tables','[]'::jsonb,'server_time',clock_timestamp());END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('table_id',i.table_id,'source_label',i.source_label,'label',i.source_label,'capacity',i.capacity,'min_party_size',i.min_party_size,'price_per_guest_cents',i.price_per_guest_cents,'currency',i.currency,'pricing_version',s.version,'fees_included',true,'exclusive_table',true,'availability',CASE WHEN v.workspace_id IS DISTINCT FROM s.workspace_id OR v.event_id IS DISTINCT FROM s.event_id OR t.capacity<i.capacity THEN 'unavailable' WHEN EXISTS(SELECT 1 FROM zoi.event_table_holds h WHERE h.event_id=i.event_id AND h.table_id=i.table_id AND h.status='active' AND h.expires_at>clock_timestamp()) THEN 'held' ELSE 'available' END) ORDER BY i.source_label),'[]') INTO rows FROM zoi.event_table_inventory i JOIN zoi.event_table_settings s USING(event_id) JOIN public.venue_tables_zones t ON t.id=i.table_id JOIN public.event_venues v ON v.id=t.venue_id WHERE i.event_id=p_event;
 RETURN jsonb_build_object('ok',true,'configured',true,'event_id',p_event,'server_time',clock_timestamp(),'tables',rows);END $$;

CREATE FUNCTION public.table_hold_create(p_event uuid,p_table uuid,p_party_size integer,p_expected_version integer,p_request uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE a uuid:=zoi.table_inventory_actor();c zoi.event_table_settings;i zoi.event_table_inventory;h zoi.event_table_holds;payload jsonb;
BEGIN
 IF p_request IS NULL OR p_event IS NULL OR p_table IS NULL OR p_party_size IS NULL OR p_expected_version IS NULL THEN RAISE EXCEPTION 'invalid_request';END IF;
 payload:=jsonb_build_object('event',p_event,'table',p_table,'party_size',p_party_size,'version',p_expected_version);
 PERFORM pg_advisory_xact_lock(hashtextextended('table-hold-actor:'||a::text,0));
 SELECT * INTO h FROM zoi.event_table_holds WHERE profile_id=a AND request_id=p_request;
 IF h.id IS NOT NULL THEN IF h.request_data IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN jsonb_build_object('ok',true,'hold',zoi.table_hold_view(h),'server_time',clock_timestamp(),'payment_collected',false);END IF;
 SELECT * INTO c FROM zoi.event_table_settings WHERE event_id=p_event FOR UPDATE;
 IF c.event_id IS NULL OR NOT zoi.table_inventory_public(p_event) THEN RAISE EXCEPTION 'table_inventory_unavailable';END IF;
 PERFORM 1 FROM zoi.listings WHERE id=p_event AND owner_workspace_id=c.workspace_id AND publish_status='published' AND moderation_status IN('clean','cleared') AND coalesce(marketplace_status,'')<>'hidden' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'table_inventory_unavailable';END IF;
 IF c.version<>p_expected_version THEN RAISE EXCEPTION 'pricing_version_conflict';END IF;
 SELECT * INTO i FROM zoi.event_table_inventory WHERE event_id=p_event AND table_id=p_table;
 IF i.table_id IS NULL OR p_party_size<i.min_party_size OR p_party_size>i.capacity THEN RAISE EXCEPTION 'invalid_party_size';END IF;
 PERFORM 1 FROM public.venue_tables_zones t JOIN public.event_venues v ON v.id=t.venue_id WHERE t.id=p_table AND t.capacity>=i.capacity AND v.workspace_id=c.workspace_id AND v.event_id=p_event FOR SHARE OF t,v;
 IF NOT FOUND THEN RAISE EXCEPTION 'table_inventory_unavailable';END IF;
 UPDATE zoi.event_table_holds SET status='expired' WHERE event_id=p_event AND status='active' AND expires_at<=clock_timestamp();
 IF EXISTS(SELECT 1 FROM zoi.event_table_holds WHERE event_id=p_event AND profile_id=a AND status='active' AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'active_hold_exists';END IF;
 IF EXISTS(SELECT 1 FROM zoi.event_table_holds WHERE event_id=p_event AND table_id=p_table AND status='active' AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'table_unavailable';END IF;
 IF (SELECT count(*) FROM zoi.event_table_holds WHERE profile_id=a AND created_at>clock_timestamp()-interval '1 hour')>=20 THEN RAISE EXCEPTION 'hold_rate_limited';END IF;
 INSERT INTO zoi.event_table_holds(event_id,table_id,profile_id,request_id,request_data,party_size,pricing_version,price_per_guest_cents,currency,total_cents,expires_at)VALUES(p_event,p_table,a,p_request,payload,p_party_size,c.version,i.price_per_guest_cents,i.currency,i.price_per_guest_cents::bigint*p_party_size,least(clock_timestamp()+interval '5 minutes',c.starts_at))RETURNING * INTO h;
 RETURN jsonb_build_object('ok',true,'hold',zoi.table_hold_view(h),'server_time',clock_timestamp(),'payment_collected',false);
END $$;
CREATE FUNCTION public.table_hold_status(p_event uuid,p_request uuid DEFAULT NULL)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE a uuid:=zoi.table_inventory_actor();rows jsonb;BEGIN SELECT coalesce(jsonb_agg(zoi.table_hold_view(x) ORDER BY x.created_at DESC),'[]') INTO rows FROM(SELECT h.* FROM zoi.event_table_holds h WHERE h.profile_id=a AND h.event_id=p_event AND(p_request IS NULL OR h.request_id=p_request)ORDER BY h.created_at DESC LIMIT 20)x;RETURN jsonb_build_object('ok',true,'holds',rows,'server_time',clock_timestamp(),'payment_collected',false);END $$;
CREATE FUNCTION public.table_hold_release(p_hold uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE a uuid:=zoi.table_inventory_actor();h zoi.event_table_holds;event uuid;BEGIN
 SELECT event_id INTO event FROM zoi.event_table_holds WHERE id=p_hold AND profile_id=a;IF event IS NULL THEN RAISE EXCEPTION 'hold_not_owned' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM zoi.event_table_settings WHERE event_id=event FOR UPDATE;
 SELECT * INTO h FROM zoi.event_table_holds WHERE id=p_hold AND profile_id=a FOR UPDATE;
 IF h.status='active' THEN UPDATE zoi.event_table_holds SET status=CASE WHEN expires_at<=clock_timestamp() THEN 'expired' ELSE 'released' END WHERE id=p_hold RETURNING * INTO h;END IF;
 RETURN jsonb_build_object('ok',true,'hold',zoi.table_hold_view(h),'server_time',clock_timestamp(),'payment_collected',false);END $$;

-- One inventory authority per event. Existing events are untouched until an operator enables table mode.
CREATE FUNCTION zoi.table_mode_ticket_guard()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN PERFORM pg_advisory_xact_lock(hashtextextended('event-table-mode:'||new.event_id::text,0));IF EXISTS(SELECT 1 FROM zoi.event_table_settings WHERE event_id=new.event_id AND enabled)THEN RAISE EXCEPTION 'event_table_mode_enabled';END IF;RETURN new;END $$;
CREATE TRIGGER table_mode_ticket_type_guard BEFORE INSERT OR UPDATE OF event_id ON zoi.ticket_types FOR EACH ROW EXECUTE FUNCTION zoi.table_mode_ticket_guard();
CREATE TRIGGER table_mode_seating_guard BEFORE INSERT OR UPDATE OF event_id ON zoi.seating_sessions FOR EACH ROW EXECUTE FUNCTION zoi.table_mode_ticket_guard();
REVOKE ALL ON FUNCTION zoi.table_inventory_actor(),zoi.table_inventory_operator(uuid,uuid),zoi.table_inventory_public(uuid),zoi.table_hold_view(zoi.event_table_holds),zoi.table_mode_ticket_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.table_inventory_configure(uuid,uuid,integer,uuid,jsonb),public.table_inventory_operator(uuid,uuid),public.table_inventory_map(uuid),public.table_hold_create(uuid,uuid,integer,integer,uuid),public.table_hold_status(uuid,uuid),public.table_hold_release(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.table_inventory_map(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.table_inventory_configure(uuid,uuid,integer,uuid,jsonb),public.table_inventory_operator(uuid,uuid),public.table_hold_create(uuid,uuid,integer,integer,uuid),public.table_hold_status(uuid,uuid),public.table_hold_release(uuid) TO authenticated;
COMMIT;

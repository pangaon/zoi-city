-- Companion lifecycle. Existing anonymous event-order gate stays closed.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
DO $$BEGIN IF to_regprocedure('public.kds_ticket_advance_once(uuid,uuid,integer,text,uuid)') IS NULL OR to_regprocedure('public.event_service_setup_save(uuid,uuid,uuid,integer,uuid,jsonb)') IS NULL THEN RAISE EXCEPTION 'service_prerequisites_missing';END IF;END$$;
CREATE TABLE zoi.event_service_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,event_id uuid NOT NULL,venue_id uuid NOT NULL,configuration_revision integer NOT NULL,configuration jsonb NOT NULL,status text NOT NULL CHECK(status IN('active','paused','closed')),revision integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(venue_id,configuration_revision));
CREATE UNIQUE INDEX event_service_one_open_session ON zoi.event_service_sessions(venue_id) WHERE status<>'closed';
CREATE TABLE zoi.event_service_stock(session_id uuid NOT NULL REFERENCES zoi.event_service_sessions(id),menu_item_id uuid NOT NULL,seeded integer NOT NULL CHECK(seeded>=0),reserved integer NOT NULL DEFAULT 0 CHECK(reserved>=0),consumed integer NOT NULL DEFAULT 0 CHECK(consumed>=0),PRIMARY KEY(session_id,menu_item_id),CHECK(reserved+consumed<=seeded));
CREATE TABLE zoi.event_service_ledger(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,session_id uuid NOT NULL,menu_item_id uuid NOT NULL,order_id uuid,kind text NOT NULL CHECK(kind IN('seed','reserve','consume','release')),quantity integer NOT NULL CHECK(quantity>=0),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(session_id,menu_item_id,order_id,kind));
CREATE TABLE zoi.event_service_requests(actor uuid NOT NULL,request_id uuid NOT NULL,kind text NOT NULL,scope_id uuid NOT NULL,arguments jsonb,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(actor,request_id));
CREATE INDEX event_service_request_budget ON zoi.event_service_requests(actor,created_at);
ALTER TABLE public.table_tabs ADD COLUMN service_session_id uuid REFERENCES zoi.event_service_sessions(id),ADD COLUMN service_currency text CHECK(service_currency IS NULL OR service_currency='CAD');
CREATE UNIQUE INDEX event_service_one_tab ON public.table_tabs(service_session_id,table_id) WHERE service_session_id IS NOT NULL;
ALTER TABLE public.table_tabs ENABLE ROW LEVEL SECURITY;ALTER TABLE public.table_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.table_tabs,public.table_members FROM PUBLIC,anon,authenticated;
DO $$DECLARE t text;r text;p text;BEGIN FOREACH t IN ARRAY ARRAY['table_tabs','table_members']LOOP FOREACH r IN ARRAY ARRAY['anon','authenticated']LOOP FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE']LOOP IF has_table_privilege(r,'public.'||t,p)THEN RAISE EXCEPTION 'service_direct_tab_access';END IF;END LOOP;FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE']LOOP IF has_any_column_privilege(r,'public.'||t,p)THEN RAISE EXCEPTION 'service_direct_tab_column_access';END IF;END LOOP;END LOOP;END LOOP;END$$;
CREATE FUNCTION zoi.event_service_tab_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN
 IF OLD.service_session_id IS NOT NULL THEN
 IF NEW.service_session_id IS DISTINCT FROM OLD.service_session_id OR NEW.table_id IS DISTINCT FROM OLD.table_id OR NEW.event_id IS DISTINCT FROM OLD.event_id OR NEW.service_currency IS DISTINCT FROM OLD.service_currency THEN RAISE EXCEPTION 'service_tab_scope_immutable';END IF;
 IF NEW.paid_amount IS DISTINCT FROM OLD.paid_amount THEN RAISE EXCEPTION 'service_settlement_not_configured';END IF;
 ELSIF NEW.service_session_id IS NOT NULL THEN RAISE EXCEPTION 'legacy_tab_cannot_be_relabelled';END IF;RETURN NEW;
END$$;
CREATE TRIGGER event_service_tab_guard BEFORE UPDATE ON public.table_tabs FOR EACH ROW EXECUTE FUNCTION zoi.event_service_tab_guard();
CREATE TABLE zoi.event_service_admissions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid NOT NULL REFERENCES zoi.event_service_sessions(id),table_id uuid NOT NULL,member_id uuid NOT NULL REFERENCES public.table_members(id),source_guest_id uuid NOT NULL,source_guest_revision integer NOT NULL,actor uuid NOT NULL,quantity integer NOT NULL CHECK(quantity>0),status text NOT NULL DEFAULT 'active' CHECK(status IN('active','revoked')),revision integer NOT NULL DEFAULT 1,UNIQUE(session_id,source_guest_id),UNIQUE(session_id,actor));
ALTER TABLE public.event_orders ADD COLUMN service_session_id uuid REFERENCES zoi.event_service_sessions(id),ADD COLUMN service_actor uuid,ADD COLUMN service_total_cents integer CHECK(service_total_cents IS NULL OR service_total_cents>=0),ADD COLUMN service_charged boolean NOT NULL DEFAULT false;
ALTER TABLE public.event_order_items ADD COLUMN service_menu_item_id uuid,ADD COLUMN service_menu_revision integer,ADD COLUMN service_unit_cents integer;
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['event_service_sessions','event_service_stock','event_service_ledger','event_service_requests','event_service_admissions'] LOOP EXECUTE format('ALTER TABLE zoi.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON zoi.%I FROM PUBLIC,anon,authenticated',t);END LOOP;END$$;
CREATE FUNCTION zoi.event_service_receipt(p_kind text,p_scope uuid,p_request uuid,p_args jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE r zoi.event_service_requests;BEGIN
 IF p_request IS NULL THEN RAISE EXCEPTION 'request_required';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('event-service-actor:'||auth.uid()::text,0));PERFORM zoi.suite_lock_session();
 SELECT * INTO r FROM zoi.event_service_requests WHERE actor=auth.uid() AND request_id=p_request;
 IF FOUND THEN IF r.kind<>p_kind OR r.scope_id<>p_scope OR(r.arguments IS NOT NULL AND r.arguments IS DISTINCT FROM p_args)THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN r.result;END IF;
 IF(SELECT count(*)FROM zoi.event_service_requests WHERE actor=auth.uid() AND created_at>clock_timestamp()-interval '1 hour')>=300 THEN RAISE EXCEPTION 'service_request_limit';END IF;
 RETURN NULL;
END$$;
CREATE FUNCTION zoi.event_service_record(p_kind text,p_scope uuid,p_request uuid,p_args jsonb,p_result jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN p_result:=p_result||jsonb_build_object('kind',p_kind,'scope_id',p_scope,'status',coalesce(p_result->>'status','completed'));INSERT INTO zoi.event_service_requests VALUES(auth.uid(),p_request,p_kind,p_scope,p_args,p_result,clock_timestamp());RETURN p_result;END$$;
CREATE FUNCTION zoi.event_service_scope(p_session uuid,p_table uuid DEFAULT NULL,p_operator boolean DEFAULT false,p_exclusive boolean DEFAULT false) RETURNS zoi.event_service_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE s zoi.event_service_sessions;r text;BEGIN
 SELECT * INTO s FROM zoi.event_service_sessions WHERE id=p_session;IF NOT FOUND THEN RAISE EXCEPTION 'service_unavailable' USING errcode='42501';END IF;
 IF p_operator THEN r:=zoi.workspace_locked_role(s.workspace_id);IF coalesce(r,'')NOT IN('owner','admin')THEN RAISE EXCEPTION 'insufficient_permission' USING errcode='42501';END IF;ELSE PERFORM 1 FROM zoi.workspaces WHERE id=s.workspace_id FOR SHARE;PERFORM zoi.suite_lock_session();END IF;
 PERFORM 1 FROM zoi.listings WHERE id=s.event_id AND owner_workspace_id=s.workspace_id AND entity_type='event' FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'service_unavailable' USING errcode='42501';END IF;
 IF NOT p_operator AND NOT EXISTS(SELECT 1 FROM zoi.listings WHERE id=s.event_id AND publish_status='published'AND moderation_status IN('clean','cleared')AND coalesce(marketplace_status,'')<>'hidden')THEN RAISE EXCEPTION 'service_unavailable' USING errcode='42501';END IF;
 PERFORM 1 FROM public.event_venues WHERE id=s.venue_id AND event_id=s.event_id AND workspace_id=s.workspace_id FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'service_unavailable' USING errcode='42501';END IF;
 IF p_table IS NOT NULL THEN PERFORM 1 FROM public.venue_tables_zones WHERE id=p_table AND venue_id=s.venue_id FOR UPDATE;IF NOT FOUND OR NOT(s.configuration->'table_ids' @>jsonb_build_array(p_table::text))THEN RAISE EXCEPTION 'service_table_unavailable';END IF;END IF;
 IF p_exclusive THEN SELECT * INTO s FROM zoi.event_service_sessions WHERE id=p_session FOR UPDATE;ELSE SELECT * INTO s FROM zoi.event_service_sessions WHERE id=p_session FOR SHARE;END IF;PERFORM zoi.suite_lock_session();RETURN s;
END$$;
CREATE FUNCTION public.event_service_start(p_workspace uuid,p_event uuid,p_venue uuid,p_expected_revision integer,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE c zoi.event_service_configurations;s zoi.event_service_sessions;it jsonb;m public.menu_items;args jsonb;r jsonb;BEGIN
 PERFORM zoi.event_service_setup_authorize(p_workspace,p_event,p_venue);
 IF NOT EXISTS(SELECT 1 FROM zoi.listings WHERE id=p_event AND publish_status='published'AND moderation_status IN('clean','cleared')AND coalesce(marketplace_status,'')<>'hidden')THEN RAISE EXCEPTION 'service_unavailable';END IF;
 args:=jsonb_build_object('workspace',p_workspace,'event',p_event,'revision',p_expected_revision);r:=zoi.event_service_receipt('start',p_venue,p_request,args);IF r IS NOT NULL THEN RETURN r;END IF;
 SELECT * INTO c FROM zoi.event_service_configurations WHERE venue_id=p_venue FOR UPDATE;IF c.workspace_id IS DISTINCT FROM p_workspace OR c.event_id IS DISTINCT FROM p_event OR c.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'version_conflict';END IF;
 IF jsonb_array_length(c.data->'items')=0 OR jsonb_array_length(c.data->'table_ids')=0 OR c.data->>'currency'<>'CAD' OR(c.data->>'closes_at')::timestamptz<=clock_timestamp()THEN RAISE EXCEPTION 'service_setup_incomplete';END IF;
 FOR it IN SELECT value FROM jsonb_array_elements(c.data->'items')ORDER BY value->>'menu_item_id' LOOP SELECT * INTO m FROM public.menu_items WHERE id=(it->>'menu_item_id')::uuid FOR SHARE;IF m.workspace_id IS DISTINCT FROM p_workspace OR m.revision IS DISTINCT FROM(it->>'menu_revision')::integer OR NOT m.is_available OR m.currency<>'CAD' OR m.station NOT IN('kitchen','bar','merch')THEN RAISE EXCEPTION 'service_menu_changed';END IF;END LOOP;
 PERFORM zoi.suite_lock_session();IF(c.data->>'closes_at')::timestamptz<=clock_timestamp()THEN RAISE EXCEPTION 'service_closed';END IF;
 INSERT INTO zoi.event_service_sessions(workspace_id,event_id,venue_id,configuration_revision,configuration,status)VALUES(p_workspace,p_event,p_venue,c.revision,c.data,'active')RETURNING * INTO s;
 FOR it IN SELECT value FROM jsonb_array_elements(c.data->'items')LOOP INSERT INTO zoi.event_service_stock(session_id,menu_item_id,seeded)VALUES(s.id,(it->>'menu_item_id')::uuid,(it->>'initial_stock')::integer);INSERT INTO zoi.event_service_ledger(session_id,menu_item_id,kind,quantity)VALUES(s.id,(it->>'menu_item_id')::uuid,'seed',(it->>'initial_stock')::integer);END LOOP;
 r:=jsonb_build_object('ok',true,'request_id',p_request,'workspace_id',p_workspace,'event_id',p_event,'venue_id',p_venue,'session_id',s.id,'revision',s.revision,'status','active','payment_collected',false);RETURN zoi.event_service_record('start',p_venue,p_request,args,r);
END$$;
CREATE FUNCTION zoi.event_service_source_guest(p_guest uuid) RETURNS zoi.event_host_guests LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE g zoi.event_host_guests;a uuid;BEGIN
 SELECT event_allocation_id INTO a FROM zoi.event_host_guests WHERE id=p_guest;
 IF a IS NULL THEN RAISE EXCEPTION 'source_guest_unavailable';END IF;
 PERFORM 1 FROM zoi.event_host_allocations WHERE id=a FOR SHARE;
 SELECT * INTO g FROM zoi.event_host_guests WHERE id=p_guest FOR SHARE;
 IF g.id IS NULL OR g.event_allocation_id IS DISTINCT FROM a THEN RAISE EXCEPTION 'source_guest_unavailable';END IF;RETURN g;
END$$;
CREATE FUNCTION public.event_service_admit(p_session uuid,p_table uuid,p_guest uuid,p_expected_guest_revision integer,p_ack_expired_hold boolean,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE s zoi.event_service_sessions;g zoi.event_host_guests;a zoi.event_host_allocations;tab public.table_tabs;member uuid;guest_actor uuid;ad zoi.event_service_admissions;args jsonb;r jsonb;cap integer;BEGIN
 s:=zoi.event_service_scope(p_session,p_table,true);args:=jsonb_build_object('table',p_table,'guest',p_guest,'guest_revision',p_expected_guest_revision,'ack_expired_hold',p_ack_expired_hold);r:=zoi.event_service_receipt('admit',p_session,p_request,args);IF r IS NOT NULL THEN RETURN r;END IF;
 g:=zoi.event_service_source_guest(p_guest);SELECT * INTO a FROM zoi.event_host_allocations WHERE id=g.event_allocation_id;
 IF s.status='closed' OR g.status IS DISTINCT FROM 'accepted' OR g.version IS DISTINCT FROM p_expected_guest_revision OR a.status IS DISTINCT FROM 'active' OR a.workspace_id IS DISTINCT FROM s.workspace_id OR a.event_id IS DISTINCT FROM s.event_id OR a.table_id IS DISTINCT FROM p_table THEN RAISE EXCEPTION 'source_guest_unavailable';END IF;
 IF a.expires_at<=clock_timestamp() AND p_ack_expired_hold IS DISTINCT FROM true THEN RAISE EXCEPTION 'expired_hold_acknowledgement_required';END IF;
 SELECT auth_user_id INTO guest_actor FROM zoi.user_profiles WHERE id=g.claimed_by;IF guest_actor IS NULL THEN RAISE EXCEPTION 'source_guest_unavailable';END IF;
 PERFORM 1 FROM auth.users WHERE id=guest_actor AND deleted_at IS NULL AND coalesce(is_anonymous,false)=false AND(banned_until IS NULL OR banned_until<=clock_timestamp())FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'source_guest_unavailable';END IF;
 IF EXISTS(SELECT 1 FROM zoi.event_service_admissions WHERE session_id=p_session AND(source_guest_id=p_guest OR actor=guest_actor))THEN RAISE EXCEPTION 'already_admitted';END IF;
 SELECT capacity INTO cap FROM public.venue_tables_zones WHERE id=p_table;
 IF coalesce((SELECT sum(quantity)FROM zoi.event_service_admissions WHERE session_id=p_session AND table_id=p_table AND status='active'),0)+g.quantity>cap THEN RAISE EXCEPTION 'table_capacity_exceeded';END IF;
 SELECT * INTO tab FROM public.table_tabs WHERE service_session_id=p_session AND table_id=p_table FOR UPDATE;
 IF NOT FOUND THEN INSERT INTO public.table_tabs(event_id,table_id,status,total_amount,paid_amount,service_session_id,service_currency)VALUES(s.event_id,p_table,'open',0,0,p_session,'CAD')RETURNING * INTO tab;END IF;
 IF tab.status<>'open' OR tab.service_currency<>'CAD' THEN RAISE EXCEPTION 'service_tab_unavailable';END IF;
 PERFORM zoi.suite_lock_session();IF a.expires_at<=clock_timestamp()AND p_ack_expired_hold IS DISTINCT FROM true THEN RAISE EXCEPTION 'expired_hold_acknowledgement_required';END IF;
 INSERT INTO public.table_members(tab_id,user_id,guest_name)VALUES(tab.id,guest_actor,g.label)RETURNING id INTO member;
 INSERT INTO zoi.event_service_admissions(session_id,table_id,member_id,source_guest_id,source_guest_revision,actor,quantity)VALUES(p_session,p_table,member,p_guest,g.version,guest_actor,g.quantity)RETURNING * INTO ad;
 r:=jsonb_build_object('ok',true,'request_id',p_request,'workspace_id',s.workspace_id,'event_id',s.event_id,'session_id',p_session,'table_id',p_table,'admission_id',ad.id,'revision',ad.revision,'source_hold_expired',a.expires_at<=clock_timestamp(),'ticket_issued',false,'payment_collected',false);RETURN zoi.event_service_record('admit',p_session,p_request,args,r);
END$$;
CREATE FUNCTION zoi.event_service_participant(p_session uuid,p_table uuid) RETURNS zoi.event_service_admissions LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE ad zoi.event_service_admissions;locked_guest zoi.event_host_guests;BEGIN
 SELECT * INTO ad FROM zoi.event_service_admissions WHERE session_id=p_session AND table_id=p_table AND actor=auth.uid() AND status='active' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'service_participation_required' USING errcode='42501';END IF;
 locked_guest:=zoi.event_service_source_guest(ad.source_guest_id);
 PERFORM 1 FROM zoi.event_host_guests g JOIN zoi.event_host_allocations a ON a.id=g.event_allocation_id JOIN zoi.user_profiles p ON p.id=g.claimed_by JOIN zoi.event_service_sessions s ON s.id=ad.session_id WHERE g.id=ad.source_guest_id AND g.status='accepted' AND g.version=ad.source_guest_revision AND p.auth_user_id=auth.uid() AND a.status='active' AND a.event_id=s.event_id AND a.workspace_id=s.workspace_id AND a.table_id=ad.table_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'service_participation_required' USING errcode='42501';END IF;RETURN ad;
END$$;
CREATE FUNCTION public.event_service_order(p_session uuid,p_table uuid,p_expected_revision integer,p_items jsonb,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE s zoi.event_service_sessions;ad zoi.event_service_admissions;tab public.table_tabs;it jsonb;cfg jsonb;m public.menu_items;st zoi.event_service_stock;args jsonb;r jsonb;cart jsonb:='[]';orders jsonb:='[]';station text;ord uuid;amount integer;charged integer:=0;total integer:=0;approval boolean;qty integer;BEGIN
 s:=zoi.event_service_scope(p_session,p_table,false);ad:=zoi.event_service_participant(p_session,p_table);
 args:=jsonb_build_object('table',p_table,'revision',p_expected_revision,'items',p_items);r:=zoi.event_service_receipt('order',p_session,p_request,args);IF r IS NOT NULL THEN RETURN r;END IF;
 IF s.status<>'active' OR s.revision IS DISTINCT FROM p_expected_revision OR clock_timestamp()<(s.configuration->>'opens_at')::timestamptz OR clock_timestamp()>=(s.configuration->>'closes_at')::timestamptz THEN RAISE EXCEPTION 'service_closed';END IF;
 IF jsonb_typeof(p_items)IS DISTINCT FROM 'array' OR jsonb_array_length(p_items)NOT BETWEEN 1 AND 20 OR octet_length(p_items::text)>10000 THEN RAISE EXCEPTION 'invalid_cart';END IF;
 IF(SELECT count(DISTINCT value->>'menu_item_id')FROM jsonb_array_elements(p_items))<>jsonb_array_length(p_items)THEN RAISE EXCEPTION 'invalid_cart';END IF;
 FOR it IN SELECT value FROM jsonb_array_elements(p_items)ORDER BY value->>'menu_item_id' LOOP
 IF jsonb_typeof(it)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(it)k WHERE k NOT IN('menu_item_id','menu_revision','quantity')) OR coalesce(it->>'menu_item_id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR jsonb_typeof(it->'quantity')IS DISTINCT FROM 'number' OR(it->>'quantity')::numeric NOT BETWEEN 1 AND 20 OR(it->>'quantity')::numeric<>trunc((it->>'quantity')::numeric)THEN RAISE EXCEPTION 'invalid_cart';END IF;
 qty:=(it->>'quantity')::integer;SELECT value INTO cfg FROM jsonb_array_elements(s.configuration->'items')WHERE value->>'menu_item_id'=it->>'menu_item_id';
 SELECT * INTO m FROM public.menu_items WHERE id=(it->>'menu_item_id')::uuid FOR SHARE;
 IF cfg IS NULL OR m.workspace_id IS DISTINCT FROM s.workspace_id OR m.currency IS DISTINCT FROM 'CAD' OR NOT m.is_available OR m.revision IS DISTINCT FROM(cfg->>'menu_revision')::integer OR m.revision::text IS DISTINCT FROM it->>'menu_revision' OR m.price_cents NOT BETWEEN 1 AND 1000000 OR m.station NOT IN('kitchen','bar','merch')THEN RAISE EXCEPTION 'service_menu_changed';END IF;
 SELECT * INTO st FROM zoi.event_service_stock WHERE session_id=p_session AND menu_item_id=m.id FOR UPDATE;IF NOT FOUND OR st.seeded-st.reserved-st.consumed<qty THEN RAISE EXCEPTION 'service_item_sold_out';END IF;
 cart:=cart||jsonb_build_array(jsonb_build_object('id',m.id,'name',m.name,'revision',m.revision,'quantity',qty,'unit_cents',m.price_cents,'station',m.station,'approval',(cfg->>'requires_staff_approval')::boolean));total:=total+qty*m.price_cents;
 END LOOP;
 IF total>100000000 THEN RAISE EXCEPTION 'invalid_cart_total';END IF;
 SELECT t.* INTO tab FROM public.table_tabs t JOIN public.table_members mem ON mem.tab_id=t.id WHERE mem.id=ad.member_id AND mem.user_id=auth.uid() AND t.service_session_id=p_session AND t.table_id=p_table FOR UPDATE OF t;
 IF tab.id IS NULL OR tab.status<>'open' OR tab.service_currency IS DISTINCT FROM 'CAD' THEN RAISE EXCEPTION 'service_tab_unavailable';END IF;
 PERFORM zoi.suite_lock_session();IF clock_timestamp()>=(s.configuration->>'closes_at')::timestamptz THEN RAISE EXCEPTION 'service_closed';END IF;
 FOR station IN SELECT DISTINCT value->>'station'FROM jsonb_array_elements(cart)ORDER BY 1 LOOP
 SELECT sum((value->>'quantity')::integer*(value->>'unit_cents')::integer),bool_or((value->>'approval')::boolean)INTO amount,approval FROM jsonb_array_elements(cart)WHERE value->>'station'=station;
 INSERT INTO public.event_orders(event_id,tab_id,table_id,member_id,customer_name,total_amount,payment_status,fulfillment_status,target_station,service_session_id,service_actor,service_total_cents,service_charged)VALUES(s.event_id,tab.id,p_table,ad.member_id,(SELECT guest_name FROM public.table_members WHERE id=ad.member_id),amount::numeric/100,'tab',CASE WHEN approval THEN 'awaiting_approval' ELSE 'received'END,station,p_session,auth.uid(),amount,NOT approval)RETURNING id INTO ord;
 FOR it IN SELECT value FROM jsonb_array_elements(cart)WHERE value->>'station'=station LOOP
 INSERT INTO public.event_order_items(order_id,item_name,quantity,unit_price,service_menu_item_id,service_menu_revision,service_unit_cents)VALUES(ord,it->>'name',(it->>'quantity')::integer,(it->>'unit_cents')::numeric/100,(it->>'id')::uuid,(it->>'revision')::integer,(it->>'unit_cents')::integer);
 UPDATE zoi.event_service_stock SET reserved=reserved+(it->>'quantity')::integer WHERE session_id=p_session AND menu_item_id=(it->>'id')::uuid;INSERT INTO zoi.event_service_ledger(session_id,menu_item_id,order_id,kind,quantity)VALUES(p_session,(it->>'id')::uuid,ord,'reserve',(it->>'quantity')::integer);
 END LOOP;
 IF NOT approval THEN charged:=charged+amount;END IF;
 orders:=orders||jsonb_build_array(jsonb_build_object('order_id',ord,'station',station,'status',CASE WHEN approval THEN 'awaiting_approval' ELSE 'received'END,'total_cents',amount));
 END LOOP;
 UPDATE public.table_tabs SET total_amount=total_amount+charged::numeric/100,updated_at=clock_timestamp()WHERE id=tab.id;
 r:=jsonb_build_object('ok',true,'request_id',p_request,'session_id',p_session,'event_id',s.event_id,'table_id',p_table,'orders',orders,'currency','CAD','total_cents',total,'charged_cents',charged,'payment_collected',false);RETURN zoi.event_service_record('order',p_session,p_request,args,r);
END$$;
CREATE UNIQUE INDEX event_service_order_item_unique ON public.event_order_items(order_id,service_menu_item_id) WHERE service_menu_item_id IS NOT NULL;
CREATE FUNCTION zoi.event_service_item_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN IF OLD.service_menu_item_id IS NOT NULL THEN RAISE EXCEPTION 'service_order_item_immutable';END IF;IF TG_OP='DELETE'THEN RETURN OLD;END IF;RETURN NEW;END$$;
CREATE TRIGGER event_service_item_immutable BEFORE UPDATE OR DELETE ON public.event_order_items FOR EACH ROW EXECUTE FUNCTION zoi.event_service_item_immutable();
CREATE FUNCTION zoi.event_service_order_transition() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE it record;s zoi.event_service_sessions;BEGIN
 IF OLD.service_session_id IS NULL THEN IF NEW.service_session_id IS NOT NULL THEN RAISE EXCEPTION 'service_order_scope_immutable';END IF;RETURN NEW;END IF;
 IF NEW.service_session_id IS DISTINCT FROM OLD.service_session_id OR NEW.service_actor IS DISTINCT FROM OLD.service_actor OR NEW.service_total_cents IS DISTINCT FROM OLD.service_total_cents OR NEW.total_amount IS DISTINCT FROM OLD.total_amount THEN RAISE EXCEPTION 'service_order_scope_immutable';END IF;
 IF NEW.fulfillment_status=OLD.fulfillment_status THEN IF NEW.service_charged IS DISTINCT FROM OLD.service_charged THEN RAISE EXCEPTION 'invalid_service_charge';END IF;RETURN NEW;END IF;
 SELECT * INTO s FROM zoi.event_service_sessions WHERE id=OLD.service_session_id FOR SHARE;
 IF NOT((OLD.fulfillment_status='awaiting_approval'AND NEW.fulfillment_status IN('received','cancelled'))OR(OLD.fulfillment_status='received'AND NEW.fulfillment_status='preparing')OR(OLD.fulfillment_status='preparing'AND NEW.fulfillment_status='ready')OR(OLD.fulfillment_status='ready'AND NEW.fulfillment_status='delivered'))THEN RAISE EXCEPTION 'invalid_service_transition';END IF;
 IF OLD.fulfillment_status='awaiting_approval' THEN
 IF OLD.service_charged OR NEW.service_charged IS DISTINCT FROM(NEW.fulfillment_status='received')THEN RAISE EXCEPTION 'invalid_service_charge';END IF;
 ELSE IF NEW.service_charged IS DISTINCT FROM OLD.service_charged THEN RAISE EXCEPTION 'invalid_service_charge';END IF;END IF;
 IF NEW.fulfillment_status IN('preparing','cancelled')THEN
 FOR it IN SELECT service_menu_item_id AS item,sum(quantity)::integer AS qty FROM public.event_order_items WHERE order_id=OLD.id GROUP BY service_menu_item_id ORDER BY service_menu_item_id LOOP
 PERFORM 1 FROM zoi.event_service_stock WHERE session_id=s.id AND menu_item_id=it.item FOR UPDATE;
 IF NEW.fulfillment_status='preparing' THEN UPDATE zoi.event_service_stock SET reserved=reserved-it.qty,consumed=consumed+it.qty WHERE session_id=s.id AND menu_item_id=it.item;ELSE UPDATE zoi.event_service_stock SET reserved=reserved-it.qty WHERE session_id=s.id AND menu_item_id=it.item;END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'service_stock_unavailable';END IF;
 INSERT INTO zoi.event_service_ledger(session_id,menu_item_id,order_id,kind,quantity)VALUES(s.id,it.item,OLD.id,CASE WHEN NEW.fulfillment_status='preparing'THEN 'consume'ELSE 'release'END,it.qty);
 END LOOP;END IF;PERFORM zoi.suite_lock_session();RETURN NEW;
END$$;
CREATE TRIGGER event_service_order_transition BEFORE UPDATE ON public.event_orders FOR EACH ROW EXECUTE FUNCTION zoi.event_service_order_transition();
CREATE FUNCTION public.event_service_approval(p_workspace uuid,p_order uuid,p_expected_revision integer,p_approve boolean,p_checks_confirmed boolean,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE o public.event_orders;s zoi.event_service_sessions;args jsonb;r jsonb;locked_ad zoi.event_service_admissions;locked_guest zoi.event_host_guests;BEGIN
 PERFORM zoi.service_queue_authorize(p_workspace,p_order);SELECT * INTO o FROM public.event_orders WHERE id=p_order;
 IF o.service_session_id IS NULL THEN RAISE EXCEPTION 'service_order_unavailable';END IF;
 SELECT * INTO s FROM zoi.event_service_sessions WHERE id=o.service_session_id FOR SHARE;
 args:=jsonb_build_object('workspace',p_workspace,'revision',p_expected_revision,'approve',p_approve,'checks_confirmed',p_checks_confirmed);r:=zoi.event_service_receipt('approval',p_order,p_request,args);IF r IS NOT NULL THEN RETURN r;END IF;
 IF p_approve IS NULL OR o.revision IS DISTINCT FROM p_expected_revision OR o.fulfillment_status<>'awaiting_approval' OR o.service_charged THEN RAISE EXCEPTION 'version_conflict';END IF;
 IF p_approve AND(p_checks_confirmed IS DISTINCT FROM true OR s.status<>'active' OR clock_timestamp()<(s.configuration->>'opens_at')::timestamptz OR clock_timestamp()>=(s.configuration->>'closes_at')::timestamptz)THEN RAISE EXCEPTION 'service_approval_unavailable';END IF;
 IF p_approve THEN
 SELECT * INTO locked_ad FROM zoi.event_service_admissions WHERE session_id=s.id AND table_id=o.table_id AND actor=o.service_actor FOR SHARE;
 IF locked_ad.id IS NULL THEN RAISE EXCEPTION 'service_participation_required';END IF;locked_guest:=zoi.event_service_source_guest(locked_ad.source_guest_id);
 PERFORM 1 FROM zoi.event_service_admissions ad JOIN zoi.event_host_guests g ON g.id=ad.source_guest_id JOIN zoi.event_host_allocations a ON a.id=g.event_allocation_id JOIN zoi.user_profiles p ON p.id=g.claimed_by WHERE ad.session_id=s.id AND ad.table_id=o.table_id AND ad.actor=o.service_actor AND ad.status='active'AND g.status='accepted'AND g.version=ad.source_guest_revision AND p.auth_user_id=o.service_actor AND a.status='active'AND a.workspace_id=s.workspace_id AND a.event_id=s.event_id AND a.table_id=o.table_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'service_participation_required';END IF;
 IF NOT EXISTS(SELECT 1 FROM zoi.listings WHERE id=s.event_id AND publish_status='published'AND moderation_status IN('clean','cleared')AND coalesce(marketplace_status,'')<>'hidden')THEN RAISE EXCEPTION 'service_approval_unavailable';END IF;
 PERFORM 1 FROM zoi.event_service_stock st JOIN public.event_order_items i ON i.service_menu_item_id=st.menu_item_id WHERE i.order_id=o.id AND st.session_id=s.id ORDER BY st.menu_item_id FOR UPDATE OF st;
 PERFORM 1 FROM public.table_tabs WHERE id=o.tab_id AND service_session_id=s.id AND service_currency='CAD' AND status='open' FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'service_tab_unavailable';END IF;
 UPDATE public.table_tabs SET total_amount=total_amount+o.service_total_cents::numeric/100,updated_at=clock_timestamp()WHERE id=o.tab_id;
 END IF;
 PERFORM zoi.suite_lock_session();IF p_approve AND clock_timestamp()>=(s.configuration->>'closes_at')::timestamptz THEN RAISE EXCEPTION 'service_closed';END IF;
 UPDATE public.event_orders SET fulfillment_status=CASE WHEN p_approve THEN 'received'ELSE 'cancelled'END,service_charged=p_approve WHERE id=p_order RETURNING * INTO o;
 r:=jsonb_build_object('ok',true,'workspace_id',p_workspace,'request_id',p_request,'order_id',p_order,'session_id',s.id,'status',CASE WHEN p_approve THEN 'approved'ELSE 'rejected'END,'revision',o.revision,'payment_collected',false);RETURN zoi.event_service_record('approval',p_order,p_request,args,r);
END$$;
CREATE FUNCTION public.event_service_control(p_session uuid,p_expected_revision integer,p_status text,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE s zoi.event_service_sessions;args jsonb;r jsonb;BEGIN
 s:=zoi.event_service_scope(p_session,NULL,true,true);args:=jsonb_build_object('revision',p_expected_revision,'status',p_status);r:=zoi.event_service_receipt('control',p_session,p_request,args);IF r IS NOT NULL THEN RETURN r;END IF;
 SELECT * INTO s FROM zoi.event_service_sessions WHERE id=p_session FOR UPDATE;
 IF p_expected_revision IS DISTINCT FROM s.revision OR s.status='closed' OR coalesce(p_status,'')NOT IN('active','paused','closed')THEN RAISE EXCEPTION 'version_conflict';END IF;
 IF p_status='closed'AND(EXISTS(SELECT 1 FROM zoi.event_service_stock WHERE session_id=s.id AND reserved>0)OR EXISTS(SELECT 1 FROM public.table_tabs WHERE service_session_id=s.id AND total_amount<>paid_amount))THEN RAISE EXCEPTION 'service_unsettled';END IF;
 PERFORM zoi.suite_lock_session();
 UPDATE zoi.event_service_sessions SET status=p_status,revision=revision+1 WHERE id=s.id RETURNING * INTO s;
 r:=jsonb_build_object('ok',true,'request_id',p_request,'session_id',s.id,'workspace_id',s.workspace_id,'status',s.status,'revision',s.revision);RETURN zoi.event_service_record('control',p_session,p_request,args,r);
END$$;
CREATE FUNCTION public.event_service_revoke_admission(p_session uuid,p_admission uuid,p_expected_revision integer,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE s zoi.event_service_sessions;ad zoi.event_service_admissions;args jsonb;r jsonb;ta uuid;BEGIN
 SELECT table_id INTO ta FROM zoi.event_service_admissions WHERE id=p_admission AND session_id=p_session;IF ta IS NULL THEN RAISE EXCEPTION 'admission_unavailable';END IF;
 s:=zoi.event_service_scope(p_session,ta,true);args:=jsonb_build_object('admission',p_admission,'revision',p_expected_revision);r:=zoi.event_service_receipt('revoke',p_session,p_request,args);IF r IS NOT NULL THEN RETURN r;END IF;
 SELECT * INTO ad FROM zoi.event_service_admissions WHERE id=p_admission FOR UPDATE;IF ad.revision IS DISTINCT FROM p_expected_revision OR ad.status<>'active'THEN RAISE EXCEPTION 'version_conflict';END IF;
 PERFORM zoi.suite_lock_session();
 UPDATE zoi.event_service_admissions SET status='revoked',revision=revision+1 WHERE id=p_admission RETURNING * INTO ad;
 r:=jsonb_build_object('ok',true,'request_id',p_request,'session_id',p_session,'admission_id',ad.id,'status','revoked','revision',ad.revision);RETURN zoi.event_service_record('revoke',p_session,p_request,args,r);
END$$;
CREATE FUNCTION public.event_service_request(p_kind text,p_scope uuid,p_table uuid,p_request uuid,p_cancel_if_missing boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE r zoi.event_service_requests;s zoi.event_service_sessions;ws uuid;ev uuid;BEGIN
 IF p_request IS NULL OR p_scope IS NULL OR p_cancel_if_missing IS NULL OR coalesce(p_kind,'')NOT IN('start','admit','order','approval','control','revoke')THEN RAISE EXCEPTION 'invalid_request';END IF;
 IF p_kind='start' THEN SELECT workspace_id,event_id INTO ws,ev FROM public.event_venues WHERE id=p_scope;PERFORM zoi.event_service_setup_authorize(ws,ev,p_scope);
 ELSIF p_kind='approval'THEN SELECT v.workspace_id INTO ws FROM public.event_orders o JOIN public.venue_tables_zones t ON t.id=o.table_id JOIN public.event_venues v ON v.id=t.venue_id WHERE o.id=p_scope;PERFORM zoi.service_queue_authorize(ws,p_scope);
 ELSE s:=zoi.event_service_scope(p_scope,p_table,p_kind<>'order',p_kind='control');IF p_kind='order'THEN PERFORM zoi.event_service_participant(p_scope,p_table);END IF;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('event-service-actor:'||auth.uid()::text,0));PERFORM zoi.suite_lock_session();
 SELECT * INTO r FROM zoi.event_service_requests WHERE actor=auth.uid() AND request_id=p_request;
 IF FOUND THEN IF r.kind<>p_kind OR r.scope_id<>p_scope THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN r.result;END IF;
 IF p_cancel_if_missing THEN PERFORM zoi.event_service_receipt(p_kind,p_scope,p_request,NULL);RETURN zoi.event_service_record(p_kind,p_scope,p_request,NULL,jsonb_build_object('ok',true,'kind',p_kind,'scope_id',p_scope,'request_id',p_request,'status','cancelled'));END IF;
 RETURN jsonb_build_object('ok',true,'kind',p_kind,'scope_id',p_scope,'request_id',p_request,'status','unknown');
END$$;

CREATE FUNCTION public.event_service_sessions(p_workspace uuid,p_event uuid,p_venue uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE rows jsonb;BEGIN
 PERFORM zoi.event_service_setup_authorize(p_workspace,p_event,p_venue);
 SELECT coalesce(jsonb_agg(to_jsonb(x)ORDER BY x.created_at DESC,x.id),'[]')INTO rows FROM(SELECT id,event_id,venue_id,configuration_revision,status,revision,created_at FROM zoi.event_service_sessions WHERE workspace_id=p_workspace AND event_id=p_event AND venue_id=p_venue ORDER BY created_at DESC,id LIMIT 100)x;
 RETURN jsonb_build_object('ok',true,'workspace_id',p_workspace,'event_id',p_event,'venue_id',p_venue,'sessions',rows);
END$$;
CREATE FUNCTION public.event_service_operator_view(p_workspace uuid,p_session uuid,p_section text DEFAULT 'overview',p_after uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE s zoi.event_service_sessions;admissions jsonb;candidates jsonb;stock jsonb;approval jsonb;BEGIN
 IF coalesce(p_section,'')NOT IN('overview','admissions','candidates','approvals')OR(p_section='overview'AND p_after IS NOT NULL)THEN RAISE EXCEPTION 'invalid_service_cursor';END IF;
 s:=zoi.event_service_scope(p_session,NULL,true);IF s.workspace_id IS DISTINCT FROM p_workspace THEN RAISE EXCEPTION 'service_unavailable' USING errcode='42501';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',ad.id,'table_id',ad.table_id,'label',m.guest_name,'quantity',ad.quantity,'status',ad.status,'revision',ad.revision)ORDER BY ad.id),'[]')INTO admissions FROM(SELECT * FROM zoi.event_service_admissions WHERE session_id=s.id AND p_section IN('overview','admissions')AND(p_after IS NULL OR id>p_after)ORDER BY id LIMIT 101)ad JOIN public.table_members m ON m.id=ad.member_id;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',g.id,'revision',g.version,'label',g.label,'quantity',g.quantity,'table_id',a.table_id,'table_label',t.name,'hold_expired',a.expires_at<=clock_timestamp())ORDER BY g.id),'[]')INTO candidates FROM(SELECT g.* FROM zoi.event_host_guests g JOIN zoi.event_host_allocations a ON a.id=g.event_allocation_id JOIN public.venue_tables_zones t ON t.id=a.table_id WHERE p_section IN('overview','candidates')AND(p_after IS NULL OR g.id>p_after)AND a.workspace_id=p_workspace AND a.event_id=s.event_id AND a.status='active'AND g.status='accepted'AND g.claimed_by IS NOT NULL AND t.venue_id=s.venue_id AND s.configuration->'table_ids'@>jsonb_build_array(t.id::text)AND NOT EXISTS(SELECT 1 FROM zoi.event_service_admissions ad WHERE ad.session_id=s.id AND ad.source_guest_id=g.id)ORDER BY g.id LIMIT 101)g JOIN zoi.event_host_allocations a ON a.id=g.event_allocation_id JOIN public.venue_tables_zones t ON t.id=a.table_id;
 SELECT coalesce(jsonb_agg(jsonb_build_object('menu_item_id',st.menu_item_id,'name',m.name,'seeded',st.seeded,'reserved',st.reserved,'consumed',st.consumed,'available',st.seeded-st.reserved-st.consumed)ORDER BY st.menu_item_id),'[]')INTO stock FROM zoi.event_service_stock st JOIN public.menu_items m ON m.id=st.menu_item_id WHERE st.session_id=s.id;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'revision',o.revision,'table_name',t.name,'customer_name',o.customer_name,'station',o.target_station,'total_cents',o.service_total_cents,'items',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',i.item_name,'quantity',i.quantity)ORDER BY i.id),'[]')FROM public.event_order_items i WHERE i.order_id=o.id))ORDER BY o.created_at,o.id),'[]')INTO approval FROM(SELECT * FROM public.event_orders WHERE service_session_id=s.id AND fulfillment_status='awaiting_approval'AND p_section IN('overview','approvals')AND(p_after IS NULL OR(coalesce(created_at,'-infinity'::timestamptz),id)>(SELECT coalesce(created_at,'-infinity'::timestamptz),id FROM public.event_orders WHERE id=p_after AND service_session_id=s.id))ORDER BY coalesce(created_at,'-infinity'::timestamptz),id LIMIT 101)o JOIN public.venue_tables_zones t ON t.id=o.table_id;
 PERFORM zoi.suite_lock_session();RETURN jsonb_build_object('ok',true,'workspace_id',p_workspace,'event_id',s.event_id,'session_id',s.id,'status',s.status,'revision',s.revision,'currency','CAD','opens_at',s.configuration->>'opens_at','closes_at',s.configuration->>'closes_at','section',p_section,'has_more',jsonb_build_object('admissions',jsonb_array_length(admissions)>100,'candidates',jsonb_array_length(candidates)>100,'approvals',jsonb_array_length(approval)>100),'admissions',CASE WHEN jsonb_array_length(admissions)>100 THEN admissions-100 ELSE admissions END,'candidates',CASE WHEN jsonb_array_length(candidates)>100 THEN candidates-100 ELSE candidates END,'stock',stock,'approvals',CASE WHEN jsonb_array_length(approval)>100 THEN approval-100 ELSE approval END);
END$$;
CREATE FUNCTION public.event_service_guest_view(p_session uuid,p_table uuid,p_before uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE s zoi.event_service_sessions;ad zoi.event_service_admissions;menu jsonb;orders jsonb;BEGIN
 s:=zoi.event_service_scope(p_session,p_table,false);ad:=zoi.event_service_participant(p_session,p_table);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'description',m.description,'menu_revision',m.revision,'unit_cents',m.price_cents,'station',m.station,'requires_staff_approval',(cfg.value->>'requires_staff_approval')::boolean,'available_quantity',CASE WHEN m.is_available AND m.currency='CAD' AND m.revision=(cfg.value->>'menu_revision')::integer THEN st.seeded-st.reserved-st.consumed ELSE 0 END)ORDER BY m.sort_order,m.name,m.id),'[]')INTO menu FROM jsonb_array_elements(s.configuration->'items')cfg JOIN public.menu_items m ON m.id=(cfg.value->>'menu_item_id')::uuid JOIN zoi.event_service_stock st ON st.menu_item_id=m.id AND st.session_id=s.id WHERE m.workspace_id=s.workspace_id;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'station',o.target_station,'status',o.fulfillment_status,'revision',o.revision,'total_cents',o.service_total_cents,'charged',o.service_charged,'items',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',i.item_name,'quantity',i.quantity)ORDER BY i.id),'[]')FROM public.event_order_items i WHERE i.order_id=o.id))ORDER BY coalesce(o.created_at,'-infinity'::timestamptz)DESC,o.id DESC),'[]')INTO orders FROM(SELECT * FROM public.event_orders WHERE service_session_id=s.id AND table_id=p_table AND service_actor=auth.uid()AND(p_before IS NULL OR(coalesce(created_at,'-infinity'::timestamptz),id)<(SELECT coalesce(created_at,'-infinity'::timestamptz),id FROM public.event_orders WHERE id=p_before AND service_session_id=s.id AND service_actor=auth.uid()))ORDER BY coalesce(created_at,'-infinity'::timestamptz)DESC,id DESC LIMIT 101)o;
 PERFORM zoi.suite_lock_session();RETURN jsonb_build_object('ok',true,'event_id',s.event_id,'session_id',s.id,'table_id',p_table,'revision',s.revision,'currency','CAD','ordering_open',s.status='active'AND clock_timestamp()>=(s.configuration->>'opens_at')::timestamptz AND clock_timestamp()<(s.configuration->>'closes_at')::timestamptz,'menu',menu,'has_more',jsonb_array_length(orders)>100,'orders',CASE WHEN jsonb_array_length(orders)>100 THEN orders-100 ELSE orders END,'payment_collected',false);
END$$;

CREATE FUNCTION public.event_service_my_tables(p_event uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE rows jsonb;BEGIN
 PERFORM zoi.suite_lock_session();IF p_event IS NULL THEN RAISE EXCEPTION 'event_required';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('session_id',s.id,'table_id',ad.table_id,'table_name',t.name,'status',s.status,'ordering_open',s.status='active'AND clock_timestamp()>=(s.configuration->>'opens_at')::timestamptz AND clock_timestamp()<(s.configuration->>'closes_at')::timestamptz)ORDER BY s.created_at DESC,s.id),'[]')INTO rows
 FROM zoi.event_service_admissions ad JOIN zoi.event_service_sessions s ON s.id=ad.session_id JOIN public.venue_tables_zones t ON t.id=ad.table_id JOIN public.event_venues v ON v.id=t.venue_id JOIN zoi.listings l ON l.id=s.event_id JOIN zoi.event_host_guests g ON g.id=ad.source_guest_id JOIN zoi.event_host_allocations a ON a.id=g.event_allocation_id JOIN zoi.user_profiles p ON p.id=g.claimed_by
 WHERE ad.actor=auth.uid()AND p.auth_user_id=auth.uid()AND ad.status='active'AND g.status='accepted'AND g.version=ad.source_guest_revision AND a.status='active'AND a.workspace_id=s.workspace_id AND a.event_id=s.event_id AND a.table_id=ad.table_id AND s.event_id=p_event AND s.status<>'closed'AND v.id=s.venue_id AND v.workspace_id=s.workspace_id AND v.event_id=s.event_id AND l.owner_workspace_id=s.workspace_id AND l.publish_status='published'AND l.moderation_status IN('clean','cleared')AND coalesce(l.marketplace_status,'')<>'hidden';
 PERFORM zoi.suite_lock_session();RETURN jsonb_build_object('ok',true,'event_id',p_event,'tables',rows);
END$$;
DO $$DECLARE f record;BEGIN FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='zoi' AND p.proname IN('event_service_receipt','event_service_record','event_service_scope','event_service_participant','event_service_order_transition','event_service_item_immutable','event_service_tab_guard','event_service_source_guest')LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.sig);END LOOP;
 FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('event_service_start','event_service_admit','event_service_order','event_service_approval','event_service_control','event_service_revoke_admission','event_service_request','event_service_sessions','event_service_operator_view','event_service_guest_view','event_service_my_tables')LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.sig);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END LOOP;END$$;
NOTIFY pgrst,'reload schema';COMMIT;

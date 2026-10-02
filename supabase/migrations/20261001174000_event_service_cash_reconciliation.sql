-- Staff records cash received or physically returned; no payment provider is invoked.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $$BEGIN IF to_regprocedure('public.event_service_control(uuid,integer,text,uuid)') IS NULL THEN RAISE EXCEPTION 'service_lifecycle_required';END IF;END$$;
DO $$BEGIN IF (SELECT md5(prosrc)FROM pg_proc WHERE oid='zoi.event_service_tab_guard()'::regprocedure) IS DISTINCT FROM '20b8dacb0811849d97eb7c2252ce6304'THEN RAISE EXCEPTION 'service_tab_guard_definition_changed';END IF;END$$;
ALTER TABLE public.table_tabs ADD COLUMN service_revision integer NOT NULL DEFAULT 1;
CREATE TABLE zoi.event_service_cash_ledger(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid NOT NULL REFERENCES zoi.event_service_sessions(id),tab_id uuid NOT NULL REFERENCES public.table_tabs(id),payment_id uuid NOT NULL UNIQUE REFERENCES public.tab_payments(id) DEFERRABLE INITIALLY DEFERRED,
 actor uuid NOT NULL,kind text NOT NULL CHECK(kind IN('cash','reversal')),cents integer NOT NULL CHECK(cents BETWEEN 1 AND 100000000),original_id uuid REFERENCES zoi.event_service_cash_ledger(id),note text NOT NULL CHECK(length(note) BETWEEN 1 AND 300),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),CHECK((kind='cash'AND original_id IS NULL)OR(kind='reversal'AND original_id IS NOT NULL)));
CREATE INDEX event_service_cash_tab_time ON zoi.event_service_cash_ledger(tab_id,created_at,id);
ALTER TABLE zoi.event_service_cash_ledger ENABLE ROW LEVEL SECURITY;ALTER TABLE public.tab_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.event_service_cash_ledger,public.tab_payments FROM PUBLIC,anon,authenticated;
DO $$DECLARE r text;p text;BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated']LOOP FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE']LOOP IF has_table_privilege(r,'public.tab_payments',p)THEN RAISE EXCEPTION 'service_cash_direct_access';END IF;END LOOP;FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE']LOOP IF has_any_column_privilege(r,'public.tab_payments',p)THEN RAISE EXCEPTION 'service_cash_column_access';END IF;END LOOP;END LOOP;END$$;
CREATE FUNCTION zoi.event_service_cash_immutable()RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN RAISE EXCEPTION 'service_cash_ledger_immutable';END$$;
CREATE TRIGGER event_service_cash_immutable BEFORE UPDATE OR DELETE ON zoi.event_service_cash_ledger FOR EACH ROW EXECUTE FUNCTION zoi.event_service_cash_immutable();
CREATE FUNCTION zoi.event_service_payment_guard()RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$DECLARE tab public.table_tabs;l zoi.event_service_cash_ledger;BEGIN
 IF TG_OP<>'INSERT' THEN IF EXISTS(SELECT 1 FROM zoi.event_service_cash_ledger WHERE payment_id=OLD.id)THEN RAISE EXCEPTION 'service_payment_immutable';END IF;IF TG_OP='DELETE' THEN RETURN OLD;END IF;END IF;
 SELECT * INTO tab FROM public.table_tabs WHERE id=NEW.tab_id;
 IF tab.service_session_id IS NOT NULL THEN
 SELECT * INTO l FROM zoi.event_service_cash_ledger WHERE payment_id=NEW.id;
 IF NOT FOUND OR l.tab_id IS DISTINCT FROM NEW.tab_id OR l.session_id IS DISTINCT FROM tab.service_session_id OR NEW.amount IS DISTINCT FROM(CASE WHEN l.kind='cash'THEN l.cents ELSE -l.cents END)::numeric/100 OR NEW.payment_method IS DISTINCT FROM 'cash'OR NEW.payment_status IS DISTINCT FROM 'completed'OR NEW.collected_by_staff_id IS DISTINCT FROM l.actor THEN RAISE EXCEPTION 'service_cash_receipt_required';END IF;
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER event_service_payment_guard BEFORE INSERT OR UPDATE OR DELETE ON public.tab_payments FOR EACH ROW EXECUTE FUNCTION zoi.event_service_payment_guard();
CREATE OR REPLACE FUNCTION zoi.event_service_tab_guard()RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$DECLARE paid numeric;BEGIN
 IF OLD.service_session_id IS NOT NULL THEN
 IF NEW.service_session_id IS DISTINCT FROM OLD.service_session_id OR NEW.table_id IS DISTINCT FROM OLD.table_id OR NEW.event_id IS DISTINCT FROM OLD.event_id OR NEW.service_currency IS DISTINCT FROM OLD.service_currency THEN RAISE EXCEPTION 'service_tab_scope_immutable';END IF;
 SELECT coalesce(sum(CASE WHEN kind='cash'THEN cents ELSE -cents END),0)::numeric/100 INTO paid FROM zoi.event_service_cash_ledger WHERE tab_id=OLD.id;
 IF NEW.paid_amount IS DISTINCT FROM paid OR paid<0 OR paid>NEW.total_amount THEN RAISE EXCEPTION 'service_cash_balance_mismatch';END IF;
 NEW.service_revision:=OLD.service_revision+1;
 ELSIF NEW.service_session_id IS NOT NULL THEN RAISE EXCEPTION 'legacy_tab_cannot_be_relabelled';END IF;RETURN NEW;
END$$;
CREATE FUNCTION zoi.event_service_tab_consistency()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE t public.table_tabs;charged numeric;paid numeric;BEGIN
 SELECT * INTO t FROM public.table_tabs WHERE id=NEW.id;IF t.service_session_id IS NULL THEN RETURN NULL;END IF;
 SELECT coalesce(sum(service_total_cents)FILTER(WHERE service_charged),0)::numeric/100 INTO charged FROM public.event_orders WHERE tab_id=t.id AND service_session_id=t.service_session_id;
 SELECT coalesce(sum(CASE WHEN kind='cash'THEN cents ELSE -cents END),0)::numeric/100 INTO paid FROM zoi.event_service_cash_ledger WHERE tab_id=t.id;
 IF t.total_amount IS DISTINCT FROM charged OR t.paid_amount IS DISTINCT FROM paid THEN RAISE EXCEPTION 'service_tab_reconciliation_mismatch';END IF;RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER event_service_tab_consistency AFTER UPDATE ON public.table_tabs DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION zoi.event_service_tab_consistency();
CREATE FUNCTION zoi.event_service_close_reconciled()RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN
 IF NEW.status='closed'AND OLD.status<>'closed'THEN
 IF EXISTS(SELECT 1 FROM public.event_orders WHERE service_session_id=OLD.id AND fulfillment_status NOT IN('delivered','cancelled'))OR EXISTS(SELECT 1 FROM zoi.event_service_stock WHERE session_id=OLD.id AND reserved<>0)OR EXISTS(SELECT 1 FROM public.table_tabs t WHERE service_session_id=OLD.id AND(t.total_amount IS DISTINCT FROM t.paid_amount OR t.paid_amount IS DISTINCT FROM(SELECT coalesce(sum(CASE WHEN kind='cash'THEN cents ELSE -cents END),0)::numeric/100 FROM zoi.event_service_cash_ledger WHERE tab_id=t.id)OR t.total_amount IS DISTINCT FROM(SELECT coalesce(sum(service_total_cents)FILTER(WHERE service_charged),0)::numeric/100 FROM public.event_orders WHERE tab_id=t.id)))THEN RAISE EXCEPTION 'service_reconciliation_required';END IF;
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER event_service_close_reconciled BEFORE UPDATE ON zoi.event_service_sessions FOR EACH ROW EXECUTE FUNCTION zoi.event_service_close_reconciled();
CREATE FUNCTION zoi.event_service_cash_scope(p_session uuid,p_tab uuid)RETURNS public.table_tabs LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE t public.table_tabs;s zoi.event_service_sessions;ta uuid;BEGIN
 SELECT table_id INTO ta FROM public.table_tabs WHERE id=p_tab AND service_session_id=p_session;IF ta IS NULL THEN RAISE EXCEPTION 'service_tab_unavailable';END IF;
 s:=zoi.event_service_scope(p_session,ta,true);SELECT * INTO t FROM public.table_tabs WHERE id=p_tab AND service_session_id=p_session FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'service_tab_unavailable';END IF;PERFORM zoi.suite_lock_session();IF t.service_currency IS DISTINCT FROM 'CAD'THEN RAISE EXCEPTION 'service_tab_unavailable';END IF;RETURN t;
END$$;
CREATE FUNCTION public.event_service_cash_record(p_session uuid,p_tab uuid,p_expected_revision integer,p_kind text,p_cents integer,p_original uuid,p_note text,p_cash_confirmed boolean,p_request uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE t public.table_tabs;s zoi.event_service_sessions;l zoi.event_service_cash_ledger;o zoi.event_service_cash_ledger;r jsonb;args jsonb;payment uuid:=gen_random_uuid();remaining integer;BEGIN
 t:=zoi.event_service_cash_scope(p_session,p_tab);SELECT * INTO s FROM zoi.event_service_sessions WHERE id=p_session;
 args:=jsonb_build_object('session',p_session,'revision',p_expected_revision,'kind',p_kind,'cents',p_cents,'original',p_original,'note',p_note,'cash_confirmed',p_cash_confirmed);
 r:=zoi.event_service_receipt('settlement',p_tab,p_request,args);IF r IS NOT NULL THEN RETURN r;END IF;
 IF s.status='closed'THEN RAISE EXCEPTION 'service_session_closed';END IF;
 IF t.service_revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'service_tab_revision_conflict';END IF;
 IF p_kind IS NULL OR p_kind NOT IN('cash','reversal')OR p_cents IS NULL OR p_cents NOT BETWEEN 1 AND 100000000 OR p_cash_confirmed IS DISTINCT FROM true OR length(btrim(coalesce(p_note,'')))NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'invalid_cash_acknowledgment';END IF;
 IF p_kind='cash'THEN IF p_original IS NOT NULL OR p_cents::numeric>(t.total_amount-t.paid_amount)*100 THEN RAISE EXCEPTION 'cash_exceeds_unpaid_balance';END IF;
 ELSE
 SELECT * INTO o FROM zoi.event_service_cash_ledger WHERE id=p_original AND session_id=p_session AND tab_id=p_tab AND kind='cash';IF NOT FOUND THEN RAISE EXCEPTION 'original_cash_required';END IF;
 SELECT o.cents-coalesce(sum(cents),0)INTO remaining FROM zoi.event_service_cash_ledger WHERE original_id=o.id;
 IF p_cents>remaining OR p_cents::numeric>t.paid_amount*100 THEN RAISE EXCEPTION 'cash_reversal_exceeds_original';END IF;
 END IF;
 PERFORM zoi.suite_lock_session();INSERT INTO zoi.event_service_cash_ledger(session_id,tab_id,payment_id,actor,kind,cents,original_id,note)VALUES(p_session,p_tab,payment,auth.uid(),p_kind,p_cents,p_original,btrim(p_note))RETURNING * INTO l;
 INSERT INTO public.tab_payments(id,tab_id,amount,payment_method,payment_status,collected_by_staff_id)VALUES(payment,p_tab,(CASE WHEN p_kind='cash'THEN p_cents ELSE -p_cents END)::numeric/100,'cash','completed',auth.uid());
 UPDATE public.table_tabs SET paid_amount=paid_amount+(CASE WHEN p_kind='cash'THEN p_cents ELSE -p_cents END)::numeric/100,updated_at=clock_timestamp()WHERE id=p_tab RETURNING * INTO t;
 r:=jsonb_build_object('ok',true,'request_id',p_request,'workspace_id',s.workspace_id,'session_id',p_session,'tab_id',p_tab,'ledger_id',l.id,'payment_id',payment,'cash_kind',p_kind,'cents',p_cents,'original_id',p_original,'revision',t.service_revision,'currency','CAD','paid_cents',(t.paid_amount*100)::integer,'remaining_cents',((t.total_amount-t.paid_amount)*100)::integer,'recorded_by_staff',true,'online_payment_collected',false);RETURN zoi.event_service_record('settlement',p_tab,p_request,args,r);
END$$;
CREATE FUNCTION public.event_service_cash_request(p_session uuid,p_tab uuid,p_request uuid,p_cancel_if_missing boolean DEFAULT false)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE t public.table_tabs;prior zoi.event_service_requests;BEGIN
 t:=zoi.event_service_cash_scope(p_session,p_tab);IF p_request IS NULL THEN RAISE EXCEPTION 'request_required';END IF;PERFORM pg_advisory_xact_lock(hashtextextended('event-service-actor:'||auth.uid()::text,0));PERFORM zoi.suite_lock_session();
 SELECT * INTO prior FROM zoi.event_service_requests WHERE actor=auth.uid()AND request_id=p_request;IF FOUND THEN IF prior.kind<>'settlement'OR prior.scope_id IS DISTINCT FROM p_tab THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN prior.result;END IF;
 IF p_cancel_if_missing THEN PERFORM zoi.event_service_receipt('settlement',p_tab,p_request,NULL);RETURN zoi.event_service_record('settlement',p_tab,p_request,NULL,jsonb_build_object('ok',true,'request_id',p_request,'status','cancelled'));END IF;
 RETURN jsonb_build_object('ok',true,'kind','settlement','scope_id',p_tab,'request_id',p_request,'status','unknown');
END$$;
CREATE FUNCTION public.event_service_cash_view(p_session uuid,p_after uuid DEFAULT NULL)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE s zoi.event_service_sessions;tabs jsonb;ledger jsonb;BEGIN
 s:=zoi.event_service_scope(p_session,NULL,true);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'table_id',t.table_id,'name',z.name,'revision',t.service_revision,'total_cents',(t.total_amount*100)::integer,'paid_cents',(t.paid_amount*100)::integer,'remaining_cents',((t.total_amount-t.paid_amount)*100)::integer)ORDER BY t.id),'[]')INTO tabs FROM public.table_tabs t JOIN public.venue_tables_zones z ON z.id=t.table_id WHERE t.service_session_id=p_session;
 SELECT coalesce(jsonb_agg(to_jsonb(x)ORDER BY x.id),'[]')INTO ledger FROM(SELECT l.id,l.tab_id,l.payment_id,l.kind,l.cents,l.original_id,l.note,l.created_at,(CASE WHEN l.kind='cash'THEN l.cents-(SELECT coalesce(sum(r.cents),0)FROM zoi.event_service_cash_ledger r WHERE r.original_id=l.id)ELSE 0 END)::integer AS reversible_cents FROM zoi.event_service_cash_ledger l WHERE l.session_id=p_session AND(p_after IS NULL OR l.id>p_after)ORDER BY l.id LIMIT 101)x;
 PERFORM zoi.suite_lock_session();RETURN jsonb_build_object('ok',true,'workspace_id',s.workspace_id,'session_id',s.id,'status',s.status,'currency','CAD','tabs',tabs,'ledger',CASE WHEN jsonb_array_length(ledger)>100 THEN ledger-100 ELSE ledger END,'has_more',jsonb_array_length(ledger)>100,'online_payment_collected',false);
END$$;
REVOKE ALL ON FUNCTION zoi.event_service_cash_immutable(),zoi.event_service_payment_guard(),zoi.event_service_tab_guard(),zoi.event_service_tab_consistency(),zoi.event_service_close_reconciled(),zoi.event_service_cash_scope(uuid,uuid)FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.event_service_cash_record(uuid,uuid,integer,text,integer,uuid,text,boolean,uuid),public.event_service_cash_request(uuid,uuid,uuid,boolean),public.event_service_cash_view(uuid,uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.event_service_cash_record(uuid,uuid,integer,text,integer,uuid,text,boolean,uuid),public.event_service_cash_request(uuid,uuid,uuid,boolean),public.event_service_cash_view(uuid,uuid)TO authenticated;
COMMIT;

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$BEGIN IF md5(pg_get_functiondef('public.menu_item_save(uuid,uuid,text,text,integer,text,boolean)'::regprocedure))<>'f7e09eb506daaa82420906a154f2d711' THEN RAISE EXCEPTION 'menu_writer_definition_changed';END IF;END$$;
-- Preserve RPC-only access established by0034; refuse unexpected inherited/column grants.
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menu_items FROM PUBLIC,anon,authenticated;
DO $$DECLARE r text;p text;BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
   IF has_table_privilege(r,'public.menu_items',p) THEN RAISE EXCEPTION 'menu_direct_table_access_unexpected';END IF;
  END LOOP;
  FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE'] LOOP
   IF has_any_column_privilege(r,'public.menu_items',p) THEN RAISE EXCEPTION 'menu_direct_column_access_unexpected';END IF;
  END LOOP;
 END LOOP;
END$$;
ALTER TABLE public.menu_items ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK(revision>0);
CREATE FUNCTION zoi.service_menu_revision() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN RAISE EXCEPTION 'menu_identity_immutable';END IF;
 NEW.revision:=OLD.revision+1;NEW.updated_at:=clock_timestamp();RETURN NEW;
END$$;
CREATE TRIGGER service_menu_revision BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION zoi.service_menu_revision();
CREATE TABLE zoi.service_menu_requests(actor uuid NOT NULL,request_id uuid NOT NULL,workspace_id uuid NOT NULL,arguments jsonb,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(actor,request_id));
CREATE INDEX service_menu_requests_actor_time ON zoi.service_menu_requests(actor,created_at);
ALTER TABLE zoi.service_menu_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.service_menu_requests FROM PUBLIC,anon,authenticated;
CREATE FUNCTION zoi.service_menu_authorize(p_workspace uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE r text;BEGIN
 r:=zoi.workspace_locked_role(p_workspace);
 IF coalesce(r,'') NOT IN('owner','admin','editor') THEN RAISE EXCEPTION 'insufficient_permission' USING errcode='42501';END IF;
 RETURN r;
END$$;
CREATE FUNCTION zoi.service_menu_capacity() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN
 -- Receipt/tombstone identity is retained; never expire it and accidentally replay a write.
 IF (SELECT count(*) FROM zoi.service_menu_requests WHERE actor=auth.uid() AND created_at>clock_timestamp()-interval '1 hour')>=120 THEN RAISE EXCEPTION 'menu_request_limit';END IF;
END$$;
CREATE FUNCTION public.service_menu_list(p_workspace uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE r text;items jsonb;BEGIN
 r:=zoi.service_menu_authorize(p_workspace);
 SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.sort_order,m.name,m.id),'[]'::jsonb) INTO items FROM (SELECT id,workspace_id,name,description,price_cents,currency,station,is_available,sort_order,revision FROM public.menu_items WHERE workspace_id=p_workspace) m;
 RETURN jsonb_build_object('ok',true,'workspace_id',p_workspace,'role',r,'items',items);
END$$;
CREATE FUNCTION public.menu_item_save_once(p_workspace uuid,p_request uuid,p_item_id uuid,p_expected_revision integer,p_item jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE args jsonb;prior zoi.service_menu_requests;item public.menu_items;result jsonb;BEGIN
 PERFORM zoi.service_menu_authorize(p_workspace);
 IF p_request IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0 OR (p_item_id IS NULL AND p_expected_revision<>0) OR jsonb_typeof(p_item) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_menu_item';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_item)k WHERE k NOT IN('name','description','price_cents','currency','station','is_available')) OR jsonb_typeof(p_item->'name') IS DISTINCT FROM 'string' OR length(btrim(p_item->>'name')) NOT BETWEEN 1 AND 160 OR coalesce(jsonb_typeof(p_item->'description'),'null') NOT IN('null','string') OR length(coalesce(p_item->>'description',''))>2000 OR jsonb_typeof(p_item->'price_cents') IS DISTINCT FROM 'number' OR (p_item->>'price_cents')::numeric NOT BETWEEN 0 AND 1000000 OR (p_item->>'price_cents')::numeric<>trunc((p_item->>'price_cents')::numeric) OR p_item->>'currency' IS DISTINCT FROM 'CAD' OR coalesce(p_item->>'station','') NOT IN('kitchen','bar','merch') OR jsonb_typeof(p_item->'is_available') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'invalid_menu_item';END IF;
 args:=jsonb_build_object('item_id',p_item_id,'expected_revision',p_expected_revision,'item',p_item);
 PERFORM pg_advisory_xact_lock(hashtextextended('service-menu:'||auth.uid()::text,0));
 PERFORM zoi.suite_lock_session();
 SELECT * INTO prior FROM zoi.service_menu_requests WHERE actor=auth.uid() AND request_id=p_request;
 IF FOUND THEN
  IF prior.workspace_id IS DISTINCT FROM p_workspace OR (prior.arguments IS NOT NULL AND prior.arguments IS DISTINCT FROM args) THEN RAISE EXCEPTION 'request_conflict';END IF;
  RETURN prior.result;
 END IF;
 PERFORM zoi.service_menu_capacity();
 IF p_item_id IS NOT NULL THEN
  SELECT * INTO item FROM public.menu_items WHERE id=p_item_id FOR UPDATE;
  PERFORM zoi.suite_lock_session();
  IF item.id IS NULL OR item.workspace_id IS DISTINCT FROM p_workspace THEN RAISE EXCEPTION 'menu_item_unavailable';END IF;
  IF item.currency IS DISTINCT FROM 'CAD' THEN RAISE EXCEPTION 'unsupported_menu_currency';END IF;
  IF item.revision<>p_expected_revision THEN result:=jsonb_build_object('ok',true,'status','conflict','workspace_id',p_workspace,'request_id',p_request,'item_id',p_item_id,'current_revision',item.revision);END IF;
 END IF;
 IF result IS NULL THEN
  IF p_item_id IS NULL THEN
   INSERT INTO public.menu_items(workspace_id,name,description,price_cents,currency,station,is_available) VALUES(p_workspace,btrim(p_item->>'name'),p_item->>'description',(p_item->>'price_cents')::numeric::integer,'CAD',p_item->>'station',(p_item->>'is_available')::boolean) RETURNING * INTO item;
  ELSE
   UPDATE public.menu_items SET name=btrim(p_item->>'name'),description=p_item->>'description',price_cents=(p_item->>'price_cents')::numeric::integer,station=p_item->>'station',is_available=(p_item->>'is_available')::boolean WHERE id=p_item_id RETURNING * INTO item;
  END IF;
  result:=jsonb_build_object('ok',true,'status','saved','workspace_id',p_workspace,'request_id',p_request,'item_id',item.id,'revision',item.revision);
 END IF;
 INSERT INTO zoi.service_menu_requests(actor,request_id,workspace_id,arguments,result)VALUES(auth.uid(),p_request,p_workspace,args,result);RETURN result;
END$$;
CREATE FUNCTION public.service_menu_request(p_workspace uuid,p_request uuid,p_cancel_if_missing boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE prior zoi.service_menu_requests;result jsonb;BEGIN
 PERFORM zoi.service_menu_authorize(p_workspace);
 IF p_request IS NULL OR p_cancel_if_missing IS NULL THEN RAISE EXCEPTION 'invalid_request';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('service-menu:'||auth.uid()::text,0));
 PERFORM zoi.suite_lock_session();
 SELECT * INTO prior FROM zoi.service_menu_requests WHERE actor=auth.uid() AND request_id=p_request;
 IF FOUND THEN IF prior.workspace_id IS DISTINCT FROM p_workspace THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN prior.result;END IF;
 result:=jsonb_build_object('ok',true,'status',CASE WHEN p_cancel_if_missing THEN 'cancelled' ELSE 'unknown' END,'workspace_id',p_workspace,'request_id',p_request);
 IF p_cancel_if_missing THEN PERFORM zoi.service_menu_capacity();INSERT INTO zoi.service_menu_requests(actor,request_id,workspace_id,result)VALUES(auth.uid(),p_request,p_workspace,result);END IF;
 RETURN result;
END$$;
-- Installed legacy clients retain their signature. They have no nonce/recovery guarantee.
-- Modern clients must use save_once; never retry this legacy create after uncertainty.
CREATE OR REPLACE FUNCTION public.menu_item_save(p_workspace uuid,p_item_id uuid DEFAULT NULL,p_name text DEFAULT NULL,p_description text DEFAULT NULL,p_price_cents integer DEFAULT NULL,p_station text DEFAULT 'kitchen',p_is_available boolean DEFAULT true) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE item public.menu_items;BEGIN
 PERFORM zoi.service_menu_authorize(p_workspace);
 IF btrim(coalesce(p_name,''))='' OR p_price_cents IS NULL OR p_price_cents<0 THEN RETURN json_build_object('ok',false,'error','invalid_item');END IF;
 IF p_item_id IS NOT NULL THEN
  SELECT * INTO item FROM public.menu_items WHERE id=p_item_id FOR UPDATE;
  PERFORM zoi.suite_lock_session();
  IF item.id IS NULL OR item.workspace_id IS DISTINCT FROM p_workspace THEN RETURN json_build_object('ok',false,'error','not_your_item');END IF;
  UPDATE public.menu_items SET name=p_name,description=p_description,price_cents=p_price_cents,station=coalesce(p_station,'kitchen'),is_available=coalesce(p_is_available,true) WHERE id=p_item_id RETURNING * INTO item;
 ELSE
  PERFORM zoi.suite_lock_session();
  INSERT INTO public.menu_items(workspace_id,name,description,price_cents,station,is_available)VALUES(p_workspace,p_name,p_description,p_price_cents,coalesce(p_station,'kitchen'),coalesce(p_is_available,true))RETURNING * INTO item;
 END IF;
 RETURN json_build_object('ok',true,'id',item.id);
END$$;
REVOKE ALL ON FUNCTION zoi.service_menu_authorize(uuid),zoi.service_menu_capacity(),zoi.service_menu_revision() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.service_menu_list(uuid),public.menu_item_save_once(uuid,uuid,uuid,integer,jsonb),public.service_menu_request(uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.service_menu_list(uuid),public.menu_item_save_once(uuid,uuid,uuid,integer,jsonb),public.service_menu_request(uuid,uuid,boolean) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

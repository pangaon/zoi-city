-- Containment: preserve existing JSON signatures; no claim of nonce/CAS menu creation.
BEGIN;
CREATE OR REPLACE FUNCTION public.menu_item_save(
  p_workspace uuid, p_item_id uuid DEFAULT NULL, p_name text DEFAULT NULL,
  p_description text DEFAULT NULL, p_price_cents integer DEFAULT NULL,
  p_station text DEFAULT 'kitchen', p_is_available boolean DEFAULT true
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_prof uuid; v_role text; v_owner uuid; v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  SELECT role INTO v_role FROM zoi.workspace_members WHERE workspace_id = p_workspace AND profile_id = v_prof FOR SHARE;
  IF v_role IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_workspace_member'); END IF;
  IF v_role NOT IN ('owner','admin','editor') THEN RETURN json_build_object('ok', false, 'error', 'insufficient_permission'); END IF;
  IF coalesce(trim(p_name), '') = '' OR p_price_cents IS NULL OR p_price_cents < 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_item');
  END IF;

  IF p_item_id IS NOT NULL THEN
    SELECT workspace_id INTO v_owner FROM public.menu_items WHERE id = p_item_id FOR UPDATE;
    IF v_owner IS NULL OR v_owner != p_workspace THEN RETURN json_build_object('ok', false, 'error', 'not_your_item'); END IF;
    UPDATE public.menu_items
      SET name = p_name, description = p_description, price_cents = p_price_cents,
          station = coalesce(p_station,'kitchen'), is_available = coalesce(p_is_available,true), updated_at = now()
      WHERE id = p_item_id;
    v_id := p_item_id;
  ELSE
    INSERT INTO public.menu_items(workspace_id, name, description, price_cents, station, is_available)
    VALUES (p_workspace, p_name, p_description, p_price_cents, coalesce(p_station,'kitchen'), coalesce(p_is_available,true))
    RETURNING id INTO v_id;
  END IF;
  RETURN json_build_object('ok', true, 'id', v_id);
END$function$;


CREATE OR REPLACE FUNCTION public.kds_ticket_advance(p_workspace uuid,p_order_id uuid,p_status text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_prof uuid; v_role text; v_owner uuid; v_status text; v_event uuid; v_event_owner uuid;
BEGIN
 IF auth.uid() IS NULL THEN RETURN json_build_object('ok',false,'error','not_signed_in'); END IF;
 v_prof:=zoi.ensure_profile();
 IF v_prof IS NULL THEN RETURN json_build_object('ok',false,'error','not_signed_in'); END IF;
 SELECT role INTO v_role FROM zoi.workspace_members WHERE workspace_id=p_workspace AND profile_id=v_prof FOR SHARE;
 IF v_role IS NULL THEN RETURN json_build_object('ok',false,'error','not_workspace_member'); END IF;
 IF v_role NOT IN ('owner','admin','editor') THEN RETURN json_build_object('ok',false,'error','insufficient_permission'); END IF;
 IF p_status IS NULL OR p_status NOT IN ('received','preparing','ready','delivered','cancelled') THEN
  RETURN json_build_object('ok',false,'error','invalid_status');
 END IF;
 SELECT v.workspace_id,o.fulfillment_status,v.event_id INTO v_owner,v_status,v_event
 FROM public.event_orders o JOIN public.venue_tables_zones t ON t.id=o.table_id JOIN public.event_venues v ON v.id=t.venue_id
 WHERE o.id=p_order_id FOR UPDATE OF o,t,v;
 IF v_owner IS NULL OR v_owner IS DISTINCT FROM p_workspace THEN RETURN json_build_object('ok',false,'error','not_your_order'); END IF;
 IF v_event IS NOT NULL THEN
  SELECT owner_workspace_id INTO v_event_owner FROM zoi.listings WHERE id=v_event FOR SHARE;
  IF v_event_owner IS DISTINCT FROM p_workspace THEN RETURN json_build_object('ok',false,'error','not_your_order'); END IF;
 END IF;
 -- Same-state replay is harmless; it does not change updated_at or reverse progress.
 IF v_status=p_status THEN RETURN json_build_object('ok',true); END IF;
 IF NOT ((v_status='received' AND p_status IN ('preparing','cancelled'))
      OR (v_status='preparing' AND p_status IN ('ready','cancelled'))
      OR (v_status='ready' AND p_status IN ('delivered','cancelled'))) THEN
  RETURN json_build_object('ok',false,'error','invalid_transition');
 END IF;
 UPDATE public.event_orders SET fulfillment_status=p_status,updated_at=now() WHERE id=p_order_id;
 RETURN json_build_object('ok',true);
END $function$;
REVOKE ALL ON FUNCTION public.menu_item_save(uuid,uuid,text,text,integer,text,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.kds_ticket_advance(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.menu_item_save(uuid,uuid,text,text,integer,text,boolean) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.kds_ticket_advance(uuid,uuid,text) TO authenticated,service_role;
COMMIT;

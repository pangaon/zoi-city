-- Migration 0033: staff-side table-tab & KDS RPCs. Authorization chain is
-- event_orders/table_tabs -> table_id -> venue_tables_zones -> event_venues
-- -> workspace_id (added in 0031). Orders/tabs with no table_id cannot be
-- authorized by this chain and are deliberately excluded below.
--
-- NOT built here, on purpose: guest self-ordering (a guest choosing an item
-- and its price). There is no menu/catalog table anywhere in this schema, so
-- an RPC that let a guest submit "item_name, unit_price" would let them set
-- their own price -- a real fraud vector, not a shortcut. That needs a real
-- menu_items table (workspace-owned, staff-priced) before it can be safe.
-- Everything below is staff-only, gated on workspace membership like every
-- other RPC in this project.

BEGIN;

CREATE OR REPLACE FUNCTION public.table_tab_list(p_workspace uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_prof uuid; v_role text; v_rows json;
BEGIN
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  SELECT role INTO v_role FROM zoi.workspace_members WHERE workspace_id = p_workspace AND profile_id = v_prof;
  IF v_role IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_workspace_member'); END IF;

  SELECT coalesce(json_agg(row_to_json(x.*) ORDER BY x.created_at DESC), '[]'::json) INTO v_rows
  FROM (
    SELECT tt.id, tt.status, tt.total_amount, tt.paid_amount, tt.created_at, tt.updated_at,
           z.name AS table_name,
           (SELECT count(*) FROM public.table_members m WHERE m.tab_id = tt.id) AS member_count
    FROM public.table_tabs tt
    JOIN public.venue_tables_zones z ON z.id = tt.table_id
    JOIN public.event_venues v ON v.id = z.venue_id
    WHERE v.workspace_id = p_workspace
  ) x;
  RETURN json_build_object('ok', true, 'tabs', v_rows);
END$function$;

CREATE OR REPLACE FUNCTION public.table_tab_record_cash_payment(
  p_workspace uuid, p_tab_id uuid, p_amount numeric, p_method text DEFAULT 'cash'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_prof uuid; v_role text; v_owner uuid; v_id uuid;
BEGIN
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  SELECT role INTO v_role FROM zoi.workspace_members WHERE workspace_id = p_workspace AND profile_id = v_prof;
  IF v_role IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_workspace_member'); END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN json_build_object('ok', false, 'error', 'invalid_amount'); END IF;

  SELECT v.workspace_id INTO v_owner
  FROM public.table_tabs tt
  JOIN public.venue_tables_zones z ON z.id = tt.table_id
  JOIN public.event_venues v ON v.id = z.venue_id
  WHERE tt.id = p_tab_id;
  IF v_owner IS NULL OR v_owner != p_workspace THEN
    RETURN json_build_object('ok', false, 'error', 'not_your_tab');
  END IF;

  INSERT INTO public.tab_payments(tab_id, amount, payment_method, payment_status, collected_by_staff_id)
  VALUES (p_tab_id, p_amount, coalesce(p_method,'cash'), 'completed', auth.uid())
  RETURNING id INTO v_id;

  UPDATE public.table_tabs
    SET paid_amount = paid_amount + p_amount, updated_at = now(),
        status = CASE WHEN paid_amount + p_amount >= total_amount THEN 'closed' ELSE status END
    WHERE id = p_tab_id;

  RETURN json_build_object('ok', true, 'payment_id', v_id);
END$function$;

CREATE OR REPLACE FUNCTION public.kds_tickets_list(p_workspace uuid, p_station text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_prof uuid; v_role text; v_rows json;
BEGIN
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  SELECT role INTO v_role FROM zoi.workspace_members WHERE workspace_id = p_workspace AND profile_id = v_prof;
  IF v_role IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_workspace_member'); END IF;

  SELECT coalesce(json_agg(row_to_json(x.*) ORDER BY x.created_at), '[]'::json) INTO v_rows
  FROM (
    SELECT o.id, o.customer_name, o.total_amount, o.payment_status, o.fulfillment_status,
           o.target_station, o.notes, o.created_at, z.name AS table_name,
           (SELECT coalesce(json_agg(row_to_json(i.*)), '[]'::json)
              FROM public.event_order_items i WHERE i.order_id = o.id) AS items
    FROM public.event_orders o
    JOIN public.venue_tables_zones z ON z.id = o.table_id
    JOIN public.event_venues v ON v.id = z.venue_id
    WHERE v.workspace_id = p_workspace
      AND o.fulfillment_status NOT IN ('delivered','cancelled')
      AND (p_station IS NULL OR o.target_station = p_station)
  ) x;
  RETURN json_build_object('ok', true, 'tickets', v_rows);
END$function$;

CREATE OR REPLACE FUNCTION public.kds_ticket_advance(p_workspace uuid, p_order_id uuid, p_status text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_prof uuid; v_role text; v_owner uuid;
BEGIN
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  SELECT role INTO v_role FROM zoi.workspace_members WHERE workspace_id = p_workspace AND profile_id = v_prof;
  IF v_role IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_workspace_member'); END IF;
  IF p_status NOT IN ('received','preparing','ready','delivered','cancelled') THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  SELECT v.workspace_id INTO v_owner
  FROM public.event_orders o
  JOIN public.venue_tables_zones z ON z.id = o.table_id
  JOIN public.event_venues v ON v.id = z.venue_id
  WHERE o.id = p_order_id;
  IF v_owner IS NULL OR v_owner != p_workspace THEN
    RETURN json_build_object('ok', false, 'error', 'not_your_order');
  END IF;

  UPDATE public.event_orders SET fulfillment_status = p_status, updated_at = now() WHERE id = p_order_id;
  RETURN json_build_object('ok', true);
END$function$;

REVOKE ALL ON FUNCTION public.table_tab_list(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.table_tab_record_cash_payment(uuid,uuid,numeric,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kds_tickets_list(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kds_ticket_advance(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.table_tab_list(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.table_tab_record_cash_payment(uuid,uuid,numeric,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kds_tickets_list(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kds_ticket_advance(uuid,uuid,text) TO authenticated, service_role;

COMMIT;

-- Restrict private service queues and tab summaries to current operational roles.
-- Preserve existing RPC shapes, station filtering and workspace-owned non-event venues.
BEGIN;

CREATE OR REPLACE FUNCTION public.table_tab_list(p_workspace uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_prof uuid; v_role text; v_rows json;
BEGIN
  IF auth.uid() IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  SELECT role INTO v_role FROM zoi.workspace_members WHERE workspace_id = p_workspace AND profile_id = v_prof FOR SHARE;
  IF v_role IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_workspace_member'); END IF;
  IF v_role NOT IN ('owner','admin','editor') THEN RETURN json_build_object('ok', false, 'error', 'insufficient_permission'); END IF;

  SELECT coalesce(json_agg(row_to_json(x.*) ORDER BY x.created_at DESC), '[]'::json) INTO v_rows
  FROM (
    SELECT tt.id, tt.status, tt.total_amount, tt.paid_amount, tt.created_at, tt.updated_at,
           z.name AS table_name,
           (SELECT count(*) FROM public.table_members m WHERE m.tab_id = tt.id) AS member_count
    FROM public.table_tabs tt
    JOIN public.venue_tables_zones z ON z.id = tt.table_id
    JOIN public.event_venues v ON v.id = z.venue_id
    WHERE v.workspace_id = p_workspace
      AND (v.event_id IS NULL OR EXISTS (SELECT 1 FROM zoi.listings e WHERE e.id=v.event_id AND e.owner_workspace_id=p_workspace))
  ) x;
  RETURN json_build_object('ok', true, 'tabs', v_rows);
END$function$;

CREATE OR REPLACE FUNCTION public.kds_tickets_list(p_workspace uuid, p_station text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_prof uuid; v_role text; v_rows json;
BEGIN
  IF auth.uid() IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  SELECT role INTO v_role FROM zoi.workspace_members WHERE workspace_id = p_workspace AND profile_id = v_prof FOR SHARE;
  IF v_role IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_workspace_member'); END IF;
  IF v_role NOT IN ('owner','admin','editor') THEN RETURN json_build_object('ok', false, 'error', 'insufficient_permission'); END IF;

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
      AND (v.event_id IS NULL OR EXISTS (SELECT 1 FROM zoi.listings e WHERE e.id=v.event_id AND e.owner_workspace_id=p_workspace))
      AND o.fulfillment_status NOT IN ('delivered','cancelled')
      AND (p_station IS NULL OR o.target_station = p_station)
  ) x;
  RETURN json_build_object('ok', true, 'tickets', v_rows);
END$function$;

REVOKE ALL ON FUNCTION public.table_tab_list(uuid), public.kds_tickets_list(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.table_tab_list(uuid), public.kds_tickets_list(uuid,text) TO authenticated, service_role;
COMMIT;

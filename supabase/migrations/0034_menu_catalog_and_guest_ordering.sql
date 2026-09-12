-- Migration 0034: real menu catalog, staff-priced only. This is the missing
-- piece flagged in 0033: guest self-ordering needs a menu to order FROM, with
-- prices set by the workspace that owns the venue -- never by the guest.

BEGIN;

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references zoi.workspaces(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'CAD',
  station text not null default 'kitchen', -- 'kitchen', 'bar', 'merch'
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists menu_items_workspace_idx on public.menu_items(workspace_id);

alter table public.menu_items enable row level security;
revoke all on public.menu_items from anon, authenticated;

-- ---------- staff: manage the menu ----------
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
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  SELECT role INTO v_role FROM zoi.workspace_members WHERE workspace_id = p_workspace AND profile_id = v_prof;
  IF v_role IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_workspace_member'); END IF;
  IF coalesce(trim(p_name), '') = '' OR p_price_cents IS NULL OR p_price_cents < 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_item');
  END IF;

  IF p_item_id IS NOT NULL THEN
    SELECT workspace_id INTO v_owner FROM public.menu_items WHERE id = p_item_id;
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

-- ---------- public: read a venue's menu (guests need this to order) ----------
CREATE OR REPLACE FUNCTION public.menu_items_list(p_workspace uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_rows json;
BEGIN
  SELECT coalesce(json_agg(row_to_json(m.*) ORDER BY m.sort_order, m.name), '[]'::json) INTO v_rows
  FROM (
    SELECT id, name, description, price_cents, currency, station
    FROM public.menu_items WHERE workspace_id = p_workspace AND is_available = true
  ) m;
  RETURN json_build_object('ok', true, 'items', v_rows);
END$function$;

-- ---------- guest: order real menu items onto their table's tab ----------
-- Price is looked up from menu_items server-side -- the guest only ever
-- chooses item_id + quantity, never a price.
CREATE OR REPLACE FUNCTION public.table_tab_guest_order(
  p_qr_slug text, p_guest_name text, p_items jsonb -- [{"menu_item_id":"...","quantity":2}]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_table_id uuid; v_venue_id uuid; v_workspace uuid; v_tab_id uuid; v_member_id uuid;
        v_order_id uuid; v_total numeric := 0; it jsonb; v_item public.menu_items%ROWTYPE; v_qty integer;
BEGIN
  IF coalesce(trim(p_guest_name), '') = '' THEN RETURN json_build_object('ok', false, 'error', 'guest_name_required'); END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RETURN json_build_object('ok', false, 'error', 'no_items'); END IF;

  SELECT id, venue_id INTO v_table_id, v_venue_id FROM public.venue_tables_zones WHERE qr_slug = p_qr_slug;
  IF v_table_id IS NULL THEN RETURN json_build_object('ok', false, 'error', 'table_not_found'); END IF;
  SELECT workspace_id INTO v_workspace FROM public.event_venues WHERE id = v_venue_id;
  IF v_workspace IS NULL THEN RETURN json_build_object('ok', false, 'error', 'venue_not_found'); END IF;

  SELECT id INTO v_tab_id FROM public.table_tabs WHERE table_id = v_table_id AND status = 'open' ORDER BY created_at DESC LIMIT 1;
  IF v_tab_id IS NULL THEN
    INSERT INTO public.table_tabs(table_id, status) VALUES (v_table_id, 'open') RETURNING id INTO v_tab_id;
  END IF;
  INSERT INTO public.table_members(tab_id, guest_name) VALUES (v_tab_id, trim(p_guest_name)) RETURNING id INTO v_member_id;

  INSERT INTO public.event_orders(tab_id, table_id, member_id, customer_name, total_amount, payment_status, fulfillment_status, target_station)
  VALUES (v_tab_id, v_table_id, v_member_id, trim(p_guest_name), 0, 'tab', 'received', 'kitchen')
  RETURNING id INTO v_order_id;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_item FROM public.menu_items WHERE id = (it->>'menu_item_id')::uuid AND workspace_id = v_workspace AND is_available = true;
    IF v_item.id IS NULL THEN CONTINUE; END IF;
    v_qty := greatest(1, coalesce((it->>'quantity')::integer, 1));
    INSERT INTO public.event_order_items(order_id, item_name, quantity, unit_price)
    VALUES (v_order_id, v_item.name, v_qty, v_item.price_cents / 100.0);
    v_total := v_total + (v_item.price_cents / 100.0) * v_qty;
    UPDATE public.event_orders SET target_station = v_item.station WHERE id = v_order_id AND target_station = 'kitchen';
  END LOOP;

  IF v_total = 0 THEN
    DELETE FROM public.event_orders WHERE id = v_order_id;
    DELETE FROM public.table_members WHERE id = v_member_id;
    RETURN json_build_object('ok', false, 'error', 'no_valid_items');
  END IF;

  UPDATE public.event_orders SET total_amount = v_total WHERE id = v_order_id;
  UPDATE public.table_tabs SET total_amount = total_amount + v_total, updated_at = now() WHERE id = v_tab_id;

  RETURN json_build_object('ok', true, 'order_id', v_order_id, 'tab_id', v_tab_id, 'total', v_total);
END$function$;

REVOKE ALL ON FUNCTION public.menu_item_save(uuid,uuid,text,text,integer,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.menu_item_save(uuid,uuid,text,text,integer,text,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.menu_items_list(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.table_tab_guest_order(text,text,jsonb) TO anon, authenticated, service_role;

COMMIT;

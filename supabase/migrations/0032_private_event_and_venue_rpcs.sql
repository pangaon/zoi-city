-- Migration 0032: SECURITY DEFINER RPC layer for private events/RSVPs and
-- venue floor plans, following the exact auth pattern already established by
-- zoi_create_workspace / zoi_claim_entity (profile via zoi.ensure_profile(),
-- membership via zoi.workspace_members, SET search_path TO '' with every
-- object fully qualified). These are the ONLY sanctioned way to touch the
-- tables locked down in 0030 — the tables themselves stay REVOKEd from
-- anon/authenticated.
--
-- Guest-facing RPCs (get-by-pin, rsvp-submit) are intentionally callable by
-- anon: wedding guests do not have Zoi accounts. They only ever accept an
-- access_pin, never a workspace_id or row id, and only ever return/write the
-- one row that pin unlocks.

BEGIN;

-- ---------- host: create a private event ----------
CREATE OR REPLACE FUNCTION public.private_event_create(
  p_workspace uuid, p_event_type text, p_title text, p_hosts text,
  p_event_date date, p_reception_venue text, p_reception_time time,
  p_ceremony_venue text DEFAULT NULL, p_ceremony_time time DEFAULT NULL,
  p_parish_priest text DEFAULT NULL, p_koumbaros_godparent text DEFAULT NULL,
  p_story_text text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_prof uuid; v_role text; v_id uuid; v_pin text;
BEGIN
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;

  SELECT role INTO v_role FROM zoi.workspace_members WHERE workspace_id = p_workspace AND profile_id = v_prof;
  IF v_role IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_workspace_member'); END IF;

  INSERT INTO public.private_events(
    workspace_id, event_type, title, hosts, event_date,
    ceremony_venue, ceremony_time, reception_venue, reception_time,
    parish_priest, koumbaros_godparent, story_text
  ) VALUES (
    p_workspace, coalesce(p_event_type,'wedding'), p_title, p_hosts, p_event_date,
    p_ceremony_venue, p_ceremony_time, p_reception_venue, p_reception_time,
    p_parish_priest, p_koumbaros_godparent, p_story_text
  ) RETURNING id, access_pin INTO v_id, v_pin;

  RETURN json_build_object('ok', true, 'id', v_id, 'access_pin', v_pin);
END$function$;

-- ---------- host: list my own private events ----------
CREATE OR REPLACE FUNCTION public.private_event_list(p_workspace uuid)
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

  SELECT coalesce(json_agg(row_to_json(e.*) ORDER BY e.event_date), '[]'::json) INTO v_rows
  FROM (
    SELECT id, event_type, title, hosts, event_date, reception_venue, reception_time,
           access_pin, is_private, registry_enabled, photo_wall_enabled, created_at
    FROM public.private_events WHERE workspace_id = p_workspace
  ) e;
  RETURN json_build_object('ok', true, 'events', v_rows);
END$function$;

-- ---------- guest: read event info by access pin (no auth) ----------
CREATE OR REPLACE FUNCTION public.private_event_get_by_pin(p_pin text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_ev public.private_events%ROWTYPE; v_registry json;
BEGIN
  SELECT * INTO v_ev FROM public.private_events WHERE access_pin = upper(coalesce(p_pin,'')) LIMIT 1;
  IF v_ev.id IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_found'); END IF;

  SELECT coalesce(json_agg(row_to_json(r.*)), '[]'::json) INTO v_registry
  FROM (
    SELECT id, title, category, target_amount, collected_amount, description
    FROM public.private_registry_items WHERE private_event_id = v_ev.id
  ) r;

  RETURN json_build_object('ok', true, 'event', json_build_object(
    'id', v_ev.id, 'event_type', v_ev.event_type, 'title', v_ev.title, 'hosts', v_ev.hosts,
    'event_date', v_ev.event_date, 'ceremony_venue', v_ev.ceremony_venue, 'ceremony_time', v_ev.ceremony_time,
    'reception_venue', v_ev.reception_venue, 'reception_time', v_ev.reception_time,
    'parish_priest', v_ev.parish_priest, 'koumbaros_godparent', v_ev.koumbaros_godparent,
    'story_text', v_ev.story_text, 'registry_enabled', v_ev.registry_enabled,
    'photo_wall_enabled', v_ev.photo_wall_enabled
  ), 'registry', v_registry);
END$function$;

-- ---------- guest: submit an RSVP by access pin (no auth) ----------
CREATE OR REPLACE FUNCTION public.private_event_rsvp_submit(
  p_pin text, p_guest_name text, p_party_size integer DEFAULT 1,
  p_attending_ceremony boolean DEFAULT true, p_attending_reception boolean DEFAULT true,
  p_email text DEFAULT NULL, p_phone text DEFAULT NULL,
  p_meal_choices jsonb DEFAULT '[]'::jsonb, p_dietary_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_event_id uuid; v_id uuid;
BEGIN
  IF coalesce(trim(p_guest_name), '') = '' THEN
    RETURN json_build_object('ok', false, 'error', 'guest_name_required');
  END IF;
  SELECT id INTO v_event_id FROM public.private_events WHERE access_pin = upper(coalesce(p_pin,'')) LIMIT 1;
  IF v_event_id IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_found'); END IF;

  INSERT INTO public.private_rsvps(
    private_event_id, guest_name, email, phone, party_size,
    attending_ceremony, attending_reception, meal_choices, dietary_notes
  ) VALUES (
    v_event_id, trim(p_guest_name), p_email, p_phone, greatest(1, coalesce(p_party_size,1)),
    p_attending_ceremony, p_attending_reception, coalesce(p_meal_choices,'[]'::jsonb), p_dietary_notes
  ) RETURNING id INTO v_id;

  RETURN json_build_object('ok', true, 'id', v_id);
END$function$;

-- ---------- host: list RSVPs for one of my events ----------
CREATE OR REPLACE FUNCTION public.private_event_rsvps_list(p_workspace uuid, p_event_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_prof uuid; v_role text; v_owner uuid; v_rows json;
BEGIN
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  SELECT role INTO v_role FROM zoi.workspace_members WHERE workspace_id = p_workspace AND profile_id = v_prof;
  IF v_role IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_workspace_member'); END IF;

  SELECT workspace_id INTO v_owner FROM public.private_events WHERE id = p_event_id;
  IF v_owner IS NULL OR v_owner != p_workspace THEN
    RETURN json_build_object('ok', false, 'error', 'not_your_event');
  END IF;

  SELECT coalesce(json_agg(row_to_json(r.*) ORDER BY r.created_at DESC), '[]'::json) INTO v_rows
  FROM (SELECT * FROM public.private_rsvps WHERE private_event_id = p_event_id) r;
  RETURN json_build_object('ok', true, 'rsvps', v_rows);
END$function$;

-- ---------- host: save a venue floor plan (upsert) ----------
CREATE OR REPLACE FUNCTION public.venue_layout_save(
  p_workspace uuid, p_venue_id uuid DEFAULT NULL, p_name text DEFAULT 'Untitled venue',
  p_dimensions_w numeric DEFAULT 30.0, p_dimensions_d numeric DEFAULT 20.0,
  p_scale_meters_per_px numeric DEFAULT 0.05, p_blueprint_url text DEFAULT NULL,
  p_tables jsonb DEFAULT '[]'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_prof uuid; v_role text; v_venue_id uuid; v_owner uuid; t jsonb;
BEGIN
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  SELECT role INTO v_role FROM zoi.workspace_members WHERE workspace_id = p_workspace AND profile_id = v_prof;
  IF v_role IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_workspace_member'); END IF;

  IF p_venue_id IS NOT NULL THEN
    SELECT workspace_id INTO v_owner FROM public.event_venues WHERE id = p_venue_id;
    IF v_owner IS NULL OR v_owner != p_workspace THEN
      RETURN json_build_object('ok', false, 'error', 'not_your_venue');
    END IF;
    UPDATE public.event_venues
      SET name = p_name, dimensions_w = p_dimensions_w, dimensions_d = p_dimensions_d,
          scale_meters_per_px = p_scale_meters_per_px, blueprint_url = coalesce(p_blueprint_url, blueprint_url)
      WHERE id = p_venue_id;
    v_venue_id := p_venue_id;
    DELETE FROM public.venue_tables_zones WHERE venue_id = v_venue_id;
  ELSE
    INSERT INTO public.event_venues(workspace_id, name, dimensions_w, dimensions_d, scale_meters_per_px, blueprint_url)
    VALUES (p_workspace, p_name, p_dimensions_w, p_dimensions_d, p_scale_meters_per_px, p_blueprint_url)
    RETURNING id INTO v_venue_id;
  END IF;

  FOR t IN SELECT * FROM jsonb_array_elements(coalesce(p_tables, '[]'::jsonb))
  LOOP
    INSERT INTO public.venue_tables_zones(
      venue_id, name, zone_type, capacity, pos_x, pos_y, pos_z, shape,
      sponsor_name, sponsor_logo_url, sponsor_tier, sponsor_pledge_amount
    ) VALUES (
      v_venue_id,
      coalesce(t->>'name', 'Table'),
      coalesce(t->>'zone_type', 'table_round'),
      coalesce((t->>'capacity')::integer, 10),
      coalesce((t->>'pos_x')::numeric, 0),
      coalesce((t->>'pos_y')::numeric, 0),
      coalesce((t->>'pos_z')::numeric, 0),
      coalesce(t->>'shape', 'round'),
      t->>'sponsor_name', t->>'sponsor_logo_url', t->>'sponsor_tier',
      coalesce((t->>'sponsor_pledge_amount')::numeric, 0)
    );
  END LOOP;

  RETURN json_build_object('ok', true, 'venue_id', v_venue_id);
END$function$;

-- ---------- host: load a venue floor plan ----------
CREATE OR REPLACE FUNCTION public.venue_layout_get(p_workspace uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_prof uuid; v_role text; v_venue public.event_venues%ROWTYPE; v_tables json;
BEGIN
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  SELECT role INTO v_role FROM zoi.workspace_members WHERE workspace_id = p_workspace AND profile_id = v_prof;
  IF v_role IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_workspace_member'); END IF;

  SELECT * INTO v_venue FROM public.event_venues WHERE workspace_id = p_workspace ORDER BY created_at DESC LIMIT 1;
  IF v_venue.id IS NULL THEN RETURN json_build_object('ok', true, 'venue', null, 'tables', '[]'::json); END IF;

  SELECT coalesce(json_agg(row_to_json(z.*)), '[]'::json) INTO v_tables
  FROM (SELECT * FROM public.venue_tables_zones WHERE venue_id = v_venue.id) z;

  RETURN json_build_object('ok', true, 'venue', row_to_json(v_venue), 'tables', v_tables);
END$function$;

REVOKE ALL ON FUNCTION public.private_event_create(uuid,text,text,text,date,text,time,text,time,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.private_event_list(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.private_event_rsvps_list(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.venue_layout_save(uuid,uuid,text,numeric,numeric,numeric,text,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.venue_layout_get(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.private_event_create(uuid,text,text,text,date,text,time,text,time,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.private_event_list(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.private_event_rsvps_list(uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.venue_layout_save(uuid,uuid,text,numeric,numeric,numeric,text,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.venue_layout_get(uuid) TO authenticated, service_role;

-- Guest-facing: callable signed-out. Only ever touches the one row a pin unlocks.
GRANT EXECUTE ON FUNCTION public.private_event_get_by_pin(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.private_event_rsvp_submit(text,text,integer,boolean,boolean,text,text,jsonb,text) TO anon, authenticated, service_role;

COMMIT;

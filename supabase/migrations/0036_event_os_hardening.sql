BEGIN;

DELETE FROM public.event_floor_plans older
WHERE EXISTS (
  SELECT 1 FROM public.event_floor_plans newer
  WHERE newer.event_id = older.event_id
    AND (newer.updated_at, newer.created_at, newer.id) > (older.updated_at, older.created_at, older.id)
);

CREATE UNIQUE INDEX IF NOT EXISTS event_floor_plans_one_per_event_idx
  ON public.event_floor_plans(event_id);

CREATE OR REPLACE FUNCTION public.event_list(p_workspace uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_prof uuid; v_rows json;
BEGIN
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  IF NOT EXISTS (SELECT 1 FROM zoi.workspace_members WHERE workspace_id = p_workspace AND profile_id = v_prof) THEN
    RETURN json_build_object('ok', false, 'error', 'not_a_workspace_member');
  END IF;
  SELECT COALESCE(json_agg(row_to_json(e) ORDER BY e.start_date DESC), '[]'::json) INTO v_rows
  FROM (
    SELECT id, slug, name, mode, capacity, start_date, end_date, is_public, brand_accent, created_at
    FROM public.events WHERE workspace_id = p_workspace
  ) e;
  RETURN json_build_object('ok', true, 'events', v_rows);
END$function$;

CREATE OR REPLACE FUNCTION public.event_create(
  p_workspace uuid, p_name text, p_mode text DEFAULT 'concert',
  p_capacity integer DEFAULT 100, p_start_date timestamptz DEFAULT now()
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_prof uuid; v_role text; v_id uuid; v_slug text;
BEGIN
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  SELECT role INTO v_role FROM zoi.workspace_members WHERE workspace_id = p_workspace AND profile_id = v_prof;
  IF v_role NOT IN ('owner', 'admin', 'operator') THEN RETURN json_build_object('ok', false, 'error', 'insufficient_permission'); END IF;
  IF nullif(trim(p_name), '') IS NULL OR p_capacity < 1 OR p_capacity > 100000
     OR p_mode NOT IN ('concert', 'banquet', 'gala', 'festival', 'church') THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_event');
  END IF;
  v_slug := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'))
    || '-' || to_char(p_start_date, 'YYYYMMDD') || '-' || substring(encode(gen_random_bytes(3), 'hex'), 1, 6);
  INSERT INTO public.events(workspace_id, name, mode, capacity, start_date, slug)
    VALUES (p_workspace, trim(p_name), p_mode, p_capacity, p_start_date, v_slug) RETURNING id INTO v_id;
  RETURN json_build_object('ok', true, 'id', v_id, 'slug', v_slug);
END$function$;

CREATE OR REPLACE FUNCTION public.event_get(p_event_id uuid, p_workspace uuid DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_prof uuid; v_event record;
BEGIN
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  IF p_workspace IS NULL OR NOT EXISTS (SELECT 1 FROM zoi.workspace_members WHERE workspace_id = p_workspace AND profile_id = v_prof) THEN
    RETURN json_build_object('ok', false, 'error', 'not_a_workspace_member');
  END IF;
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id AND workspace_id = p_workspace;
  IF v_event IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_found'); END IF;
  RETURN json_build_object('ok', true, 'event', row_to_json(v_event));
END$function$;

CREATE OR REPLACE FUNCTION public.event_update(
  p_event_id uuid, p_workspace uuid, p_name text DEFAULT NULL,
  p_mode text DEFAULT NULL, p_capacity integer DEFAULT NULL, p_start_date timestamptz DEFAULT NULL,
  p_brand_accent text DEFAULT NULL, p_brand_name text DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_prof uuid; v_role text;
BEGIN
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  SELECT role INTO v_role FROM zoi.workspace_members WHERE workspace_id = p_workspace AND profile_id = v_prof;
  IF v_role NOT IN ('owner', 'admin', 'operator') THEN RETURN json_build_object('ok', false, 'error', 'insufficient_permission'); END IF;
  IF p_name IS NOT NULL AND nullif(trim(p_name), '') IS NULL THEN RETURN json_build_object('ok', false, 'error', 'invalid_event'); END IF;
  IF p_capacity IS NOT NULL AND (p_capacity < 1 OR p_capacity > 100000) THEN RETURN json_build_object('ok', false, 'error', 'invalid_event'); END IF;
  IF p_mode IS NOT NULL AND p_mode NOT IN ('concert', 'banquet', 'gala', 'festival', 'church') THEN RETURN json_build_object('ok', false, 'error', 'invalid_event'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id AND workspace_id = p_workspace) THEN RETURN json_build_object('ok', false, 'error', 'not_your_event'); END IF;
  UPDATE public.events SET name = COALESCE(trim(p_name), name), mode = COALESCE(p_mode, mode),
    capacity = COALESCE(p_capacity, capacity), start_date = COALESCE(p_start_date, start_date),
    brand_accent = COALESCE(p_brand_accent, brand_accent), brand_name = COALESCE(p_brand_name, brand_name), updated_at = now()
    WHERE id = p_event_id;
  RETURN json_build_object('ok', true, 'id', p_event_id);
END$function$;

CREATE OR REPLACE FUNCTION public.event_publish(p_event_id uuid, p_workspace uuid, p_publish boolean)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_prof uuid; v_role text;
BEGIN
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  SELECT role INTO v_role FROM zoi.workspace_members WHERE workspace_id = p_workspace AND profile_id = v_prof;
  IF v_role NOT IN ('owner', 'admin', 'operator') THEN RETURN json_build_object('ok', false, 'error', 'insufficient_permission'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id AND workspace_id = p_workspace) THEN RETURN json_build_object('ok', false, 'error', 'not_your_event'); END IF;
  UPDATE public.events SET is_public = p_publish, published_at = CASE WHEN p_publish THEN COALESCE(published_at, now()) ELSE NULL END, updated_at = now() WHERE id = p_event_id;
  RETURN json_build_object('ok', true, 'is_public', p_publish);
END$function$;

CREATE OR REPLACE FUNCTION public.event_public_get(p_slug text)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $function$
  SELECT COALESCE((SELECT json_build_object(
    'ok', true, 'event', json_build_object('slug', e.slug, 'name', e.name, 'mode', e.mode,
      'capacity', e.capacity, 'start_date', e.start_date, 'end_date', e.end_date,
      'description', e.description, 'brand_accent', e.brand_accent, 'brand_name', e.brand_name,
      'brand_logo_url', e.brand_logo_url, 'published_at', e.published_at)
    ) FROM public.events e WHERE e.slug = lower(trim(p_slug)) AND e.is_public = true),
    json_build_object('ok', false, 'error', 'not_found'));
$function$;

CREATE OR REPLACE FUNCTION public.floor_plan_save(p_event_id uuid, p_workspace uuid, p_layout_json jsonb)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_prof uuid; v_role text; v_plan_id uuid;
BEGIN
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  SELECT role INTO v_role FROM zoi.workspace_members WHERE workspace_id = p_workspace AND profile_id = v_prof;
  IF v_role NOT IN ('owner', 'admin', 'operator', 'floor_manager') THEN RETURN json_build_object('ok', false, 'error', 'insufficient_permission'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id AND workspace_id = p_workspace) THEN
    RETURN json_build_object('ok', false, 'error', 'not_your_event');
  END IF;
  INSERT INTO public.event_floor_plans(event_id, layout_json, updated_at)
  VALUES (p_event_id, p_layout_json, now())
  ON CONFLICT (event_id) DO UPDATE SET layout_json = EXCLUDED.layout_json, updated_at = now()
  RETURNING id INTO v_plan_id;
  RETURN json_build_object('ok', true, 'plan_id', v_plan_id);
END$function$;

DROP FUNCTION IF EXISTS public.floor_plan_get(uuid);

CREATE OR REPLACE FUNCTION public.floor_plan_get(p_event_id uuid, p_workspace uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_prof uuid; v_plan record;
BEGIN
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  IF NOT EXISTS (SELECT 1 FROM zoi.workspace_members wm JOIN public.events e ON e.workspace_id = wm.workspace_id
                 WHERE wm.workspace_id = p_workspace AND wm.profile_id = v_prof AND e.id = p_event_id) THEN
    RETURN json_build_object('ok', false, 'error', 'not_authorized');
  END IF;
  SELECT * INTO v_plan FROM public.event_floor_plans WHERE event_id = p_event_id;
  RETURN json_build_object('ok', true, 'plan', CASE WHEN v_plan IS NULL THEN NULL ELSE row_to_json(v_plan) END);
END$function$;

CREATE OR REPLACE FUNCTION public.event_team_members_list(p_event_id uuid, p_workspace uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_prof uuid; v_rows json;
BEGIN
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  IF NOT EXISTS (SELECT 1 FROM zoi.workspace_members wm JOIN public.events e ON e.workspace_id = wm.workspace_id
                 WHERE wm.workspace_id = p_workspace AND wm.profile_id = v_prof AND e.id = p_event_id) THEN
    RETURN json_build_object('ok', false, 'error', 'not_authorized');
  END IF;
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.created_at), '[]'::json) INTO v_rows
  FROM (SELECT id, role, name, email, invited_at, accepted_at, created_at FROM public.event_team_members WHERE event_id = p_event_id) t;
  RETURN json_build_object('ok', true, 'members', v_rows);
END$function$;

CREATE OR REPLACE FUNCTION public.event_team_member_invite(p_event_id uuid, p_workspace uuid, p_name text, p_email text, p_role text DEFAULT 'staff')
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_prof uuid; v_role text; v_id uuid;
BEGIN
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  SELECT wm.role INTO v_role FROM zoi.workspace_members wm JOIN public.events e ON e.workspace_id = wm.workspace_id
    WHERE wm.workspace_id = p_workspace AND wm.profile_id = v_prof AND e.id = p_event_id;
  IF v_role NOT IN ('owner', 'admin', 'operator') THEN RETURN json_build_object('ok', false, 'error', 'insufficient_permission'); END IF;
  IF nullif(trim(p_name), '') IS NULL OR nullif(trim(p_email), '') IS NULL OR p_role NOT IN ('manager', 'box_office', 'door', 'floor_manager', 'staff') THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_team_member');
  END IF;
  INSERT INTO public.event_team_members(event_id, name, email, role) VALUES (p_event_id, trim(p_name), lower(trim(p_email)), p_role) RETURNING id INTO v_id;
  RETURN json_build_object('ok', true, 'id', v_id);
END$function$;

GRANT EXECUTE ON FUNCTION public.floor_plan_get(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.floor_plan_get(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.floor_plan_get(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.event_publish(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_publish(uuid, uuid, boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.event_public_get(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_public_get(text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.event_team_members_list(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_team_members_list(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.event_team_member_invite(uuid, uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_team_member_invite(uuid, uuid, text, text, text) TO authenticated, service_role;

COMMIT;
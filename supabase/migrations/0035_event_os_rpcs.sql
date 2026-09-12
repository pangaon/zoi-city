-- Migration 0035: Event OS — full event management with floor plans, team, and real data

BEGIN;

-- ========== TABLES ==========
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references zoi.workspaces(id) on delete cascade,
  name text not null,
  slug text not null, -- for public URL /e/:slug
  mode text not null default 'concert', -- 'concert', 'gala', 'market', 'wedding_reception', 'conference', 'festival'
  capacity integer not null default 100,
  start_date timestamptz not null,
  end_date timestamptz,
  description text,
  is_public boolean not null default false,
  brand_accent text default 'gold', -- color token from design system
  brand_name text, -- white-label event name override
  brand_logo_url text,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists events_workspace_idx on public.events(workspace_id);
create index if not exists events_slug_idx on public.events(slug);
alter table public.events enable row level security;
revoke all on public.events from anon, authenticated;

create table if not exists public.event_floor_plans (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null default 'Main floor',
  layout_json jsonb not null default '{"venueW":1200,"venueH":800,"els":[]}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists event_floor_plans_event_idx on public.event_floor_plans(event_id);
alter table public.event_floor_plans enable row level security;
revoke all on public.event_floor_plans from anon, authenticated;

create table if not exists public.event_team_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  workspace_member_id uuid references zoi.workspace_members(id) on delete set null,
  role text not null default 'staff', -- 'owner', 'manager', 'box_office', 'door', 'floor_manager', 'staff'
  name text not null,
  email text,
  invited_at timestamptz default now(),
  accepted_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists event_team_members_event_idx on public.event_team_members(event_id);
alter table public.event_team_members enable row level security;
revoke all on public.event_team_members from anon, authenticated;

-- ========== RPC: Create event (workspace staff only) ==========
CREATE OR REPLACE FUNCTION public.event_create(
  p_workspace uuid, p_name text, p_mode text DEFAULT 'concert',
  p_capacity integer DEFAULT 100, p_start_date timestamptz DEFAULT now()
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_prof uuid; v_role text; v_id uuid; v_slug text;
BEGIN
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  
  SELECT role INTO v_role FROM zoi.workspace_members WHERE workspace_id = p_workspace AND profile_id = v_prof;
  IF v_role NOT IN ('owner', 'admin', 'operator') THEN 
    RETURN json_build_object('ok', false, 'error', 'insufficient_permission'); 
  END IF;
  
  IF coalesce(trim(p_name), '') = '' OR p_capacity < 1 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_event');
  END IF;
  
  v_slug := lower(trim(p_name)) || '-' || to_char(p_start_date, 'YYYYMMDD') || '-' || 
            substring(encode(gen_random_bytes(3), 'hex'), 1, 6);
  
  INSERT INTO public.events(workspace_id, name, mode, capacity, start_date, slug)
  VALUES (p_workspace, p_name, p_mode, p_capacity, p_start_date, v_slug)
  RETURNING id INTO v_id;
  
  RETURN json_build_object('ok', true, 'id', v_id, 'slug', v_slug);
END$function$;

-- ========== RPC: List events for workspace ==========
CREATE OR REPLACE FUNCTION public.event_list(p_workspace uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_prof uuid; v_rows json;
BEGIN
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  
  SELECT COALESCE(json_agg(row_to_json(e.* ORDER BY e.start_date DESC)), '[]'::json) INTO v_rows
  FROM (
    SELECT e.id, e.slug, e.name, e.mode, e.capacity, e.start_date, e.end_date, 
           e.is_public, e.brand_accent, e.created_at
    FROM public.events e
    WHERE e.workspace_id = p_workspace
    ORDER BY e.start_date DESC
  ) e;
  
  RETURN json_build_object('ok', true, 'events', v_rows);
END$function$;

-- ========== RPC: Get single event ==========
CREATE OR REPLACE FUNCTION public.event_get(p_event_id uuid, p_workspace uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_event record;
BEGIN
  SELECT * INTO v_event FROM public.events e 
  WHERE e.id = p_event_id AND (p_workspace IS NULL OR e.workspace_id = p_workspace);
  
  IF v_event IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_found');
  END IF;
  
  RETURN json_build_object('ok', true, 'event', row_to_json(v_event));
END$function$;

-- ========== RPC: Update event ==========
CREATE OR REPLACE FUNCTION public.event_update(
  p_event_id uuid, p_workspace uuid, p_name text DEFAULT NULL,
  p_mode text DEFAULT NULL, p_capacity integer DEFAULT NULL, p_start_date timestamptz DEFAULT NULL,
  p_brand_accent text DEFAULT NULL, p_brand_name text DEFAULT NULL
)
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
  IF v_role NOT IN ('owner', 'admin', 'operator') THEN 
    RETURN json_build_object('ok', false, 'error', 'insufficient_permission'); 
  END IF;
  
  SELECT workspace_id INTO v_owner FROM public.events WHERE id = p_event_id;
  IF v_owner IS NULL OR v_owner != p_workspace THEN 
    RETURN json_build_object('ok', false, 'error', 'not_your_event'); 
  END IF;
  
  UPDATE public.events SET
    name = COALESCE(p_name, name),
    mode = COALESCE(p_mode, mode),
    capacity = COALESCE(p_capacity, capacity),
    start_date = COALESCE(p_start_date, start_date),
    brand_accent = COALESCE(p_brand_accent, brand_accent),
    brand_name = COALESCE(p_brand_name, brand_name),
    updated_at = now()
  WHERE id = p_event_id;
  
  RETURN json_build_object('ok', true, 'id', p_event_id);
END$function$;

-- ========== RPC: Save floor plan ==========
CREATE OR REPLACE FUNCTION public.floor_plan_save(
  p_event_id uuid, p_workspace uuid, p_layout_json jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_prof uuid; v_role text; v_owner uuid; v_plan_id uuid;
BEGIN
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  
  SELECT role INTO v_role FROM zoi.workspace_members WHERE workspace_id = p_workspace AND profile_id = v_prof;
  IF v_role NOT IN ('owner', 'admin', 'operator', 'floor_manager') THEN 
    RETURN json_build_object('ok', false, 'error', 'insufficient_permission'); 
  END IF;
  
  SELECT workspace_id INTO v_owner FROM public.events WHERE id = p_event_id;
  IF v_owner IS NULL OR v_owner != p_workspace THEN 
    RETURN json_build_object('ok', false, 'error', 'not_your_event'); 
  END IF;
  
  INSERT INTO public.event_floor_plans(event_id, layout_json)
  VALUES (p_event_id, p_layout_json)
  ON CONFLICT (id) DO UPDATE SET layout_json = p_layout_json, updated_at = now()
  RETURNING id INTO v_plan_id;
  
  RETURN json_build_object('ok', true, 'plan_id', v_plan_id);
END$function$;

-- ========== RPC: Get floor plan ==========
CREATE OR REPLACE FUNCTION public.floor_plan_get(p_event_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_plan record;
BEGIN
  SELECT * INTO v_plan FROM public.event_floor_plans WHERE event_id = p_event_id
  ORDER BY created_at DESC LIMIT 1;
  
  IF v_plan IS NULL THEN
    RETURN json_build_object('ok', true, 'plan', NULL);
  END IF;
  
  RETURN json_build_object('ok', true, 'plan', row_to_json(v_plan));
END$function$;

-- ========== GRANTS ==========
REVOKE ALL ON FUNCTION public.event_create(uuid,text,text,integer,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_create(uuid,text,text,integer,timestamptz) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.event_list(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_list(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.event_get(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_get(uuid,uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.event_update(uuid,uuid,text,text,integer,timestamptz,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_update(uuid,uuid,text,text,integer,timestamptz,text,text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.floor_plan_save(uuid,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.floor_plan_save(uuid,uuid,jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.floor_plan_get(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.floor_plan_get(uuid) TO authenticated, service_role;

COMMIT;

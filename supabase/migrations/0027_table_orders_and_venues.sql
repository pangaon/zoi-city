-- Migration 0027: Event venues, 3D sponsor tables, live group tabs, split-bill, cash collection & KDS orders

create table if not exists public.event_venues (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  name text not null,
  blueprint_url text,
  scale_meters_per_px numeric default 0.05,
  dimensions_w numeric default 30.0,
  dimensions_d numeric default 20.0,
  created_at timestamptz default now()
);

create table if not exists public.venue_tables_zones (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.event_venues(id) on delete cascade,
  name text not null,
  zone_type text not null default 'table_round',
  capacity integer not null default 10,
  pos_x numeric not null default 0,
  pos_y numeric not null default 0,
  pos_z numeric default 0,
  shape text default 'round',
  sponsor_name text,
  sponsor_logo_url text,
  sponsor_tier text,
  sponsor_pledge_amount numeric default 0,
  qr_slug text unique not null default encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz default now()
);

create table if not exists public.table_tabs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  table_id uuid references public.venue_tables_zones(id),
  status text not null default 'open',
  total_amount numeric default 0,
  paid_amount numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.table_members (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid references public.table_tabs(id) on delete cascade,
  user_id uuid references auth.users(id),
  guest_name text not null,
  avatar_url text,
  is_host boolean default false,
  joined_at timestamptz default now()
);

create table if not exists public.event_orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  tab_id uuid references public.table_tabs(id) on delete set null,
  table_id uuid references public.venue_tables_zones(id),
  member_id uuid references public.table_members(id),
  customer_name text not null,
  customer_phone text,
  total_amount numeric not null default 0,
  payment_status text not null default 'paid', -- 'paid', 'cash_pending', 'tab'
  fulfillment_status text not null default 'received', -- 'received', 'preparing', 'ready', 'delivered', 'cancelled'
  target_station text not null default 'kitchen', -- 'kitchen', 'bar', 'merch'
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.event_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.event_orders(id) on delete cascade,
  item_name text not null,
  quantity integer not null default 1,
  unit_price numeric not null default 0,
  special_instructions text,
  created_at timestamptz default now()
);

create table if not exists public.tab_payments (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid references public.table_tabs(id) on delete cascade,
  member_id uuid references public.table_members(id),
  amount numeric not null,
  payment_method text not null default 'card', -- 'apple_pay', 'card', 'cash'
  payment_status text not null default 'completed', -- 'pending_cash', 'completed'
  collected_by_staff_id uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Realtime publication for orders and tabs
alter publication supabase_realtime add table public.table_tabs;
alter publication supabase_realtime add table public.table_members;
alter publication supabase_realtime add table public.event_orders;
alter publication supabase_realtime add table public.tab_payments;

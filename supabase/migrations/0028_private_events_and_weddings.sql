-- Migration 0028: Private events, weddings, baptisms, RSVPs, digital envelopes & photo walls

create table if not exists public.private_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null default 'wedding', -- 'wedding', 'baptism', 'memorial', 'engagement', 'private_gala'
  title text not null,
  hosts text not null, -- e.g. "Dimitris & Maria" or "George & Eleni"
  event_date date not null,
  ceremony_venue text,
  ceremony_time time,
  reception_venue text not null,
  reception_time time not null,
  access_pin text not null default upper(substring(encode(gen_random_bytes(3), 'hex') from 1 for 6)),
  is_private boolean not null default true,
  registry_enabled boolean not null default true,
  photo_wall_enabled boolean not null default true,
  parish_priest text,
  koumbaros_godparent text,
  story_text text,
  created_at timestamptz default now()
);

create table if not exists public.private_rsvps (
  id uuid primary key default gen_random_uuid(),
  private_event_id uuid references public.private_events(id) on delete cascade,
  guest_name text not null,
  email text,
  phone text,
  party_size integer not null default 1,
  attending_ceremony boolean default true,
  attending_reception boolean default true,
  meal_choices jsonb default '[]'::jsonb, -- e.g. [{"name":"George","meal":"lamb"},{"name":"Eleni","meal":"sea_bass"}]
  dietary_notes text,
  assigned_table text, -- e.g. "Table 4 — Koumbaroi"
  rsvp_status text not null default 'confirmed', -- 'confirmed', 'declined', 'tentative'
  created_at timestamptz default now()
);

create table if not exists public.private_registry_items (
  id uuid primary key default gen_random_uuid(),
  private_event_id uuid references public.private_events(id) on delete cascade,
  title text not null, -- e.g. "Honeymoon in Santorini & Crete", "Traditional Shakoula Cash Gift", "Baptism Cross Fund"
  category text not null default 'cash_envelope', -- 'cash_envelope', 'honeymoon', 'parish_donation', 'gift'
  target_amount numeric default 0,
  collected_amount numeric default 0,
  description text,
  created_at timestamptz default now()
);

create table if not exists public.private_event_gifts (
  id uuid primary key default gen_random_uuid(),
  private_event_id uuid references public.private_events(id) on delete cascade,
  registry_item_id uuid references public.private_registry_items(id) on delete set null,
  giver_name text not null,
  amount numeric not null,
  message text,
  payment_method text not null default 'apple_pay', -- 'apple_pay', 'card', 'cash_envelope'
  created_at timestamptz default now()
);

create table if not exists public.private_photo_wall (
  id uuid primary key default gen_random_uuid(),
  private_event_id uuid references public.private_events(id) on delete cascade,
  guest_name text not null,
  table_name text,
  photo_url text not null,
  caption text,
  created_at timestamptz default now()
);

-- Realtime subscriptions
alter publication supabase_realtime add table public.private_events;
alter publication supabase_realtime add table public.private_rsvps;
alter publication supabase_realtime add table public.private_registry_items;
alter publication supabase_realtime add table public.private_event_gifts;
alter publication supabase_realtime add table public.private_photo_wall;

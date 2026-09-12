-- Migration 0029: Diaspora Messenger, P2P & Business Chat, Ethical Spotlight Ad Engine & User Interest Controls

-- 1. Diaspora Conversations (Direct, Business Inquiries & Table Groups)
create table if not exists public.diaspora_conversations (
  id uuid primary key default gen_random_uuid(),
  conversation_type text not null default 'direct', -- 'direct', 'business_inquiry', 'table_group', 'community_group'
  title text,
  entity_id uuid, -- referenced listing if business inquiry
  participant_ids uuid[] not null default '{}',
  last_message_text text,
  last_message_at timestamptz default now(),
  created_at timestamptz default now()
);

-- 2. Diaspora Messages (Text, Greek Stickers, Media & Action Cards)
create table if not exists public.diaspora_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.diaspora_conversations(id) on delete cascade,
  sender_id uuid references auth.users(id),
  sender_name text not null,
  sender_avatar text,
  message_type text not null default 'text', -- 'text', 'greek_sticker', 'booking_card', 'table_invite', 'media'
  content text not null,
  action_payload jsonb default '{}'::jsonb,
  read_by uuid[] default '{}',
  created_at timestamptz default now()
);

-- 3. Ethical Spotlight & Discovery Placements (Non-intrusive, Interest-Matched)
create table if not exists public.community_ad_placements (
  id uuid primary key default gen_random_uuid(),
  advertiser_name text not null,
  advertiser_slug text,
  headline text not null,
  body text not null,
  hero_image_url text,
  destination_url text not null,
  category text not null, -- 'gastronomy', 'festivals', 'orthodox', 'travel', 'professional', 'creator', 'marketplace'
  target_cities text[] default '{}',
  target_countries text[] default '{}',
  sponsor_tier text not null default 'verified_spotlight', -- 'verified_spotlight', 'patron_partner', 'cultural_grant'
  is_active boolean not null default true,
  impressions_count integer not null default 0,
  clicks_count integer not null default 0,
  created_at timestamptz default now()
);

-- 4. User Cultural Interest & Privacy Preferences (User-Owned Control Center)
create table if not exists public.user_cultural_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  interests jsonb not null default '{"gastronomy": 5, "festivals": 5, "orthodox": 5, "travel": 5, "business": 5, "creators": 5}'::jsonb,
  receive_nameday_alerts boolean not null default true,
  receive_parish_bulletins boolean not null default true,
  allow_p2p_messaging boolean not null default true,
  updated_at timestamptz default now()
);

-- Realtime publication (safe idempotency)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.diaspora_conversations;
    alter publication supabase_realtime add table public.diaspora_messages;
    alter publication supabase_realtime add table public.community_ad_placements;
    alter publication supabase_realtime add table public.user_cultural_preferences;
  end if;
exception when others then null;
end $$;

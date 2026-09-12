-- Migration 0030: SECURITY FIX — 0027/0028 created tables with no RLS, so
-- PostgREST served them to anyone with the public anon key: full read AND
-- write access to event orders, cash-tab payments, and wedding RSVP/gift/
-- registry/photo-wall data, with no sign-in required. Verified live before
-- this migration: `GET .../rest/v1/tab_payments` returned 200 with no auth.
-- No real rows existed yet (both feature sets are still frontend-only), so
-- nothing sensitive leaked — but the hole was open in production.
--
-- Fix: enable RLS on every one of these tables and add zero policies. RLS
-- with no policies is default-deny for anon and authenticated alike, which
-- closes the hole immediately. service_role (used by trusted server-side
-- code only) bypasses RLS as always, so nothing here blocks a future
-- SECURITY DEFINER RPC layer — it just stops these tables being queried
-- directly from the browser, which they were never designed for.

BEGIN;

alter table public.event_venues          enable row level security;
alter table public.venue_tables_zones    enable row level security;
alter table public.table_tabs            enable row level security;
alter table public.table_members         enable row level security;
alter table public.event_orders          enable row level security;
alter table public.event_order_items     enable row level security;
alter table public.tab_payments          enable row level security;

alter table public.private_events            enable row level security;
alter table public.private_rsvps             enable row level security;
alter table public.private_registry_items    enable row level security;
alter table public.private_event_gifts       enable row level security;
alter table public.private_photo_wall        enable row level security;

-- Belt and braces: PostgREST also honors table grants. Anon/authenticated
-- should never touch these tables directly — all access must go through
-- SECURITY DEFINER RPCs that check workspace membership / access pins.
revoke all on public.event_venues          from anon, authenticated;
revoke all on public.venue_tables_zones    from anon, authenticated;
revoke all on public.table_tabs            from anon, authenticated;
revoke all on public.table_members         from anon, authenticated;
revoke all on public.event_orders          from anon, authenticated;
revoke all on public.event_order_items     from anon, authenticated;
revoke all on public.tab_payments          from anon, authenticated;

revoke all on public.private_events            from anon, authenticated;
revoke all on public.private_rsvps             from anon, authenticated;
revoke all on public.private_registry_items    from anon, authenticated;
revoke all on public.private_event_gifts       from anon, authenticated;
revoke all on public.private_photo_wall        from anon, authenticated;

COMMIT;

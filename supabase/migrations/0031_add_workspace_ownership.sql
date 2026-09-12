-- Migration 0031: add workspace ownership so the RPC layer can actually
-- authorize access. 0027/0028 created event_venues and private_events with
-- no link back to a workspace — there was no column to check "does this
-- caller's workspace own this event" against, which is required before any
-- RPC can safely read or write these rows. table_tabs/event_orders/rsvps/etc
-- all hang off event_venues.id or private_events.id, so one owner column on
-- each root table is enough to authorize the whole tree.

BEGIN;

alter table public.event_venues
  add column if not exists workspace_id uuid references zoi.workspaces(id) on delete cascade;

alter table public.private_events
  add column if not exists workspace_id uuid references zoi.workspaces(id) on delete cascade;

create index if not exists event_venues_workspace_idx on public.event_venues(workspace_id);
create index if not exists private_events_workspace_idx on public.private_events(workspace_id);

COMMIT;

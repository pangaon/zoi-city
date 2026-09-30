# Versioned event table holds — deployed API

Deployed in release `136f5c4a2c7137332ae6c9299bb5883eeb33e412`: source migration `20260930125216` is live ledger version `20260930132820`; configuration receipt source `20260930130840` is live version `20260930132822`. Both corrected production rollback fixtures passed with zero retained rows. See [production acceptance](../../docs/audits/event-table-holds-production-acceptance-2026-09-30.md). No Signature/Parkview table inventory or ownership is created. Use actual event UUID and actual `venue_tables_zones.id`, never a source drawing label as an inventory UUID.

## Operator setup

`table_inventory_operator(p_workspace UUID,p_event UUID)` requires current owner/admin membership and actual event ownership. Returns `{ok,event_id,version:0 when absent,enabled,starts_at,tables,available_tables,payment_enabled:false}`. `available_tables` contains at most201 actual venue tables `{table_id,label,capacity}`; more than200 must be handled by a future paginated operator UI, not silently configured. `tables` contains stored per-event config rows. No public exposure of operator results.

`table_inventory_configure(p_workspace,p_event,p_expected_version,p_request UUID,p_data)` requires the same current role/ownership on every call, including retry. Stable actor/request plus exact payload replay returns the original receipt; changed retry payload raises `request_conflict`. New expected0; edits use exact current version. Returns `{ok:true,event_id,version,enabled,payment_enabled:false}`. Fetch operator state after historical receipt recovery rather than assuming it is still current.

`table_inventory_configure_receipt(p_workspace,p_event,p_request)` requires current owner/admin and event ownership; actor-bound exact workspace/event lookup returns `{ok,found,receipt?}` without private configuration payload. It uses the same request lock as configure. A missing receipt does not authorize a duplicate request; a historical successful receipt must be followed by reloading current operator settings.

`p_data` exact keys:

```json
{
  "starts_at": "2027-03-20T22:00:00-04:00",
  "enabled": false,
  "tables": [{
    "table_id": "<actual zone UUID>",
    "source_label": "<organizer-confirmed drawing label>",
    "capacity": 10,
    "min_party_size": 10,
    "price_per_guest_cents": 12500,
    "currency": "CAD",
    "fees_included": true
  }]
}
```

Example is contract illustration, NOT approved Signature pricing/currency/configuration. Operator supplies explicit zoned future timestamp,1..200 unique tables/labels, capacity1..100 no greater than actual zone capacity, minimum1..capacity, integer price0..10000000 cents. CAD/USD/EUR/GBP/AUD/NZD/CHF are the initial supported two-decimal currencies. All mandatory fees must already be included; unknown fees/currency cannot enable this flow. Backend trusts authorized operator configuration, not source-page guesses. New configuration is blocked while any unexpired active hold exists, including disabling; the operator must wait at most the remaining five-minute hold window. Emergency event hiding/ownership revocation invalidates customer-facing hold status.

Table venue must belong to the current workspace and reference this exact event. Existing GA tiers or named-seat sessions prevent enabling table mode. Once enabled, narrowly scoped triggers prevent adding/moving legacy ticket tiers or seating sessions into this event. Other events remain unchanged. This prevents two independent inventory authorities selling the same event; it is an interim compatibility fence, not mixed-mode support.

## Public discovery

`table_inventory_map(p_event)` returns `{ok:true,configured,event_id,server_time,tables}`. Unconfigured, disabled, past, hidden, unpublished, unclean or transferred events return configuredfalse/emptytables. No fallback from a source floorplan.

Each configured table:

`{table_id,source_label,label,capacity,min_party_size,price_per_guest_cents,currency,pricing_version,fees_included:true,exclusive_table:true,availability:'available'|'held'|'unavailable'}`.

Pricing version is event configuration version. Public map includes no guest/profile/hold identities, QR capability, sponsor data or provider secrets. Unavailable covers a table/venue no longer matching its configuration.

## Authenticated customer

`table_hold_create(p_event,p_table,p_party_size,p_expected_version,p_request UUID)` returns `{ok:true,hold,server_time,payment_collected:false}`. All arguments are fixed for an uncertain retry. Server controls price/currency/total; no client total accepted. One active hold per actor per event, maximum20 newly created holds per actor/hour. Two buyers compete under the event configuration row lock; only one gets the table.

A hold exclusively protects the entire table, even if the accepted party size is below capacity. Configuring `min_party_size=capacity` requires the full table party. Per-guest pricing does not mean independently saleable remaining chairs. Five-minute expiry is capped at event start; reads use current server clock. Exact nonce retry after expiration/release returns that same terminal hold, never silently reacquires it.

`hold`:

`{id,event_id,table_id,request_id,party_size,pricing_version,price_per_guest_cents,currency,total_cents,expires_at,fees_included:true,exclusive_table:true,status:'active'|'expired'|'released'|'invalidated'}`.

`table_hold_status(p_event,p_request UUID|null DEFAULT null)` returns `{ok:true,holds:[...],server_time,payment_collected:false}`: only the caller's latest20 holds, or that caller's exact event/request match. This is nonce-only recovery with no stored customer contact required. Another actor receives no matching row. Missing recovery must not be treated as successful release or allow replacement of an unresolved request automatically.

`table_hold_release(p_hold)` returns the same response envelope as create. Only the holder may release. It remains available after event hiding/ownership changes. Repeated release is harmless; expired rows remain expired. `invalidated` is a read projection when event/current ownership/configuration/table identity no longer matches; historical pricing remains visible only to its holder.

Common errors: `not_signed_in`, `not_authorized`, `event_not_owned`, `inventory_owner_changed`, `invalid_request`, `request_conflict`, `version_conflict`, `invalid_configuration`, `invalid_event_time`, `duplicate_table`, `invalid_table`, `table_not_owned`, `active_holds`, `incompatible_ticket_inventory`, `event_table_mode_enabled`, `table_inventory_unavailable`, `pricing_version_conflict`, `invalid_party_size`, `active_hold_exists`, `table_unavailable`, `hold_rate_limited`, `hold_not_owned`.

## Deliberate boundaries

This is a timed hold, not a reservation confirmation, issued ticket, group invitation, split charge or paid order. No payment collection, staff cash conversion, invite delivery, table-tab service activation or paid-finalize call exists here. Future per-seat/per-guest allocation, shared guest management and split payments must consume this same inventory authority atomically, with their own authenticated participation and payment receipts. They remain required follow-up work, not silently dropped scope.

Private tables have RLS enabled and no direct anon/authenticated grants. Definer helpers are revoked from public callers. Approval-sensitive price fields remain immutable in each hold snapshot. Source assets and live room visuals remain separate from operational availability.

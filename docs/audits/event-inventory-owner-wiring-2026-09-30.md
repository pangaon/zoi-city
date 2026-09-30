# Event inventory owner setup: bounded follow-up audit

Read-only source and production function-definition inspection, 2026-09-30.
No organizer records, tables, bookings or money were changed.

## Confirmed blocking gap

`/tickets/` event cards open the real `table-inventory-operator.mjs` editor.
Its `table_inventory_operator` read returns only tables joined through
`venue_tables_zones → event_venues` with matching event and current workspace.
Price/party settings can be reviewed, saved and recovered for those existing IDs.

A new event has no supported creation path for those IDs in this UI. The nearby
`venue-studio.mjs` writes versioned geometry into `venue_plans`; those objects
are not `venue_tables_zones` rows. Publishing named seats is a different inventory
mode and cannot safely substitute. The editor's instruction to save a venue
layout first is therefore misleading and does not complete setup.

The legacy `venue_layout_save` definition was checked directly in production.
It has no event parameter, permits any workspace member (including viewer), and
updates by deleting/recreating table rows. It has no immutable request receipt or
version guard. Calling it from the new editor would not attach the tables to an
event and could destroy stable identifiers. Do not wire this writer blindly.

## Service tools are a separate gap

The old `apps/tickets-studio` contains real menu/KDS calls mixed with demo guests,
dishes, fixed tax/tip calculations and simulated interactions. It is not the
current `/tickets/` operational dashboard. The newer menu/KDS authorization
hardening does not make that surrounding simulator production-ready. Operational
menu IDs are distinct from descriptive business-home menus; table-order APIs
explicitly deny event ordering until event service configuration exists.

## Implemented local candidate

Keep the existing physical table/venue and pricing/hold tables. Add an authenticated
owner/admin setup writer for a current owned event with actor-bound request UUID,
exact replay, explicit capacities and stable table IDs. Use optimistic versioning
and inventory/hold locks. No assumed Signature rows, inferred capacity, source
price-to-stock conversion or automatic enablement. Recover the writer's receipt
before configuring prices. Expose this as the first stage of the existing table
inventory editor, not another disconnected route.

The additive candidate and existing Tickets editor integration are implemented locally.
Parent review, browser acceptance and production deployment remain pending.
Migration: `20260930142554_event_table_identity_setup.sql`.
Contract: `assets/tickets/table-identity-contract.md`.
Native table setup and event service dispatch remain unimplemented in this scope.

## Next operational boundary (not implemented)

`table_hold_create` provides an exclusive five-minute customer hold; it is not a
venue-approved durable host allocation. `saved_guest_group_save` stores private
reusable guest data, not ticket quotas. `event_team_member_invite` manages staff;
it does not issue guest payment claims.

A host-allocation workflow still needs organizer-authorized table/quantity/expiry
snapshots, host allocations whose sum cannot exceed that quota, recipient-bound
claim capabilities and exact retries. Email/SMS sending requires a separate
configured delivery path and recorded consent/purpose; payment status requires
actual provider confirmation. None is implied by saving this table setup.

Event service remains explicitly closed by `table_tab_order_once` with
`event_service_not_configured`. Reusing its server pricing/order/KDS primitives
requires a current-owner service configuration: approved opening/closing times,
currency and fee policy, table/zone access, available stock with atomic decrement,
reviewed catalogue versions, alcohol/service restrictions and cancellation stock
restoration. Existing non-event menu availability alone does not establish those
conditions. No new service writer was added in this task.

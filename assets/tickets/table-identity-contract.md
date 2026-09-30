# Event table identity setup

Candidate migration `20260930142554_event_table_identity_setup.sql`; not deployed.

The existing Tickets dashboard → Table inventory now offers table setup when no real table identities exist. This creates labels and organizer-confirmed capacities, not a measured venue layout. Pricing, dates, included fees and enabling remain a separate explicit step in the existing inventory editor. No Signature tables are seeded.

Authenticated current event workspace owners/admins only:

- `table_identity_get(p_workspace,p_event)` → `{ok,event_id,version,venue_id,tables:[{id,label,capacity}]}`. An untouched event has version0/venue_id null/empty tables.
- `table_identity_save(p_workspace,p_event,p_expected_version,p_request,p_tables)` → `{ok,event_id,venue_id,version,table_ids,enabled:false}`. Client-generated UUIDs remain stable; labels1–80, explicit integer capacities1–100; maximum200 event tables. Exact actor/request/payload replay returns original receipt. Changed payload or stale version fails.
- `table_identity_receipt(p_workspace,p_event,p_request)` → `{ok,found,receipt}` after rechecking current role and event ownership. No other actor’s receipt or payload is exposed.

Saved rows cannot be omitted/deleted. Existing priced identities cannot be renamed or resized. Active holds or enabled inventory block new setup changes. The legacy delete/recreate writer cannot delete managed rows. Source layouts and unknown source capacities are never imported automatically.

The client persists only actor/workspace/event/request/version metadata. On uncertain writes it retains exact arguments in memory, blocks replacement writes and offers same-request retry or receipt recovery. After reload, receipt recovery remains available; a missing receipt does not discard the pending request. Account changes remove private form content.

Validation: `node tests/database/event-table-identity.integration.mjs` (11 groups including actual legacy-writer containment and exact rollback fixture); `node --test tests/unit/table-identity.test.mjs tests/unit/table-inventory-operator.test.mjs` (17 tests). Browser acceptance and independent review recorded separately. Native setup remains an explicit web owner-tool handoff, not a new native editor.

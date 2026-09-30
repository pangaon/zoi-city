# Event table inventory and hold foundation

Candidate only. No production apply, source-table import, Signature event creation, owner assignment or live customer hold. CLI migration `20260930125216_versioned_event_table_holds.sql`; exact RPC contract `assets/tickets/table-holds-contract.md`.

## What this provides

Current owner/admin operators can configure actual event-linked venue-table UUIDs with explicit capacity/minimum party, all-inclusive per-guest cents, supported currency and event start. Every edit is versioned and request-idempotent. Public availability is absent until configured and enabled against a current public event. Source drawing labels are display/mapping metadata, never inventory UUIDs.

Authenticated customers can exclusively hold one whole table per event for up to five minutes, inspect current status by original request UUID and release it. A smaller party still exclusively holds the table; the minimum controls whether that is permitted. The server chooses pricing and computes totals. Expiry is checked against the server clock without requiring cron. Same nonce retains original price/quantity/event/table and never renews a released or expired hold. No personal contact or guest names are needed in this ledger.

The existing event venue/table identities and event ownership model are reused. A new private ledger is necessary because existing named-seat reservations have a ten-seat/free-ticket contract and cannot truthfully represent larger whole-table party holds. Existing GA/seat inventory and enabled table inventory cannot independently sell the same event: enabling refuses existing tiers/sessions, and narrowly scoped creation/move triggers refuse later legacy inventory only for enabled table events. Other events are unaffected.

A per-event configuration row lock serializes holds, release and configuration. This is a deliberate safe throughput tradeoff; measured optimization can later introduce finer locks while retaining a single inventory authority. Current parent/venue ownership and visibility are checked; removal/transfer makes active receipt projections invalidated. Own release remains permitted. Configuration edits, including disabling, are refused while an unexpired active hold exists; immediate event hiding is the existing emergency public-availability containment.

## What is still required

Actual Signature owner authorization, event/inventory setup, confirmed currency/fees and source-table mapping are not supplied by this migration. It contains no seed records. A source plan with price bands is insufficient to enable it.

Per-guest remaining-seat sales, group invitations, group member rights, split-payment allocations, provider checkout/webhooks, paid reservations/tickets, staff operations and native client integration remain follow-ups. Whole-table exclusive hold is an explicitly interim foundation, not a silent replacement for that requested scope. No payment/booking success is returned. Event-linked food/drink ordering remains separately disabled until its service configuration exists.

Operator UI must fetch current configuration after historical save-receipt replay, show all-inclusive currency explicitly, and surface active-hold/configuration conflicts. Consumer UI must retain the nonce, recover via status and use server expiry; no response may turn an unknown outcome into an available table. A configured=false response must keep the source preference experience usable without pretending stock exists.

## Evidence

Live read-only column metadata confirmed `public.event_venues.workspace_id/event_id`, actual zone UUID/capacity and `zoi.ticket_types.event_id`; no customer content was read. Existing source audit and migration0027/01839 established the reused table and named-seat contracts.

`node tests/database/event-table-holds.integration.mjs` passed12 actual isolated PostgreSQL16 groups:

1. Unconfigured and anonymous refusal; viewer/editor cannot configure.
2. Existing GA/seat coexistence fences; exact config replay.
3. Public map privacy; expected quote version and party bounds.
4. Two buyers racing one table produce one active hold; immutable quote replay.
5. Actor-only status/release; held config blocked; released nonce cannot reacquire.
6. Expiry restores availability with no cron; old nonce remains expired.
7. Hidden/transferred event invalidation and own release.
8. Invalid date/fee/currency/capacity/duplicate config rolls back atomically.
9. Configuration CAS, stale quote refusal and private ledger ACLs.
10. Concurrent same actor/request produces one identical hold.
11. Concurrent table-mode enable versus legacy ticket creation has one winner; unrelated event unchanged.
12. Exact `ops/verify-event-table-holds.sql` dedicated-QA BEGIN/ROLLBACK fixture leaves no persisted settings, listings or holds.

The rollback fixture pins the existing QA auth/profile/workspace, creates only uncommitted synthetic event/venue/table data and never captures money. No production execution has occurred here. Independent creator specialist performed a read-only lock/privacy review and reported no blocking finding; that is distinct from the executed PG suite and from deployment acceptance.

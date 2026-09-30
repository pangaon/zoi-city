# Signature event experience release evidence

Candidate route: `/events/giannis-ploutarchos-andromache-toronto-2027/`.

## Public experience

Original organizer poster and floor plan, March 20 2027 date, 118 traced table/booth positions, source and schematic room views, optional official Parkview Manor Matterport handoff. Selection preserves zoom. Guests can prioritize up to three table preferences with drag/drop or accessible Move up/down controls. This changes guest preferences, never venue geometry or availability.

Group planning supports per-guest ticket bands confirmed by the user, optional names, source-band mismatch prevention, exact-cent equal/custom ticket-share planning, private save, copy and download. Currency, taxes, capacities, inventory, bottles and payment remain unconfigured. No live reservation or paid ticket is implied.

## Independent checks

- QA inspected actual canonical HTML at 390px and 1440px. Source poster loads, 118 positions render, no horizontal page overflow or console exceptions observed.
- Selecting table30 preserves zoom. Reordering preferences30/31/32 updates the group review. A selected yellow200 budget with magenta275 tables suppresses misleading totals; matching magenta with seven guests yields1925 before unconfigured taxes/fees.
- Keyboard spatial navigation and accessible preference movement verified. Drag/drop separately checked by implementing specialist.
- Matterport is not loaded until requested and is removed on leaving the tour view. Provider playback could not be verified; direct provider request encountered a challenge. No camera-to-table mapping is claimed.
- Private adapter checks actor changes, exact nonce retry, receipt shape, readonly historical review and uncertain reload without duplicate creation. Bridge clears private form data on account changes and browser history suspension.
- First production rollback fixture attempt found SQL-fixture syntax/ambiguous-column issues. Second exposed actual backend required contact fields absent from the original mocked frontend contract. These are recorded failures, not passes.
- Corrected dedicated-QA production rollback fixture (`ops/verify-signature-private-plan.sql`) passed existing writer save→same-request retry→read-back→empty bookings, then rolled back all fixture writes. This does not substitute for an ordinary signed-in production browser test.

## Supporting models, not live services

Catalog CSV/price/stock/zone validation and versioned reorder proposals are pure models. Event-wall consent/moderation/media/sponsor policy is a pure model. Full service ordering, live stock, per-person payment ledger, server queues, owner menu publishing, messaging and public wall uploads/screens are not delivered by these modules.

The separate cash/order migration remains a candidate pending its own release. It is not part of this public experience release.

## Scope retention

The delivery ledger compiles686 recorded requirements from scope and sector journeys. Zero is marked verified in that ledger until requirement-level evidence is attached; this does not mean existing deployed functionality is absent. A read-only scheduled GitHub workflow generates an artifact, not an autonomous coding agent.

Contact flow was independently tested using exact canonical HTML with an isolated authenticated RPC fixture: blank/invalid input sends no save, valid contact is preserved, lost-response exact retry succeeds, durable markers contain no contact fields, and account changes clear the form. This was not a production signed-in browser session.

Production deployment and actual deployed-route checks must be recorded separately after the exact staged tree passes verification.

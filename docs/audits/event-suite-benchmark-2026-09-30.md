# Event operations benchmark and delivery boundaries

Research date: 2026-09-30. Primary product documentation describes vendor capabilities, not integrations already installed on Zoi. This is a reusable suite, with Signature Productions as the source-specific test event.

| Benchmark | Evidence reviewed | Zoi requirement |
|---|---|---|
| sunday | [Equal, custom amount and own-item splits](https://sundayapp.com/en-gb/sunday-split-the-bill-any-way-they-want/) | Offer all three allocation modes and shared bottle allocation, with cent-exact totals. |
| Toast | [Mobile split payments](https://support.toasttab.com/en/article/Split-Payments-with-Toast-Mobile-Order-Pay) | Connect guest identity to ordered items and current balance; support staff-added/voided items. Toast explicitly does not offer even mobile splitting in this flow, so do not assume every vendor feature is universal. |
| me&u | [Hybrid ordering](https://www.meandu.com/serve/hybrid) | Combine guest and staff ordering around a shared service journey; validate operational integration separately. |
| Cvent | [Planner platform](https://www.cvent.com/en/platform/planners) | Organizer drag-and-drop layout/seating controls, with constraints and accessible alternatives. |
| Seats.io | [Temporary holds](https://docs.seats.io/docs/api/temporarily-hold-objects/) and [hold sessions](https://docs.seats.io/docs/renderer/config-session/) | Treat holds as server-owned expiring inventory. A highlighted table or saved plan is never a hold. Wait for confirmed hold writes before advancing. |
| Walls.io | [Events](https://www.walls.io/solutions/events) and [moderation](https://help.walls.io/en/articles/11906908-step-4-moderating-your-wall) | QR direct submissions, curated screen feed and moderator control. Zoi uses explicit public-screen consent and approval; a hashtag alone is insufficient. |
| Tagboard | [Social graphics](https://support.tagboard.com/knowledge-base/social-displays-101) and [direct UGC](https://support.tagboard.com/knowledge-base/gather-display-direct-ugc) | Sponsor lower-thirds, QR actions and guest-submitted content fit a deliberate live production workflow. No automatic social-account scraping. |

## Customer journey

1. Explore real venue imagery and source floor plan; choose preferences or actual inventory only when connected.
2. Create an invited group; choose tickets and organizer-approved packages, view final taxes/fees, then allocate shares.
3. Each guest accepts their share. Payment allocation is separate from a booking; provider receipt and server reconciliation determine settlement.
4. At the event, join the correct table using a scoped, revocable session. See the live menu and service availability; order or ask assigned staff for help.
5. Follow order status. Split a shared bottle among selected guests, pay own items or cover a chosen balance without exposing another guest’s payment details.
6. Share an event card or opt into the moderated photo wall. Private group posts remain private. Revoke public display independently of participation in the event.

## Organizer and staff journey

1. Verify workspace ownership and configure venue/timezone, exact capacities, currency, tax/service policy, stock, menus and authorized staff.
2. Import a price list with row-by-row errors and an explicit preview. Reordering sends IDs/version, never an old copy of prices or stock.
3. Assign bar/server service zones. Enable guest ordering only after routing, permissions, availability and receipt recovery are tested.
4. Approve scoped sponsor assets with dates, placement, destination and disclosure. Use on-demand table details, restrained menu cards and intermittent lower-thirds, never forced checkout overlays.
5. Staff accept, prepare and deliver orders; authorized staff record cash with a real receipt and immutable audit. A guest cannot mark their own bill paid.
6. Moderators approve or remove event media. Screen operators receive only approved public fields, with revocation refresh and an emergency blank-screen action.

## Hardening acceptance

- Auth: current organizer ownership and membership, staff zone assignment, guest table participation, group invitations, revoked participants, account switches, tenant transfer.
- Money: exact minor-unit accounting, currency-specific minor units, shared items, discount allocation, tax rounding, optional tips, no overpayment, concurrent payers, refunds/voids, late orders after a guest settles.
- Orders: server prices and stock, catalog-version mismatch, last-bottle race, duplicate request IDs, lost response, partial delivery, rejected substitution, alcohol checks, service cutoff and staff handoff.
- Inventory: expiring holds, held-to-booked transition, atomic capacity, cancellation/release, replayed callbacks and provider outages.
- Media: finalized image/video validation, malicious files, event-scoped objects, explicit permission, moderator authorization, abuse reports, immediate removal, consent expiry and screen-cache invalidation.
- Interaction: 390px and desktop, keyboard and touch, reduced motion, long names, empty/error states, slow networks, undo and conflict resolution for drag-and-drop.
- Messaging: resolve recipients on server, not a client-supplied workspace/table label; permission checks on every read/write; idempotent sends, status receipts, attachments, blocking/reporting, mute and retention.

## Current status

Built candidates: source-specific guest planner, 118-position source-floorplan explorer, venue-tour handoff, exact-cent ticket split arithmetic, private-plan adapter, catalog/CSV/reorder validation model and event-wall moderation model. These are not a completed operational event platform.

Existing server table-tab writers were audited; a candidate migration adds staff-only idempotent cash recording and idempotent bounded guest orders. It still does not supply the full event catalog-version, stock, staff-routing, per-guest split ledger or event participant authorization required above.

Open: actual organizer-owned event inventory, live ordering/stock and server queues, payment/share ledger, direct messaging integration, owner menu editor integration, drag-and-drop UI, moderation/upload/screen endpoints, sponsor management and native implementation. Payment details remain outside the current showcase. No real sponsor, price list, paid status or reservation is invented.

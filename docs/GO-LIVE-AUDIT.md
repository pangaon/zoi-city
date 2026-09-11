# Go-Live Audit and Enhancement Map

Updated 2026-09-11. This is the production truth for the four operator surfaces.
An item is **live** only when its result is durable, permission-checked, and
observable after a reload. A UI control that changes only browser memory is not live.

## Product Direction

Zoi should beat generic schedulers through a guided daily workflow, not a larger
pile of buttons:

1. Today view with the next best action, failed work, and approvals.
2. Goal setup for reservations, foot traffic, donations, growth, or awareness.
3. Weekly plan proposals that the owner approves before publishing.
4. Campaign briefs that become coordinated posts, email, community, and listing updates.
5. Approval lanes for owners, editors, and operators.
6. Reusable content tied to real events, listings, and source facts.
7. Network-aware copy, length, media, and call-to-action adaptation.
8. Safe AI that proposes and previews without inventing facts or publishing silently.
9. Per-network failure recovery, retry, and explanations.
10. Analytics that recommends the next action instead of only drawing charts.
11. Consent-aware audience journeys by intent, nameday, location, and language.
12. One canonical event link shared across Tickets, email, Social, and Community.
13. Reviewable content suggestions from verified website facts.
14. Orthodox calendar, fasting context, Greek/English copy, and diaspora time zones.
15. A trust center showing source, date, confidence, and owner overrides.
16. Searchable approved assets: logos, photos, menus, flyers, and alt text.
17. Campaign link tracking and conversion-aware recommendations.
18. Mobile approvals, edits, rescheduling, and pause controls.
19. Safe import of calendars, contacts, and existing content.
20. Transparent capability limits naming the credential or backend requirement.

## Social / Business Suite

1. OTP sign-in and workspace selection: live.
2. Workspace creation: live.
3. OAuth state creation with authenticated workspace membership: hardened in this release.
4. Callback return URL allowlist: hardened in this release.
5. Facebook Page OAuth: provider credentials and app review required.
6. Instagram Business OAuth: Meta Page link and app review required.
7. LinkedIn OAuth: provider credentials and product approval required.
8. X OAuth: provider credentials and paid API access may be required.
9. TikTok OAuth: provider credentials and developer review required.
10. YouTube OAuth: provider credentials and Google verification required.
11. Token refresh and expiry health: required before calling a channel healthy.
12. Disconnect / revoke access: required; current UI intentionally does not fake it.
13. Per-network capability checks for image, video, threads, and first comments: required.
14. Provider media upload pipeline: required for Instagram, TikTok, and YouTube.
15. Per-target publish status, retry, and error detail: required.
16. Scheduled post worker monitoring and dead-letter recovery: required.
17. Today view and prioritized next action: required.
18. Goal-based weekly planning: required.
19. Coordinated campaign briefs: required.
20. Approval lanes and an approved asset library: required.
21. Link tracking and conversion-aware recommendations: required.
22. Mobile approval and pause controls: required.
23. Provider token health and per-target retry: required.
24. Cross-channel analytics with recommended next actions: required.

## Tickets

1. Public event discovery: live for published events.
2. Free RSVP reservation: live end to end.
3. QR confirmation and offline display: live.
4. Door scanning and duplicate detection: live.
5. Attendee CSV and printable manifest: live.
6. Organizer OTP and workspace dashboard: live.
7. Paid Stripe checkout: built, but disabled until Stripe keys, webhook proof, and `payments_live` are enabled.
8. Confirmation and receipt email: blocked until the email provider is configured.
9. Event editing and archiving: enhancement required.
10. Ticket-tier editing and deletion: enhancement required; current backend exposes add-only behavior.
11. Refunds and cancellation policy: enhancement required.
12. Waitlist promotion and reservation expiry: enhancement required.
13. Role-based organizer access: enhancement required.
14. Audit log for check-ins, changes, and refunds: enhancement required.
15. Capacity alerts and scheduled organizer notifications: enhancement required.

## Event OS

1. Live event-directory discovery: metadata only; no operational ownership.
2. Owned event workspace: required.
3. Durable event metrics: required; fabricated metrics were removed from the discovery path.
4. Durable floor-plan save/load: required; current layout state is browser-local.
5. Guest and RSVP records: required.
6. Ticket inventory linked to Tickets: required.
7. Payment and settlement reporting: required.
8. Waitlist and table assignment: required.
9. QR door check-in linked to the real attendee ledger: required.
10. Multi-operator collaboration and conflict handling: required.
11. Vendor, sponsor, and pledge records: required.
12. Public branded event page backed by owned data: required.
13. Real-time operational board: required.
14. Export, backup, and recovery: required.
15. Demo checkout, demo guests, and in-memory sales: must remain isolated from production.

## Command Center

1. Supabase OTP authentication: implemented in this release.
2. Server-side admin authorization: required and must be enforced by every admin RPC.
3. Removal of the committed placeholder passphrase: implemented in this release.
4. Directory search, filters, sorting, and pagination: live.
5. Review queue actions: live where the corresponding RPC is deployed.
6. Claims and lead workflows: live where the corresponding RPC is deployed.
7. Bulk actions with partial-failure reporting: enhancement required.
8. Admin activity audit trail: enhancement required.
9. Role and permission management: enhancement required.
10. Ingestion run controls and retry history: enhancement required.
11. Source health, freshness, and outage alerts: enhancement required.
12. Data-quality issue drill-down and repair jobs: enhancement required.
13. Export and scheduled reports: enhancement required.
14. Realtime sync and stale-data indicators: enhancement required.
15. Operator sign-out, session expiry, and forced re-authentication: enhancement required.

## User Journeys

## Verified-Site Enrichment

The enrichment worker is live and runs from each listing's database-owned website,
not from a URL supplied by a visitor. It follows robots rules, blocks private and
cloud metadata addresses, checks redirects, limits response size and time, and
writes machine-derived values under `profile._enrich` with source and date.

The production queue contains more than 10,000 registered websites. Verified,
owner-verified, and source-verified listings are prioritized. The production
scheduler invokes the worker automatically. Every attempt records a result,
including useful fields, an empty page, a robots refusal, an HTTP failure, or a
network error, so a broken site is not retried invisibly forever.

The worker can extract descriptions, taglines, phone, email, opening hours,
address parts, coordinates, photos, social links, menus, booking, ordering, and
donation links. Aggregator sites may contribute contact facts, but their branding
and descriptions are excluded. Owner-entered fields are protected from machine
overwrite.

Next enrichment improvements are confidence scores, field-level review, change
diffs before publishing, same-domain `/menu` and `/contact` discovery, canonical
URL detection, language-aware extraction, owner correction feedback, and a
visible “last checked / source” panel on every listing.

### Connect a social account

1. User signs into `/social` with an email code.
2. User selects a workspace and opens **Accounts**.
3. Zoi checks provider configuration and enables only configured providers.
4. User clicks **Connect** and is sent to the provider's OAuth domain.
5. Provider returns a one-time state and authorization code to Supabase.
6. Supabase exchanges the code, stores the channel, and redirects only to `/social`.
7. Zoi reloads the channel and shows the account as connected.
8. Publishing remains unavailable if the provider capability or token health check fails.

### Reserve a free ticket

1. Guest opens a published event URL.
2. Guest chooses an available free tier and quantity.
3. Server validates capacity and creates the reservation.
4. Browser displays the durable confirmation code and QR.
5. Organizer opens Door mode and scans or types the code.
6. Server accepts the first check-in and rejects duplicates.

### Create and operate an event

The canonical live path is currently `/tickets`: create the event, add a tier,
share the public URL, inspect attendees, and run Door mode. Event OS cannot yet
claim to be the system of record because its floor, guest, and sales data are not
persisted to the ticketing backend.

### Operate the directory

1. Operator signs in with Supabase OTP.
2. Server-side admin RPCs authorize the profile.
3. Dashboard loads current metrics and preserves failures as visible errors.
4. Operator filters or drills into records.
5. Actions run through guarded RPCs and reload the affected data.

## External blockers

The following cannot be honestly enabled by frontend code alone: provider OAuth
credentials and app review, Stripe keys plus webhook verification, email provider
credentials, AI provider credentials, and server-side admin role assignment.
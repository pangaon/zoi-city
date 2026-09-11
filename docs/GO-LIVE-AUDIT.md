# Go-Live Audit and Enhancement Map

Updated 2026-09-11. This is the production truth for the four operator surfaces.
An item is **live** only when its result is durable, permission-checked, and
observable after a reload. A UI control that changes only browser memory is not live.

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
# Event planner session and lost-response recovery — owner acceptance

This candidate repairs the shared coordinated-event planner, retaining canonical event plans, booking writers, compare-and-swap versions and immutable request receipts. The old web planner used `auth.load().user.id`; actual ZoiCore stores `user_id`, so pending requests usually had no account key. The new account-bound durable request marker preserves the exact request and original confirmation context across a lost response and a closed tab. It never substitutes a new nonce for an uncertain mutation. Account changes and authenticated authority refusals clear private rendered content, with a final dispatch fence after Core refresh. Matching expired access snapshots can refresh through the real Core contract.

Five remaining private planner RPCs now call the existing customer-session authority helper. Exact live function-body, owner and ACL guards precede replacement. This migration DEPENDS on `20261015012143_customer_booking_current_session.sql`; it must not be deployed first. Ordinary customers need no workspace membership. Provider context retains the existing actual owner/admin policy and explicit shared fields. No writer signature, canonical store, receipt, booking CAS or public grant changes.

## Exercised evidence

- `node --test tests/unit/event-planner-session.test.mjs`: 13 passing checks.
- `ZOI_EVENT_PLANNER_BROWSER=1 node tests/database/event-planner-session.integration.mjs`: 28 passing grouped checks against isolated PostgreSQL16 and captured real authority/RPC definitions, including actual Chromium at390/1440.
- Actual ZoiCore, route and app call the isolated canonical SQL through a controlled auth/HTTP transport. This is not production identity/token verification. Minimal auth/JWT and ensure_profile fixture scaffolding remains explicit; authoritative helper bodies are captured, not replaced with always-allow decisions.
- Save commits with response loss, actual revoked session refusal, account switch private-DOM clearing, close/reopen exact-nonce recovery and one canonical plan; review and two-booking confirmation commits with response loss, close/reopen recovery and exactly two bookings.
- Actual held Core refresh blocks an old account dispatch. Initial expired access snapshot refreshes and saves once. Provider context excludes private notes. Both widths have zero page errors or horizontal overflow.
- Source and screenshots: `docs/audits/evidence/event-planner-session-owner-2026-10-15/`; latest browser JSON records all final runtime assertions. `git diff --check` passes.

## Release and limits

Candidate only: independent review and root-owned migration application, rollback proof, web release and production journey verification remain required. Apply current-session customer helper first, then this exact-guarded migration; deploy the versioned web assets together. If actual metadata differs, stop rather than adapt guards without review. No production writes or provider calls occurred. Native EventPlanner source was read, but no native files/build/runtime were changed or newly accepted. Previously unrecorded requests cannot be retrospectively reconstructed. Local request markers are recovery hints; database current authority and immutable receipts remain decisive. This accepts this planner recovery slice, not all event families, provider integrations or ecosystem completion.

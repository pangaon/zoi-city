# Event payment-arrangement response deadline

Local candidate, 2026-10-01. Root owns retained-definition reconciliation, schema application, cache versions and release. No production writes, payments, claims, invitations or customer contact performed in this lane.

## Existing journey and scope

Authenticated Tickets inventory → Manage host table allocations carries exact workspace/event. The existing host page mounts the payment policy module for owners/admins and payment choices for accepted guests. Reuses `zoi.event_payment_policies`, `event_guest_payment_preferences` and actor/request receipts; no simulator, duplicate dashboard or payment provider.

An optional response deadline means the guest must choose their payment arrangement by that instant. It is not a payment due date, money collection, seat expiry, ticket issuance or settlement ledger. Online payment remains disconnected. Existing pay-at-door choices remain unpaid after the deadline.

Authoritative inventory settings retain `starts_at` as timestamptz but no IANA timezone/original offset. Owner entry and guest/operator display therefore explicitly use UTC and label the event timezone as not configured. No city-based timezone is inferred. Native Tickets currently has only a generic host-page web link; selected-event/workspace handoff is a separate outstanding task.

## Server behavior

New `event_payment_policy_configure` adds explicit nullable deadline to existing CAS policy writer. Deadline must be finite, in the future and no later than configured event start. Clearing explicitly stores null. Existing six-argument `event_payment_policy_save` preserves the current deadline and still requires current CAS version. Policy changes increment the existing version, so older guest choices are shown as needing review under existing semantics.

Server projection computes `response_open` using clock_timestamp. New guest choice checks cutoff after lock waits and current session check; equality is closed. Exact historical replay returns the previous unpaid receipt rather than inventing a newly accepted choice.

Policy mutations and cancellation acquire actor/request advisory locks, then current workspace/member/listing authority, then settings, with current session rechecks after waits. This avoids settings→workspace inversion with inventory and team changes. Current owner/admin authority is required for policy edits; guest receipt recovery remains claimant-bound.

New `event_payment_request` reads or atomically cancels the exact operation/scope. A cancellation tombstone fences delayed writers. Request, operation and scope metadata bind recovered/cancelled outcomes. Previous policy requests retain their original legacy payload and retry the legacy writer. Exact old receipts are augmented with scope/request metadata without manufacturing current policy state.

Six retained function MD5 guards prevent silently replacing drifted live definitions. These guards were generated from retained definitions loaded into isolated PostgreSQL; live definition equivalence still belongs to root release review.

## Client behavior

New deadline settings use the new configure RPC. Unknown outcomes retain immutable request parameters in account-bound session storage. Check, retry and cancel cannot replace a pending request. Actor UUID is validated before storage access; late responses after account changes are rejected. Confirmed receipts clear recovery before optional refresh; a failed refresh cannot turn an established saved/cancelled result into an unknown result.

## Evidence

- `node tests/database/event-payment-deadline.integration.mjs`: 11 isolated PostgreSQL groups, actual retained functions plus current authority helpers. Tests cover null/open, set, clear, extension, stale CAS, legacy preserve, clock boundary, historical replay, cancellation, role/session denials, three-session inventory/policy/team lock ordering, session expiry during actor wait and guest cutoff while waiting for policy lock. Inventory and payment tables remain unchanged.
- `node --test tests/unit/event-payment-policy.test.mjs`: 12 passing client/validation tests, exact request/scope, wrong receipt refusal, reload retry, historical recovery, account fencing, explicit deadline instant, cancellation and legacy payload preservation.
- `tests/browser/event-payment-deadline/verify.cjs`: component and actual host module/CSS at 390 and1440. Controlled RPC responses; not live API. Set/clear, lost-response reload/recovery, cancel unknown, confirmed result before refresh failure, closed guest action and reopened choice exercised. Phone screenshots inspected after CSS transitions settled; no horizontal overflow.
- Screenshots `/tmp/zoi-payment-deadline-owner-shell-390.png` and `/tmp/zoi-payment-deadline-guest-shell-390.png`.

## Remaining boundaries

No production capability asserted until root applies guarded SQL and deploys verified client together. Existing actor request budget also bounds new cancellation tombstones; when quota is exhausted an absent unknown request remains pending until capacity returns. Provider collection and reconciliation are not connected by this change. Event timezone storage and native selected-event handoff are not invented here.

# Free general-admission requests

Candidate backend migration `20260930082649_idempotent_general_admission_reservations.sql`; parent controls deployment. Named-seat workflow is unchanged. Paid checkout remains separately unavailable until its server path is repaired and verified.

`public.tickets_reserve_once(p_request uuid,p_event uuid,p_type bigint,p_name text,p_email text,p_qty integer DEFAULT 1)` returns:

```json
{"ok":true,"code":"actual reservation code","qty":2,"amount_cents":0,"currency":"CAD","paid":false,"request_id":"UUID","event_id":"UUID","ticket_type_id":"decimal string"}
```

The name/email are trimmed, bounded and validated; quantity is 1–10. The immutable hash binds event, tier, trimmed name/email and quantity. Initial auth.uid is bound if present; otherwise the request remains a guest capability. The unpredictable client-generated UUID must be persisted BEFORE sending. Same request and payload returns the identical stored receipt without increasing inventory again. Changed payload or actor fails `request_conflict`. Never create a new request to retry an unknown outcome.

`public.tickets_reserve_receipt(p_request uuid,p_event uuid,p_type bigint)` returns `{ok:true,found:true,receipt:<same receipt>}` or `{ok:true,found:false}`. Only the known private nonce plus matching scope and original actor can read it. No buyer contact is returned. Wrong account/event/tier fails `request_unavailable`; no email lookup exists. Recovery waits on an already-running same-nonce transaction. `found:false` means not yet confirmed; it does not prove a delayed original HTTP request can never arrive.

Browser/native durable state should contain only protocol `once`, nonce, event, tier, quantity, original actor scope and timestamp. Do not persist plaintext contact details. After restart, restore the receipt first. If missing, re-enter the original details and submit the SAME nonce; the server enforces the exact hash. A guest request uses anonymous transport for both operations; an authenticated request uses the same signed-in actor for both. Account changes must never silently rebind or discard an unresolved request. Never translate old non-idempotent legacy latches into new requests.

New requests require the ticket feature enabled, event published/clean-or-cleared/nonhidden, a valid explicit-zone future `profile.event_at`, active free tier, current event owner matching tier workspace, normal non-seated tier, valid inventory and sufficient capacity. Existing `tickets_reserve` gains identical guards but remains non-idempotent: old clients must not automatically retry it. Named-seat tiers remain on the existing hold API. The wrapper calls the existing capacity writer under its row lock; no second inventory system is introduced.

Receipt recovery/replay is historical and remains possible if the event later closes. It does not claim the event is still operating, that a ticket was paid, or that cancellation is supported. The private request table is RLS-enabled with no client grants. No server publication, email, payment or customer reservation was executed during development. This change does not add per-IP guest bot protection or arbitrary anonymous reservation lookup.

Tests: twelve actual PostgreSQL checks, including same-request concurrency, competing last-capacity requests, account/payload mismatch, old-entrypoint bounds, event visibility/time/owner changes, paid/seated denial, private receipt response, and exact production rollback fixture. Run `node tests/database/general-ticket-reservations.integration.mjs`.

## Current-status projection (read-hardening migration)

Migration `20260930083307_ticket_read_visibility_and_operator_access.sql` adds `current_status` (`reserved`, `confirmed`, `cancelled`), `checked_in` boolean and `event_available` boolean beside the nested receipt in a found recovery response. The nested receipt remains immutable. Always read this current status after once submission/retry before calling the ticket active: a repeated creation request can return its original receipt after cancellation. Missing new fields mean current status is unknown, not proof of an active ticket.

`event_available` means a future publicly eligible event, enabled ticketing and active tier belonging to the current event owner. It is not available capacity, a seat hold, or cancellation eligibility. Published historical event metadata remains readable; expired/unavailable events offer no public tier/checkout results. Hidden/draft/moderated events return no event metadata. Buyer-contact lists require current owning-workspace membership with owner/admin/editor role; viewer and former owner are denied. The list also filters each ticket tier to the same workspace.

Seventeen actual PostgreSQL checks cover the combined writer/read contract and exact private QA production rollback. The read fixture temporarily changes only the dedicated QA member role inside the transaction and restores it by rollback; no actual customer records are touched.

# Independent event payment response deadline review — 1 October 2026

## Current disposition

Backend contract reviewed and initial frozen candidate independently passed 10 isolated PostgreSQL groups. Final UI/host journey acceptance is pending specialist freeze and independent browser execution. No production application or customer write is established by this report.

## Corrections requested and reviewed

The initial operator path acquired event settings before workspace/member authority. Combined with retained inventory configuration and workspace team mutation ordering, this admitted a three-transaction lock cycle. Operator authority now locks workspace/member/listing before event settings, followed by current-session revalidation after waits. The independent isolated run includes the config → policy → team contention case and succeeds.

New writer and recovery receipts now carry exact request ID and operation scope. The client must validate those fields before clearing a pending marker. Recovery uses a payment-specific scoped path and shared actor/request serialization; an unknown-request cancellation creates a tombstone that prevents a delayed save from applying. It does not modify generic host cancellation semantics.

The current-role denial was explicitly tightened to `coalesce(r,'') NOT IN ('owner','admin')` after initial execution. Existing retained membership and session helpers covered reachable null cases; the correction makes future null-role behavior fail closed directly. This narrow correction changes SQL hash from the initially tested c1226910 prefix to b30d719b; specialist final rerun is pending.

## Source contract

Deadline is nullable absolute timestamptz; null means no response cutoff. Server clock determines closure at equality and after the deadline. New deadlines must be finite, future and no later than the configured event start. Legacy policy save retains the deadline and participates in the same policy version CAS. Guest new choices check the locked policy version, preference version and server deadline. Exact historical replay returns the prior unpaid preference rather than creating a new acceptance after cutoff.

Online payment remains disconnected. Responses explicitly retain `payment_collected:false` and `ticket_issued:false`; this is a payment-arrangement preference deadline, not a payment processor, ticket sale, or attendance reservation.

## Independent evidence

`node tests/database/event-payment-deadline.integration.mjs` passed 10 groups; `/tmp/event-payment-deadline-independent.log`. Covers nullable/set/extend/clear, bounds, CAS, legacy preservation, historical replay, cancellation fencing, current authority/session, equality boundary, lock-order contention and session expiry during advisory waits. The harness retains preceding migration definitions and verifies guarded fingerprints against that local fixture. It does not establish that production definitions are unchanged or that migrations were applied.

No runtime files were edited by this reviewer. Lead owns live definition readback and release; specialist owns final implementation and UI fixture.

## Final local candidate acceptance

Accepted after independently rerunning the final SQL and complete controlled UI packet:

- SQL `b30d719ba7fc306c7b907712efcd6191445ecf9c8e6429664b0186d0cb557d66`
- UI `972f1f6f5166c1aa76f2794de2ff61226f02f40d2c8cc11b60a3cd3bc806c1aa`
- Client `36375ec9bb5abf0157a93d5eb9f39d54304610157ccc9bd02527eaa149ca6a46`
- PostgreSQL harness `e02878c6929868ed34f2319188d4c07f7ddbaa6644db8f19fa0a157382c917c2`

Final PostgreSQL run passed 11 groups including the additional guest cutoff after waiting on policy lock. Log `/tmp/event-payment-deadline-final-independent.log`. Twelve payment client units passed (combined `/tmp/queued-privacy-deadline-units-independent.log`). Independent browser run passed component and actual host-module/CSS owner/guest journeys at 390/1440; log `/tmp/event-payment-deadline-browser-independent.log`. Set/clear, unknown request reload/recovery, cancellation, confirmed receipt before optional failed refresh, closed and reopened choice states were exercised with controlled RPCs. Phone owner screenshot inspected: labelled input and deadline text are legible within the host card.

The UI explicitly labels UTC because retained event settings have no configured event timezone. This is an honest fallback, not a claim of venue-local timezone support. Native selected-workspace/event handoff remains separate. Cancellation budget exhaustion leaves an unknown request pending rather than pretending cancellation succeeded. Guarded production definition equivalence, schema application and coordinated client deployment remain lead prerequisites; no real payment, ticket issuance or customer write occurred.

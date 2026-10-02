# Event-service cash companion — independent database review

Accepted locally for the database slice, 2026-10-02. Operator/guest UI, live migration compatibility and production activation remain separate gates.

Frozen migration `20261001174000_event_service_cash_reconciliation.sql` SHA-256 `20e8795fe305b6b4c5886dc88790a140e9cac4161e52f100e064ad9643a183e7`; integration harness `9af099349a02cf83e05b439abb2fd74352ca2cf020a7c76a681326da20349fb0`.

## Reviewed contract

Staff explicitly acknowledges cash received or returned. The immutable ledger binds each entry to one real `tab_payments` ID, service session/tab, current Auth actor, integer cents, note and optional original receipt. Reversals cannot exceed the unreversed original or paid balance. This records a staff assertion; it does not collect an online payment or verify physical cash.

Current workspace role and session are checked through the accepted lifecycle scope, followed by table/tab serialization, actor receipt lock and session recheck. Exact replay retains its original receipt; changed arguments conflict. Cancellation creates an immutable request tombstone. Existing venue-table locks precede cash tab locking, serializing same-table admission/order/approval paths through their existing shared/exclusive table locks. Control takes the session's exclusive lock before receipt serialization.

Payment and ledger records are immutable; unlinked legacy payment writes for service tabs are refused. The tab guard derives paid amount from signed ledger entries. Deferred definer consistency checks compare tab total against charged orders and paid amount against ledger at transaction completion. Closure requires fulfilled/cancelled orders, no stock reservation and exact reconciliation. New cash/reversals after closure are rejected; history remains readable. No external payment API is introduced.

The retained base schema allows signed numeric payment amounts and links collected_by_staff_id to Auth users, matching this companion's use. New ledger is private/RLS-enabled; direct payment privileges are revoked and checked, while public functions are authenticated-only. The exact prior service-tab guard definition is asserted before replacement. Production schema/readback is not established by this source inspection.

## Independent execution

`node tests/database/event-service-cash.integration.mjs` completed with exit0 and all12 groups passing: four actual lifecycle prerequisites and eight cash/reconciliation groups. Includes explicit acknowledgement, one real payment on replay, CAS/overpayment/guest refusal, linked partial reversal and immutable records, artificial paid/total/direct payment denial, cancellation fencing, concurrent same-revision winner, current-role replay rejection, session expiry during receipt wait, and delivered/reconciled closure with read-only closed history.

Fresh log `/tmp/event-service-cash-independent.log`. The fixture executes isolated PostgreSQL and retained migrations; no live customer/payment writes. This closes the previously identified missing database settlement path for this slice. It does not certify the unfinished operator form, all production migrations, taxation/accounting integration or native device journeys.

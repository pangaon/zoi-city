# Atomic event service lifecycle — independent database review

Final database candidate accepted locally after the corrections below. This is not guest activation or full operational acceptance: settlement/closure and actual UI journeys remain separate release gates. No production writes performed.

Initial reviewed SQL snapshot was `80ae81d05c5afb36de929a15b503a57948d83cdf9428e58e3c9e0b98804b4f60`. Source includes explicit admission, immutable session configuration, seeded/reserved/consumed inventory, per-station orders, approval before charging, and current scope/receipt gates. Existing KDS is unchanged and gains stock consumption through a companion trigger.

The existing17-group isolated fixture passed in an independent run (`/tmp/event-service-lifecycle-independent.log`), but SQL changed during this review to `960c9b2e45895133e8191f985950f1e392a9e2343c0f962482c249d3b1a06409`. This run is preliminary and is not final frozen-candidate acceptance. Browser UI is not yet submitted for review.

## Findings sent to implementation owner

1. Admission originally explicitly locked guest FOR SHARE then allocation FOR SHARE. Existing host guest-save uses settings → allocation FOR UPDATE → guest FOR UPDATE. A guest/allocation lock inversion can deadlock. Participant and approval joins locking both rows also require a deterministic compatible order. The initial fixture loaded host tables but not actual host writer functions, so those cross-function races were not exercised.
2. Control originally obtained session FOR SHARE through scope, then an actor receipt lock, then upgraded session FOR UPDATE. Two operators can hold SHARE and deadlock upgrading. A same-actor operation can hold SHARE waiting on the actor lock while control holds the actor lock waiting on that operation's SHARE. Exclusive control-session acquisition before actor receipt serialization should be verified with deterministic races.
3. Operator/guest read projections require an explicit bounded pagination contract before substantial operational use; this was already acknowledged by the specialist.

These are source-level lock-order findings. New deterministic race fixtures and corrected frozen source are requested before final acceptance; no claim of a live incident or reproduced production deadlock is made.

## Final corrected database acceptance

- SQL: `8d0045db2b317ac766698f8d070da528b82670e286305ac1a67e1aade4c56f02`
- Specialist integration fixture: `bf85db5c8996b1f096a881a468261203c92f6ca3e5c51de0c470f2230b39465d`

The new private source helper reads the allocation reference, locks the allocation before the guest, then rechecks their linkage. Admission, participant validation and approval use the same ordering. Control and control-request recovery acquire the exclusive session lock in the initial scope, before actor receipt serialization, eliminating SHARE-to-UPDATE upgrades. Operator candidate/admission/approval sections and guest order history now return bounded pages and continuation information.

Independently reran all20 isolated PostgreSQL groups: passed (`/tmp/event-service-lifecycle-final-independent.log`). The fixture now loads the actual retained latest host guest-save and its actual helper functions. Its held-allocation schedule exercises that real writer against admission; expected source/business-rule refusal occurs without deadlock. This supersedes the earlier table-only compatibility evidence.

Added `tests/database/event-service-control-locks.independent.mjs`, an independent deterministic schedule over the same retained fixture. It holds both operator receipt advisory locks, starts two controls, asserts that both are waiting before releasing the barrier, then requires one success and one exact CAS conflict. This passed alongside the full fixture (`/tmp/event-service-control-locks-independent.log`). Different operators cannot both acquire a shared session lock and later deadlock upgrading. The original same-actor control/recovery case also passes. The wrapper creates and deletes its temporary runner; runtime SQL is never edited by this test.

The final source and tests remained at the hashes above through review. No outstanding blocker was found in this scoped database candidate after corrections. It requires current production schema/definition reconciliation and prerequisite migrations before any application.

## Operational gates still open

The new flow can add unpaid charges, but it deliberately rejects the existing settlement writer and refuses to close a session with unpaid tab totals. Without a reviewed settlement/reconciliation companion, an operator cannot finish a charged service session or replace its configuration. This is correct fail-closed accounting, not a completed cash/credit operation. Parent was explicitly advised not to present live guest activation as complete before that path exists.

Actual host/guest UI, customer review of amounts, persisted server receipts through those screens, unavailable/stale stock states, physical devices, deployed capabilities and provider settlement were not exercised by this database review. Existing anonymous ordering remains closed; no public gate, customer record, live table or provider was mutated here.

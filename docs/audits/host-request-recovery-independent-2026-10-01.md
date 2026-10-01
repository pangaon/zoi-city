# Host unknown-request recovery independent review

Independent candidate review, 1 October 2026. No production schema/data changes, invitations, purchases or provider writes.

## Source review

All four host writers check the same private actor/request tombstone under request then actor advisory locks. Cancellation serializes on those same keys; existing receipts are returned through the shared receipt reader's current domain authorization. Same actor/request reuse with a different operation rejects. Tombstone response contains only cancellation/request metadata, not a claim capability or guest details. Actor-private namespace and restricted grants preserve receipt isolation. Existing payment writer source uses identical locks and immutable payload comparison; the candidate preserves payment-policy and payment-choice authorization branches in the shared receipt reader.

Client only permits cancellation after a successful unknown-result check; response identity/kind/payment flags are checked before clearing nonce. A lost cancellation response retains recovery state. Account epoch fences late results. Confirmed cancellation clears private drafts and reloads authoritative allocations. No claim of invitation delivery, payment collection or ticket issuance is introduced.

## Independently exercised

- Eight isolated PostgreSQL groups passed: four late writes fenced, wrong-kind/actor isolation, existing completed receipt, claimant/current event ownership, both synchronized concurrency orders, role downgrade while waiting, grants and no raw capability persistence.
- 13 new/existing host unit tests passed.
- Actual mounted browser candidate at 390/1440 passed lost-before-server remount→check→cancel→editing restored, accepted receipt recovery and account cleanup, with no page errors/overflow.
- Inspected `/tmp/host-request-unknown-390.png`. Actual shared/host CSS is loaded. Recovery copy readable; adjacent recovery buttons touch and specialist was asked to apply existing actions-gap wrapper. Payment panel currently shows controlled fixture failure, not successful payment configuration evidence.

## Requested evidence before acceptance

Current database fixture does not load the payment-preferences migration, so preserved payment receipt branches and payment-writer reuse of tombstoned requests are source-reviewed only. Requested actual payment migration stack with payment-policy/payment-choice receipt/current authorization and cross-kind tombstone regression tests. Pending these checks and final visual/hash freeze.

## Final candidate accepted for integration

Specialist added actual event-payment-preferences migration to the fixture and assertions for both payment writers rejecting a cancelled nonce, both payment receipt kinds recovering, and current revoked organizer/claimant authorization denying those reads. Independent rerun: nine PostgreSQL groups pass; browser 390/1440 passes. Final phone screenshot inspected: recovery buttons now separated using existing host-actions styling. The payment panel screenshot remains intentionally failed fixture data and is not payment-setup evidence.

Accepted client SHA256 `70ade97fa81ce4ba1bfb5f2f57fae9bb3b631d9afdeecfce5fb777a63cee37a1`; UI `548fd01b102bdb9e731b446e4bc25e040665c0e25ce598d628e3264121dd633d`; migration `d4cc322a5d81c804593fcf2a272ae4786fae4e839a4f6361690261c0706c5961`. No production execution performed. Lead retains release and live readback.

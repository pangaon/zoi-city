# Durable social delivery candidate

This adds bounded attempts to the existing `social_post_targets` journal. It does not create a second scheduler. A reservation can expire safely before dispatch; after a dispatch permission is committed, a lost reply or expired lease becomes unknown and cannot automatically send again. Concurrent workers receive one dispatch permission. Results and Instagram container identifiers are recorded as immutable facts. Instagram publishing requires a second one-time current-authority and channel check after the container checkpoint.

Calendar provides current-owner review of delivery uncertainty. An owner may report an existing provider link or close the attempt without retry. These are explicitly owner-reported facts, not provider verification. Closure remains binding even if a late provider result arrives. Actor/workspace changes clear private UI, and lost mutation replies recover only the original nonce and original details.

Finalization checks the current canonical author, client and source authority, expected payload hash, and success receipts for each requested destination. A concurrent owner's draft or changed schedule is preserved. Historical provider results remain separate. New Community ledger inserts capture their payload; older ledger entries are not retroactively claimed to prove current copy.

Local acceptance: real isolated PostgreSQL functions and concurrent processes; actual Calendar and review controller at 390 and 1440 pixels with persisted report, committed/lost response, identical retry, reload/readback and scope clearing; controlled worker provider callbacks only. No live provider requests or publication were performed. Production schema/worker/browser acceptance remains the release lead's gate.

## Provider documentation and limits

[X Create Posts](https://docs.x.com/x-api/posts/create-post) documents creation and the returned post ID. [X lookup by ID](https://docs.x.com/x-api/posts/get-post-by-id) supports checking a known post ID. The inspected creation schema did not document a generic idempotency key; this is a bounded documentation observation, not a universal provider guarantee.

[LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-05) documents versioned Posts API writes, returned identifiers and lookup of known URNs. The existing adapter uses the older ugcPosts endpoint; this candidate does not establish live provider compatibility or upgrade that endpoint.

Meta's official Facebook/Instagram documentation requests were unavailable during this review. No undocumented automatic reconciliation behavior is assumed. A recorded Instagram container alone is not represented as a published media receipt.

The RPC-to-network interval cannot be made atomic: revocation after a one-time permission but before HTTP can still race. Durable permissions prevent another worker from repeating that dispatch; they cannot undo a remote side effect. Unknown creation without a confirmed ID remains held for explicit review. This candidate does not automatically query providers, prove absence, or permit a blind retry after closure. Provider-assisted verification, OAuth/API availability and actual sandbox/live publishing remain separate operational gates. No new services or spending are introduced.

## Release and rollback

Apply the exact-reviewed additive migration first. It revokes old service due/snapshot/finalizer entry points so the old worker fails closed. Allow already-running old invocations to drain; schema changes cannot recall an in-flight HTTP request. Run the production rollback/no-send fixture with the dedicated QA owner/session and no helper replacement, then deploy the new worker and Calendar assets together. Verify unauthenticated worker rejection and owner read/review with real current-session authority before enabling any scheduled external test.

If the new worker fails, keep scheduled delivery paused. Do not regrant old dispatch/finalizer APIs or delete the attempt journal to recover. Preserve receipts, lease states and explicit closure history; use reviewed forward corrections. Deleting a post with durable history is refused; moving it to draft preserves that history.

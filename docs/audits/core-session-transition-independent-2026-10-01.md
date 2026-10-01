# Shared Core session transition audit

2026-10-01. Source and deterministic actual-script VM exercises; no real Auth/provider requests, private production reads or mutations.

## Confirmed behavior

Reproducer tests/browser/core-session-transition/audit.mjs executes actual assets/zoi-core.js with controlled fetch/storage. /tmp/core-session-transition-audit.json captures:

1. require RPC invoked under A, synchronous switch to B before promise continuation: sends A's parameters with B's token and accepts the response.
2. prefer RPC invoked under A then switch to B: sends captured A token but records B's auth version at send, accepting A's response under B.
3. A logout/relogin before require send: request proceeds despite explicit session boundary, even with same actor.
4. Cross-tab persisted B session loaded through auth.load while A's request is held: response accepted because authLoad does not change _authVersion.
5. Legitimate same-actor ensureFresh while a prefer request is held: response incorrectly rejected because refresh authSave increments _authVersion.

Existing expired refresh completion already refuses a local authSave/clear that increments _authVersion; that narrower protection is retained. The fresh-session resolved-promise path, prefer path and external storage reload demonstrate why wrapper-only fixes are insufficient.

## Proposed parent-owned correction

Preserve auth revision for stale refresh/OTP responses. Add a separate explicit session-transition epoch captured at RPC invocation, not send time. Reconcile external persisted state at entry. Check transition after refresh, immediately before fetch, and after the full response body. Bind prefer to its invocation actor/session; anonymous mode remains anonymous.

Public auth.save/clear represent explicit session transitions, including same-actor logout/relogin. Internal refresh may preserve transition epoch only after validating same actor/session; it still changes auth revision. Avoid marking every token rotation a new login. Use JWT session identity where available, reject conflicting stored/JWT actor identity, and conservatively treat unknown external opaque-token replacement as a transition. Current credentials must remain server-authorized; client token parsing is only a scope fence.

Auth.load must notice external actor/session changes and advance revision/transition appropriately; a storage listener is needed for observed cross-tab removal/relogin boundaries even when final actor returns to the same UUID. Preserve existing refresh deduplication, transient-failure retained credentials, invalid-refresh clear, deadline/no-mutation-retry and error-envelope behavior. No application .auth.save callers were found in assets/social/community/explore during this review; known refresh commit is internal.

Parent owns runtime implementation. EXPECT_FIXED=1 enables regression assertions in the retained fixture. Additional root tests should include external sameactor token rotation with stable session ID, cross-tab logout/relogin, changed refresh-response actor/session, and anonymous compatibility. Individual consumer scope/DOM cleanup remains necessary after central transport repair.

## Final independent acceptance

Root correction separates session transition epoch from refresh revision, captures RPC scope before queued work, reconciles unseen storage at request and Auth commit boundaries, and validates refreshed actor/session before committing. Malformed JWT claims normalize safely. Explicit save/logout and observed external logout/relogin invalidate pending work; proven same-session token rotation preserves it. Anonymous/prefer anonymous invocation never upgrades to authenticated transport.

Independent tests now promoted to tests/unit/core-session-transition.test.mjs for ordinary CI. Includes queued require/prefer switches, explicit sameactor save and logout/relogin, unseen storage during body/refresh/OTP, same-session refresh, wrongactor/session/conflictingmetadata no-commit, anonymous transport, external session rotation/logout and malformed claims. Combined with existing Core session/events tests, all24 passed (/tmp/core-session-transition-final-units.log), including refresh deduplication/failure and no mutation retry.

Actual browser two-tab storage events also passed: changed actor denies old response; rapid logout/relogin restoring identical final snapshot denies; same-session JWT rotation preserves. tests/browser/core-session-transition/storage.cjs; /tmp/core-session-transition-storage.json. Five original regressions and nine expanded VM cases passed separately. No live Auth/provider requests. Client view/workspace scope guards remain required; central transport protects session transitions, not all product-surface changes.

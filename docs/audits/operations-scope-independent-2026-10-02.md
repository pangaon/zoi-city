# Operations queued scope — independent acceptance, 2026-10-02

Accepted locally for the narrow private transport and identity correction. No production deployment or broad Operations capability claim.

## Reviewed source

Runtime `assets/suite/operations.js` SHA-256 `251654a0b030a97af16b10f269a4722117a876b59f6e8c311f02f15bb306a6c1`.

Mount requires UUID actor/workspace and agreement between the stored actor and shared session identity before recovery storage or private surface creation. Active scope checks current identity, workspace, connected root and retained surface. RPC explicitly refreshes, rechecks scope, rejects unsuccessful refresh, sends through Core with `prefer`, and rechecks after completion. Existing exact receipt recovery remains in place. Runtime was not edited by this reviewer.

## Independently exercised

Retained harness `tests/browser/operations-queued-scope/verify.cjs` SHA-256 `e12857271bcacf503c3196adb4a91b2ad28dc45c8192dbfcc1ef67c04c7c8a58` uses actual local Core and mounted Operations module with fully controlled authentication/RPC network responses. All 24 cases passed at 390 and 1440 pixels:

- Initial read and form save paused during real Core token refresh: same-actor workspace change or detached surface sends zero private RPCs.
- Unchanged same-session refresh: initial read succeeds; form save sends exactly one mutation, accepts its scoped receipt, renders the saved record reference and refreshes the list. The two total calls are one write and one read.
- Refresh HTTP 401: zero private RPCs; private draft/form is absent afterward.
- Missing, opaque, malformed and stored/JWT-mismatched actor identity: zero private RPCs, zero Operations recovery storage accesses, and no private Operations surface.

Nine Operations/recovery unit cases also passed independently. Root separately reported the existing lost-response/remount/recovery browser; that report is not relabeled as an independent rerun here.

Commands:

```sh
EXPECT_FIXED=1 QA_REPORT=/tmp/operations-queued-independent.json node tests/browser/operations-queued-scope/verify.cjs
node --test tests/unit/operations-recovery.test.mjs tests/unit/operations.test.mjs
```

Fresh report `/tmp/operations-queued-independent.json`; log `/tmp/operations-queued-independent.log`. Earlier pre-reset temporary evidence was not reused. Tests mutate only isolated browser fixtures; no customer/provider/database writes. Workspace transition is an explicit mutation of the mounted context, not a claim about the full workspace-picker journey. This acceptance does not establish production authorization, persistence or deployment.

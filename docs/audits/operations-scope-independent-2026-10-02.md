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

## Adjacent retained-DOM gap reproduced after narrow transport acceptance

The earlier transport/identity acceptance remains valid for those cases, but does not establish complete lifecycle privacy. New actual-Core `tests/browser/operations-queued-scope/retained-root.cjs` baseline at390/1440 confirms private draft values remain after idle root detach/reinsert, explicit returned destroy(), and unrelated replacement followed by reinserting the retained old surface. Six exposure cases reproduced. The two queued-refresh controls already clear the DOM through the existing authentication-change path and send no private RPC; they were not mislabeled as failures.

All eight baseline expectations passed; report `/tmp/operations-retained-root.json`, log `/tmp/operations-retained-root.log`. No runtime edits by reviewer. Root owns correction. The harness supports EXPECT_FIXED=1, requiring no retained draft across all scenarios. Whole Operations lifecycle acceptance is held pending this correction; previously exercised transport protections are not discarded.

## Retained-surface correction accepted independently

Final Operations runtime `4fb920d84acac35543a2150907dbd5843725e9b8cf1297aa548f9147c2cb8409` closes the independently reproduced adjacent gap. It captures its owned section before imports, permanently invalidates on document removal records, synchronously consumes pending records before transport and clears the captured section even detached. Cleanup preserves unrelated replacement nodes. Import failure and stale mount clean up their owned section.

Fresh independent evidence at390/1440:

- All eight `EXPECT_FIXED=1 retained-root.cjs` cases pass: idle detach/reinsert, queued refresh, explicit destroy and unrelated replacement with retained old section. No private draft restored or stale RPC sent.
- New `import-ownership.cjs` passes four held-import cases with unchanged account: replacement surface preserved, detached/reinserted root empty, no private RPC or page error.
- Full 24-case actual-Core `EXPECT_FIXED=1 verify.cjs` passes, including identity refusal, false refresh and positive scoped save/reference.
- Existing Operations recovery browser independently passes both widths, covering lost create/remount receipt without duplicate write, transient draft preservation, denial cleanup and late logout; held import/account change also passes.

Reports `/tmp/operations-retained-fixed-independent.json`, `/tmp/operations-import-independent.json`, `/tmp/operations-queued-final-independent.json`; recovery log `/tmp/operations-recovery-final-independent.log`. Root-owned runtime was not edited by reviewer. This accepts the described transport/lifecycle correction, not production database persistence or unrelated Operations product completeness. Production release remains root-owned.

# Properties and Timekeeping scope defects — independent reproduction

Open blocker, 2026-10-02. No runtime changes or live writes.

Properties operator SHA-256 `cbf926585d3a63ba26f8ef3e2093ec0d7b8fabf89b6c0997be48c3b036a57f52`; Timekeeping `f8680b38f4edf778c84d9a80408c401a1157d42f093362e2791c0631ff091c22`.

Both directly call Core RPC with `auth:require` and lack a mounted actor/workspace/surface guard. Their wrapper awaits mount without returning a cleanup handle. Their MutationObserver aborts event listeners when the inner surface disappears, but does not cancel or invalidate awaited transport continuations. Removing the root itself also does not trigger the root child-list observer. Timekeeping additionally owns a periodic timer.

`node tests/browser/private-operators-scope/verify.cjs` exercised actual Core and actual suite wrappers against controlled network fixtures. Twelve cases passed the baseline defect expectations at 390/1440: all eight workspace-change or detached-root cases still sent an old-workspace private read after paused refresh resumed; four unchanged controls read normally. Report `/tmp/private-operators-scope.json`, log `/tmp/private-operators-scope.log`. The harness supports `EXPECT_FIXED=1` for the future correction. Explicit context mutation models a same-actor workspace transition; it is not a full workspace-picker journey.

Recommended narrow repair: shared-session actor and UUID workspace validation before private mount; explicit refresh → active-scope check → prefer transport → post-response check; lifecycle handle returned through wrapper; guard rendering and private cleanup on account/workspace/surface/access denial, including Timekeeping timer cleanup. Add held writes and already-rendered private enquiry/description cleanup cases after implementation. This reproduction establishes stale private reads; it does not claim an unauthorized server write or production data exposure.

## Corrected candidate acceptance

The narrow lifecycle/transport correction is now independently accepted locally. Earlier defect evidence above remains the baseline; it is not the current outcome. Root implemented the runtime; reviewer owns the retained browser harnesses only.

Final hashes:

- Shared `private-operator-scope.mjs`: `959eaeded98a78677188336a2187d802251f62d56f21d2a74f87bb7cbb81af87`
- Properties operator: `d6da695f7aa9f9a01051a86d12e59de2b5f80decce8e7c2434cb9672a39e3722`
- Timekeeping operator: `21556a8877d8d9a665d59fa4443c8085cd2f1b5b8b182bcd330951523be5b561`
- Properties wrapper: `916955a0abe24ba5077c957ece3128c9e073d912c2227ff00d358fe183ee6581`
- Timekeeping wrapper: `9e39bddc1b4bc692c4a5b2dc32b25dce5212a9053703b88f36537fe7384d7afc`

Shared scope checks UUID/current shared identity, captured workspace, owned surface and connected root before/after authentication refresh and transport. Denial invalidates private state and DOM. Cleanup is returned through the wrappers; Timekeeping's timer clears on scope abort. Wrapper child-node snapshots prevent a held import from replacing an unrelated new surface.

Independent review found an additional retained-DOM defect: detaching the root invalidated state but left private markup in the disconnected root, so reattaching it exposed the old enquiry. Root corrected cleanup to clear the retained owned surface even when disconnected. The dedicated detach/reattach regression now passes for both tools and widths.

Fresh independent tests:

- Original 12 actual-Core queued-read scenarios pass corrected expectations: `EXPECT_FIXED=1 QA_REPORT=/tmp/private-operators-fixed.json node tests/browser/private-operators-scope/verify.cjs`.
- New 52 actual-wrapper cases pass: `node tests/browser/private-operators-scope/journeys.cjs`. Covers queued writes during workspace change/detach, same-session positive save and displayed confirmation, refresh401, held read response after workspace/account change, 403 private clear, returned cleanup, detach/reattach, held import with unrelated replacement surface, and missing/opaque/mismatched identity. Both390/1440; no browser page errors. Reports `/tmp/private-operator-journeys.json` and `/tmp/private-operator-journeys.log`.
- Six Properties/Timekeeping model units pass independently.

Positive saves use controlled receipts and readback; no live property publication, time ledger persistence, provider operation or broader workflow completeness is claimed. Workspace transitions deliberately mutate the mounted context, not a full picker. These tests accept the private lifecycle correction only; root retains release and production verification ownership.

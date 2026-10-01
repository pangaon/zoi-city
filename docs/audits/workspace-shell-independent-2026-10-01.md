# Independent workspace shell acceptance — 1 October 2026

Reviewer: workspace_qa. Candidate worktree: `.recovery/community-release`.
This is local candidate evidence, not a production release claim.

## Exercised actual source

`tests/browser/workspace-shell/verify.cjs` serves the current `social/index.html`
without changing its inline shell functions. It retains the real `bizpage.js`,
workspace creation controller, navigation and imported view modules. It replaces
external suite scripts/core with a controlled authenticated RPC adapter and an
Overview mounting probe. All external network requests are blocked. No real
workspace, account, OTP, message or payment is created.

Candidate hashes at acceptance:

- `social/index.html`: `e44d6e14b182396fd4dea7a96caeac21b96b6bc49641b4505af1124eed874c10`
- `assets/suite/workspace-creation.mjs`: `897114f215c9937277fa0c3bd4aa5e4b2189fd6c0165e92dbc276ddf6b9d2793`
- `assets/suite/bizpage.js`: `3f2ccd0cc5b60af1deac4600497ac4a79c9b2449ebc4ceb5dc9ca2dd6bba1a24`

## Results

Actual shell checks passed at both 390 × 900 and 1440 × 900:

1. Starting with an explicit old-workspace query, confirmed creation opens the
   exact returned new workspace after membership readback.
2. Two Enter submissions produce one creation RPC.
3. A lost creation response leaves creation disabled; checking memberships does
   not resend or infer that a returned workspace is the original request.
4. Recovery storage contains references, not the private business name.
5. An account-change event clears the private creation input and review links.
6. A requested missing listing produces an explicit chooser and zero content
   reads; it does not silently edit the first available listing.
7. Explicit selection updates the exact listing/workspace query before the
   `#home-design` hash and loads only that listing.
8. Switching workspace updates the explicit query, removes stale listing and
   legacy `ws` intent, reloads and opens the chosen workspace.
9. Cancelling the unsaved-changes dialog retains the original workspace URL.
10. No uncaught page errors or horizontal body overflow in these exercised states.

An adjacent dropdown defect was found during review: its old handler changed only
localStorage before reloading, while boot prioritizes the explicit URL workspace.
The lead corrected that handler; checks 8–9 cover the resulting candidate.

Independent reruns of the existing creation browser fixture passed at both widths.
The creation and navigation unit suites passed all 17 tests, including the held
initial-load serialization and cleanup-storage-failure regressions. Those two
storage races are unit-level evidence, not claimed as browser fault injection.

## Rendering and limits

Screenshots: `/tmp/workspace-shell-390.png` and
`/tmp/workspace-shell-1440.png`. The phone screenshot was visually inspected:
workspace identity, editor headings and controls fit the viewport. The controlled
adapter deliberately does not implement saved-design RPCs, so the design panel
shows its retry state. This is not acceptance of the complete design editor,
all modules, live authorization, native devices, real provider connections or
production workspace creation. Deployment verification remains with the lead.

Run:

```sh
CHROMIUM_EXECUTABLE_PATH=/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome node tests/browser/workspace-shell/verify.cjs
node --test tests/unit/workspace-creation.test.mjs tests/unit/workspace-navigation.test.mjs
```

The three runtime hashes above were also matched against the lead's exact staged
archive `/tmp/zoi-workspace-artist-release-f6mv3ko0` (tree
`31a094ba9738a511e1cbbc557da4f29eeb521405`). The verifier additionally supports
`WORKSPACE_SOURCE_ORIGIN` to exercise downloaded deployed modules with controlled
RPCs after release; that mode has not yet been run at this audit checkpoint.

## Production readback — release 0f29bc0

After the lead pushed `0f29bc0`, read-only requests to
`https://zoi.city/social/index.html`, `/assets/suite/bizpage.js` and
`/assets/suite/workspace-creation.mjs` returned bytes identical to the three
reviewed SHA256 values above. The deployed-source verifier then passed all shell
checks again at both 390px and 1440px with no uncaught page errors.

Command:

```sh
WORKSPACE_SOURCE_ORIGIN=https://zoi.city CHROMIUM_EXECUTABLE_PATH=/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome node tests/browser/workspace-shell/verify.cjs
```

These are actual deployed frontend modules exercised locally with controlled RPC
responses. They prove the deployed shell's handling of the tested responses, not
an authenticated production creation or production backend write. No live account
or workspace was changed by this reviewer.

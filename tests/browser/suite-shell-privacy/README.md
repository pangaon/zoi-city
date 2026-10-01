# Suite shell privacy journeys

Run from the repository root:

```sh
node tests/browser/suite-shell-privacy/verify.cjs
node --test tests/unit/schedule.test.mjs tests/unit/composer-ai.test.mjs
```

Optional `OUTPUT_DIR` isolates reviewer artifacts; `CHROMIUM_EXECUTABLE_PATH` overrides the installed Chromium path. The harness serves the actual Social shell and module files. Its backend, auth identities and provider responses are synthetic; external network is blocked. No customer/provider/database mutations occur.

At 390 and 1440 px, assert account-switch modal cleanup, held save/publish cancellation, old template response rejection, actor-scoped draft isolation, actual workspace-selector navigation, unchanged-account publishing/recovery and Calendar-to-Composer handoff. RPC and raw upload/AI denial responses clear private content. No page errors are allowed. Initial AI/Analytics/Connect shell replacement is checked only; this is not full provider/queue acceptance for those modules.

The shell workspace selector navigates the whole document; that test deliberately reports document replacement, not an in-place context change. Synthetic successful publication establishes client continuation behavior only, not provider delivery.

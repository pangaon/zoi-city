# Operations mounted recovery acceptance

Run with Chromium installed from the repository root:

```sh
node tests/browser/operations-recovery/verify.cjs
```

`CHROMIUM_EXECUTABLE_PATH` can select a local Chromium binary. Uses repository Playwright and serves only local assets. Actual Operations UI and shared recovery controller are mounted at 390px and 1440px against controlled RPCs. No production database, auth session or real client record is used. The separate `tests/database/operations-recovery.integration.mjs` exercises actual PostgreSQL transaction and authorization behavior.

Also holds the recovery-module import across an account change to ensure an old asynchronous mount cannot replace a newer surface. Browser page errors are asserted empty. The test runner closes its browser and local server.

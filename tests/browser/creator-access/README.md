# Mounted creator access acceptance

Run from the repository root:

```sh
CHROMIUM_EXECUTABLE_PATH=/path/to/chromium node tests/browser/creator-access/verify.cjs
```

The executable override is optional when Playwright Chromium is installed. Uses the locked `playwright-core` dependency, an ephemeral loopback server and actual `studio.mjs` / `customer.mjs` modules. All RPC/auth/OTP results are synthetic and local; external browser requests are refused. No real session, message, database write or OTP is created.

At 390 and 1440 pixels the harness checks transient read failure preserves unsent draft text; authoritative denial clears private details and can recover via Refresh; signout clears private content; old deferred success and denial cannot repaint a same-root remount under a new account/workspace; delayed customer OTP-send and OTP-verify results cannot replace a new actor's loaded campaign. Unexpected browser errors fail the run. Browser/server cleanup executes on success and failure.

This verifies frontend lifetime boundaries only. It does not replace PostgreSQL authorization, real sign-in, durable uncertain-write recovery or native-device acceptance. No production assets are changed and no screenshots are required.

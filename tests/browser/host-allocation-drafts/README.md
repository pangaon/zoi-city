# Host allocation review drafts

Run from repository root with Chromium installed:

```sh
node tests/browser/host-allocation-drafts/verify.cjs
```

Set `CHROMIUM_EXECUTABLE_PATH` if using a non-default Chromium executable. The runner uses the repository's Playwright dependency and a loopback-only controlled RPC fixture. It mounts the real host controller at 390px and 1440px.

Assertions cover grant host reference/quota/local expiry and guest label/whole-ticket quantity surviving Review → Back to editing, no mutation before confirmation, private drafts cleared on revoked reads and account changes, and zero browser errors. External requests are refused. No production authentication, invitations or reservations occur.

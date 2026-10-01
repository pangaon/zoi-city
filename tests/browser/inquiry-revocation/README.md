# Mounted inquiry access revocation

Run from the repository root with installed Chromium:

```sh
node tests/browser/inquiry-revocation/verify.cjs
```

Set `CHROMIUM_EXECUTABLE_PATH` when using a non-default browser executable. The runner requires the repository's `playwright-core` dependency.

The actual shared customer/operator module is mounted at 390px and 1440px using a controlled operator RPC fixture. It asserts transient read failures preserve drafts, SQL permission denial and HTTP 403 remove loaded private settings/list/messages, uncertain send nonces survive denial while in-memory message payloads are discarded, restored reads cannot bypass the nonce fence, late account-switch reads cannot repaint, and a denied first mutation clears private content. No external requests, production authentication, message delivery or database writes occur. This is frontend acceptance, not a replacement for PostgreSQL authorization tests.

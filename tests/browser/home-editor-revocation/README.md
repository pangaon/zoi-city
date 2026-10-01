# Mounted private home editor revocation acceptance

From repository root, with the existing locked dependencies installed:

```sh
npx --no-install playwright-core install chromium
node tests/browser/home-editor-revocation/run.cjs
```

An existing Chromium installation can be selected with `CHROMIUM_EXECUTABLE_PATH`.
The script serves repository assets on an ephemeral loopback port, imports the actual
shared editor, and closes the browser and server on completion or failure. It makes
no production requests, sends no messages, and uses only controlled fixture RPC
responses. External browser requests are refused. No screenshots are generated.

At 390px and 1440px it checks transient failures preserve work, revoked authority
clears protected controls, uncertain-write storage survives denial and restored
access without a duplicate write, sign-out/account switches clear private state,
and non-JSON preview 403 clears content while a transient 502 preserves the draft.
Unexpected browser errors fail acceptance. The fixture is test-only, not an auth
seam or evidence of an authenticated production publication.

# Shared identity independent regressions

Run from repository root:

```
node tests/browser/session-identity/locality.cjs
node tests/browser/session-identity/consumers.cjs
node tests/browser/session-identity/queued.mjs
node tests/browser/session-identity/refresh.mjs
```

Browser scripts use Playwright Core and CHROMIUM_EXECUTABLE_PATH (Codespaces default supplied). Every external browser request is blocked; only candidate modules and fixture HTML are served. Reports go to /tmp/shared-identity-regression.json and /tmp/shared-identity-consumers.json.

Locality exercises actual DOM at 390/1440: unresolved opaque/email identities cannot read private home; resolved UUID accepts a distinct internal profile UUID; account loss clears and late responses cannot restore home. Consumers mounts actual Community and Business home at both widths: public anonymous Community feed remains available; unresolved private reads and Business home reads are denied. These are functional privacy tests without product styles, not visual design acceptance.

Queued extracts the current runtime RPC helpers, pauses refresh, changes account, and verifies no send; valid same-account reads/writes and boolean delete normalization remain. It is a helper transport test, not a full rendered save/delete journey. Refresh uses the real default locality fetch path, pauses refresh, changes account without an event, and verifies zero private fetches. No real Auth session, provider traffic, or production writes are used.

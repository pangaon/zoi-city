# Documents privacy independent review — 2026-10-01

Accepted for the scoped client privacy correction. This is local candidate acceptance, not production upload or storage-provider verification.

## Reviewed source

- `assets/documents/client.mjs`: `3b6d92031e4d7a1b180fe686619aed7321cc704081d6552f1c5c8a8f9a4d5bb0`
- `assets/documents/operator.mjs`: `7f1251c595815357047abe100d424830f986c770923ecf3b4fb68bfa7f10f897`
- `assets/suite/documents.js`: `22d449d3ccf90b8002f20e003f0aad5402c30c761a5628b35522f3bf8c9f2b62`

The raw client checks its captured scope before and after refresh, before transport, and after response/body reads. Error status survives decoding. The operator requires UUID actor/workspace identity, checks the mounted surface and current context, clears private state on denial/disposal, and revokes temporary download URLs. Root's final operator RPC change explicitly refreshes, rechecks the surface/workspace, refuses failed refresh, and only then uses the preferred existing token. This closes the same-actor workspace transition gap which a central account epoch alone cannot prevent. Versioned dependency imports were included in review.

Existing request identity, version CAS and already-sent mutation semantics are preserved. This review does not claim that cancelling a UI lifecycle cancels a server mutation already sent.

## Independently exercised evidence

- `node --test tests/unit/document-client-scope.test.mjs tests/unit/document-files.test.mjs tests/unit/document-edge.test.mjs`: 15 passed. Log `/tmp/documents-units-independent.log`.
- `OUTPUT_DIR=/tmp/documents-independent node tests/browser/suite-documents-privacy/verify.cjs`: passed at 390 and 1440. Actual Social shell with controlled APIs exercises upload refresh/account transition, detached old surface, positive upload/version history/download bytes, 403 cleanup, and unresolved/opaque identity denial. Evidence `/tmp/documents-independent/findings.json` and `/tmp/documents-browser-independent.log`.
- Added `tests/browser/suite-documents-privacy/queued-workspace.cjs`: four direct actual-operator DOM cases passed, list and archive at both widths. Holding refresh and changing the same actor's workspace produced zero private RPC sends after the switch. Evidence `/tmp/documents-queued-workspace-independent.json`. This is a direct operator test, distinct from full Social navigation above.

All transport fixtures are controlled; no real customer upload, document modification, external message or provider request occurred. Browser assertions establish behavior and mounted-surface cleanup; no separate visual redesign acceptance is claimed. Production deployment, exact deployed bytes and live storage capability remain the release owner's separate evidence.

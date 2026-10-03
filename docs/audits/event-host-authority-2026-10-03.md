# Event host current-session authority derivative

This is a narrow additive derivative of accepted host packet `cf0977ae92ca4526c576c6a16d9d0bbbb8c88facd61abd528076b4146ac0ee9a`. The original 347-entry snapshot is immutable. Only `assets/events/host-controls.mjs` changes at runtime, in the isolated checkout. No schema, community-release runtime, room, source pricing, event identity, payment option, active sales count or live data mutation occurs here.

The independently identified defect is confirmed with the actual Core transport shape: a database `invitation_unavailable` message can arrive with HTTP400; Core creates Error(message) with `.status=400`. The original adapter treated it as uncertain transport and retained its pending receipt and owner editor. Foreground focus also skipped authority checks when the account ID was unchanged, so expired/revoked same-account sessions could retain displayed fields. The retained baseline browser run reproduces 14 failures, and the baseline unit reproduces pending-receipt retention for current-session refusal.

The new shared classifier recognises known current authority messages/codes, 401/403, and Core's exact session-changed/sign-in errors. Definitive current-session refusal clears the exact stored pending announcement, retires the owner snapshot and removes its editor/preview/actions. Account-switch fencing remains unchanged. Foreground focus with a current snapshot performs the existing protected `home_content_get` check, even for the same account. An authorised foreground read does not replace dirty fields or their reviewed CAS version. Transient reads preserve edits; an unknown save/response still preserves its immutable retry request. No broad HTTP400 or arbitrary “session” text is classified as permission failure.

Evidence in `docs/audits/evidence/event-host-authority-2026-10-03`:

- `baseline/host-controls.mjs` and `unit-before.log` retain the original source/failing regression.
- `before/report.json`: all 14 phone/desktop current-session/foreground cases fail against the original module.
- `after/report.json`: all 14 pass. These exercise HTTP400 refusal before status/read, on save, after a lost response retry, and on same-actor foreground expiry with dirty or pending fields. A 503 foreground read preserves the entered count and usable controls. The actual existing publicity editor is used; no writer permission is invented.
- `unit-after.log`: 57 tests pass, including current-session message families, status401/403, exact Core session transition error, and transient/unknown-response retention, plus the original scoped writer/publicity/payment/inventory/private planning regressions.

Only controlled authorised responses are exercised. This is not a live sign-in, expired-session production exploit or actual publication. The approved editor uses existing real writers; no default sales count appears in production. Root owns final independent review, current-release patching/version stamps and deployment.

Replay from the additive snapshot with shared installed dependencies:

```
NODE_PATH=/workspaces/zoi-city/.recovery/community-release/node_modules QA_OUTPUT_DIR=/tmp/event-host-authority-review node tests/browser/event-host-controls/authority.cjs
node --test tests/unit/event-host-controls.test.mjs tests/unit/event-publicity.test.mjs tests/unit/event-publicity-view.test.mjs tests/unit/event-payment-policy.test.mjs tests/unit/table-inventory-operator.test.mjs tests/unit/signature-startup.test.mjs tests/unit/signature-experience.test.mjs tests/unit/signature-planning.test.mjs tests/unit/signature-table-choice.test.mjs
```

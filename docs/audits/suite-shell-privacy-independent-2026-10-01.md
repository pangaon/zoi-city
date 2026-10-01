# Independent Composer and Calendar privacy acceptance — 1 October 2026

Accepted after the final identity correction: root identified unresolved actor identity allowing `undefined === undefined`; the refrozen candidate now requires actor and workspace UUIDs and returns before private reads, raw transports or storage for missing/opaque identity. Independent 38-case actual-shell rerun passed, including the new negative cases. This is not evidence of live provider publication or completion of every suite tool.

## Frozen source

- Composer: `c22735cef643a5da85e6d69082a7a37215ff0527e9b1fa47646abeecc1bcf811`
- Calendar: `caf0874282b0e8a4b07af265e92231cbeceb7b3a250c9e47325300da6dba90d6`
- Shared scheduling helpers: `bab7d318bcb40fd7b837a40d2e21fd183ff847f71eec27d32629f873c8c2c258`

Mounted actor/workspace/root identity guards now surround RPC entry and completion. Detached tools stop continuations, timers and body-mounted dialogs. Same-account navigation retains a meaningful draft; another actor cannot consume that draft or Calendar handoff through these helpers. Legacy unscoped storage is deliberately not imported. Storage remains readable by someone inspecting the same browser; this is application identity isolation, not encryption.

The earlier raw transport blocker is resolved: AI checks failed HTTP status before parsing JSON, and upload preserves status. Both feed the same authorization-denial clear path, including non-JSON 403 responses. Already-issued server operations cannot be undone by this client guard; obsolete results and subsequent writes are rejected.

## Independently exercised

`node --test tests/unit/schedule.test.mjs tests/unit/composer-ai.test.mjs`: 38 passed. Log `/tmp/suite-shell-privacy-units-independent.log`.

`OUTPUT_DIR=/tmp/suite-shell-privacy-independent node tests/browser/suite-shell-privacy/verify.cjs`: 30 asserted actual Social shell cases at 390 and 1440 pixels passed with no page errors. Findings `/tmp/suite-shell-privacy-independent/findings.json`; log `/tmp/suite-shell-privacy-independent.log`.

Cases cover held read and save across account change, removal of private body dialogs, no downstream publication after stale save completion, actor-scoped stored draft recovery, explicit same-account Restore, Calendar-to-Composer handoff, normal save/publication RPC sequence and RPC/AI/upload denial cleanup. Actual workspace selection navigates to a new document: that case establishes document destruction, not an in-place workspace mutation race. AI/Analytics/Connect checks establish old shell surface removal only.

Phone screenshot inspected: shell/cards are readable and contained. The saved recovery screenshot's initial viewport shows the upper tools; successful draft Restore is established by the browser value assertion, not by claiming the editor is visible in that screenshot.

All backend and provider responses were controlled, external requests blocked, and no live messages, publications or customer writes occurred. Production release and server authorization remain separate evidence owned by the lead.

Final identity rerun: `/tmp/suite-shell-privacy-identity-independent/findings.json` (38 cases), log `/tmp/suite-shell-privacy-identity-independent.log`. Prior 30-case evidence above remains the earlier candidate record. New AI/Connect runtime work is excluded from this acceptance.

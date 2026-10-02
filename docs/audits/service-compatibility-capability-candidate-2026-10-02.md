# Service compatibility and installed capability candidate — 2026-10-02

This is producer evidence for the lead's independent review. Nothing in this packet was applied to production. Source, controlled rendered journeys and production readiness are separate below.

## Source contract

The exact owned-file SHA256 manifest is [candidate-manifest-2026-10-02.json](evidence/service-capabilities/candidate-manifest-2026-10-02.json). Existing setup, atomic lifecycle and cash migrations remain unchanged dependencies. No payment, host/Parea, Social, navigation or suite-wrapper implementation was changed. Tickets Studio edits were discarded: its current URL redirects to `/tickets`. Legacy compatibility is for cached callers, not an invented new Studio screen.

Menu's retained signature preserves its original success envelope and field domain, including legacy names/prices/stations outside modern form limits. It now locks current workspace membership and checks current session after item waits. It deliberately has no safe retry guarantee for a lost legacy create response. Modern receipt/CAS calls remain unchanged and never fall back to legacy writes.

The legacy KDS signature permits serialized forward fulfillment and same-state no-ops, with current authority and session checks. Repeating preparing cannot consume stock again. Order cancellation is refused: this packet does not invent a refund or accounting reversal. Request cancellation remains a separate recovery operation.

The final additive capability reader verifies 51 exact function bodies and their security/search_path/execute grants, ten enabled trigger identities/types/deferral settings, and sixteen private tables' RLS and effective client privileges. The two authority functions are checked before obtaining actor/role context. Their retained prosrc hashes match the lead's current readback: suite_lock_session `ab5f8703ced5f96c0ac69257281ffe00`; workspace_locked_role `0c25b1e04d01e5866b58d009fa1f50b9`. An altered body or direct client execution grant refuses the entire capability response. This is an explicit reviewed manifest, not a runtime trust-on-install snapshot.

Baseline Menu/Setup/Queue may be available independently; lifecycle requires the complete setup, queue, stock and cash reconciliation stack. Exact numeric version, Auth actor, distinct internal profile, workspace/event and current role are validated by clients. Missing/malformed proof closes modern reads, writes and pending-request recovery. Existing nonce markers remain intact. Explicit existing Refresh controls recheck capability before exact recovery; they do not automatically retry mutations. The operator Reload action also rereads context, fixing recovery when an initial unavailable proof left no selected event.

## Exercised evidence

All PostgreSQL tests use isolated local PG16 databases and retained real functions, not production requests:

- `node tests/database/service-menu.integration.mjs`: 15 groups, including original legacy domain, exact envelope, current role/session and actual workspace/item lock waits.
- `node tests/database/service-queue.integration.mjs`: 12 groups, including legacy forward/no-op/cancellation behavior and workspace/order lock waits.
- `node tests/database/service-capabilities.integration.mjs`: 13 groups including reused lifecycle prerequisites, partial/full installation, real KDS stock consumption once, disabled/replica trigger, changed body, changed authority source/grants, private-table privilege drift, viewer/session denial and public/private ACLs.
- `node --test tests/unit/service-capabilities.test.mjs`: five tests for strict envelope, pending marker preservation, held-scope and denial behavior.

`tests/browser/service-capabilities/verify.cjs` passed ten controlled cases: Menu, Setup, Queue, operator lifecycle and guest lifecycle at 390/1440. Each starts with an unknown request marker, blocks all operational RPCs while capability is absent or malformed, then explicitly refreshes a verified capability and settles one exact request cancellation. No mutation is dispatched. Existing actual component journeys and actual Social Menu/Setup/Queue plus operator/guest mounts passed at both widths. The retained family ownership, lifecycle import/replacement and delayed detach/reattach regressions also passed. Network contracts are controlled: these are not live inventory, payment or customer operations.

Terminal logs are copied to `docs/audits/evidence/service-capabilities/` with an evidence hash manifest; original logs remain under `/tmp`: `service-compat-menu.log`, `service-compat-queue.log`, `service-capabilities-pg.log`, `service-capabilities-unit.log`, `service-capabilities-browser.log`, and `service-capabilities-{menu,queue,setup,lifecycle}-browser.log`; actual shell/mount logs `service-capabilities-{menu,queue,setup}-shell.log`, `service-capabilities-mounts.log`; ownership logs `service-capabilities-{family,ownership,retained}.log`. Phone/desktop rendered captures are in `/tmp/service-capabilities-candidate`. The operator phone unavailable state was visually inspected: explanation readable, recovery visibly disabled, Refresh reachable. Inline JavaScript verification also passed.

One test-only authority introspection initially attempted a private-schema regprocedure lookup as authenticated and was correctly denied. The fixture now performs that administrative drift setup as the isolated DB owner; actual capability calls remain authenticated. The final run passed. No permission was widened to accommodate the fixture.

## Release and activation boundaries

The lead owns independent review, all live preflight/application, and parent reachability/cache integration. Required chain: current authority → Menu → paused setup → Queue → atomic lifecycle → cash → final capability migration. Preserve each retained definition guard; do not blindly replay after timeout. Lead preflight confirms original Menu/KDS full-definition hashes match the held guards, but this packet itself performs no live read or write.

Parent integration must include reachable Social service tool entries and both suite wrappers without replacing released Company routes, plus the exact wrapper/child/helper cache chain. Guest host-page mount must preserve released organizer/Parea work. A successful local fixture does not prove those production consumers are reachable.

Real setup still requires an owned published event, venue/tables, reviewed available CAD menu revisions, explicit initial quantities, service window, staff approval rules and legitimate admissions. No seed catalogue or customer records are created here. Scope is fixed initial stock, explicit physical cash acknowledgment/reversal, and fulfilled/reconciled permanent closure. Restocking, online collection, charged-order refunds/cancellation and post-close corrections/reopening remain unavailable. Payment response-deadline work is separate and was not activated.

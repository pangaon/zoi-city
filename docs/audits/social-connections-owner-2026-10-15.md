# Connect local lifecycle recovery — owner candidate

This recovers a concrete unfinished part of the original owner-tools work: current owners/admins can inspect safe connection state, explicitly remove local credentials, and reopen the persisted result/history. It extends the existing Connect suite and social_channels records. No provider permission revocation, refresh, OAuth activation, new credentials or external sending is introduced.

Original recovery evidence: `/workspaces/zoi-city/docs/audits/original-worktree-recovery-classification-2026-10-15.json` (18c6668c). Current main Connect had no local disconnect API; both source search and read-only production function-name metadata found the old lifecycle RPCs absent. This is a selective reimplementation against current canonical authority, not a wholesale port of the old unguarded migration. The existing delivery board connected-tools lane remains authoritative; this audit is evidence, not another queue.

## Contracts and authority

CLI-created migration20261015023559 adds connection_version and three authenticated owner/admin RPCs: social_connections_status(workspace), social_connection_disconnect(workspace,channel,expected_version,request), social_connection_history(workspace). Exact current assert_workspace_write/workspace_locked_role/suite_lock_session bodies, owner, ACL and empty search path are guarded. Existing signatures/functions and durable publisher files are unchanged.

Workspace-first foundation authority includes actual owner fallback without a member row; forged owner labels are refused. A current account/session and locked current profile mapping are required, including successful receipt replay. Bigint IDs/versions travel as decimal strings. The additive BEFORE UPDATE trigger increments the version on every channel update, so existing OAuth/reconnect writes invalidate old snapshots without a signature change. Trigger function has no new client grants.

Disconnect locks current authority, account/nonce and channel, compares the expected version, removes access/refresh tokens, expiry, scopes, meta, connected_by and last_error, and persists a token-free receipt in one transaction. Status/history contain no token, private meta or raw provider error. The private RLS journal is not accessible to client or service roles. Public mutations cannot update/delete old receipts. Exact actor/account/workspace/nonce/payload replay returns the original receipt after current authorization; it does not clear a later reconnect. Fresh requests are bounded to500 per account/rolling24h under an account lock. Already-clean disconnected channels refuse another fresh mutation.

The existing publisher current-channel gate actually refuses dispatch after this local disconnect. This does not atomically recall an HTTP request whose dispatch permission was already obtained. Existing durable delivery reconciliation remains necessary; the RPC-to-network race is not claimed solved.

## Web recovery

The actual Connect script imports the scoped helper and requires schema1/account/workspace/immutable-receipt proof before enabling Disconnect. Old-schema404 supports legacy read-only display. Current responsive CSS remains. All saved accounts are rendered, rather than only the first connected account per platform. States distinguish Connected locally, Connection needs attention, Disconnected locally and planning-only handles.

A durable account/workspace marker contains only nonce/channel/version, never a token or private channel content. Unknown results require the original request; closing/reopening preserves it. Only an exact canonical receipt clears it. First known non-writing validation refusals can unlock correction; earlier uncertain retries remain held even if access/version later changes. Final beforeDispatch scope checks execute after the real Core refresh. Account changes/403 authority refusals clear private DOM; expired access can refresh without being mistaken for an account change.

## Actual isolated acceptance

- 14 helper unit checks: immutable original recovery, response loss/reopen, mismatched receipt, account switch, delayed dispatch, first-known versus earlier-unknown refusal, blocked storage, safe status, bigint bounds, scoped history, local-only receipt semantics and expired-token account binding.
- `ZOI_CONNECTION_PRODUCTION_FIXTURE=1 ZOI_CONNECTION_BROWSER=1 node tests/database/social-connections.integration.mjs`:51 grouped checks passed. This reuses the existing32 real durable-publisher gate groups unchanged, then adds19 connection/race/fixture/browser groups. Existing publisher transport is controlled, not a live provider.
- Current actual foundation definitions are reused without authority helper overrides. Fixture-only table/owner/ACL metadata is aligned to captured production guards. Auth/JWT transport is controlled. Real isolated session/role/profile data and locks determine authorization.
- Concurrent same-nonce calls commit one receipt. Actual concurrent workspace ownership change, session deletion and profile reassignment refuse disconnect without clearing credentials. Stale version/different payload are refused. Old immutable success survives reconnect. Current admin and actual owner-without-member positives pass; forged owner/editor/viewer fail.
- Actual Core + Connect UI to canonical SQL at390/1440: commit then lost HTTP response; actual session expiry retry403 clears private DOM and retains uncertainty; close/reopen retries exact nonce with no duplicate; safe persisted history readback; accountB clearsA; held real Core refresh blocks old dispatch; zero page errors/overflow. Screenshots and browser JSON under `docs/audits/evidence/social-connection-owner-2026-10-15/`.
- Root-only production rollback fixture passes17 assertions and4 absence flags in isolated production-shaped data, with account/profile UUIDs distinct. It creates no auth user and alters no real QA role/session. This is NOT actual production acceptance yet.
- Node syntax checks and git diff whitespace check pass. Phone screenshots visually inspected; existing theme/layout retained.

## Release gate and remaining work

Candidate only until independent QA, root schema apply, actual rollback fixture, coordinated web release and deployed owner journey. Root must version the existing social/index.html Connect asset URL to20261015-local-disconnect (outside this specialist's files). Apply schema first; the new helper import is versioned. Keep old provider/refresh implementation disabled/unmodified. A stale expected authority hash stops release rather than weakening a guard.

Rollback: remove new clients first; preserve private receipts/history. Root may remove new RPC execution/trigger only through reviewed migration after accounting for connection version consumers. Do not restore removed credentials or replay a disconnected provider request. Normal canonical channel data and old writers remain; no production credential is captured in this artifact.

No native source/build/runtime was changed or newly accepted. Native local disconnect and any deliberate canonical-web handoff remain separate acceptance work. Provider-wide revocation, configured current API refresh, app review/scopes, real delivery and whole-ecosystem completion remain open. No production mutation, provider call, secret value read, deployment or commit was performed by this specialist.

## Independent cross-tab finding corrected before release

Named browser Web Locks now cover the entire account/workspace mutation admission, request dispatch and marker update/clear, for both new disconnect and retry. Scope is rechecked after waiting for the lock and again after Core refresh; a queued tab cannot dispatch an old actor/workspace operation. The pending marker is reread inside the lock. Storage events update the recovery view and read current status after another tab resolves a reference. Browsers without this coordination capability fail closed for disconnect/retry; safe reads remain available and the UI explains the limitation.

Actual two-tab Chromium against canonical SQL at390/1440 holds the winning HTTP response after commit, starts the second tab before the winner receives a controlled lost response, then verifies exactly one dispatch/receipt, both tabs retaining the original uncertain nonce, and a successful original retry. Two additional helper tests cover shared-lock admission and unavailable-lock refusal. Final acceptance remains51 grouped database/browser checks and14 unit checks; schema/production fixture hashes are unchanged.

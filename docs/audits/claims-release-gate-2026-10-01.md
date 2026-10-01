# Claims release candidate and production gate — 2026-10-01

The staged claim authority, sign-in continuation, exact workspace handoff, admin review and workspace claim tracking are accepted in their separate independent audits. This is a release candidate, not a live acceptance claim.

Exact staged runtime checks passed 267 node:test files plus two standalone suites at `/tmp/zoi-claims-tracking-release-98ewrtds` (tree `b89692943700f0e1f84a803db210702ed43736d3`). Final archive `/tmp/zoi-claims-tracking-final-fq4fs58b` (tree `1bb378ba9caf14564e5ee45cecd77a772a7da448`) adds the missing browser fixture only; targeted database/browser checks run against that archive. The earlier handoff/admin/auth candidate also passed the full suite before tracking integration.

## Production incident

One `apply_migration` request for `claim_authority_and_receipts` returned: `Failed to initialise history table: Connection terminated due to connection timeout`. Subsequent read-only reconciliation requests for the authority table and claim-function fingerprint also timed out. The migration outcome has not been confirmed; no automatic migration replay or web deployment was performed.

A public `home_entity` request for Signature timed out after20 seconds. Auth health timed out after15 seconds; the unauthenticated REST root returned401 in0.07 seconds, which proves gateway reachability only. Project metadata reports ACTIVE_HEALTHY, not proof of working database/Auth journeys. PostgreSQL log sample for09:40–09:55UTC contains statement timeouts. No root cause or successful recovery is claimed.

Supabase's public status page still lists the Eastern-US latency incident, including serverless clients regardless of project region: https://status.supabase.com/ . This may contribute but does not establish the cause of internal database timeouts. No provider restart, broad cancellation, customer claims, messages or payments were executed in this release attempt.

Next release gate: obtain authoritative readback of migration history/schema before deciding whether to apply; apply the separately reviewed bizpage_status migration; verify function/ACL readback; deploy coherent web candidate; exercise actual production journey and distinguish controlled-transport tests from authenticated live canaries. Full original scope remains in docs/recovery-scope.json.

## Subsequent acceptance and current public impact

Claim/ownership journey candidate is committed locally as `b4e2c30`; shared suite role/session repair is committed locally as `7db07d4` after17 independent PostgreSQL groups passed. Neither commit has been pushed. Full Social-shell claim tracking controlled journeys passed390/800/1024/1440; root inspected phone/desktop screenshots, and independent header review caught an additional1024 search-width issue under correction.

A later actual public request to `https://www.zoi.city/business/signatureproductions-6aa61d` returned503 after3.61seconds. This is evidence of customer-facing impact, not merely unavailable developer tooling. Reconciliation SQL continues timing out. No migration has been replayed and no restart was attempted.

## Database recovery and applied prerequisites

Later readback recovered and confirmed the claim table remained absent, old claim fingerprint unchanged and no migration history entry. A subsequent apply still timed out; another authoritative readback again confirmed absence before any retry. Activity showed no blocking query. The smaller status migration then succeeded, followed sequentially by claim authority, shared workspace authority and selected-category search migrations. All four returned success.

Post-apply readback confirms the private claim authority table exists but authenticated SELECT is denied, anonymous claim execution is denied, authenticated admin reader is granted behind its internal admin/session guard, shared current-role resolver includes session validation, and selected-type search RPC exists. Earlier outage evidence remains historical; web deployment and live browser verification are still separate gates. No customer claims, messages, payments or provider sends were executed.

# Claims release candidate and production gate — 2026-10-01

The staged claim authority, sign-in continuation, exact workspace handoff, admin review and workspace claim tracking are accepted in their separate independent audits. This is a release candidate, not a live acceptance claim.

Exact staged runtime checks passed 267 node:test files plus two standalone suites at `/tmp/zoi-claims-tracking-release-98ewrtds` (tree `b89692943700f0e1f84a803db210702ed43736d3`). Final archive `/tmp/zoi-claims-tracking-final-fq4fs58b` (tree `1bb378ba9caf14564e5ee45cecd77a772a7da448`) adds the missing browser fixture only; targeted database/browser checks run against that archive. The earlier handoff/admin/auth candidate also passed the full suite before tracking integration.

## Production incident

One `apply_migration` request for `claim_authority_and_receipts` returned: `Failed to initialise history table: Connection terminated due to connection timeout`. Subsequent read-only reconciliation requests for the authority table and claim-function fingerprint also timed out. The migration outcome has not been confirmed; no automatic migration replay or web deployment was performed.

A public `home_entity` request for Signature timed out after20 seconds. Auth health timed out after15 seconds; the unauthenticated REST root returned401 in0.07 seconds, which proves gateway reachability only. Project metadata reports ACTIVE_HEALTHY, not proof of working database/Auth journeys. PostgreSQL log sample for09:40–09:55UTC contains statement timeouts. No root cause or successful recovery is claimed.

Supabase's public status page still lists the Eastern-US latency incident, including serverless clients regardless of project region: https://status.supabase.com/ . This may contribute but does not establish the cause of internal database timeouts. No provider restart, broad cancellation, customer claims, messages or payments were executed in this release attempt.

Next release gate: obtain authoritative readback of migration history/schema before deciding whether to apply; apply the separately reviewed bizpage_status migration; verify function/ACL readback; deploy coherent web candidate; exercise actual production journey and distinguish controlled-transport tests from authenticated live canaries. Full original scope remains in docs/recovery-scope.json.

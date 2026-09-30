# Next enrichment correction: reviewed source-to-lease binding

Read-only follow-up to the catch-up pilot, 30 September 2026. No production writes or dispatches performed.

## New reproducible finding

The current rendered queue calls `enrich_queue_lease`, whose returned record lacks the original stored source fingerprint. It calls `renderOfficialSource` directly, without the fingerprint annotation performed by the separate `captureRows` helper. The proposed `enrich_source_queue_lease` adapter is not consumed by the queue.

The current `reviewedEnrichmentBatch` verifies the review fingerprint against the report, but never against the lease. A direct invocation with report/review fingerprint `old` and lease fingerprint `changed` returns an apply payload successfully. This is an artifact-binding gap; it is not evidence that the database's independent owner/source apply fences can be bypassed. The current unit fixture also lacks a lease fingerprint, so it cannot detect this gap.

## Actual operational evidence and limits

Retained run 36748083116 contains three reports, all without source fingerprints. Dimitra's Workshop rendered successfully but was routed to identity review because its document title is descriptive rather than exactly its listing name. The other reports contain `unsafe_source_url` and `source_http_400`. These are three repair reports, not successful enrichment. Do not relax unattended identity matching to make the count look successful.

Two fresh read-only production SQL requests failed with connection timeouts, including the minimal `now()`/adapter-existence query. Further retries stopped. Current production adapter availability, cron state, candidate eligibility and cohort counts remain unverified; historical pilot counts and schedules must not be presented as current.

## Recommended bounded next action

Repair the shared binding before scheduling catch-up: consume the capped fingerprint adapter, require a nonempty original fingerprint, annotate every success/failure capture before hashing, and require reviewed report/review/current lease fingerprints to agree before creating a payload. Reject changed and missing fingerprints. Preserve existing database owner/source fences and exact apply receipts.

Then obtain a fresh source capture for a currently eligible source-backed listing such as the previously reviewed Dimitra identity. Revalidate its official identity, media and owner snapshot; do not apply the old fingerprint-less report to a fresh lease. Verify actual public projection and rendered result after a separately authorized bounded write. Only after usable successful extractions should the existing pilot's two-of-three gate be reconsidered. No accelerated cron or broad source batch is recommended while binding and live eligibility remain unresolved.

Proposed code ownership, awaiting parent agreement: `scripts/enrichment/render-queue.mjs`, `scripts/enrichment/reviewed-batch.mjs`, their focused unit tests, and the existing source-capture adapter migration/database test. The migration must be reviewed and released through the lead; no direct production function replacement.

## Local correction completed — not deployed

Approved files changed: `scripts/enrichment/render-queue.mjs`, `scripts/enrichment/reviewed-batch.mjs`, `tests/unit/rendered-source.test.mjs`, and this audit. The queue now calls the capped `enrich_source_queue_lease` adapter. It validates every returned fingerprint before capturing any row, stamps the original fingerprint into both successful and refused reports before computing their evidence hash, and includes it in successful machine provenance. Both direct automatic payload creation and reviewed payload creation reject missing or mismatched bindings. A renderer cannot supply a replacement fingerprint.

Focused source/runtime/collector suite: 31 tests passed. New queue tests exercise actual orchestration with injected transport, success and robots refusal artifact hashing, missing-fingerprint whole-batch rejection before rendering/apply, and no fallback to the old RPC. Reviewed tests reject missing, null, empty and changed current lease fingerprints. Existing isolated PostgreSQL adapter suite: four checks passed (original fingerprint, cap, service-only execution, changed fingerprint rejection). These are local tests, not production capture acceptance.

Release dependency remains the existing proposed adapter migration `20260930173000_source_capture_lease_fingerprint.sql`; it was not edited or applied during this task. Deploying only the JS while the adapter is absent will fail closed at the lease RPC, not silently fall back. Production schema state must be revalidated after the incident. No additional production calls, writes, workflow dispatches, commits or pushes were made during implementation.

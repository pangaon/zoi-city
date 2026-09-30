# Enrichment freshness and recovery

Live definitions and recent cron timestamps were reviewed from `.recovery/logs/enrichment-rotation-metadata.json` on 30 September 2026. The hourly job runs at minute45 and was active; the duplicate five-minute job was disabled. Recent SQL cron runs succeeded. Those timestamps prove scheduling, not successful HTTP crawling or database application.

The normal queue uses a 30-day freshness threshold. A successful 16 September source record is intentionally not eligible on30 September; its age does not prove the worker stopped. The live apply function also replaced the entire machine namespace on transient errors, so a timeout could erase previously sourced imagery/contact and incorrectly refresh their checked date.

The additive resilience migration retains previous successful fields, provenance and checked date on transient failure. It records a separate last attempt and retries no more often than every six hours through the normal queue. Successful current crawls replace the machine namespace, including intentional nulls, while owner fields remain authoritative. Every applied result must have a current matching lease, unchanged registered website, and unexpired lease; consumed or wrong leases return explicit `applied:false`. The worker validates exact per-slug receipts rather than assuming an array length is success.

## Bounded release and catch-up

1. Apply `20260930042432_enrichment_resilient_leases.sql`; review the rollback-only fixture result (zero persisted fixtures).
2. Deploy `zoi-enrich` with `_images.js`, `_receipts.js`, existing `_social.js`, `_media.js`, and `_ssrf.ts`. Existing authorization and enabled flag remain required. The new worker needs the new sample-lease RPC before sample requests.
3. Invoke **one** authorized canary with `sample_ids` containing at most three reviewed listing UUIDs. The server looks up their stored websites; callers cannot provide URLs. Proposed sample: Oniro `faa6b189-2187-4ae4-9934-202ed129b7dd`, Aphrodite `a4f60b0d-ad6b-4dc8-8432-8d81744dade6`, Pandosia `d266800d-cd9b-4a63-afe4-ade1984d43a5`.
4. Check exact `sample_requested`, `queued`, `applied`, `unprocessed`, `lease-rejected`, and field statistics. A missing/leased/blocked sample is not reported as complete. Read those three profiles and verify owner fields and actual image/social links; inspect their rendered homes.
5. Only after the canary passes, continue the existing hourly leased queue. A shorter freshness policy requires an explicit cadence decision; do not bulk-null checked dates or restart the duplicate aggressive cron. Missing website rows need actual source identification, not inferred URLs.

Cost bounds: each listing uses its own homepage, robots checks, and at most two explicit same-origin contact/gallery pages; each document is limited to1.5MB, eight seconds per fetch and the overall existing invocation deadline. Three sites are a maximum of nine HTML pages plus bounded robots/redirect requests, with per-host spacing. No paid search/model API or social-account feed calls are introduced. Signed CDN assets may expire and JavaScript-only content can remain unavailable; disclose those limitations rather than manufacture data.

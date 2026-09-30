# Automatic source queue health

Read-only inspection of live lease/apply definitions and aggregate listing metadata. No crawler, cron, lease or record mutation was performed for this audit.

## Observed

- 14,401 published, clean/cleared, nonhidden HTTP-website records; 3,723 carry a blocked marker.
- 347 eligible-public records currently have crawl_status=error; 367 errors across the entire inventory. Among all errors, 238 lack last_attempt_at. They retain checked_at, so absence of checked_at is not the cause.
- The current queue predicate yields only 219 eligible errors, all checked September29. Its next40 are all errors on40 distinct hosts with prior expired leases. There are no eligible non-error records under the current30-day condition.
- Last-attempt hourly aggregates:04h41 records/38 errors;05h33/32;06h31/31;07h28/28; targeted08h24/0. These are current stored outcomes, not a complete immutable run log. They do not prove the same records retried inside the six-hour backoff.
- Current lease priority is verification status, checked_at then UUID. Error eligibility uses last_attempt_at or negative infinity with a fixed six-hour delay. Legacy missing attempt timestamps are immediately eligible.
- Worker fetches sequentially, with8-second HTTP deadlines and bounded redirect/supplementary fetching. It leases40 by default, stops before the next row after110seconds, then applies processed rows together. Unprocessed leases remain until their15-minute expiry. It has no per-request promise that all40 complete.

## Missing-evidence cohort proposed for review

9,318 nonblocked public HTTP-website records have no crawl_status, no status, no last_attempt_at and no enrichment coverage status. They span5,859 hosts; none are owner-managed. Their checked_at dates range August31–September16 and4,397 have source_url exactly equal to website. Existing provenance/dates cannot alone establish successful completion under the current receipted worker. This does not prove these records were never crawled.

A narrow additional eligibility branch can make this cohort fetchable without marking it verified. Preserve all publication, moderation, blocked/robots, source fingerprint and lease fences. Exclude explicit successful/error/member-review statuses and completed coverage. Reserve a bounded quota for this missing-evidence cohort and another for eligible retries, retaining verification priority within each cohort and filling unused quota. Preserve existing30-day refresh eligibility. Test quota fill, deterministic ordering, locked-row skipping, recent successful receipts, retry delay, blocked/private records and source/owner write preservation.

No rate increase is proposed. First use a reviewed small canary; distinguish fetched/field extraction from identity/design/functional signoff. Raising frequency on the present predicate would mostly accelerate errors. Worker batching should be coordinated separately: bounded small chunks avoid leasing work the time budget cannot process, but changing cron40 to3 without measuring cadence would reduce maximum throughput. Do not change a global rate merely from the successful targeted sample.

## Reviewed candidate implementation

CLI migration20260930090118 implements the precise missing-evidence branch, clamps each lease to three records and allocates two nonretry slots plus one retry slot (unused capacity fills from the other cohort). Existing30-day refresh remains. Legacy error backoff falls back to checked_at when last_attempt_at is absent. Verification priority is retained inside each cohort. Lease and visibility predicates are checked again on the locked listing, preventing a concurrent snapshot from claiming an already renewed lease. Seven real PostgreSQL checks include eight concurrent lease races. The production acceptance fixture clones the installed function against a temporary table; no actual listing is leased.

This candidate does not change cron frequency. With the existing hourly schedule it temporarily limits work to at most three records per hour. A separate reviewed catch-up cadence is necessary for useful large-inventory throughput; neither31,168 records nor all website records have been individually verified.

A higher-priority canary finding was separated into migration20260930090004: blocked-only crawler payloads previously took the successful replacement path and could discard prior machine evidence. The patch preserves prior evidence and owner fields, stores a bounded block reason and marks coverage blocked. Six real PostgreSQL checks include a dedicated-QA rollback fixture. It does not reconstruct data already lost; any exact restoration requires separate review of the captured before-state.

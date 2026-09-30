# Enrichment worker deadline hardening — local candidate

This is an independently justified service correction, not a finding that enrichment caused the connectivity incident. No production database calls, deployment or workflow dispatch occurred during this implementation.

## Runtime contract

Each invocation carries its own absolute 110-second deadline, including request-body reading, database lease acquisition and source work. Database RPCs are limited to 15 seconds across both headers and response-body consumption. Source work receives an earlier deadline reserving 15 seconds for apply. Host serialization waits, rate-limit waits, redirects, robots requests, page requests and supplementary page requests preserve the same deadline. There is no mutable global invocation deadline.

The fetch signal is aborted on deadline and the caller's wait is independently bounded with a promise race. An expired operation cannot open a later source request after waiting for politeness or another host operation. Source URL vetting takes an optional deadline; existing callers retain the default. An in-progress DNS query cannot be cancelled by this code, but its late result cannot initiate another DNS query or a page request. JavaScript timers do not preempt synchronous extraction/JSON work; source bodies retain the existing 1.5 MB bound.

## Writes and uncertainty

A lost/timed-out apply response returns `outcome: unknown`, `reconciliation_required: true` and the original slug/lease identifiers. It performs no retry and does not claim `applied: 0` or that a database write failed. If the invocation deadline has already expired before apply begins, the response says `outcome: not_attempted`; leases still need reconciliation/expiry handling. Queue acquisition uncertainty also reports reconciliation required. Aborting an HTTP request does **not** prove PostgreSQL cancelled or rolled back; existing lease/source/owner apply fences remain unchanged.

The caller still needs to reconcile exact leases against stored evidence before another attempt. This patch does not add a new receipt store, renew a lease, release uncertain leases or alter cron scheduling. Current full-cohort queue scan/ranking cost and database lock-wait behavior remain separate server-side investigation items after connectivity recovery.

## Verification

50 focused local enrichment/SSRF tests passed. New behavioral coverage exercises stalled headers, stalled response body, abort signal and single dispatch, expired-before-start, independent invocation budgets, late rate-limit completion and expired host-queue waits without a fetch, default DNS compatibility and late DNS preventing a second lookup, and actual handler ambiguous apply output retaining the original lease. Existing member/privacy/packaging/SSRF tests pass with extraction harness updated for the new helper dependencies. No live execution acceptance is claimed.

Changed files: `supabase/functions/zoi-enrich/index.ts`, `supabase/functions/zoi-enrich/_ssrf.ts`, `tests/unit/enrichment-deadline.test.mjs`, `tests/unit/enrichment-member-worker.test.mjs`, `tests/unit/ssrf.test.mjs`, this audit. The separate source-capture fingerprint candidate remains separate and unchanged.

Independent review identified a preexisting host-map cleanup comparison that could never match its stored promise. The corrected cleanup tracks the actual tail and removes it only after settlement and only if still current. A timed-out waiter cannot remove a live predecessor’s serialization barrier. Added a predecessor → expired waiter → third caller test and map-empty-after-drain assertion.

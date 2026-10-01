# Owner catalogue, host recovery and map integration

Previous goal turn made progress: exact Toronto guest redirects/canonical metadata were implemented, independent review assignments advanced, and hotel database/browser evidence completed. The broader goal remains active.

## Reviewed release candidate

Exact staged archive `/tmp/zoi-owner-host-map-release-6uganhsg`, tree `b8b5dfe34107e52cf939283154cc17c498475479`: `npm run verify:local` passes 257 node:test files plus two standalone suites. This is local source/regression evidence; it is not production acceptance. Independent reports accompany hotel owner catalogue, host unknown-request recovery, map footer/scope and Toronto routing. Final map camera review is required before push.

Hotel editor supports the five existing hotel-family categories through the shared editor and versioned writer. Source suggestions remain distinct from owner edits; explicit clears survive public projection. Mixed legacy IDs and prototype-key IDs were corrected after independent review. Nineteen focused units, six actual isolated PostgreSQL groups and four mounted viewport/palette scenarios pass. Lead visually inspected phone editor. No customer catalogue was edited for QA.

Host unknown requests can be checked and explicitly cancelled using an actor/request tombstone, so late original writes cannot bypass cancellation. Nine actual isolated PostgreSQL groups include lock ordering, authorization changes and existing payment receipt compatibility. Thirteen focused units and mounted 390/1440 recovery checks pass. Lead versioned the host entry and its client import, then reran both mounted checks successfully. No invitations or customer allocations were created for QA.

Map corrections preserve pagination/retry when statistics arrive late, distinguish scoped counts from global coverage, and reset unpositioned searches to world view rather than retaining the prior city's camera. No listing coordinates were changed or invented. Global coordinate accuracy remains open.

## Applied schema evidence

Applied reviewed migrations once through the authorized Supabase connection:

- Local `20261001031621_hospitality_owner_catalogue.sql`, SHA256 `979478af7c556527d55a0c5f8ffc7e7a755f3a1f29c1b7912658d1a2a68a5837`; remote ledger `20261001034216`.
- Local `20261001032515_event_host_request_cancellation.sql`, SHA256 `d4cc322a5d81c804593fcf2a272ae4786fae4e839a4f6361690261c0706c5961`; remote ledger `20261001034227`.

Lead captured actual prior function definitions and compared the host replacement against live definitions. Existing payment branches are preserved. After application, all three modified hotel function definitions exactly match the intended limited transformations of the captured originals. New internal helpers deny anonymous/authenticated execution; the new public cancellation RPC denies anonymous execution and permits authenticated callers, with actor/current-domain authorization inside. All new helpers/RPC use empty search paths.

Security advisor flags authenticated execution of the new SECURITY DEFINER cancellation RPC; that is intentional, covered by its current actor/domain checks and concurrency tests. The database still has pre-existing broad advisor findings (242 RLS/no-policy notices, 17 mutable-search-path warnings, three public extensions, other executable definer functions and disabled leaked-password protection). This release does not claim database-wide remediation. Reference: https://supabase.com/docs/guides/database/database-linter

## Toronto catalogue publication gate

The exact source-reviewed proposal executed successfully in BEGIN/ROLLBACK; a separate read confirmed zero matching rows afterward. Generated dry-run ID was discarded. Publication must occur only after guest redirects are verified live. Existing singular routes and catalogue search fail the prepublication verifier as expected, while actual plural room → table 10 → group succeeds at 390/1440. No booking, configured inventory, organizer ownership, connected payment or delivery capability is inferred from catalogue visibility. Existing noindex remains intentional pending full SEO acceptance.

# Independent reviewed-geography writer review

Unapplied candidate review, 1 October 2026. Initial runtime/schema owned by lead. For the final path-parser correction below, the lead explicitly transferred those two files to this reviewer for implementation; independent final acceptance of that correction belongs to the lead. No production mutations.

## Initial blockers reported to lead

1. Public guard uses `moderation_status NOT IN ('clean','cleared')`. A NULL moderation status makes that predicate NULL and can make the entire IF NULL, allowing the record through. Require an explicit true eligibility predicate or NULL-safe rejection.
2. SQL validation is materially weaker than the report extractor: no report schema/kind/HTTP-success or official-source classification checks, no candidate name/address binding, and only host comparison rather than listing property-path scoping. A wrong-property report on the same hotel/group domain can therefore meet booleans/hash/locality checks and be written with street precision. Service-only authority is necessary but does not replace this review gate. Require complete report contract and source/property/identity evidence, including explicitly bound address review where source differs from stored address.
3. Reviewer and specialist names permit whitespace-only values or same identity with case/whitespace variation. Normalize and reject empty/equal identities before treating review as independent.
4. When original profile is SQL NULL, apply coalesces to an object and revert removes _geo to produce `{}`. Original NULL is not restored. Preserve the original null/object state alongside the narrowly reverted geo fields.

## Initial accepted mechanisms

Exact input report byte SHA256 is checked and included in immutable replay payload. Full-row fingerprint is compared under the listing row lock; unrelated edits conservatively fail CAS. Apply/revert use request advisory lock then listing lock, preserving a consistent order. Replay rejects changed payload/reverted request and current post-write fingerprint mismatch. Revert refuses overwritten or newly owned records rather than removing later unrelated changes. Ledger/private helpers are not granted to ordinary clients.

Acceptance remains pending corrected candidate and actual isolated PostgreSQL tests, especially malformed/partial evidence, same-host wrong-property identity, null moderation/profile, replay and revert races. No map-visible street precision has been independently approved by this report.

## Corrected frozen candidate rerun

Independently reran eight actual PostgreSQL groups successfully. SQL SHA256 `9554996b60971130996b412d7637373ec4837a730259cb3024c07cb06067ecc7`; test SHA256 `4e45c5ea6c433d0132c3e16c3c72138c11a78e241a900bf6b55346b90fdd9f1a`. Prior blockers corrected: NULL moderation refused; object profile shape enforced; SQL-null profile restored; normalized reviewer identities; full report/HTTP/kind/name/address/source-property checks. Parallel same-request calls replay one receipt; competing reviewed coordinates with one snapshot cannot overwrite each other. Receipt includes after_snapshot for guarded reversal.

Remaining parser edge reported before final acceptance: SQL path-prefix comparison works on raw strings and would accept `/property-a/../property-b` or encoded traversal/separators, whereas extractor URL parsing normalizes navigation. Requested conservative refusal of noncanonical path forms to align the guarded writer with source-property scope. No canary write approved.

## Final path-parser correction (reviewer became fix author)

Added conservative rejection before property-prefix comparison for literal dot segments, repeated slash separators, literal backslash, encoded dot/slash/backslash, and encoded percent (which could hide another decoding layer). The same checks apply to the report source and stored official website. Path checks exclude query and fragment. This intentionally refuses ambiguous encodings rather than inferring the final navigated property.

Ran `node tests/database/reviewed-geography.integration.mjs`: all eight actual PostgreSQL groups pass. Added nine ambiguous path variants tested as source URLs and again as stored website URLs, a similarly prefixed sibling-property negative case, and a canonical nested property URL with trailing slash/query/fragment that applies and reverses successfully. Existing authorization, source identity, replay, full-row concurrency and exact reversal checks still pass. `git diff --check` is clean.

Frozen SQL SHA256: `efd477760fb2bd62e433748a741c5ed9745db9c2d8dd9509f35e4053f554d08b`.
Frozen database fixture SHA256: `c14c19bba15a8a9d654cd1ac02992506871f5f73bf0fc12f3cba8c83c461580b`.

Evidence here is isolated database execution and code review. There is no deployed writer, production coordinate mutation, rendered pin verification, or approval of an individual listing's locality envelope in this report. Lead review of the authored correction remains required before release.

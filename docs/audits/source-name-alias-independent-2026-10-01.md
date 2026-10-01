# Source name alias independent review — 2026-10-01

Accepted bounded extractor candidate; no coordinate writer change or real listing identity approval.

Reviewed `scripts/geography/source-coordinates.mjs` SHA256 `3907fe86659f43d3071d8319c5327c0105a0243b909b717578082266385c20a2` and `tests/unit/source-coordinates.test.mjs` SHA256 `b65bf1dde9bfb5ca2e0cc54076555f7861ccc0d94565efa5294943d99128cb0b`. Independently ran the nineteen tests; all passed.

An optional source_name only participates after exact_name_confirmed plus the existing listing/snapshot/source URL/source bytes/reviewer/date/address review binding succeeds. Matching uses existing deterministic Unicode/case/punctuation normalization, not fuzzy substring matching. Aliased JSON-LD candidates must match the reviewed complete postal address, including region/postcode, even if another row-address comparison would otherwise pass. Candidate preserves the actual source name, stored listing name and identity-review hash. Existing exact-name extraction remains available without an alias. Squarespace and Google destination paths do not inherit a broad alias bypass.

Changed listing identity/address/site/owner hash or source bytes invalidate the supplied review. Mismatched alias, missing confirmation, wrong address, external host and sibling branch are rejected. Result remains a review-required dry run with zero coordinate writes; locality/plausibility and independent report review are still separate gates. These synthetic examples do not approve Parkview or any actual alias by themselves. No production data reads or writes performed by this review.

# Independent selected-category autocomplete review — 2026-10-01

Accepted local candidate. Production RPC availability/performance and actual map integration after deployment remain unverified while database management is unavailable.

## Frozen scope

- `20261001095824_explore_search_selected_types.sql`: `b6bb5c4781d1ed66972671627b9ba1061214495f27edbc7324251e9fc27a42ad`
- `assets/discovery/autocomplete.mjs`: `cd24ddbde1bddc08b14fa5bc2fbd9be14f5478e740495af7c4dad7d08e0326b3`
- PG harness: `0a0415a32f744ab7925b8a9cd93e2b2c826c80e8b0ebdaea3719aced6ddd10f2`

Previously, fetching the first eight rows before discarding disabled categories could hide every relevant selected-category result. The new array RPC filters eligible selected types before dedupe, ranking and pagination in both locality and global branches. Existing scalar RPC is untouched. NULL means all categories; empty array means no results. Malformed/multidimensional/oversized/null-element arrays fail closed before geography. Public/moderation eligibility, ranking, projections and partial locality index strategy remain intact.

The shared client sends one array request, deduplicates selected types, preserves cancellation/locality, and never broadens a category-constrained empty result. No categories selected performs no fetch. Scalar Explore fallback behavior remains separate and unchanged. This is a bounded suggestion list, not a claim that autocomplete displays every eligible listing.

## Independent checks

- PostgreSQL harness passed 144 exact JSON comparisons plus single-type parity, selected matches behind eight excluded rows, invalid arrays on nonexistent geography, public privacy and index-plan checks. `/tmp/search-types-independent.log`.
- Synthetic 32,000-row en_US.UTF-8 fixture: old query 13.161ms, candidate 5.415ms, inner locality plan 0.565ms. These are local fixture measurements, not production latency claims.
- Twelve shared autocomplete unit tests passed, `/tmp/search-types-units-independent.log`.
- Controlled browser component journeys at 390/1440 passed: one server-filtered request, excluded-category noise, strict locality, keyboard/touch selection, and empty selection without fetching. `/tmp/search-types-browser-independent.log`. The RPC fixture applies the server filter; actual SQL behavior is established separately above. No live APIs were probed.

Parent must confirm the new RPC migration/readback before publishing a client that calls it, and invalidate the shared module URL/cache as needed. The earlier multi-category truncation backlog is addressed in this candidate, but should only be called live after actual deployed API/map verification.

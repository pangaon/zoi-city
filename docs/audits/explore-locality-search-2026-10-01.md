# Explore search locality repair — 2026-10-01

Root applied `20261001091757_explore_locality_candidate_plan.sql` after independent review. Migration SHA-256: `a57b96c28bdb278e5cff329d1927b9eec2852611e3287a9ef46512be4480c814`.

The literal-city path filters narrow candidate columns through a partial locality index before text matching. Ranking, deduplication, visibility, output projection and pagination remain unchanged; global and pattern-city searches retain the previous query. The transactional index build is not nonblocking; bounded lock/statement timeouts were included and root controlled deployment.

## Isolated evidence

`node tests/database/explore-locality-plan.integration.mjs` passed 77 exact JSON comparisons against the previous function on PostgreSQL with production-matching `en_US.UTF-8`. Cases cover Greek/case, literal and wildcard/escaped city/country filters, type/region, visibility, deduplication and pagination. A 32,000-row fixture used the partial locality index without a global text BitmapOr: current 24.717 ms, candidate 5.716 ms. Public RPC execution remains available without direct table access.

## Production evidence supplied by root

Root read-only EXPLAIN after deployment: Amar/Limassol limit 8 took 194 ms cold; global SIG limit 8 took 67 ms. Actual shared autocomplete helper HTTP results are recorded in `/tmp/zoi-search-after-locality-http.json`: global SIGNAT returned HTTP 200 in 309 ms with Signature Productions among four real suggestions; strict Amar/Limassol returned HTTP 200 in 167 ms with Amara Hotel. No specialist customer writes or additional live probes were performed.

These are exercised HTTP/helper outcomes, not a substitute for root browser rendering/selection evidence. Timings describe these samples, not a latency guarantee under sustained import load.

## Global search assessment

No new global SQL repair is warranted by current evidence. Global matching already uses indexed text/name/region predicates and loads large listing payloads only after pagination. Broad two-character and empty queries still require deduplication/ranking of their complete candidate sets and can be sensitive to load. Arbitrary early candidate limits would break ranking/deduplication semantics. Autocomplete retains debounce, stale-request cancellation, one retry and a bounded timeout.

# Bounded backend log diagnosis and public country-request repair

## Corrected evidence interpretation

Retained window: 2026-10-02 14:45–15:00 UTC, project csebihpaychdkanjjsmz. The earlier aggregate file is preserved unchanged. Its **schema/catalog** classification based on SQL containing `pg_catalog` was misleading. A bounded query-prefix check shows all 118 PostgREST matches were ordinary `public.explore_countries()` RPC wrappers containing `pg_catalog.count`, not schema introspection. Do not infer a schema-cache refresh storm from this sample.

Out-of-band log grouping identifies 118 country RPC cancellations (115 SELECT, 3 PARSE), 51 `home_entity` cancellations (46 SELECT, 5 PARSE), 12 other/setup PostgREST cancellations, 5 exporter and 2 management cancellations. The heuristic RPC extractor produces non-function tokens for some non-PostgREST queries; only the explicitly inspected PostgREST names above are attributed. Exporter and management failures remain broader incident evidence. These error counts are neither request throughput nor a successful-query denominator.

The project metadata reports ACTIVE_HEALTHY, ca-central-1, PostgreSQL17.6.1.127. That control-plane status does not establish healthy queries. No database SQL, write replay, project restart, configuration change, connection termination or DDL was performed in this investigation. One unified-log column-discovery attempt returned a backend error and was not retried. No raw request JWTs, customer payloads or complete management statements were retained.

The failed atomic UPDATE reported by the lead and failed readback remain ambiguous until authoritative row/receipt readback. This candidate does not justify replay. Existing PGRST002 observations remain real but separate; their cause cannot be established from ordinary RPC wrapper text.

## Actual caller and controlled reproduction

Current Explore/map/discovery code does not invoke `explore_countries`. The actual callers are server-rendered `api/place.js` and the places portion of `api/sitemap.js`. Each place/category handler previously requested the same full-country aggregate independently, even when concurrent in one warm process. Retained Sept30 SQL already canonicalizes distinct country names before joining the eligible listing table, but each call still aggregates eligible listings. Current production SQL body and query plan were not probed, and are not assumed from the migration.

A controlled actual-handler run with all fetches replaced locally issued **12 simultaneous country RPCs for 12 concurrent same-country requests**. Zero live requests. The initial empty-listing fixture produced honest404s; it demonstrates duplicate aggregate loading, not a successful page. The committed regression uses a populated listing and verifies actual200 HTML/canonical business links.

## Bounded shared correction

`api/_public-country-read.js` coalesces in-flight reads and caches successful public country arrays for60seconds. Its contract permits only an HTTPS argument-free `explore_countries` endpoint, with endpoint and timeout policy in the key. It is used only by the existing place/sitemap callers. No private/authenticated/user-specific RPC passes through it.

The optional category deadline1200ms, required country deadline4500ms and sitemap deadline8000ms stay separate, so an optional request cannot prematurely cancel the required country lookup. Successes are cloned before returning to avoid cross-request mutation. Failed or invalid loads are evicted; expired data is not served after an error. Country errors remain branded uncached503; category fallback behavior and per-page scoped listing queries remain unchanged.

This reduces repeated country aggregates **within each warm serverless process**. It does not coalesce across instances, alter database load from other RPCs, optimize `home_entity`, establish a root cause or prove incident recovery. Existing CDN behavior remains intact; no new infrastructure/provider capability is claimed.

## Acceptance and release limits

`node --test tests/unit/public-country-read.test.mjs tests/unit/place-request.test.mjs`: **7 passing**. Actual handler evidence:12 concurrent populated country pages cause one country read while retaining12 correctly scoped listing reads;6 sitemap requests cause one additional read under their separate deadline. Rendered country headings, existing listing links and sitemap geographic links are preserved. Additional checks cover successful reuse, expiry, rejected/malformed response eviction and retry, empty arrays, endpoint/deadline separation, response mutation isolation,503/no-store behavior and existing category fallback/Orthodox landing behavior.

No browser layout code changed; no live browser/database recovery acceptance was claimed. Before release the parent retains independent review/integration ownership. Before any held database write, require exact row/receipt readback; before claiming service recovery, require bounded successful profile/search/map journeys. Provider-side resource/wait-event evidence is still needed to distinguish pressure, lock waits, I/O and cancellation causes.

Retained evidence: `evidence/backend-timeout-applications-2026-10-02.json`, `evidence/backend-timeout-rpc-families-2026-10-02.json`, original aggregate and `evidence/place-country-repetition-before-2026-10-02.json`.

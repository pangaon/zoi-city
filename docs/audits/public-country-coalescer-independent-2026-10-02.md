# Independent public-country coalescer review · 2026-10-02

Accepted the narrow warm-process country-read correction for integration. No database writes, live queries, incident recovery or root-cause conclusion are part of this acceptance.

## Source boundary

Only the exact HTTPS `/rest/v1/rpc/explore_countries` endpoint is accepted; credentials, query and fragment are refused. Both current call sites use an empty RPC body and static publishable-key authentication, never incoming request credentials or user-specific arguments. Scoped listing queries and all other RPCs bypass the helper. This is a deliberately public-only caller contract, not a general authenticated RPC cache.

Endpoint and timeout policy are separate keys. Place optional 1200ms, required country 4500ms and sitemap 8000ms loads use matching actual AbortSignal deadlines, so a short optional call cannot impose its cancellation on a required load. In-flight work is shared only within that key and warm process. Successful arrays are cloned on storage and return; rejected or malformed loads are deleted. Empty arrays remain valid. Expired success is never returned as stale fallback after a new failure.

TTL is 60 seconds after successful completion. The current fixed endpoint/three-deadline callers bound practical key count; the helper is not an arbitrary-endpoint general-purpose bounded-size cache and is not shared across serverless instances. Existing CDN cache policy is unchanged.

## Independent execution

`node --test tests/unit/public-country-read.test.mjs tests/unit/place-request.test.mjs` passed all seven tests. Log: `/tmp/country-independent.log`.

The actual place handler fixture issued 12 concurrent populated country-page requests: one country aggregate and 12 separate correctly scoped listing reads, with 200 HTML and retained canonical business links. Six actual sitemap handlers made one additional country aggregate under their distinct deadline and retained geographic URLs. This is controlled handler/render evidence, not a live browser/backend test.

Tests also exercised clone isolation, endpoint/deadline separation, expiration, failure without stale fallback, retry after failure/malformed response, valid empty response, disallowed RPC/protocol/query, branded no-store503 and existing category/Orthodox behavior. Source inspection confirms private requests are not routed into the cache.

## Incident interpretation

The retained diagnosis reports 118 country RPC and 51 home_entity cancellations, not a schema-refresh storm: ordinary PostgREST wrapper text includes pg_catalog. Error counts are not throughput or a successful-query denominator. This mitigation does not repair home_entity, establish the database wait cause, justify a timed-out write replay or demonstrate recovery. Those remain separate lead-owned evidence gates.

## Reviewed SHA-256

```text
306a4d4cd466c82f43e50c23f1936cbccb4b632739e9bee003753eca9707a997  api/_public-country-read.js
79666bf2269ae889691de6689ba87427a88f52d722f581d95400f73ca6fc671d  api/place.js
38f5c611313b4ddb18ed34af133fdbc8752eb77f608f12f956468976d90f3c7d  api/sitemap.js
909aafed6fda82f8e84fa150ca7f6bb85c8c86697ba5cc22425a8cdc7410ba41  tests/unit/public-country-read.test.mjs
```

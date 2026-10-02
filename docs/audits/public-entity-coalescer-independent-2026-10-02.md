# Independent public entity in-flight coalescer review · 2026-10-02

Accepted the frozen narrow public-read coalescer for integration. No source edits, database queries/writes, deployment or recovery claim were made by this reviewer.

## Source boundaries

The actual entity handler adapter permits only home_entity, seo_related and listing_completeness, using the existing fixed endpoint and publishable-key anonymous authorization. Incoming cookies/Authorization are not forwarded. The key includes endpoint, exact RPC name/body, timeout and recovery mode. Distinct slugs/arguments cannot share a projection. Only home_entity wraps the existing single eligible retry; sharing covers the whole retry promise rather than creating a retry for each waiting page. Mutation, authenticated/private RPC and other reads are untouched.

The helper retains at most128 pending keys. Overflow independently executes rather than displacing active work. Both resolution and rejection delete the key before subsequent callers can reuse a settled result. There is no result TTL, negative-result retention or stale fallback. Every consumer receives a structured clone, preventing renderer mutations from crossing requests. Deadline enforcement remains in the existing RPC adapter (3400ms home,2000ms optional); retry policy and CDN60-second page behavior are unchanged. Thus fresh server reads do not imply bypassing the existing CDN cache.

## Fresh independent execution

`node --test tests/unit/entity-burst.test.mjs tests/unit/public-read-coalescer.test.mjs tests/unit/entity-request.test.mjs tests/unit/public-entity-read.test.mjs` passed all25 tests. Log `/tmp/entity-coalescer-independent.log`.

Actual handler fixture: twelve simultaneous same-slug page requests issue three total public reads, with valid200 responses, rather than twelve separate primary/optional sets. The eligible transient burst shares two primary attempts total. Distinct slugs remain six independent primary/optional calls; customer headers are ignored. Failed burst fans the existing503/no-store outcome to each caller and is evicted, so the next request succeeds after source recovery. Explicit owner social clear, hidden404 and republished next reads immediately change handler output. Clone isolation and128-key overflow behavior also pass.

Evidence is controlled actual-handler/render output, not production throughput or a provider/database benchmark. Process-local coalescing is not cross-instance protection and does not establish incident root cause, database recovery, successful interrupted writes or fewer failed HTTP responses during a shared upstream failure.

## Reviewed SHA-256

```text
c397a9a865514ad13686eba4842e56fe7ef2d65655abd620ddee68bf713bf17d  api/entity.js
c653b594132e0779bd9720e40287eb6ad8acd4d06727c8583570c964b9b3b659  api/_public-read-coalescer.js
6ab739d31aac119488d62d25f530e7ad8521846e5932f64a438ad10709172980  tests/unit/entity-burst.test.mjs
73edf3dd2395c146cb00d7cf468c5b431713fb543560c6152a2570b87191cd04  tests/unit/public-read-coalescer.test.mjs
```

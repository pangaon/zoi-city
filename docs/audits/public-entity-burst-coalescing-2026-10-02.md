# Public entity burst coalescing

## Controlled reproduction

Calling the actual canonical entity handler 12 times simultaneously for one slug made 12 `home_entity`, 12 `seo_related` and 12 `listing_completeness` calls (36 total). A controlled first-wave502 made24 primary calls and12 independent retry warnings. These are local controlled upstream responses, not production benchmarks or evidence that all recent production timeouts share this cause.

## Correction and boundaries

The fixed anonymous public reads now share an in-flight promise keyed by endpoint, exact function/body, deadline and recovery mode. The entire existing home recovery sequence is shared, including its one permitted retry. Optional reads coalesce separately. Each consumer receives a structured clone so renderer mutations cannot contaminate another response.

There is zero settled-result TTL: success, not-found and errors are immediately evicted. The next request fetches current data, including explicit owner clears and visibility changes. Existing60-second CDN policy and legacy redirect policy are unchanged. No stale fallback, private/authenticated result cache, extra retry or timeout increase is introduced. Request cookies/JWTs remain ignored; only the existing fixed publishable key is sent upstream. Only the three existing public projection functions are allowed through the local adapter.

At most128 keys are retained concurrently per process. New keys at capacity run independently instead of evicting a pending job or waiting indefinitely. This is process-local coalescing, not distributed across Vercel instances and not a fix for database load from independent workloads. A shared failure still produces the existing unavailable log for each HTTP response; fewer database reads does not imply fewer failed HTTP responses.

## Evidence

`node --test tests/unit/entity-burst.test.mjs tests/unit/public-read-coalescer.test.mjs tests/unit/entity-request.test.mjs tests/unit/public-entity-read.test.mjs`:25 tests pass.

Actual-handler same-slug burst now makes3 total public reads; recovery burst makes2 primary reads total. Distinct slug isolation, failure eviction followed by successful fresh read, ignored incoming account credentials, immediate owner clear/not-found/unhide, clone isolation,128-key overflow and existing deadline/retry/404/CDN/renderer contracts pass. No production queries, schema changes, deployment or customer writes performed.

## Frozen files

- api/entity.js c397a9a865514ad13686eba4842e56fe7ef2d65655abd620ddee68bf713bf17d
- api/_public-read-coalescer.js c653b594132e0779bd9720e40287eb6ad8acd4d06727c8583570c964b9b3b659
- tests/unit/entity-burst.test.mjs6ab739d31aac119488d62d25f530e7ad8521846e5932f64a438ad10709172980
- tests/unit/public-read-coalescer.test.mjs73edf3dd2395c146cb00d7cf468c5b431713fb543560c6152a2570b87191cd04

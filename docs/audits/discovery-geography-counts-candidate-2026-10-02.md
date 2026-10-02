# Public geography reader repair · candidate only

This packet targets the demonstrated metadata scan path and four visibility defects. Production logs already showed SQL57014 statement cancellations for directory search and geography/statistics readers. It does not claim the complete server incident is solved. No production mutation, restart, maintenance or migration application was performed by this lane.

## Installed evidence and change

Fresh read-only `pg_get_functiondef`/ACL snapshots are retained in `evidence/discovery-geography-function-preflight-2026-10-02.json` and `evidence/discovery-country-normalization-preflight-2026-10-02.json`. Additional cities/region-cities definition and ACL snapshots are retained in `evidence/discovery-additional-count-readers-preflight-2026-10-02.json`. The original bodies used by the isolated suite remain in `evidence/discovery-current-definitions-2026-10-02.json`. The prior plan diagnosis identifies the production countries heap-access path; it is separate from the controlled execution plans below.

Migration `20261002221551_discovery_public_geography_counts.sql` was generated through `supabase migration new` and remains unapplied. It adds one partial covering index on `(country,region,city) INCLUDE (region_code,region_native)` with the exact published, clean/cleared and nonhidden predicate. It leaves the installed countries body untouched. Regions use the same visibility contract, aggregate raw geography first and canonicalize once per distinct raw country before returning the same country/region/count/code shape. Cities and region cities acquire the same gates. Cities preserve NULL canonical country groups, count/city ordering and existing limit clamps/defaults. Region cities preserve country, region, native-region and case-insensitive region-code filters, including escaped literal patterns. Statistics make one eligible-row scan instead of three published-row scans. Hidden and moderated counts are intentionally corrected; there is no attempt to preserve their old inclusion.

Existing signatures, defaults, language, volatility, definer status, search paths, ownership and ACLs are preserved. In particular, the existing home_stats PUBLIC EXECUTE permission is neither broadened nor silently removed. All reader and normalization bodies are guarded against exact installed definition hashes, and the five reader ACL/owner contracts are guarded too. No direct listing-table grant or new public writer is introduced. Duplicate aliases, max region code, NULL/empty geography and ILIKE country pattern semantics are retained. home_stats continues counting distinct raw countries (including nonnull empty strings); it does not silently convert that metric to canonical country count.

## Isolated database evidence

`node tests/database/discovery-geography-counts.integration.mjs` passes 13 groups in an isolated PostgreSQL 16 server. Its 48,004 rows include a 3,520-byte uncompressed payload, country aliases, whitespace/empty/NULL geography, Unicode, duplicate cities, nullable region codes and marketplace values, escaped literal `%`/`_` patterns, drafts, hidden and moderated rows. Independent eligible-row reference queries provide expected country and region results; a separate single aggregate provides expected stats. A current NULL moderation change immediately removes the record from counts; restoring it restores the counts. Empty-table behavior is checked inside a rolled-back transaction.

The suite reconstructs the exact installed definitions/ACLs, rejects body/grant/normalization drift before index creation, applies the candidate, exercises all five public readers as anon/authenticated/service_role, refuses direct private-table reads and proves contract/countries-body preservation. It refuses replay against the replaced bodies. Before/after EXPLAIN ANALYZE uses the identical corpus before any visibility mutations, with no query planner enable/disable settings. Local maintenance uses VACUUM PARALLEL 0 because this container's shared-memory limit caused a parallel maintenance allocation failure during an earlier run; this is not a production setting change.

Retained full JSON: `evidence/discovery-geography-counts-isolated-plans-2026-10-02.json`. In the final run:

| Reader | Before execution | After execution | Before shared blocks | After shared blocks |
|---|---:|---:|---:|---:|
| Countries | 100.776 ms | 9.599 ms | 16,194 | 657 |
| Regions | 134.698 ms | 13.741 ms | 16,193 | 615 |
| Statistics | 194.027 ms | 23.306 ms | 32,253 | 654 |
| Cities | 106.821 ms | 10.063 ms | 16,168 | 609 |
| Region cities | 121.682 ms | 8.419 ms | 16,197 | 606 |

Each after-plan chooses the new index with an Index Only Scan and zero heap fetches on the initially all-visible corpus. PostgreSQL may need heap visibility checks after ordinary updates; zero heap fetches is not a universal promise. These local measurements are evidence for this query/index shape, not a production SLA or proof that global autocomplete timeouts are eliminated. Production runs PostgreSQL 17 and has different load, cache and data distribution.

## Lead-owned release boundary

The index uses a bounded transactional CREATE INDEX with 5-second lock timeout and 30-second statement timeout. This temporarily conflicts with listing writes; it must not be applied blindly during an outage. Lead must review current load/locks and table/index state, revalidate exact prerequisites, and choose an appropriate deployment window or a separately reviewed concurrent-index strategy. A lock or statement timeout aborts the transaction; observe authoritative index/function/migration state before considering retry. Do not increase timeout or restart the database to force this packet through.

After eventual deployment, independently verify definitions/ACLs/index validity, eligible-only geography output and actual anonymous directory/autocomplete requests at both widths. The candidate does not change search ranking/deduplication, mapping coordinates, provider data, enrichment coverage or user preference writers. Those remain separate work.

## Related reader blast radius remains explicit

Current related definitions and the public view are retained in `evidence/discovery-related-reader-definitions-2026-10-02.json`. The first body-only scan suggested both legacy map overloads lacked moderation checks; inspecting the inherited view corrected that conclusion. `explore_geo(integer,integer)` already obtains clean/cleared moderation and confirmed-duplicate filtering through `zoi.v_public_listings`, then excludes hidden listings directly. The active `explore/map/index.html` uses this overload at line562. It is not changed by this packet.

The direct JSON overload `explore_geo(text,text,text,text,integer)` really omits moderation, and `dir_browse(text,text,integer,integer)` allows hidden records while excluding cleared records. The latter feeds event/parish/recommendation/directory cards in `explore/app/index.html` (including lines1237,1608,1664,1726,1881). These require a separate guarded contract review and exercised consumer tests; this packet does not claim those legacy journeys or global map coordinate quality are repaired. Regions/city counts feed `api/place.js` and sitemap, so this shared count correction covers those consumers without per-city patches.

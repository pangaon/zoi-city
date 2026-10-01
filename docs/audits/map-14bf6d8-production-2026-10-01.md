# Production map acceptance — 14bf6d8

1 October 2026. Read-only browser/RPC verification. No coordinate or customer writes.

## Deployed source

Fetched `https://www.zoi.city/explore/map/`; full HTML SHA256 `e89c3262531bb08315363f03ffe1a4e242940fb731311655377cb1be0d976afe` exactly matches accepted candidate. No local HTML or module replacement in production browser checks.

## Actual public data and rendered journey

Ran Nairobi/Kenya and Toronto/Canada at both 390 and 1440. Held only the original `home_stats` network response, unmodified, until original area results loaded, then released it.

| Scope | Loaded entries | Street-position entries | Awaiting positions | Area pagination before/after stats |
| --- | ---: | ---: | ---: | --- |
| Nairobi, both widths | 15 | 0 | 15 | 0 / 0 |
| Toronto, both widths | 645 | 35 | 610 | 1 / 1 |

All four preserved scoped header/footer counts after global statistics arrived. Toronto Load more remained present; no global denominator was mixed into the loaded-results header. No browser page errors. Inspected Nairobi390 and Toronto1440 screenshots: Nairobi displays world view and unpinned real records; Toronto displays scoped street positions and loaded-result summary. Existing Load more control uses a plain browser button appearance; functional acceptance does not claim a complete map visual redesign.

Artifacts: `/tmp/map-production-14bf6d8.cjs`, `/tmp/map-production-14bf6d8.json`, `/tmp/map-production-14bf6d8-{Nairobi,Toronto}-{390,1440}.png`.

## Separate controlled deployed-code regression

`/tmp/map-deployed-camera-14bf6d8.cjs` uses deployed HTML/modules/styles, replaces only directory RPC replies with controlled fixtures, and passes all four viewport/motion cases: valid Toronto fit, unpinned Nairobi world reset, Toronto return fit, city-only London exclusion, deduplication, delayed statistics, failed pagination and retry. These controlled data results are separate from the actual-data counts above. Screenshots `/tmp/map-deployed-camera-14bf6d8-{reduce,no-preference}-{390,1440}.png`.

Accepted deployed behavior for this bounded correction. Counts describe current loaded data, not independent geocoding verification or full-category enrichment. Most loaded Nairobi/Toronto entries still lack a street-level position; that source-coordinate work remains open.

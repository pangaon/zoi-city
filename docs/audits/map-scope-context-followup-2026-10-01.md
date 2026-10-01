# Map scope context follow-up

Read-only production reproduction, 1 October 2026. No source-coordinate or account changes.

## Current public states

Actual production, original public RPC responses:

- Nairobi/Kenya at 390: header `15 of 14,635 shown`; footer `14,635 of 30,284 listings have coordinates. The rest are in Explore.` followed by global 2,155 street-level and 12,480 unpinned counts, then 15 area results. No page errors.
- Toronto/Canada at 1440: header `643 of 14,635 shown`; same global footer, then 24 area results and Load more. No page errors.

The numerator is the deduplicated scoped merged list; denominator is the global coordinate-feed array. These are different populations. The footer also implies records outside that coordinate feed are only elsewhere, despite supplemental area results appearing here. Raw loaded search-result count does not equal additional unique visible records because duplicates/category filters apply.

## Reproduced functional race

On actual production Toronto page, delayed only the original `home_stats` response without modifying it. Area results loaded first: Load more existed. Released the original statistics response: Load more disappeared, along with the area result/error section. No user action or scope change occurred.

Cause: `explore/map/index.html` statistics callback assigns `coverageNote()` directly to `#pfoot`, overwriting the composed scoped footer. This can erase retry as well as pagination.

Reproduction scripts: `/tmp/map-scope-current.cjs`, `/tmp/map-footer-race.cjs`. Screenshots `/tmp/map-scope-current-{Nairobi,Toronto}.png`. The Toronto screenshot was reused by the race script for its final state.

## Proposed shared correction; not yet implemented

Requested ownership: `explore/map/index.html`, dedicated browser fixture and this audit. Use a single footer renderer for scope/results/error/loading/pagination and global coverage updates. Display deduplicated scoped loaded count without a misleading global denominator; distinguish list entries with verified pins from entries awaiting coordinates. Keep global coverage clearly global and acknowledge that additional unmapped results load in this area list. Preserve pagination/retry through late statistics and failed statistics reads. Test dense/sparse, query/category filters, duplicate supplemental rows, delayed statistics and area retry at 390/1440.

This fixes result context and interaction recovery. It does not geocode missing records or establish global coordinate correctness. The source-coordinate review queue remains open.

## Implemented candidate and exercised evidence

`explore/map/index.html` now uses one browse footer renderer. Header counts represent deduplicated loaded list entries; scoped street-position and awaiting-position counts are separate from expandable global feed/directory counts. Late statistics cannot remove area pagination or retry. Sparse supplemental results no longer coexist with a false no-matches toast. Footer content is bounded and scrollable on phones; rendering resets stale footer scroll offset and the list can shrink within its sheet.

`node tests/browser/map-scope-context/verify.cjs` passes at 390 and 1440 using actual candidate HTML/modules/styles with controlled read-only RPC responses: duplicate map/area record, delayed statistics, failed second page and retry, successful pagination, Toronto→Nairobi scope replacement, sparse unmapped record, no false no-results toast and no browser errors. Screenshots `/tmp/map-scope-context-{390,1440}.png` inspected. Basemap itself uses its normal remote resources. No production mutation or candidate deployment performed.

51 existing map unit checks pass across map-data, map-precision, map-preview and map-focus-return. These are regression evidence, not coordinate verification. Further debt: changing to an area with no positioned records leaves the previous map camera visible; this candidate explains list availability but does not invent a geographic centre. Source geocoding remains open.

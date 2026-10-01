# Map production acceptance — 0a4eaf2

Read-only acceptance on 2026-10-01. No authentication, production writes, messages, or geocoding changes.

## Deployed code

The public `/explore/map/` HTML and `/assets/map-data/loader.mjs` returned 200 and matched the tested release archive `/tmp/zoi-map-settings-release-yeugnw5k` byte for byte. Release tree: `c7f729d3efb9946fbb9b6e9a01857a3c5fd87fc8`.

## Real public source and rendering

No RPC or asset overrides were used for these two checks:

- Nairobi, Kenya at 390px: scoped `explore_search` returned 15 public records, including `ke-nairobi-yamas-greek-restaurant`. The previous production baseline showed no Nairobi results. The new records appeared in the list without fabricated map positions.
- Toronto, Canada at 1440px: scoped search returned its first 24 records; existing mapped places remained visible, and “Load more area results” was available. The displayed combined count was 643. Search results were deduplicated against existing map records, so 24 search responses do not mean 24 new unique places.

Both requests used exact city and country, limit 24 and offset 0. Both pages returned 200, displayed the expected scope and basemap, and had no recorded page errors or horizontal overflow during the bounded run.

Evidence: `/tmp/map-production-0a4.json` records public request arguments, response identities, visible text and errors. Visually inspected screenshots: `/tmp/map-production-0a4-Nairobi.png` and `/tmp/map-production-0a4-Toronto.png`.

## Exercised sparse journey

A separate browser run used the actual deployed HTML/modules, with only RPC responses replaced by controlled public fixtures. At both 390px and 1440px, an unmapped Nairobi record appeared, could be selected, and opened its correct identity preview. A record without coordinates or a verified address produced neither a pin nor a Directions action. Exact scope arguments were asserted. No page errors or horizontal overflow were recorded.

Evidence: `/tmp/map-live-sparse-0a4.mjs`, `/tmp/map-live-sparse-0a4-390.png`, `/tmp/map-live-sparse-0a4-1440.png`. This is controlled journey evidence, not proof of authenticated production data or verified coordinates.

## Remaining limits

The existing footer still says unmapped records are “in Explore,” although scoped results now also appear here. The global denominator still represents coordinate-bearing feed records rather than the merged list. These are copy/count-context debts; reported to the lead. This run did not exhaust pagination or verify the geographic accuracy of every source record. Existing unverified coordinates remain withheld from precise pin placement.

# Progressive map startup acceptance

The Map creates the existing basemap and loads a bounded 24-row public directory independently of the full coordinate feed. No ordinary pins or distances are supplied until the entire existing page walk and cohort checks succeed. Address lookup remains useful; numeric Directions still require the separate exact reviewed entity/coordinate receipt.

From the frozen root, with existing dependencies linked:

```sh
node --test tests/unit/map-data.test.mjs tests/unit/map-preview.test.mjs tests/unit/map-focus-return.test.mjs tests/unit/map-precision.test.mjs
EVIDENCE_DIR=/tmp/map-startup-controlled node tests/browser/map-startup/verify.cjs
EVIDENCE_DIR=/tmp/map-startup-real node tests/browser/map-startup/real-data.cjs
node tests/browser/map-scope-context/verify.cjs
node scripts/lint-html.mjs explore/map
```

`verify.cjs` runs six real-MapLibre browser cases at 390/1440 with clearly controlled read-only RPC receipts: held feed, failed first page, missing second page, recovery, preserved selected profile/manual camera, incomplete-feed distance/pin suppression, separate reviewed Directions, and intentional city/world changes. Missing-page recovery checks actual source GeoJSON because a deliberately retained manual camera can leave the recovered point offscreen. No synthetic receipt is represented as production data.

`real-data.cjs` overlays only owned Map HTML/loader/preview source onto www.zoi.city. All RPC/image/provider responses are actual anonymous reads. It blocks service workers in the candidate context so deployed cached source cannot bypass the static overlays, asserts the candidate document, and records served owned SHA256 values. Four All Saints/Olympia cases verify public identity, action semantics, home links, URL selection, responsive layout and errors. This is candidate acceptance, not a deployed acceptance claim. Writes are blocked. Provider route links are inspected; no booking, payment or customer mutation occurs.

The prior address verifier's 36–47 second totals included a 30 second wait for a nonexistent `.m-row-act` selector. Those totals are not website startup latency. The new test reads actual `.m-dir` actions and records first usable result, selection and action separately. Exact final evidence includes real 500 responses followed by retries and some still-loading basemap styles. These limits remain open.

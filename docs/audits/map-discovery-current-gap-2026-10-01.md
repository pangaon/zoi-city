# Shared discovery recovery and bounded map audit — 1 October 2026

## Reproduced discovery defect

The actual `assets/zoi-search.js` palette was mounted in Chromium before editing. A delayed Toronto response repopulated results after the query was cleared; the input was empty while an old Toronto row remained. A separate HTTP503 search response displayed `no matches`. Evidence: `/tmp/zoi-discovery-gap.cjs` and `/tmp/zoi-discovery-gap.json`.

The generation counter previously advanced only when a debounced network request started. Input changes, clearing and close/reopen did not fence responses. Old rows also remained actionable by Enter during debounce. The HTTP branch converted every non-success response to an empty list.

## Candidate implementation

Every input, clear, close and reopen now invalidates the search generation, pending debounce and active request. New input removes old actionable rows immediately. Network work has a12-second abort deadline. HTTP failures and malformed non-array responses show a retry action with the query preserved and a working Explore fallback; successful empty arrays alone report no matches. Sparse records without usable identity are not made into broken result links. Error retry is a real button with mobile touch sizing. Result name and location now occupy separate lines.

The shared script is loaded on ten routes: home, Explore, Tickets, social workspace, apps index, event-os, tickets-studio, business-pro, command-center and intelligence. Each exact script URL is versioned `20261001-search-recovery`; no unrelated page markup was edited.

## Exercised candidate evidence

`tests/browser/search-palette/verify.cjs` passed at390/1440 using the real script/styles and controlled public search responses. It covers clear while pending, a newer query before its debounce starts, close/reopen, stale Enter, HTTP503 retry, successful empty, malformed response, sparse/populated rows, bounded timeout, arrow selection, and exact listing navigation by touch/keyboard. No captured page errors remained. The initial destination fixture lacked shared themeCSS and triggered Chromium's cross-document transition rejection; adding the same theme to the destination resolved that mismatch without error suppression. The phone error/retry screenshot was visually inspected.

55 existing search/map regression tests passed. Inline script parsing passed. Candidate deployment and production acceptance remain lead-owned; these tests are not evidence that every search or map record is correct.

## Separate live geography evidence

A read-only public `explore_geo` call (`p_limit:1000,p_offset:0`) returned1000 coordinate rows:708 city,161 street,127 approximate and4 unknown. This is the first bounded page, not a random sample or full-catalog audit. All1000 passed numeric coordinate bounds. Running the current production loader's cohort guard on this sample allowed158 street pins and withheld842 coarse/unknown/conflicted rows.189 sample rows had cohort conflicts, including3 labelled street. Evidence: `/tmp/zoi-geo-bounded-sample.json`, `/tmp/zoi-geo-bounded-analysis.json`.

Current `explore/map/index.html` uses `hasStreetPosition` for GeoJSON pins and camera selection, and the already delivered supplemental area search lists unmapped records without inventing positions. Thus the bounded source still contains many city-centre coordinates, but current map code does not promote these to premises pins. No live coordinates were changed and no claim of worldwide street accuracy is made. A street metadata label alone does not prove physical address accuracy; source geocoding verification and remaining global coverage remain open.

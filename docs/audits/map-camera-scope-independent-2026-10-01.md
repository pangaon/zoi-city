# Independent map camera scope review

1 October 2026. Read-only candidate review; no coordinate changes or production mutations.

Accepted HTML SHA256 `e89c3262531bb08315363f03ffe1a4e242940fb731311655377cb1be0d976afe`. Camera fixture SHA256 `e001eab2577b0954d35eb7ef5ca869d08195d2f1775ee77481424bed773deaf8`.

## Source

`showMatches()` uses the current scoped deduplicated list, and `matchBounds()` admits only positions passing existing street-position checks. If no bounds exist it stops previous motion and jumps to a neutral world camera (centre 0,0, requested zoom 0.6, zero pitch/bearing). This is camera orientation, not a new listing coordinate or claimed city centre. Valid bounds retain existing fitting, with zero duration under reduced motion. Explicit saved camera URLs retain the existing restore behavior.

Footer wording now limits the absence statement to loaded results, rather than asserting all records in an area lack coordinates. Existing footer count/retry implementation is preserved.

## Exercised and rendered

Independently ran `node tests/browser/map-scope-context/verify-camera.cjs`: all four 390/1440 × reduce/no-preference scenarios passed. Each asserts Toronto valid-position fit, switch to Nairobi without positions resets to world, return to Toronto fits again, and London city-only coordinates cannot provide trusted bounds. Scope/count/pagination/error-retry assertions also pass and browser page errors are absent. MapLibre constrains world zoom on phone; accepted world range remains at most 1, not a city view.

Inspected `/tmp/map-camera-reduce-390.png` and `/tmp/map-camera-no-preference-1440.png`: Nairobi context and unpinned row remain available over a clearly global view; stale Toronto streets are absent, footer remains contained and readable. Runtime is actual candidate HTML/modules/styles with controlled directory RPCs and normal basemap resources. No deployed behavior or global geocoding correctness is claimed.

Accepted for lead integration. Source-coordinate verification and unmapped-record enrichment remain separate open work.

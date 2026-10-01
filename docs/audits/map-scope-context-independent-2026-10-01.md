# Independent map scope review

Reviewed frozen `explore/map/index.html`, its dedicated browser test and follow-up audit. No candidate runtime modifications or production mutations.

Accepted for its bounded scope: deduplicated loaded-result counts, truthful separation of scoped street positions from global feed coverage, and preserving area pagination/retry through late statistics. This is not geocoding acceptance or a declaration that the entire map experience is complete.

## Independent checks

- `node --test tests/unit/map-data.test.mjs tests/unit/map-precision.test.mjs tests/unit/map-preview.test.mjs tests/unit/map-focus-return.test.mjs`: 51 passed.
- `node tests/browser/map-scope-context/verify.cjs`: passed at 390 and 1440. Actual candidate HTML/scripts/styles with controlled RPC responses, original remote basemap. Duplicate positioned/area row merges correctly; initial count 24, one street-positioned and 23 awaiting; second-page failure retries to 25; sparse Nairobi scope replaces Toronto list with one unpositioned result.
- Additional independent mounted variant deferred the statistics success until the area pagination error was already displayed. Retry remained present after statistics resolution and succeeded at both widths.
- A second independent variant returned a statistics HTTP 503 while the area retry was displayed. Retry still worked at both widths. These variants also asserted no horizontal document overflow and footer height at most 152px. Temporary helper removed after execution.
- No browser page errors in these runs. Source review confirms the statistics callback now invokes the same composed footer renderer and leaves selected-preview mode untouched.

## Visual inspection

Inspected `/tmp/map-scope-context-390.png` and `1440.png`. Mobile list card and footer are legible and contained. Expandable global coverage no longer consumes the list by default. Desktop scope/result text agrees with the scoped list rather than comparing that count against all global feed records.

Known remaining issue is visible: switching to an area without any verified positioned records leaves the previous map camera (Toronto) behind the Nairobi list. The candidate audit already discloses this. Do not interpret the background map as Nairobi geocoding. Also the temporary status can continue saying results appear as they load after a sparse result is already present; it expires, and does not block interaction, but should be polished in the next scope/camera task.

No new blocking defect found for the bounded count/footer correction. Query/category combinations beyond the existing unit coverage were not separately exercised by this review, nor were real production coordinates verified.

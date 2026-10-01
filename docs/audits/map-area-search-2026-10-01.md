# Map scoped area search and coordinate guards — 2026-10-01

The coordinate feed excludes listings without coordinates. Previously they could only be reached through an exact slug or by leaving the map for Explore. The map now supplements its list through the existing public `explore_search`, scoped to the current query/city/country, with explicit 24-row pagination and retry messaging. Empty global browsing does not trigger another global fetch.

Supplementary results remain list-only even if a response happens to contain coordinates. They do not create pins, distance estimates, or coordinate directions. Selecting one loads its exact canonical public profile. The existing mapped record wins duplicate slugs. Requests are fenced by scope generation, and account/storage changes invalidate pending area results. Background results do not replace a selected-place panel.

Shared coordinate validation now rejects coercion-only values, range errors and the dual-zero sentinel; actual equator or prime-meridian locations remain valid. Directions reuse that same verified-position guard rather than trusting precision text alone.

## Evidence

Focused loader/precision/preview/focus-return tests pass. Added actual cases for 24-row pagination, sparse completion, wrong-country/private row rejection, failed-page retry, stale account/location responses, immutable coordinate withholding, and invalid-coordinate routing.

Actual map module mounted with local candidate HTML/loader on the production origin and controlled public RPC responses at 390/1440: an entirely unmapped Nairobi record appears under the explicit Nairobi/Kenya scope, opens its identity panel, retains no pin or directions without address evidence, and has no horizontal overflow or recorded page errors. Screenshots `/tmp/map-area-390.png` and `/tmp/map-area-1440.png`; harness `/tmp/map-area-browser.mjs`. Mobile screenshot visually inspected.

The first browser run timed out waiting for the result; it did not capture diagnostic state. A second run with diagnostic capture and a shorter 10-second assertion passed both widths. Do not interpret the repeat as proof of zero intermittent loading failures. Real provider tiles were involved; public RPC results in this test were controlled.

No coordinates were invented, no geocoder was called, and no production data or schema was changed. This is candidate acceptance, not deployed coverage or proof that all listings have verified locations.

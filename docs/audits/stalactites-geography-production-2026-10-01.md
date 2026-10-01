# Stalactites production geography — independent acceptance

Actual public browser/API evidence, 1 October 2026. No writes, mocked responses, or coordinate replacements. Lead performed the guarded write; this reviewer exercised the resulting public map.

## Source and projection

Read actual `explore_geo`, `explore_search` and `home_entity` responses through the browser at 390 and 1440 widths. Stalactites Restaurant, slug `stalactites-restaurant-melbourne`, projects latitude **-37.8110808**, longitude **144.9670491**, precision **street**, address 177–183 Lonsdale Street, Melbourne VIC 3000. The point matches the independently reviewed official and municipal published coordinate. `home_entity` provenance names request `59ca1977-37f5-4d02-8a35-c2cb68346be6` and the exact reviewed report hash. No synthetic point substituted.

## Rendered and exercised

Test script `/tmp/stalactites-production.cjs`; retained output `/tmp/stalactites-production.json`; screenshots `/tmp/stalactites-production-{390,1440}.png`.

Desktop 1440: ordinary pointer click on the actual map pin opens the correct named place preview. Phone 390: pin exists, but normal pointer click repeatedly fails because `#attrib` overlaps the pin; ordinary result-row selection works and opens the correct preview. Screenshot `/tmp/stalactites-obstructed-390.png` records this obstruction. Root owns the shared camera/layout correction; mobile pin acceptance remains open.

Both selected previews identify street-level location and expose the correct business-home link, official website and source menu link. Directions deliberately use the published street address (Google Maps destination), rather than suggesting surveyed entrance precision. Provider navigation was inspected, not a trip initiated. No page errors at either width.

Separate contact defect found during this real journey: the preview exposes `tel:5555555555` from legacy `profile._enrich.phone` even though top-level phone is null. Reported to lead for a shared contact validation correction. This is not valid contact acceptance and is unrelated to the new coordinate.

## Request preparation helper

Independently inspected `scripts/geography/reviewed-coordinate-request.mjs` and reran its three unit tests, all passing. It preserves exact report bytes and explicit immutable request UUID, checks retained snapshot/review binding and expiry, creates a file exclusively with restricted mode, and has no network/database mutation. Server evidence, current-row CAS and privilege gates remain authoritative; preparation alone does not approve a coordinate.

Production geography projection is verified. Full guest journey acceptance is withheld pending phone pin obstruction and the exposed invalid contact action. No category-wide geocoding completion is claimed.

## Shared map correction — candidate execution

Lead corrected search camera fitting to use measured controls, tool rail, attribution and result-sheet insets, shared with selected-place focus. Independent short-phone testing initially caught a `Cannot read properties of undefined (reading 'center')` error from excessive fit padding; lead then used the existing minimum-drawable-region clamp.

Frozen HTML SHA256 `bcb8b869f038383d69615311124d3ab988f32b02733d5186990eb46be1745d59` passes normal, unforced pin clicks and correct selected previews in four scenarios: 390×900 and 1440×900 normal motion; 390×700 and 1440×700 reduced motion. Zero page errors. Only the map HTML response was replaced with candidate bytes; all listing/API data, shared modules and tiles came from production. `/tmp/stalactites-candidate.cjs`, `/tmp/stalactites-candidate.json`, and `/tmp/stalactites-candidate-{width}-{height}.png` retain evidence. Short-phone screenshot visually inspected: selected marker clear of controls and attribution. These are candidate results, not evidence of deployment. Invalid legacy contact action remains separate.

Additional preselection measurement at 390×700: pin bounds x187,y376,16×16; controls bottom380.828; attribution top396.609. Centre click succeeds, but the marker's top roughly five pixels grazes the controls and the available vertical gap is only 15.8 pixels. Reported to lead: automatic sheet collapse on insufficient map height would improve touch usability beyond the passing centre-click check. `/tmp/stalactites-short-before.png` records the narrow preselection state.

### Final candidate accepted after short-phone correction

The prior candidate was held. New hash `17524420ba93a211dee3654be99675e31ef5ef95af72d8ef12ef97c6c455319b` automatically collapses the phone sheet when less than 120 px remains, then recalculates camera insets. Independently reran all four scenarios above: ordinary pin clicks, correct previews, zero errors. At 390×700 the full pin is now y446–462, controls finish at380.828 and attribution begins533.609. Screenshot `/tmp/stalactites-short-before.png` was replaced with and visually checked against this final state. The collapsed sheet retains its Show places control; normal click reopens it (`aria-expanded` false→true) and reveals the actual Stalactites result. Candidate accepted; production deployment verification remains separate.

## Production release007f65c

Lead verified actual deployed HTML SHA256 `17524420ba93a211dee3654be99675e31ef5ef95af72d8ef12ef97c6c455319b`. CI36815372082 passed. Exact staged release passed258 test files plus2 standalone suites. Actual public map (no HTML/data overrides) passed390/1440 widths at900px normal and700px reduced motion; ordinary pin clicks, exact public coordinate response, short-phone full-pin clearance, manual sheet reopening and zero page errors. Report `/tmp/map-reviewed-pin.json`. Legacy placeholder Call remains visible in this release and is explicitly separate pending shared-family repair; no telephone call was placed.

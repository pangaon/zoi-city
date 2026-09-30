# Map live journey check — 2026-09-30

One bounded production browser session, resized390×844 and1440×1000. No business changes, reservations, tile-provider configuration changes or navigation claims.

- Live search Avli produced6 results. Selecting Avli Rethymno opened its preview and moved keyboard focus to Open home. Enter opened /business/avli-rethymno; browser Back restored search, selected place and map view.
- No horizontal document overflow at either viewport. Screenshots: .recovery/logs/map-preview-live-390.png and map-preview-live-1440.png. Initial phone screenshot had partly loaded basemap; desktop later showed detailed tiles. One observed page load had33 map/style/tile resource entries; no stress loop.
- Rethymno pin clearly says Approximate city location. Directions uses Xanthoudidou22 address rather than city-centroid coordinates. Name-only results explicitly label name-based provider search. This is a provider handoff, not Zoi live navigation.
- Permission denial was injected into the actual page's geolocation callback: clear browser-settings denial appeared, existing selection remained. This is an error-state fixture, not a real user permission grant.
- Speech methods were instrumented on the live DOM: explicit Read calls speak once, Stop calls cancel once and hides Stop. Actual audible output was not tested. Existing lifecycle tests separately cover hidden page/destroy and stale callbacks. Copy correctly distinguishes place summary from turn-by-turn navigation.
- Reproduced keyboard defect: Escape from focused preview action removed the element and left focus on BODY. Candidate closeSelection now restores focus to search after Escape or Back to all results. Actual handlers executed in focused VM regression;29 map focus/preview/precision tests passed. Production remains unchanged until root releases candidate.

Files: explore/map/index.html; tests/unit/map-focus-return.test.mjs. No broader map rewrite or completeness sign-off.

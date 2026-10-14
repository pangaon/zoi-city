# Map correctness and interaction delivery

Source candidate in `/workspaces/zoi-city-release`; this artifact does not establish a production deployment or native device acceptance. Existing owner publication schema remains frozen.

## Shared correctness

Individual web markers now always use their own coordinates. Close but geographically different listings remain an area group; clicking that group never fans individual premises around the host coordinate. Spider previews apply only to exactly shared coordinates and their geographic anchors stay unchanged. Selecting a different place resets precision zoom; selecting the same place retains deliberate closer zoom. Dateline result bounds use the short longitude arc. Browser location accuracy metres now convert using MapLibre's 512-pixel world.

Web and native preserve optional public listing ID, sanitized source geometry metadata and reviewed receipt. The shared enrichment diagnosis overrides documented city-centroid/street conflicts, preserves legitimate shared buildings for review, and requires matching current listing/pair receipt for numeric routing. Explicit canonical null coordinates cannot revive stale feed coordinates. These changes do not independently prove old catalogue coordinates match published addresses.

## Twenty acceptance targets

| Target | Web source and exercised evidence | Native state |
|---|---|---|
| 1 Anchored pin versus area | Eight actual-function geometry/metadata cases; independent browser uses real MapLibre | Native pins remain exact; precision reset source and TypeScript checked, physical device pending |
| 2 Place/address suggestions | Local complete position feed plus existing remote name suggestions; address visible in suggestion. Controlled published-address dropdown exercised | Name/place search remains native; advanced published-address tools explicit browser handoff. Global published-address helper merged; controlled unlocated address suggestion → fresh profile exercised. Additive RPC production deployment required |
| 3 Categories | Existing multi-select retained; independent browser exercised | Existing native type selection; web multi-select handoff |
| 4 Search visible area | Bounds and URL state, antimeridian tests, controlled browser exercised | Full map tools handoff |
| 5 Locate me | Explicit browser permission; independent success/denial/coarse recovery | Existing device location path; device permissions pending |
| 6 Radius | 1/5/10/25/50 km; no filtering from absent/coarse position; browser exercised | Full map tools handoff |
| 7 Straight-line sorting | Named explicitly; deterministic unknown-position order; browser exercised | Existing native proximity plus full map tools handoff |
| 8 Hover/list selection | Shared highlight and exact selection; independent browser exercised | Existing touch selection; no hover on touch devices |
| 9 Touch photo preview | Existing fresh-profile selected preview retained and opened in browser | Existing selected native card; physical-device photo journey pending |
| 10 Sheet sizes | Compact, expanded, full list exercised at 390/1440 | Full map tools handoff |
| 11 Cluster drilldown | Geographic groups never imply premises at group anchor; group unit cases and browser checks | Existing native grouping retained |
| 12 Origin/destination | Root-owned actual address destination and optional origin panel | Root-owned direct optional origin input |
| 13 Modes | Root-owned drive/walk/cycle/transit; walking address URL exercised | Root-owned four mode buttons, shared navigation builder |
| 14 Navigation | Google Maps URL with destination/mode; external navigator handoff, no embedded route/ETA claimed | Direct Google Maps handoff; device app launch pending |
| 15 Saved map | Device-local save/unsave, true map+list filter, four bounded public readers recover unavailable-coordinate saved profiles; recovery browser exercised | Full map tools handoff; no account sync claim |
| 16 Share place/view | Selected public place and filters/camera only; independent share URL exercised | Full map tools link preserves public selected place/scope/camera, unit tested |
| 17 Fit/recenter | Independent browser exercised; dateline bounds unit case | Existing native fit/select plus handoff |
| 18 Compass/zoom/scale/fullscreen | Existing controls plus north reset/fullscreen; independent browser exercised | Native zoom buttons and existing map gestures; advanced controls handoff |
| 19 Themes/Greek | Existing basemap themes and labels retained; source review. Controlled owner browser has background-only style, so no live cartographic claim | Native map provider visuals remain; full map tools handoff |
| 20 Accessibility/recovery | Labels, focus outlines, keyboard typing guard, reduced-motion, permission/error retry; independent browser exercised | Accessible controls and handoff failure message; physical-device accessibility pending |

## Verification

Owner unit suite: 104 checks pass across marker position (8), loader, precision, focus/return, interactions, native discovery, coordinate diagnosis and shared autocomplete and six actual HTML address-search cases. Native TypeScript check passes. Inline JS parser and HTML lint pass. Owner actual-HTML/MapLibre browser runs pass at 390 and 1440 with controlled RPC records and background-only basemap: address dropdown/filter, area scope, actual address walking directions, save and sparse saved recovery, explicit GPS, radius/order, three sheet states, no overflow/page errors. Evidence: `evidence/map-interactions-owner-2026-10-13/journeys.json`, screenshots and reproducible `browser.mjs`.

Independent QA separately exercised broader controls and permission failure paths, with its own evidence. Production feed/source-coordinate review and migrations belong to enrichment/lead. Production deployment and iOS/Android build distribution belong to lead. Provider route calculation and ETA remain unconnected; Google Maps performs actual navigation after handoff. Global unlocated-address autocomplete now uses the lead's additive published-address RPC; production RPC deployment and live address query verification remain release gates.

# Toronto and Montréal room finishing candidate

Baseline: actual READY production `95d63fd15b18d3d73d91bb2a5e40ae54313e8a39`, deployment `dpl_AEtAAPx4k71afGdkRnw2o9TTCcbP`. The three source changes below are a candidate for the lead’s next reviewed batch, not deployed by this lane.

## Guest-impact findings and correction

1. Toronto phone sponsor drawer extended to y=787 while the selected-table strip began at y=764.7: 22.3 pixels of overlap. The drawer now anchors below the actual toolbar and caps itself against the actual room and any horizontally overlapping selection panel. Resize, full-screen and panel-size changes recompute this bound. One outer drawer owns scrolling; the business card does not add a nested scroll rail. Final 390px drawer ends at y=753, leaving 11.7px before selection. Its source action is visible and hit-testable at y=729.1. Desktop ends at y=887 and starts below its controls at y=81.
2. A real initial phone capture showed an incomplete logo and an empty white rectangle. The shared sponsor preview now displays the exact business name while loading, an explicit unavailable state on image failure, and the original image only once loaded. A fresh image element and request epoch prevent an old business image’s load event from changing a newer selection. The source URL, listing ID and demonstration disclosure are unchanged. The actual Kolonaki image rendered at its original 883×240 response dimensions.
3. The in-room test display’s hit target was 190×39px. It is now 190×44px. Open → inspect real selected table → reopen → remove → continue to Parea remains exercised.

Only `assets/events/signature/sponsor-preview.mjs`, `sponsor-preview.css` and `furnished-concert.mjs` changed. No stage, table, wall, source plan, camera, price, capacity or furniture change. Toronto retains white couches, prominent pink lounge bases and standard chairs; Montréal retains its black-cloth plan. Montréal has no invented sponsor preview.

## Separate evidence

**Source:** the exact approved plans, category mappings and original room imagery are frozen as dependencies. The earlier source-image receipt retains the original 3000×1996 concert photograph, 1920×1281 crowd photograph and 1080×1350 Montréal artist wall asset. This pass does not claim new photographic detail or measured venue accuracy.

**Actual production before:** `evidence/room-finishing-2026-10-03/before/` contains four no-overlay room journeys. All source IDs and categories match (Toronto 118; Montréal 102 exact IDs, including actual alphanumeric/gapped IDs). Complete finder access, clear selected labels, seated/close/full views, touch rotation without changing selection, unobstructed controls and full-screen exit pass. `interactions-before/report.json` retains the first interaction harness failure: it incorrectly expected a literal `data-fullscreen=false`; production correctly removes that attribute. The separately corrected run `interactions-corrected/` passes all four actual sponsor/handoff journeys and retains the real drawer/39px measurements.

**Candidate rendering and journeys:** `final/report.json` explicitly records local overlays of only these three candidate files against actual canonical pages and read-only APIs. Four 390/1440 Toronto/Montréal journeys pass. Toronto additionally exercises controlled slow loading, controlled provider failure, a stale old-image load event after a business switch, real original-image recovery, source-link hit testing, resizing to 740px height while the drawer is open, selected-table display/remove and exact-ID room → same Parea handoff. Controlled Theo image failures are retained as expected request failures, not disguised as live provider failures. Screenshots include pending/unavailable/loaded card states, resized drawer, actual table display and Parea handoff. No page errors, sends or writes.

**Shared regression:** `paired-candidate/` retains four complete local room journeys, including actual source counts/colours, all desktop numbers, selected-ID access with finder open, seated labels, touch/drag, edge/alphanumeric IDs and controls. Forty relevant unit tests pass (`unit-tests.log`).

**Negative candidate evidence:** `candidate/` retains a first fixture failure because the source action was inside unopened About details. `candidate-final/` passed its then-current journey assertions but its measured desktop drawer top was negative due to bottom anchoring feeding height back into the measurement. This visual defect was rejected, the anchor corrected, and `candidate-final-v2/` plus the final run assert both top/control and bottom/selection bounds. These earlier artifacts are immutable and are not final acceptance.

## Release and remaining capability

The lead must independently review, stamp imports once, release this batch and run `tests/browser/room-finishing-live/production.cjs` on the actual READY deployment. That production runner uses no overlays and requires explicit commit/deployment identity. No fresh production acceptance of these fixes is claimed yet.

Stock remains unconfigured in the actual event APIs. Room selection remains a preference, not a hold or booking; test displays remain demonstrations, not active sponsorship inventory. The seated room’s large dark upper area is retained as a composition observation, not a proven functional defect; camera geometry was not changed speculatively. This finishing pass does not establish physical venue accuracy, activated payments, sending, native 3D rendering, or completion of the wider platform scope.

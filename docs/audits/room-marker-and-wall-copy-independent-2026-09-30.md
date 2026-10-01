# Room markers and wall copy — independent candidate checks

Local integration candidate only; root holds release pending user's wording clarification.

## Angular numbered labels

Toronto actual pointer-orbit and camera zoom at390/1440/2048:9 selected12 cases, zero pairwise visible-label rectangle intersections, selected12 visible in every case, Find retained118 entries; no captured pageerrors. White couches and strong pink lounges remain unchanged.

Additional matching whole-room oblique case starts unselected, selects Whole room then drags toward horizon:390 shows21 labels,1440 shows102,2048 shows116, zero pairwise intersections,118 finder entries. Inspected /tmp/horizon-marker-1440-horizon.png; it reproduces the oblique whole-room orientation rather than an overhead substitute. Suppressed labels remain available through Find. The test output field named selected in this unselected run only means ID12 was visible, not that it was selected.

Montréal same9 angle/zoom checks:zero intersections,102 finder entries, no captured pageerrors. One phone orbit-plus-zoom moves selected12 outside the viewport; it is not retained onscreen under arbitrary free camera navigation. Other8 cases retain selected12. No genuine browser-menu200% zoom test was completed; no such acceptance is claimed.

Scripts: /tmp/angle-marker-qa.mjs, /tmp/mtl-angle-marker-qa.mjs, /tmp/horizon-marker-qa.mjs. Screens /tmp/marker-{390,1440,2048}-{angle,low-angle,zoom}.png and /tmp/mtl-marker-*; initial low-angle filename corresponds to overheadward drag and must not be presented as horizon evidence.

## Wall copy

Fresh integrated390/1440 screenshot inspection shows only SIGNATURE PRODUCTIONS on photographic wall artwork. CONCERT ARCHIVE is absent from that canvas caption; source explanation remains in About this room view. Screens /tmp/room-normal-selected-390.png and1440.png. Table17→parea still passes with no overflow/captured pageerrors. Browser closed.

User's latest wording requires root clarification, so this records actual candidate state rather than approving final wording. Separate observed phone chrome issue: closed sponsor opener partly under selection card in latest screenshot; reported to root without changing implementation.

## Production e82ad2 wall-copy acceptance

Actual public Toronto event at390/1440 loads furnished-concert.mjs?v=20260930-labels. Visually inspected /tmp/live-e82ad2-room-selected-390.png and1440.png: photographic wall caption is SIGNATURE PRODUCTIONS only; white couches/pink lounges retained. Actual About DOM says 'Wall photographs show previous Signature Productions events.' and contains no Concert Archive wording. Select17→parea succeeds at both widths, no overflow/captured pageerrors. Browser closed. No transactions/messages.

Script /tmp/live-wall-e82ad2.mjs. First script stopped on an ambiguous details selector matching both sponsor and About panels; corrected to the About details before rerunning. This was a harness selector failure, not a product error.

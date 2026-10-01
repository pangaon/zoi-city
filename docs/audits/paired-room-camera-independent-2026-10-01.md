# Paired room camera independent review — 2026-10-01

Reviewer: commerce_audit. No runtime edits or production writes.

## Candidate

- `assets/events/signature/furnished-concert.mjs`: `9166feb53ebd1a73afe010f23b614cdc06bc4a629a6332cfba7ab0c16a17a9da`
- `assets/events/room-scene.mjs`: `bb5cacf3c7458e7eb28c3e1f06d6214205d028638298d1faa2efecba9665f10b`

The diff preserves source table geometry, Toronto white couches/pink sponsor lounge treatments, Montréal furniture and published category colours. Changes concern overview framing, seated lens/aim and hiding floating number labels in seated views. No source re-enrichment or actual venue sightline certification is implied.

## Exercised evidence

`node --test tests/unit/{furnished-concert,paired-room-camera,room-scene,event-room-plan}.test.mjs`: all 27 pass independently.

`node tests/browser/paired-room-camera/verify.cjs`: all eight interaction scenarios report success (Toronto/Montréal × 390/1440 × normal/reduced motion), no page errors or page overflow. Production shell, only two candidate modules intercepted. Fullscreen, overview, source table selection, seated view, side selections and fullscreen exit exercised. This is candidate testing, not deployed-candidate proof.

## Visual blocker — acceptance held

Fresh independent normal-motion Montréal phone screenshots show the WebGL room disappearing after fullscreen, leaving DOM labels and the selected-table panel. Whole room and subsequent selection do not restore it. Reduced-motion screenshots render furniture and media correctly. The fixture's page-error/overflow checks do not detect this blank-canvas condition.

Repeated in a fresh browser with only Montréal390 normal motion, so this is not merely resource accumulation across eight scenarios. Console reports the Three shadow deprecation and ReadPixels performance warnings, not a context-loss warning. Cause remains under investigation by the implementation owner; observer/redraw scheduling is a hypothesis only.

Retained evidence:

- `/tmp/zoi-paired-room-camera-independent/` — complete independent eight-case screenshots and results.
- `/tmp/zoi-paired-camera-isolated/` — repeat isolated screenshots and results.
- `/tmp/paired-isolated.cjs` — isolated reproduction with browser console logging.

Notable failed frames: `montreal-390-no-preference-overhead.png` and `montreal-390-no-preference-side23.png`.

Other reviewed frames show readable paired seated media, intact selected-table actions and Toronto portrait overview using room height. Toronto portrait overview places stage left, Montréal stage right; reported as a camera-orientation consistency follow-up, not furniture/source mismatch. Full room design, real sponsor inventory and provider booking capabilities are outside this bounded camera acceptance.

## Corrected candidate independent acceptance

A second independent reviewer ran the full eight-scenario matrix with context availability and meaningful canvas pixels checked in all six room states per scenario (48 captures). All passed. Candidate modules were intercepted on actual production pages; this proves the local candidate in the current production shell, not deployment. Results/screenshots: `/tmp/zoi-paired-room-camera-independent-v2/`; log `/tmp/zoi-paired-room-camera-independent-v2.log`.

Accepted runtime hashes:

- furnished-concert.mjs: `5048615135fd0109e110b1a2a2f6a3b47a19bfb064fca316cb5722729e0f39c7`
- room-scene.mjs: `59f0d5169ddaa264254591e2365392ebbbdd15df00337b817afca50c3a1b4548`

The fullscreen visibility guard now keeps Montréal drawing while fullscreen even if the intersection observer reports its original location outside the viewport. Actual Montréal390 normal-motion overview and subsequent selections render furniture/media, resolving the reproduced blank-canvas blocker. Context and screenshot pixel checks supplement page exceptions; they are not a complete visual-quality measure.

Directly inspected phone normal/reduced overview frames and both cities' phone/desktop seated frames and desktop overview frames. The stage appears on the RIGHT in both phone overviews. The prior left/right prose was incorrect for the current Toronto runtime; an unnecessary Montréal sign change was reverted before its matrix cases began. The final projection test separately passes. All 28 relevant unit tests passed; the corrected orientation test was rerun after the final sign correction.

White Toronto lounge furniture/pink bases remain; Montréal keeps its source-specific dark seating. Seated media remains visible without floating table-number clutter. Toronto's portrait floor uses more height than the previous shallow strip, but still has more unused vertical space than Montréal. Small controls require horizontal scrolling on narrow screens, and not every source number is simultaneously visible in overview; Find table remains available. These broader design limitations remain open and are not newly claimed complete by camera acceptance. No live inventory, sponsor configuration, payment, device-native performance or certified venue sightline acceptance is implied.

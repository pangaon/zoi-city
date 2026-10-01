# Paired room control acceptance — 2026-10-01

Scope: shared phone toolbar and current room regression inspection. No geometry, artwork, source table/category, pricing, furniture, inventory or checkout changes.

## Reproduced current behavior

The current Toronto production shell with unchanged local room modules passed normal-motion390/1440 canvas/context checks through embedded, fullscreen, overview, seated and side selections. Screenshots/results: `/tmp/paired-room-current-oct1/`. On390, focusing the fullscreen button scrolls the single-row toolbar right, hiding Find table and Stage view. Whole-room selection retains an offset and partially clips Exit full screen. This is a reachable phone control defect, not missing table data.

The Montréal public canonical route did not mount a room; bounded readback returned503 and the HTML title `Profile temporarily unavailable — Zoi`, with `This profile couldn’t load`. Retained `/tmp/montreal-current-room-page.html`. This is recorded separately from room rendering; no attribution beyond failed profile retrieval or repeated backend probes. Live Montréal acceptance remains blocked.

## Correction

`assets/events/room-brand.css` puts the phone toolbar into a two-row six-column grid: Find table, Stage view and Whole room on top; View from table, zoom controls and Full screen below. All retain44px targets. No horizontal toolbar scrolling or focus-induced clipping. The shared finder and Toronto sponsor tools sit below the taller controls. Desktop controls remain one row. Toronto fullscreen canvas padding accounts for the taller toolbar.

## Exercised evidence

`node tests/browser/paired-room-controls/verify.cjs` passes four real-renderer journeys: Toronto/Montréal ×390/1440. Local static Toronto page is used; Montréal mounts its exact retained `MONTREAL_PLAN_SOURCE`, tables and categories through the existing renderer, without a synthetic replacement plan or live API. External requests are blocked. This establishes local renderer behavior, not current Montréal public-route availability.

Every visible toolbar button is asserted inside the toolbar, at least44px high, and hit-testable, with no horizontal overflow. Phone toolbar height is at most110px. Fullscreen, actual source table12/10A selection through Find table, seated view, overview and exit are exercised. Four cases passed; no page exceptions. Artifacts: `/tmp/paired-room-controls/` and `/tmp/paired-room-controls.log`.

Visually inspected both phone fullscreen frames and both desktop seated frames; earlier current Toronto phone overview and desktop seated frames also inspected. White Toronto couches and prominent pink lounge bases remain; Montréal has dark cloth/chairs and published category accents. Existing table-label decluttering means not all source numbers are simultaneously visible in overview; Find table remains the source-ID access path. Chairs are visible in close views; phone overview is necessarily smaller and no comprehensive legibility score is claimed. Toronto's added wall overlay is Signature Productions; the original concert poster retains its organizer artwork and event text. No new invented wall text, archive caption or imagery was added.

28 relevant unit tests pass: furnished-concert, paired-room-camera, room-scene, event-room-plan. No full build, deployment, current source re-verification, certified sightline or mobile-device GPU benchmark claimed.

Frozen CSS SHA256: `0db57c7a081308ad2298e57a7b03cbc4306fdf4fc552fc14e4bfdc6b69c44bef`.
Harness SHA256: `0f3f0638f71842f9ede82e0f19e7ac4b446c2260c3a967a3f390f72dea06ce12`.

Root owns versioned CSS import integration and release. Independent review required.

## Lead independent acceptance
Root independently ran four actual-renderer390/1440 journeys in /tmp/paired-room-controls-root; /tmp/paired-room-controls-root.log passed. Inspected both phone fullscreen screenshots: Find table, Stage view, Whole room, zoom and Exit remain visible and selectable. This accepts the scoped control layout, not complete room visual/source accuracy. Dependency CSS imports now reference room-brand.css?v=20261001-phone-controls; furniture and camera runtime unchanged. Montreal live route remains503 separately.

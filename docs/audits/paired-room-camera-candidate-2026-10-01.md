# Paired room camera candidate — 1 October 2026

Scope: camera correction only. No source table coordinates, source capacities, category colours, prices, Toronto white couches, room artwork, or shared room CSS changed.

Toronto portrait Whole room now rotates the camera through 90 degrees and fits the floor into the portrait viewport; the stage-only mobile lens shift no longer pushes overhead content into a shallow strip at the top. Floor centre is accounted for. Seated views in both rooms use illustrative eye height of 1.15 scene units, aim at the stage media, and adapt portrait field of view within a bounded range. Toronto floating spatial sprites and Montréal table markers are hidden during seated viewing so they do not cover the artwork. These remain illustrated views, not measured sightlines.

## Evidence

Source: existing source plans and furniture contracts retained; 27 tests passed:

`node --test tests/unit/furnished-concert.test.mjs tests/unit/paired-room-camera.test.mjs tests/unit/room-scene.test.mjs tests/unit/event-room-plan.test.mjs`

Rendered/journey: `node tests/browser/paired-room-camera/verify.cjs` passed eight combinations: Toronto/Montréal ×390/1440 ×normal/reduced motion. Each exercises embedded entry, fullscreen default perspective, overhead, selected seated view (Toronto12/Montréal10A), table1 and23 focus, fullscreen exit. No page errors or document horizontal overflow. This uses the actual production page shell with ONLY the two candidate modules intercepted from disk; it is candidate evidence, not a deployment claim. No reservation, payment or customer write.

Screenshots/results: `/tmp/zoi-paired-room-camera/`, `results.json`. Inspected portrait overhead, both portrait/desktop seated views, and portrait side selections. Toronto portrait overview now uses roughly430px of height rather than the earlier shallow strip. Both seated posters fit visibly; Toronto white couches and category colours retained. The Montréal table23 screenshot is a normal source table, not a Toronto-style lounge.

Remaining: small-table number density still requires Find table; sponsor preview/control crowding is a separate lane; original image resolution is unchanged; this software-rendered browser does not establish physical-device FPS or measured venue sightlines. Live proof must follow integration.

## Frozen owned manifest

- `assets/events/signature/furnished-concert.mjs` SHA256 `9166feb53ebd1a73afe010f23b614cdc06bc4a629a6332cfba7ab0c16a17a9da`
- `assets/events/room-scene.mjs` SHA256 `bb5cacf3c7458e7eb28c3e1f06d6214205d028638298d1faa2efecba9665f10b`
- `tests/unit/paired-room-camera.test.mjs` SHA256 `5bcbc3a0e061cd98bb39b8b42904f61a279d6016c3c6f403780835ee94c644b7`
- `tests/unit/furnished-concert.test.mjs` SHA256 `197f612252c4e369b066ac6d07863f2b2f2235cf1659565cfbe84c33477921d0` (existing camera assertion updated to media aim)
- `tests/browser/paired-room-camera/verify.cjs` SHA256 `1db557810fc2b030d703893ffdf685711f5ae98d41e8505e4ddc43c0df2d962f`

No staging or deployment by this specialist. Root owns cache references/integration/release.

## Resumed held-release investigation

The current worktree already contained the prior specialist's fullscreen visibility repair and pixel/context assertions when room_repair resumed. These changes were preserved. Montréal's draw scheduler previously trusted only IntersectionObserver visibility: a false intersection during fullscreen would stop redraws after canvas resize. The prior failing run suggested this scheduling path; the resumed ordinary observer trace did not reproduce a false fullscreen intersection, so the browser trigger is not independently established by that trace. The repair treats native fullscreen and the expanded fallback as visible, requests drawing on fullscreen state change, and uses that visibility rule in scheduling, frame execution and observer cancellation.

An isolated Montréal 390px normal-motion run passed actual WebGL context and screenshot-content checks for embedded, fullscreen, overview, seated10A and side table1/23 selections. Retained screenshots: `/tmp/zoi-paired-room-camera/` (stage-right original candidate) and `/tmp/zoi-room-repair-current/` (temporary stage-left orientation experiment, withdrawn). No production mutation or deployment was performed.

The earlier stage-left Toronto description was stale. Independent rendered inspection established current Toronto portrait stage RIGHT. Montréal retains positive PI/2 overview orientation, also stage RIGHT. A projection regression now checks that orientation explicitly; all28 relevant unit tests pass. Runtime geometry and approved venue furniture are unchanged.

The browser verifier now derives repository location from its file, accepts `CHROMIUM_EXECUTABLE_PATH` and `ROOM_CAMERA_OUTPUT`, and records IntersectionObserver/fullscreen state in results. Existing actual-canvas checks reject lost contexts and >97% dominant-colour frames with DOM table labels hidden; these detect the prior blank-room defect rather than accepting surviving HTML labels. Fresh independent matrix acceptance is required before release. These checks establish rendered content, not physical-device performance or a fully completed venue product.

# Independent paired room safe-chrome correction · 2026-10-02

Accepted this narrow responsive correction, superseding the artwork/control overlap finding in `paired-rooms-current-independent-2026-10-02.md`. No runtime edits or deployment were performed by this reviewer.

## Source review

Phone canvas space now starts below measured toolbar chrome; Toronto also reserves the closed sponsor summary strip. Controls remain visible and usable, rather than hidden. Resize observers and existing render projection use the reduced canvas dimensions. Toronto marker-layer bounds already align with the actual canvas, so the inset is propagated to label positions. No source IDs, floor-plan positions, furniture geometry, artwork sources, category prices, or camera presets changed.

Root subsequently changed the Montréal CSS-loader query to safe-chrome and parent/CSS import chains; final review includes that query-only integration.

## Independent exercised/rendered evidence

`tests/browser/paired-room-safe-chrome/verify.cjs` passed both cities at390/1440 with reduced and normal motion: eight journeys. It checks measured canvas/chrome clearance, phone canvas greater than450px at900px height, visible reachable44px toolbar targets, source12/10A finder selection, selected view, seated camera, whole-room view and fullscreen exit, with no captured page errors. Screenshots `/tmp/room-chrome-independent/` and `/tmp/room-chrome-independent-motion/` retain embedded/default/fullscreen/selected/seated/overhead states.

An independent extended local script `/tmp/room-chrome-sponsor-independent.cjs` also passed the four paired journeys and Toronto create test placement→inspect physical display→reopen→remove at both widths. Explicit sponsor-open screenshot is retained separately under `/tmp/room-chrome-sponsor-independent/`. The open drawer intentionally overlays the room; closed summary is outside the rendered art. Preview remains demonstration-only, not approved sponsorship.

Visually inspected paired phone default, selected and seated images and desktop overview: previously masked poster faces are now below the toolbar/closed sponsor strip; white/pink Toronto lounges and black Montréal chairs remain distinct. Desktop retains its prior layout. Twenty-four furnished-concert/paired-camera/room-scene tests passed, including source geometry/camera constraints. Log `/tmp/room-chrome-units-independent.log`.

After root's cache-query integration, reran all four actual local journeys successfully: `/tmp/room-chrome-final-query-independent/`, log `/tmp/room-chrome-final-query-independent.log`.

## Final runtime hashes

```text
47bd701b9140f7a82707b25da0acf1204ab7e65afef1f6477c902a86811a6deb  assets/events/room-brand.css
0e5e8960ff243151da97bff5dc1d8fe84bb7f441a277dfd845dbb6898022967b  assets/events/room-scene.mjs
0241805294b4d6e83fe5a1305933fa3bd6158b8bdcf198643bd2abcbb1e5137c  assets/events/signature/furnished-concert.mjs
```

This is local corrected-renderer acceptance, not a production availability assertion. Montréal uses the retained source-plan local mount; its earlier production503 remains a separate gate. No service schema/frontend activation, live inventory, booking, payment or new source-image quality capability is inferred. Root retains coherent cache/release and actual production verification ownership.

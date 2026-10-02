# Paired room phone safe space

The default fullscreen phone controls overlapped the artist artwork in both rooms. Toronto's closed sponsor opener also crossed the poster faces. The correction reserves actual toolbar height above the rendered surface on narrow screens. Toronto additionally reserves a compact 44px sponsor-summary strip. The toolbar remains fully visible and operable; controls were not removed or hidden to obtain clearance.

`room-brand.css` shares the responsive safe-region styling. Montréal measures its toolbar when the surface or toolbar resizes; Toronto measures toolbar and sponsor-summary bounds when rendering and observes toolbar resizing. Canvas dimensions and existing projection/raycast/label calculations use the resulting available space. Furniture, source positions/IDs, category colours/prices, image sources, camera presets and movement easing remain unchanged. Open sponsor details remain an explicit temporary overlay; the closed opener is outside the artwork.

Local evidence:
- Existing paired-room-controls browser suite: four journeys, Toronto and Montréal at390/1440, pass.
- New paired-room-safe-chrome fixture: asserts canvas starts below toolbar and sponsor summary, all toolbar targets are at least44px and reachable, phone canvas remains over450px tall; exercises sponsor open/close, find table, selection, seated camera, overview and fullscreen exit.
- 24 furnished-concert/paired-camera/room-scene unit tests pass, preserving source geometry, categories and camera constraints.
- Default and selected seated phone screenshots for both cities were visually inspected under `/tmp/paired-room-safe-chrome-check/`; faces are clear of toolbar and closed sponsor controls.

Toronto uses the actual local event page. Montréal uses its retained published plan in a local room mount. The earlier Montréal production503 is a separate backend/public-page availability finding, not evidence that this renderer correction is live. No deployment or source-image enhancement is claimed.

Runtime freeze:
- room-brand.css47bd701b9140f7a82707b25da0acf1204ab7e65afef1f6477c902a86811a6deb
- room-scene.mjs a35f5ddcebf922091f89e406d3197e40a9c89e1fcebdc4318e381174ddc364be
- signature/furnished-concert.mjs0241805294b4d6e83fe5a1305933fa3bd6158b8bdcf198643bd2abcbb1e5137c

No changes to venue-experience mount, furniture/art assets, schemas, contacts or frozen service/native packets.

Normal-motion matrix also passed all four journeys (`MOTION=normal OUTPUT_DIR=/tmp/paired-room-safe-chrome-motion node tests/browser/paired-room-safe-chrome/verify.cjs`). Final reduced-motion rerun adds embedded/default and selected closeup screenshots as well as fullscreen/seated/overview, and passed all four journeys in `/tmp/paired-room-safe-chrome-final`.
Final dedicated fixture hash:964b1cf74929fac0cc68783d50d50e4c82b13f77c6d918067ad140189ba08e97.

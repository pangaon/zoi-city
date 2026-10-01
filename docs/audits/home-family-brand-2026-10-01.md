# Shared family brand repair — 2026-10-01

Owned implementation: music, creator and hospitality renderers; music app/API cache versions; hospitality API favicon head. Existing `assets/brand/site-identity.mjs` and exact blue/olive artwork remain unchanged.

## Defect and correction

Known Zoi links carried taglines that the deliberate narrow identity matcher did not recognize: music header “Greek worlds, connected.”, hospitality “Places to belong”, creator footer “YOUR WORLD. MORE GREEK.” Music also rerenders its entire home in the browser, so a server-only replacement could be lost.

Each affected renderer now explicitly identifies its own Zoi home links with `aria-label="Zoi home"` and applies the existing `identityHtml` before returning. Both server and client rendering contain the approved image, without timing dependence on the core's one-time identity boot. Client names, photographs, logos and section structure remain unchanged. No matcher broadening or mutation observer was added. Music app/render cache chain is `20261001-home-brand`.

Hospitality canonical pages now use existing `identityHead()` for favicon and Apple touch icon. Its existing Hotel schema stays intact; no generic metadata rewrite.

## Verification

- 29 focused tests pass: family identity, server tracing, music home, creator templates and hospitality home. Identity coverage includes all four designs, populated and sparse data, raw renderer and full SSR. Applying identity twice is idempotent.
- `node tests/browser/home-family-brand/verify.mjs`: 24 scenarios pass (three families × populated/sparse ×390/1440 ×light/dark browser preference), Concierge. Actual scripts and approved local image load; music waits for actual app mounting before checking brand. Checks image decoding, dimensions, home target, overflow, page errors and hotel favicon.
- Visually inspected phone populated Music, phone populated Hospitality and desktop sparse Creator. Blue/olive mark is clear on each family palette. Music phone layout deliberately hides its adjacent wordmark text through existing responsive CSS; the actual emblem remains.
- Screenshots `/tmp/home-family-brand-{family}-{populated|sparse}-{light|dark}-{390|1440}.png`; result `/tmp/home-family-brand-final-results.json`.

External photos and provider calls are blocked in fixtures, so imagery availability/playback is not assessed. “Light/dark” here means the browser color-scheme preferences were exercised; these family designs retain their existing chosen palettes. This is not a new global theme implementation. No publication, real account changes or provider writes occurred. Production acceptance remains required after release.

This runs the two candidate frontend files on the actual public www origin.
Only map HTML and interactions CSS are overlaid. All public records, current
reviewed-point RPCs, canonical redirects, map library, tiles and other assets
are real production reads. This is candidate frontend evidence, not a deployed
fix or a claim that every stored coordinate is correct. No signed-in account,
SQL, provider navigator, paid service, source data or API-response fixture is used.

```sh
OUTPUT_DIR=/tmp/unique-map-proof node tests/browser/map-public-journey-fixes/verify.mjs
```

It uses existing Playwright/Chromium paths; optional ZOI_PLAYWRIGHT_MODULE and
CHROMIUM_EXECUTABLE_PATH override those. No installation/build is required.
ZOI_MAP_CASES=390x900 can restrict the matrix to a bounded reproduction.
ZOI_MAP_BASELINE=1 runs the unchanged public frontend as the negative control.
Keep its failed evidence separate from the candidate evidence.

The matrix exercises actual Zoom+/Zoom−/compass hits and44px targets across
three sheet states, fullscreen, keyboard, themes, selected directions, fresh
Saved canonical+reviewed-point reads, exact reviewed legacy alias/currentID,
three city/country shortcuts and retained-map orientation changes. Saved state
is isolated browser-local slugs only. No coordinates/verified metadata persist.
Actual server record changes may correctly refuse an expected reviewed pin;
investigate the current source instead of fabricating a receipt or point.

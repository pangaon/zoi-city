# Map position and motion acceptance — 30 September 2026

Independent read-only candidate review covered `assets/map-data/loader.mjs`, `explore/map/index.html`, and `assets/zoi-globe.js`. The specialist corrected two defects found during review: static/offscreen globes now receive their ready flag without requiring animation; rejected coordinate cohorts can no longer become coordinate-only directions when an address is missing. The related globe, loader and precision suite passed 48 tests after those corrections.

Actual browser acceptance used the local candidate against the real public RPC at 1280 and 390 pixel widths. OpenFreeMap geography and labels rendered successfully; no browser console errors were observed. Brantford returned the exact Hellenic Community/Prophet Elias record while withholding its falsely street-labelled Toronto centroid. Selecting its card retained the world zoom and exposed canonical church, published-address directions, and official source actions. Mobile main actions were visible without horizontal overflow.

A Toronto search fitted real permitted street points at zoom10.02. Clicking a real cluster increased zoom to14.30. Selecting Ekfrassi Productions preserved zoom14.30 while centring its selected point. The selected mobile card showed its city, home and directions actions while retaining a useful map canvas and visible street labels. Evidence: root `.recovery/logs/map-review-{basemap,brantford-390,pin-390}.png`. Browser session closed.

The cohort guard is deliberately conservative. Same coordinates with different city/country labels, including aliases or bilingual spellings, can withhold legitimate co-located listings; more than eight distinct address strings can do the same for dense buildings. Those records remain searchable and address-routable. This is not proof that all remaining street-labelled coordinates are accurate, nor a correction to source data. Cohort detection is limited to the records successfully loaded in that session. The upstream verification backlog remains necessary.

These are candidate implementation and browser checks, not a claim that the release has reached production.

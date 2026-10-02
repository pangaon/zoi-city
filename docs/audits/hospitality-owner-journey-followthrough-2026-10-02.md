# Hotel owner catalogue follow-through — October 2

The October1 next-proposal is superseded by the implemented/released catalogue schema and writer batch14bf6d8. Do not recreate that editor. This audit follows the existing Business home module through its actual versioned save and reload orchestration.

## Controlled exercised journey

`tests/browser/hospitality-owner-journey/verify.cjs` mounts actual bizpage.js, owner-entity.mjs and vertical form/UI with authorized synthetic hotel snapshots. RPC fixtures enforce expected versions and return workspace/listing/request/version-bound save receipts. At390/1440, unrelated save leaves imported rooms unpromoted; accepting/reordering preserves source room names, stable IDs and exact detail links; clearing writes[] and reload does not revive imports; sparse room addition and booking-provider navigation URL survive save/reload. No horizontal overflow or browser page errors. No rates, availability, booking stock or reservation confirmation invented.

This is controlled client orchestration acceptance, not live authorization/database/provider acceptance. The existing isolated PostgreSQL catalogue suite remains server evidence. Existing native handoff was not exercised on devices here.

## Reproduced remaining shared defect

Top-level `_vertical-ui.js` controls have sibling label elements without `for`/id or aria-labelledby. The Booking or enquiry link field is visibly present and persists correctly but `getByLabel('Booking or enquiry link')` finds no control. Repeat row fields already have explicit aria-labels. This affects the shared schema renderer, not only hotels. Proposed narrow correction: bind native input/select/textarea labels and identify composite groups without changing data serialization. Root ownership requested before editing runtime.

Evidence `/tmp/hospitality-owner-journey-provider.log`; screenshots `/tmp/hospitality-owner-journey-{390,1440}.png`. Fixture names and source URLs are synthetic and not an enrichment proposal.

## Authorized correction

Root approved `_vertical-ui.js` only. Each mounted top-level field receives a unique label ID; native controls receive a corresponding ID and label.for association. Composite controls receive a named group; tag entry inputs get an explicit Add [field] name. Existing repeated row, money and hours labels are preserved. No profile schema, writer, stock or provider behavior changed.

Actual owner journey regression verifies label-click focus, keyboard Tab departure, room/amenity group names, tag entry name, and unique IDs across simultaneous hospitality plus populated/sparse generic editor mounts at390/1440. Existing catalogue component checks and19 unit tests remain the regression suite. This closes the shared label wiring defect; production deployment and real customer save acceptance remain lead-owned.

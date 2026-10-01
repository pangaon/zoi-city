# Independent public lounge feed review

1 October 2026. Accepted for the bounded candidate release. No customer writes, live approvals or production frontend verification performed by this review.

## Source review

Reviewed the canonical Toronto event resolver, venue visibility lifecycle, shared read-only placement stream and separate lounge placement group. The canonical record must be an event with the exact canonical slug before its actual database UUID is passed to the reader. Missing or mismatched identities do not start placement requests. Configuration revisions are discovered through the sanitized public reader and then bound to placement responses. Wrong event/configuration/revision, approval, count or clock responses clear the feed.

The stream anchors current time to server time plus monotonic elapsed time. Hidden/inactive views suspend reads and clear placements; generation checks discard late responses. Polling is every 30 seconds, with foreground invalidation. Exclusive end expiry has its own timer. Revocation is therefore bounded by refresh/polling, not realtime.

Placement updates rebuild only the placement group. They preserve furniture, camera and a still-valid open card/link focus. Removal closes the card and restores an available focus target. Card navigation rechecks active placement; invalid artwork hides on failure. No demonstration business is promoted to an approved sponsor.

## Exercised and visual evidence

Independently reran:

- `node --test tests/unit/lounge-placement-stream.test.mjs tests/unit/signature-lounge-placements.test.mjs tests/unit/signature-lounge-scene.test.mjs`: seven tests passed.
- `node tests/browser/lounge-placement-feed/verify.cjs`: actual WebGL and styles at 390 and 1440 passed approved display, pixel-identical camera after unchanged refresh, retained card-link focus, broken-image fallback, revocation removal/focus fallback, expiry, read failure clearing and destruction. Zero page errors.
- `node tests/browser/lounge-placement-feed/verify-entry.cjs`: actual Toronto HTML and candidate modules with controlled RPCs passed canonical UUID/configuration binding and mismatched canonical identity refusal. Zero page errors.

Inspected `/tmp/lounge-feed-390.png` and `/tmp/lounge-feed-1440.png`. White couches, readable sponsor card, rounded controls and phone control wrapping remain consistent with the existing lounge presentation. The screenshots intentionally exercise hidden failed artwork; they are not evidence of a live sponsor image.

## Reviewed runtime hashes

- `assets/events/signature/experience.mjs`: `b1c6c96fab67927b5d7153f50be4f9e4dcf38b4ba6d01344cff8f2ac51ba67af`
- `assets/events/signature/venue-experience.mjs`: `5185895c2ace2c9b7a9c3a646cd3403c6fdc5aec210210d4e6165b17811db487`
- `assets/events/signature/lounge-scene.mjs`: `c4838c9b5dbad7553fa869d43056950b5bdef1ad5cc156c2fc32b034b909a567`
- `assets/events/signature/lounge-placement-stream.mjs`: `41c922436ee511240bd67f46656a4503d6a356087a4dbf3d057f051c1198643d`

## Limits

This acceptance covers approved front/side furnished-lounge placements only. Numbered table inventory, the separate full-room sponsor previews, Montréal integration, native device rendering and actual customer approvals remain outside this candidate evidence. No configured scope or approval should produce an empty feed. Root owns backend application, deployment and production readback.

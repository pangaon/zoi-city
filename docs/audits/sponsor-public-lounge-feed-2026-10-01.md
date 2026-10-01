# Approved sponsor feed — public furnished lounge candidate

1 October 2026. Source/runtime implementation and controlled browser evidence only; no production sponsor assignment or customer writes.

## Source and identity

Toronto's actual event page resolves its own canonical event through `home_entity`. A missing record, non-event response, mismatched canonical slug or stale mount does not connect a feed. The real returned UUID is passed to the venue; the source-plan string is never substituted for a database event ID.

The shared read-only feed discovers each front/side current revision through `festival_placement_configuration`, then reads `festival_placements_public` for those exact event/configuration/revision values. Unknown or ineligible configuration produces no placement. Responses must have the expected identity, approval, bounded count and valid server time. Existing presentation gates validate active intervals, exact scope and safe bounded artwork copy. No sample business becomes an approved sponsor.

The narrow scope reader was independently reviewed and all seven real PostgreSQL fixture groups rerun successfully; schema ownership remains workspace specialist/root. Public code does not approve or write anything.

## Lifecycle and rendering

Polling runs every 30 seconds only while the lounge is the active view; foreground return rechecks approval. Leaving the lounge or hiding the page suspends the feed and clears its displayed placements. Read failures or mismatched projection clear stale artwork. In-flight generations are fenced and timers cancelled on suspension/destruction.

Server time anchors active display to monotonic elapsed time, avoiding dependence on a wrong device wall clock. Existing exclusive-end expiry removes a placement without waiting for polling. Revocation/scope changes become visible at the next successful poll or foreground refresh, not claimed as instantaneous realtime.

Lounge placement meshes now live in a separate group. Feed and expiry updates only rebuild that group, not furniture or camera. A still-valid open card and its focused link remain open/focused; removal closes it and restores the canvas/remaining marker target. Sponsor cards say Sponsored placement and link to the sponsor website, not an invented product order. Failed images hide without broken-image chrome.

## Exercised evidence

- `node --test tests/unit/lounge-placement-stream.test.mjs tests/unit/signature-lounge-placements.test.mjs tests/unit/signature-lounge-scene.test.mjs`: seven tests pass, including revision discovery, clock anchoring, wrong scope/failure clearing, late-response fencing, timer cleanup and existing placement/configuration gates.
- `node tests/browser/lounge-placement-feed/verify.cjs`: 390 and 1440 actual WebGL/stylesheet/module scenarios pass. Approved display, pixel-identical rendered camera after refreshing unchanged placement, card-link focus preserved, broken-image fallback, revoke/focus fallback, exclusive expiry, failed reads and destruction. Zero page errors. `/tmp/lounge-feed-{390,1440}.png`; phone screenshot inspected.
- `node tests/browser/lounge-placement-feed/verify-entry.cjs`: actual Toronto HTML and changed module responses with controlled RPC transport; real event UUID is used only after canonical identity match. Before choosing lounges there is no sponsor poll. Wrong canonical identity does not issue any placement requests. Zero page errors. Core/shared unrelated assets come from production; this is candidate execution, not deployed acceptance.

## Frozen files

- experience.mjs `b1c6c96fab67927b5d7153f50be4f9e4dcf38b4ba6d01344cff8f2ac51ba67af`
- venue-experience.mjs `5185895c2ace2c9b7a9c3a646cd3403c6fdc5aec210210d4e6165b17811db487`
- lounge-scene.mjs `c4838c9b5dbad7553fa869d43056950b5bdef1ad5cc156c2fc32b034b909a567`
- lounge-placement-stream.mjs `41c922436ee511240bd67f46656a4503d6a356087a4dbf3d057f051c1198643d`

The existing lounge-placements.mjs presentation model is reused unchanged. Root owns the top-level event script cache tag and deployment.

## Honest remaining scope

This connects the existing furnished-lounge front/side configurations, not numbered-table inventory or the separate full-concert-room sponsor previews. Montréal does not yet mount this consumer. No live owner approval, actual Toronto/Montréal sponsor, upload inspection, order, payment, or provider fulfilment has been tested or claimed. The source-verified event may have no owner configuration; an empty feed is the correct result. Native-specific WebGL/app behavior is not exercised by these desktop Chromium viewport tests.

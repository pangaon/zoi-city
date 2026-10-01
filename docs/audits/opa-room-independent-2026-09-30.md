# Montréal room — independent source and journey acceptance

Reviewed original `assets/events/opa/montreal-2027-floor-plan.jpg` against the candidate manifest and actual public-entity server-rendered fixture `.qa-opa-room/integrated.html` on 30 September 2026. This is candidate acceptance, not a production deployment claim.

## Source

102 visible unique table footprints: 44 central, 50 angled side tables, 8 horizontal stage-side tables. Alphanumeric 10A/10B/20A/20B and deliberately absent numerical IDs are preserved. Category counts: red24, blue17, yellow12, pink14, purple2, green21, black12. Independently checked 53/54 purple and107 blue. Side angles, stepped central stage, two front bars, rear-centre FOH agree with artwork. Geometry uses image pixels, not surveyed dimensions. The plan states ten persons unless otherwise indicated and black tablecloths/chair covers; it provides no category price legend or availability.

## Exercised candidate journey

At390px and1440px: open interactive room, Find table10A, choose actual numbered button, Use table10A, enter3 people, Prepare my enquiry. The resulting note contains10A and3 people and explicitly says not held/reserved/submitted. Clear empties the preference and hides the stale prepared note. No horizontal document overflow or pageerror observed in these runs. No messages, bookings or payments sent.

Screenshots inspected: `/tmp/opa-independent-room-390.png`, `/tmp/opa-independent-room-1440.png`, `/tmp/opa-independent-request-390.png`. Reproduction: `/tmp/opa-independent.mjs`.

Functional selection/enquiry path passes. Visual limitation: after selecting10A on390px, the stage label is offscreen left and the stage is an unlabelled cropped slab. Desktop stage label remains visible. Reported to root/scene specialist for framing correction. This is an illustrative source-plan room, not a measured or photorealistic venue reconstruction.

## Orientation correction recheck

Fresh browser rerun after the scene specialist's framing change passes390/1440 again:10A→prepared3-person enquiry→clear, no pageerrors/overflow. Updated390 screenshot inspected: STAGE label and selected10A are both visible, and adjacent rows provide context. The previously reported mobile orientation issue is resolved in this candidate. Functional/source-plan acceptance has no remaining blocking finding in the reviewed scope. This does not certify measured venue dimensions or booking inventory.

## Full-screen fallback independent check

Actual integrated390×844 fixture tested with Element.requestFullscreen both absent and rejecting. Both entered a room at exact viewport bounds(0,0,390,844). Escape restored focus to Full screen and cleared temporary body position/overflow styles. Reopening, choosing10A and Use table10A exited fallback and retained10A in the enquiry. No pageerrors observed. Screenshot `/tmp/opa-fullscreen-independent-absent.png` inspected; reproduction `/tmp/opa-fullscreen-independent.mjs`. Browser closed. These are browser simulation checks, not physical iPhone certification.

## Production b9f2b69

After confirmed Vercel success, actual www.zoi.city event passed390/1440 table10A→three-person prepared enquiry→clear. Deployed canonical/client and room-scene modules carry `?v=20260930-montreal-room`; integration/plan modules and room-scene.css were requested from production. No pageerrors/overflow observed. Logs `/tmp/opa-live-b9f2b69.log`.

Cold-load visual race found: table selection is available before Three.js finishes importing. Selecting10A then correctly preserves enquiry data, but newly created scene label/mesh lacks selected highlight and finder remains open. Reported to root and scene specialist. Waiting for `.rs-loading` to hide before selection yields correct selected10A/stage display and closes finder; subsequent production rerun passes both widths. Inspected `/tmp/opa-live-ready-b9f2b69-room-390.png`. This race remains an open follow-up until fixed/deployed; no lost booking or enquiry data was observed.

## Cold-load corrective candidate independent acceptance

Read-reviewed ready-time reapplication using `notify:false,focus:false`: this synchronizes newly created geometry/labels without duplicating selection notification or resetting the chosen camera. Independently held the Three.js module network request, selected10A in the actual integrated form before releasing it, then released the module at390/1440. Both retained form10A, created exactly the10A pressed scene label, and closed the finder after successful WebGL initialization. Screenshot `/tmp/opa-cold-independent-390.png` inspected. Reproduction `/tmp/opa-cold-independent.mjs`. Corrective candidate passes; not yet a production-fix claim.

## Corrective production c024633 acceptance

Actual production390/1440 verified with Three.js request held until10A was selected. After releasing the original network request, field10A persisted, exactly10A scene label became pressed/highlighted, and finder closed. Use table10A → three people → Prepare my enquiry retained10A/3 with not-held/not-submitted wording; Clear emptied choice and hid stale note. Actual canonical/client/room-scene URLs all carried `?v=20260930-room-ready`. Inspected `/tmp/opa-cold-live-c024633-390.png`; logs `/tmp/opa-cold-live-c024633.log`, reproduction `/tmp/opa-cold-live-c024633.mjs`. Cold-load visual issue is resolved in the verified production artifact. No messages, payments or bookings sent; browser closed.

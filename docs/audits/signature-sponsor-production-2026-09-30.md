# Signature tabletop sponsor preview — production verification

Read-only actual browser check of `https://www.zoi.city/events/giannis-ploutarchos-andromache-toronto-2027/` during the b9fe5bb production release. Viewports390×844 and1440×1000. No listing, sponsor, booking or payment data was written.

## Exercised

Selected table9 from actual selector; opened full-screen room and Sponsor placements; clicked Try a table display. A textured Kolonaki tabletop stand appeared inside the canvas scene. View display on table collapsed the preview controls. Clicking the physical stand in the canvas reopened the preview (phone pointer195,367; desktop720,238). Switched to Theo Eye Care and visually confirmed changed stand artwork; projected accessible hotspot also reopened preview. Remove test display removed the stand/hotspot and reported removal. Both viewport flows completed. No browser page errors; phone document had no horizontal overflow. Browser closed afterward.

This is an actual scene test placement, not merely sidebar imagery. TEST/disclosure text is present. It is not approved sponsorship inventory, a saved organizer placement, a bottle sale, or a confirmed reservation.

## Remaining visual/usability gaps

- Expanded mobile table-details sheet covers Sponsor placements controls. The first pointer attempt was intercepted by the details sheet; collapsing it restored access. This is an interaction-discoverability issue, not failure to create the display.
- At desktop close camera, the test sign is visually a large billboard occupying the top of the table scene. It proves placement mechanics but does not meet the requested subtle premium product-placement art direction.
- Existing room remains an illustration; this check does not certify venue-accurate photorealism or real sponsor approval.

## Inspected evidence

Screenshots in `/workspaces/zoi-city/.recovery/logs/`:

- `sponsor-live-blocked390.png`: expanded details obscuring sponsor controls.
- `sponsor-live-stand390.png`: Kolonaki physical stand and table9.
- `sponsor-live-theo390.png`: business-switch artwork visible.
- `sponsor-live-stand1440.png`: large physical stand, TEST/table9 disclosure.

No implementation changes. Any fix to panel overlap belongs to shared venue styles; stand scale/camera calibration belongs to `furnished-concert.mjs` and should be coordinated before edits.

## Local polish candidate after live audit

The four-file candidate changes the phone drawers to be mutually exclusive, keeps the sponsor opener above expanded table details, and reduces the physical stand to 0.72 × 0.45 scene units. Placement framing uses distance 3.5 on phone and 5.8 on desktop; normal room cameras and source table positions/colours are unchanged. Listener cleanup is explicit. Reopening from a room hotspot gives the visible sponsor summary as the return-focus target.

Exercised locally at 390 × 844 and 1440 × 1000: expanded table 9 details → sponsor opener → table display; Kolonaki → Theo; View display; physical canvas sign click at desktop (720,350) → reopened card; removal → zero placement hotspots and explicit removed status. Keyboard Enter on the phone placement hotspot reopened the card with table details collapsed. Phone removal passed. No browser page errors. Screens inspected: `/tmp/sponsor-polish-sheet390.png`, `/tmp/sponsor-polish-stand390.png`, `/tmp/sponsor-polish1440.png`. Sixteen furnished-scene unit tests passed, plus module syntax check. The final return-focus target change was code-reviewed after these captures; it did not receive a separate browser replay.

This is local candidate evidence, not deployment acceptance. Stand artwork is still an explicitly labelled TEST business placement, not a purchased or approved sponsorship. Opening the longer phone preview requires scrolling its panel to the View display/Remove controls.

## Independent final polish acceptance

Independent reviewer exercised the current local canonical event at390×1000 and1440×1000. Expanded table9 details → Sponsor placements → Try display collapsed the details sheet. The actual textured canvas stand reopened controls with pointer coordinates(195,438) on phone and(720,350) on desktop. Changed business to Theo, closed card, and verified focus returned to the visible Sponsor placements SUMMARY. Keyboard Enter on the projected stand hotspot reopened the controls. Remove eliminated all placement hotspots; table9 remained selected. No pageerror observed in either run. Inspected `/tmp/sponsor-independent-polish-390.png` and `-1440.png`: smaller tabletop display, distinct selected9, and category colours retained. Scripts `/tmp/sponsor-polish-independent.mjs` and `/tmp/sponsor-polish-physical-independent.mjs`. Candidate passes the bounded sponsor-polish release check; no approved sponsor/payment/inventory or production deployment claim.

## Production b9f2b69 polish check

Actual production390px replay passes expanded details→sponsor→physical tabletop click→Theo switch→close/focus→keyboard hotspot→remove. Details collapsed; close focused visible Sponsor placements SUMMARY; zero hotspots after removal; table9 and source category colours retained. No pageerror observed. Visually inspected `/tmp/sponsor-live-b9f2b69-390.png`. Actual venue-experience CSS/module and furnished-concert module URLs carry `?v=20260930-sponsor-polish`. Logs `/tmp/sponsor-live-b9f2b69.log`. No resource interception or customer transactions.

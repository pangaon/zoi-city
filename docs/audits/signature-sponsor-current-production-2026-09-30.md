# Current Signature tabletop sponsorship review

Independent production review, 30 September 2026. Route: https://www.zoi.city/events/giannis-ploutarchos-andromache-toronto-2027/ . This checks the currently deployed tabletop placement behavior, not the older card-only screenshot.

## Exercised behavior

At 390×844, selected Table 9, entered full-screen room, opened Sponsor placements, chose the Kolonaki sample and used View display on table. The physical tabletop stand showed the real logo. Its accessible projected button reopened the editor. Switched to Theo Eye Care, viewed, reopened, and removed the display. Table 9 stayed selected; source yellow, green and magenta category colours remained visible. No horizontal overflow.

At 1440×1000, the physical Kolonaki stand rendered clearly on Table 9. Clicking its canvas artwork at approximately (715,230) reopened the editor. Switched to Theo, waited 1.2 seconds for the placement camera to settle, clicked the physical stand again, and removed it successfully. Table 9 remained selected. No page errors were observed in this separate desktop run.

Neither preview implies approved event sponsorship. Both are labelled demonstrations. No customer transaction, external business navigation, message or actual sponsorship change was performed.

## Remaining defect

The projected accessible sponsor button is hidden on the desktop close-up although the physical stand remains visible and clickable. The stand artwork occupies approximately y155–315, below the y86–145 camera toolbar. This is a keyboard/accessibility gap; it is not a failure to show the tabletop placement. Root has ownership of the projection fix.

Rapid coordinate clicks while the camera is still moving can miss the stand. The acceptance clicks above waited for its settled position; no claim of instantaneous camera readiness is made.

## Evidence

- `/workspaces/zoi-city/.recovery/logs/sponsor-current-390.png` — visually inspected mobile logo stand and source colours.
- `/workspaces/zoi-city/.recovery/logs/sponsor-current-1440.png` — visually inspected desktop physical logo stand.
- `/tmp/sponsor-current.mjs` — mobile flow and failing hidden desktop accessible-button attempt.
- `/tmp/sponsor-current-desktop.mjs` — successful direct physical stand pointer flow after camera settling.

This review does not certify photorealistic venue accuracy, sponsor approval, inventory holds, payment collection, or admission issuance.

## Independently reviewed follow-up candidate

Root's subsequent projection correction was tested by intercepting only the production `furnished-concert.mjs` request with the current local candidate. This is candidate acceptance, not a claim that the fix is already deployed.

At both 1440×1000 and 390×844, the projected sponsor button remained visible and keyboard-focusable. Focus + Enter reopened the editor; business switching, reopening and removal succeeded. The final positioning keeps the selected Table 9 badge below the sponsor label on the original table centre, preserving correct spatial identity. Both final screenshots were visually inspected: no overlap with the logo or toolbar and no badge placed on adjacent Table 8. No page errors or horizontal overflow observed in these runs. All 15 focused scene tests passed before the final position-only adjustment; the actual browser journey was rerun after that adjustment.

Final candidate evidence: `/workspaces/zoi-city/.recovery/logs/sponsor-hotspot-fixed-390.png` and `sponsor-hotspot-fixed-1440.png`. No remaining blocker found for this bounded hotspot correction.

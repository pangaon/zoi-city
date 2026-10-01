# Hospitality production acceptance — d08f52d

Deployed SHA: `d08f52d6f0865f9f4f9a019783ea63082a7396b7`. Actual production checks completed on 2026-10-01 using agent-browser at 390×900 and 1440×900.

## Exercised results

- `https://www.zoi.city/travel-place/moongarden-molyvos`: zero published room/dining/occasion entries correctly produce no empty sections or matching navigation anchors, and no room-type selector. The official Facebook link is visible and targets `https://www.facebook.com/MoongardenBoutiqueResort/`. The first gallery button opens the reviewed bedroom photograph. Submitting 1–4 February 2027 for two guests creates a device-local plan, explicitly says no reservation was made and offers `tel:+302253072170`.
- `https://www.zoi.city/travel-place/25hours-hotel-sydney-the-olympia-paddington`: eight room types, four dining venues and five occasion spaces remain rendered. Actual room shortlist click selects Medium Queen; gallery opens a hotel photograph. The same date/guest submission preserves the selected room and produces the official provider link with hotel code and supported dates, plus a draft email containing the dates, guests and room. No social profile is invented when the public model has none.
- All four viewport/profile combinations passed; no browser page errors or document-wide horizontal overflow. Screenshots inspected for sparse social/contact, both plan layouts and gallery. Olympia's phone navigation is horizontally scrollable and its two-column native room select truncates its selected label; the full room name is visible in the resulting plan. These are existing presentation limitations, not evidence of every hospitality journey being complete.

## Evidence and boundaries

Runner: `/tmp/hospitality-production-verify.mjs`; results: `/tmp/hospitality-production-d08f52d6f0865f9f4f9a019783ea63082a7396b7.json`. Screenshots use `/tmp/hospitality-production-d08f52d6f0865f9f4f9a019783ea63082a7396b7-{moongarden,olympia}-{390,1440}-{gallery,plan,contact}.png`.

Native date inputs were assigned values with DOM input/change events; gallery, shortlist and submit used actual browser clicks. The initial runner attempted a gallery click while viewport/scroll positioning was unsettled and reported no open dialog; waiting for resources and placing the target in view before the pointer click resolved automation timing. The successful run exercised all four cases and closed the browser.

No phone call, email, Facebook action or booking-provider navigation was triggered. This verifies local enquiry preparation and truthful provider handoff construction, not booking completion, live availability or payment. Owner clear/replacement behavior remains covered by the local shared-resolver tests and fixture; no production owner data was changed for this verification.

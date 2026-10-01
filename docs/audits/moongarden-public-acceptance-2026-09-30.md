# Moongarden public acceptance — 30 September 2026

Independent production inspection after the lead reported guarded apply receipt hash `22c10057048c373e7b72de6d3d325b0dd070399b8cf751805f629a59573e3d65`. This QA did not perform or independently rerun the database write.

Actual canonical `https://www.zoi.city/business/moongarden-molyvos` returned 200 at 390 and 1440 pixels. Both full-page screenshots were visually inspected. No captured page errors or horizontal document overflow occurred.

## Visible source-backed content

- The introduction describes independent country guest houses in Molyvos/Mithymna, Lesvos, with olive trees, gardens and a swimming pool.
- The official bedroom hero loads at its natural 1920×830 resolution. The gallery contains that bedroom image and the official aerial property/pool image at 605×405. All three rendered image elements loaded.
- Call links to `tel:+302253072170`; the website link targets `https://www.moongarden.gr/en`.
- The stay form says “Enquire directly with the hotel” and explains that a plan stays on this device until shared. There is no observed claim of confirmed inventory, payment or reservation. No enquiry, call, payment or external message was submitted.

## Remaining issues

1. The reviewed source proposal includes an official Facebook link, but neither width renders any Facebook/social link. This is a projection gap; the present browser evidence alone does not establish which intermediate model omitted it.
2. Rooms, Dining and Occasions remain separate large sections containing generic “Contact Moongarden for the current options” placeholders. Navigation promises those subjects but provides no room, menu or occasion detail. The content repair is visible, yet the complete client experience is not accepted as polished or fully enriched.
3. The hotel navigation and language use generic hotel copy despite the sourced independent guest-house description. Any refinement should preserve the source identity and avoid inventing room inventory or venue capacity.

Evidence: `/tmp/moongarden-public.mjs`, `/tmp/moongarden-public-results.json`, `/tmp/moongarden-public-390.png`, `/tmp/moongarden-public-1440.png`. Browser closed after inspection. Hospitality specialist owns follow-up fixes; no implementation files changed by this reviewer.

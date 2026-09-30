# Independent discovery and profile acceptance — 30 September 2026

This is a failing baseline, not a site-wide acceptance report. Live production and the user’s immutable preview are separate environments.

## Exercised production journeys

- https://www.zoi.city/explore → Yamas Quick look → Open full page: navigation succeeds at 390px; correct canonical `/business/ke-nairobi-yamas-greek-restaurant`; no horizontal overflow. The quick look shows initials, generic description, city and category only. The full page has no images, address, phone, email, menu or real reservation handoff. It repeats the shell meta description as meaningful content. Desktop 1440px remains the same incomplete client representation.
- Supplied `zoi-city-i84xlu20r-pangaons-projects.vercel.app` URL currently redirects this independent unauthenticated checker to Vercel login. Cannot claim the screenshot’s refresh/503 issue reproduced or fixed there.
- https://www.zoi.city/explore/map → search Paradosi → select Toronto Dance Troupes → zoom controls → click actual marker: zoom remains 11.127428144876493. Old zoom-out regression was not reproduced in this bounded current-production case. Two same-name Paradosi records appear (North York/Hellenic Associations and Toronto/Dance Troupes). No merge action performed.
- Map at 390px has no horizontal overflow, but top filters and bottom selected-place card consume most of the viewport, leaving approximately 130px visible map between overlays. This is usable controls evidence, not visual excellence.

## Source versus presentation

Actual browser-rendered https://www.yamas.co.ke/ is a React application; its initial HTML is only 1,276 bytes. HTML-only enrichment sees the generic meta description and misses the client’s real content. Browser resources include `/api/menu-files`, `/api/settings` and `/api/testimonials?featured=true`.

Source provides logo `/logo.png`, cuisine imagery `/images/a-greek-fling.png` and `/images/flavors-of-greece.png`, address Ground Floor, Westgate Shopping Mall, Mwanzi Rd, Nairobi, phone +254742432358, email info@yamas.co.ke, reservation handoff https://eatapp.co/reserve/yamas-nairobi?source=iframe, and menu image files `/uploads/6942b43a3ad8d_1765979194.jpg` and `/uploads/6942b4497162e_1765979209.jpg`. These are source-presence observations; menu prices have not been transcribed or validated. The source contains apparent sample testimonials (Cape Town, Durban, Johannesburg, Lovely Bobby); do not import these as verified customer reviews.

## Cross-family coverage matrix

| Record/family | Actual production server evidence | Journey evidence | Open failure |
|---|---|---|---|
| Yamas / restaurant sparse | HTTP200, 0 image elements, generic shell-description payload | Quick look→canonical actual390 and desktop render | Source available but absent from card, quick look and full page |
| 12 Islands / restaurant populated | HTTP200, 5 image elements | Not re-exercised in this audit | This populated showcase cannot prove all restaurants |
| Signature / event producer | HTTP200, 10 image elements | Prior event work preserved; not re-exercised here | Not proof of category-wide coverage |
| St Nicholas Toronto / parish | HTTP200, 6 image elements | Not re-exercised here | Not proof of sparse parishes |
| Olympia / hotel | HTTP200, 29 image elements | Not re-exercised here | Not proof of transactional booking |
| Paradosi Toronto / organization | HTTP200, 0 image elements; website visible canonical | Actual map selection,390 and desktop; canonical source read | Map omits website; duplicate records; generic home; malformed title `Dance Troupeses`; related dance-troupe section includes unrelated therapists and cheese business |

## Actionable shared acceptance work

1. Classify HTML-shell-only source fetches as incomplete, route to a bounded supported dynamic extraction path, and report unresolved source fields instead of marking a useful client home complete.
2. Verify public database/RPC projection, discovery cards, quick look and canonical home use the same enriched source and respect owner overrides/clears.
3. Ordinary listings must receive the shared family rendering, not just curated IDs. Source photos and actual operational links must be exercised.
4. Recommendation headings must describe their actual candidate set: strict dance-troupe neighbors or a broader honest nearby label, never silently substituted professions under a specific category title.
5. Record source facts, rendered evidence and exercised actions independently for each listing; expand sparse/populated cohorts across every family before any site-wide completion claim.

## Evidence files

Local root recovery evidence (outside this worktree): `/workspaces/zoi-city/.recovery/logs/yamas-quicklook-before-390.png`, `yamas-home-before-390.png`, `yamas-home-before-1440.png`, `yamas-source-1440.png`, `paradosi-map-selected-390.png`, `profile-family-before.json`. Raw JSON contains server-projected public records only. No mutation, payment, reservation or message was sent during this audit.

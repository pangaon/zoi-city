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

## Independent local candidate review

Static server `http://127.0.0.1:4318`, real anonymous public RPCs; this section is not production proof.

- Restaurant palette candidate: seven unit tests passed independently. QA found an inverted owner palette accepted white ink/accent while hero/buttons used fixed white foregrounds; root added guard and regression coverage. Actual sparse Yamas public record rendered via server renderer into ignored `.qa-image/yamas-actual.html`. At 390px, visit dialog was 366×576px within 844px viewport, no horizontal overflow. This does not solve absent source enrichment.
- Map Paradosi selected details called actual `home_entity` HTTP200 and hydrated the source description and correct `https://www.paradosihdc.com/` website. At390, root’s compact selection state frees significantly more map area. QA found the new description pushed all primary actions below the short sheet; root reordered actions before optional content. Retest Open home/Directions top721/bottom761 inside844px viewport; sheet scroll retains additional website action. At1440 no horizontal overflow.
- Actual imported preview module rejected a wrong-slug deferred response and a valid response resolved after destroy; neither inserted its test description. These bounded concurrency checks do not prove all asynchronous states.
- Explore first load failed with actual public database `canceling statement due to statement timeout`; clicking Try again recovered24results. This intermittent backend failure remains open. A recovered Alexiou Realty card displayed literal `<span class=` from its description; reported to root for shared cleanup.
- Search Yamas→Quick look on candidate hydrated Official website after public RPC completion. At390 dialog366×575 fits; Escape restored Quick look focus. Open full page anchor uses correct canonical route. Signed-out This is mine routed to `/social/` without a workspace/claim mutation request.
- Extra screenshots in root `.recovery/logs`: `map-candidate-paradosi-390.png` (before action reorder), `map-candidate-actions-390.png` (after), `restaurant-candidate-dialog-390.png`.

## Rendered-source security review and live frontend follow-up

Independent review of `scripts/enrichment/{render-source,render-capture,extractor,reviewed-batch}.mjs` and shared `scripts/quality/source-fetch.mjs` found two concrete guard gaps: robots was only checked before the initial URL, and renderer aggregate/time budgets were checked before queued requests executed. A deterministic demonstration followed `/public` to robots-disallowed `/private`; the enrichment specialist corrected this and added a regression. Queue execution now checks remaining time and bytes. Twenty collector/render tests passed independently after those fixes. QA additionally found failed oversized requests were not counted toward aggregate bytes; specialist correction remained pending at this review checkpoint. Do not equate HTTP interception with OS-level isolation of arbitrary browser protocols.

The specific immutable Yamas capture `ab4f7ba354255db814dd74b2495b3119aa64984101c1c2deb96374e12d6c0cca.json` was inspected without printing raw API responses: two external scripts, no inline script bodies, no inputs, no detected secret/password/token-style assignments in stored DOM. Profile contains public phone, email, logo, two published menu scans and four photos. This bounded artifact inspection does not certify arbitrary websites cannot expose sensitive source configuration. Generic future capture strips script/style/template/noscript content, comments and event/value attributes; source still requires independent review before applying.

Live frontend release `5dd94d8898cc3a68de38a4806a1f46c87f30a2fc` independently exercised: Yamas Quick look now hydrates Official website and fits 390×844; Paradosi map selected panel now hydrates the actual description and official website while Open home/Directions remain visible on mobile. Evidence `live5dd-map-390.png`. Source enrichment had not yet been applied at this checkpoint, so Yamas imagery/menu/contacts remained absent despite the frontend fixes.

## Post-apply Yamas production evidence

After the specialist applied reviewed source data through the existing lease writer, independent live browser checks confirmed:

- Explore card uses the actual 1222px source photo and reviewed description.
- Quick look shows the same photo, Westgate street address, official menu, official website, telephone and address-based directions; full-page link remains canonical.
- Canonical at390 and1440 has loaded source logo/hero, address, telephone, email, real reservation-provider handoff and gallery. Gallery Next loaded the actual1920px second photograph. No horizontal overflow observed. Opening hours remain unknown rather than fabricated.
- Root's not-yet-deployed menu-scan candidate independently opens a1700px original menu image in a366×657 dialog at390×844, with an original-resolution link. Production at this point still shows the official full-menu page only.
- Map deep-link to Yamas failed to surface Nairobi during a partial public dataset load: only5,000 records loaded and the UI disclosed that part of the directory did not load. This is not a successful all-surface acceptance. Screenshot `live-yamas-map-partial-390.png`.
- Visual shortcomings remain despite enriched data: the selected source hero is a collage with pale rectangular areas that become visible grey blocks under the hero shade; intrinsic transparent whitespace makes the logo appear tiny on mobile. Reported to lead for source-specific visual correction. No white-glove visual signoff claimed.

Evidence: root logs `live-yamas-enriched-quicklook-390.png`, `live-yamas-hero-enriched-390.png`, `live-yamas-hero-enriched-1440.png`; earlier `live-yamas-home-enriched-*` screenshots capture the gallery area, not the hero.

Rendered-source guard follow-up:21 collector/render tests passed independently after streamed byte accounting was added, including failed oversized resources. DNS and HTTP now share the request time budget. Identified redirect, queue and failed-byte holes are resolved in the reviewed candidate; full OS-level browser isolation remains outside this operator-reviewed capture boundary.

Map retry refinement: a subsequent reload recovered all14,395 mapped records (16 completed `explore_geo` calls HTTP200), but Nairobi Yamas remained absent. The map explicitly reports only14,395 of28,933 listings have coordinates. The requested Nairobi place deep-link fell back to eight other Yamas results in other countries with no selected Nairobi identity. Therefore both intermittent dataset failure and an unmapped-listing deep-link gap exist; a successful reload alone does not resolve the latter. Do not invent verified coordinates from the supplied address.

### Map resilience and exact unmapped identity candidate

Owned implementation: `assets/map-data/loader.mjs`, `explore/map/index.html`, `tests/unit/map-data.test.mjs`. Transient map reads retry at most twice within existing four worker slots; exhausted pages remain explicit partial coverage. Wrong-slug, hidden and draft profile responses are rejected. A requested unmapped profile is resolved through anonymous `home_entity`, keeps its exact identity and never gets inferred coordinates or an automatic camera move. Retry/error UI preserves the requested link. Selection epochs prevent stale responses replacing later choices.

Actual local candidate at 390×844, backed by public production RPC: `?q=Yamas&place=ke-nairobi-yamas-greek-restaurant` opens Yamas Nairobi/Kenya with reviewed photo, menu, official website and phone. Open home and Directions visible at y695–735, no horizontal overflow. URL retains requested slug, original world camera remains `#1.35/37.98380/23.72750/0/0`. Screenshot: `/workspaces/zoi-city/.recovery/map-unmapped-yamas-390.png`. Found and fixed a resize/moveend race before acceptance: loading group mode must be established before resizing. Actual-handler regression proves both resize survival and late-response discard. 19 map loader/preview/focus tests pass. This is candidate evidence, not a deployment claim; unmapped listings still have no map pins.

Root's final restaurant fixture (`.qa-image/yamas-final.html`) independently exercised at390: menu page1 opens1700px original image inside366×657 dialog; next gallery navigation changes photo and does not overflow. A4-person October10 visit plan saves to the correct entity's local browser key and presents the right summary with explicit no-reservation/no-message-sent text. Empty required date blocks saving. Gallery photo2 is533px at source: functioning gallery is not evidence every source asset is high-resolution. No fresh sparse-fixture check in this final bounded pass; prior sparse family evidence remains separate.

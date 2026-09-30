# Discovery experience repair — 2026-09-30

Scope: shared `/explore` cards and quick-look modal across every entity family returned by `explore_search`. No Yamas-only renderer. Map reuses the new pure profile preview projection through the lead's separate integration. Category hub layouts and `/explore/app` legacy application are not changed here.

## Source and journey findings

- Card CSS intentionally collapsed missing artwork to 64px, logos to 116px, square art132px, with photo16:10 and grid align-start. It caused the reported uneven rows. Changed to consistent16:10 frames, logo contain, actual photo cover, honest identity mark for absent/broken imagery, stretched row cards and aligned44px actions. Category labels now identify the actual category when supplied.
- All card, title, media and quick-look full-page routes already use current type+slug. Same-origin preview failure is a server/public-read issue; this patch does not mask it by forcing all preview links to production. Unsafe legacy fallback path destinations are rejected.
- Quick look previously only repeated search projection fields. It now requests anonymous `home_entity`, checks listing ID, ignores stale/closed requests, offers a retry and progressively adds official website, sourced menu, safe phone, address/directions, description and image when present. Source identity and explicit owner clears respected. No reviews/ratings/availability fabricated.
- Quick-look modal previously lacked background inert, scroll lock, focus return and Tab containment. All added, including mobile constrained scroll area,44px close control, reduced motion, rounded glass treatment.
- Claim previously silently selected `workspaces[0]`. It now loads existing `zoi_me` workspaces, requires deliberate selection, explains ownership review and only submits existing `zoi_claim_entity` after explicit confirmation. Exact successful statuses checked; unknown results direct the user to business tools instead of offering an unsafe duplicate retry. Account change clears private workspace details, submission controls disabled while pending.

## Evidence

23 relevant unit tests passed (`node --test tests/unit/explore-*.test.mjs tests/unit/quicklook-details.test.mjs`). Includes prior geography/search/follow regressions, modal keyboard containment, unsafe paths, source identity, owner clears, menu/media fallback.

Local browser with actual public RPC at390px and desktop: no horizontal overflow; first three mixed cards each476px tall with220px media. Mobile quick look366px wide, fully inside390px viewport. ReverseTab wraps to last control, Escape returns to original Quick look and restores body scroll/inert. Screenshot `/workspaces/zoi-city/.recovery/logs/discovery-quicklook-390.png` inspected. Actual Yamas `home_entity` returned matchingID and officialwebsite; website action visibly rendered. At check time source record still lacked photos/address/menu; extraction and enrichment owned separately by lead.

Claim UI exercised with explicitly MOCKED read/write responses in local browser: blank initial workspace selection, explicit secondworkspace passed to existingRPC, pending-review message, no actual ownership write sent. Live authenticated claim submission remains independent acceptance requirement; cannot call mock evidence a production ownership claim.

## Remaining

This improves shared discovery and details, not a claim that all listings are enriched or category-wide bespoke editorial layouts delivered. Source catch-up, canonical server failure, fullhome brand rendering, native phone acceptance and real authenticated owner claim roundtrip remain separately tracked. No fabricated sponsored placements or missing photos.

# Five enriched restaurant source/render checks — 2026-09-30

Read-only selection: first five published, clean/cleared, visible restaurant-category records by ID with populated successful enrichment (one checked_no_data record was excluded). No external source fetches, screenshots, data mutation, or acceptance sign-off. Exact current public seo_entity payloads evaluated through restaurantHomeContent. All five authoritative owner_content objects are empty.

## Confirmed rendered defects and uncertainty

1. Litani’s (012f38f4-9ba4-40e3-9f8a-739247e383bb): machine social links point to AGFG publisher accounts facebook.com/ausgoodfoodguide and instagram.com/ausgoodfood. Both become restaurant social buttons. These are syntactically valid profiles, so current profile-link classifier alone is insufficient. Proposed narrow source-identity rule: on exact AGFG restaurant-detail sources, exclude only known publisher account identities from machine social fallbacks; preserve restaurant-scoped JSON-LD contacts, listing-ID photos and matching order links. No whole-host quarantine.
2. Aphrodite (018a38cb-a800-454b-97ff-ede370ed3492): source phone +0221 493331 renders tel:+0221493331. International prefix cannot begin0. Do not invent a replacement +49 number from assumptions; existing original source number can remain visible while requiring a valid dialable form for telephone action. Address formatting differs but actual street number698 is retained.
3. Nick The Greek (00a26d92-238d-4d26-9dea-6b3969dece8f): brand root supplies App-Web-Banners-2026 as photographic hero and chain menu labelled Full menu for Fresno. Source logo is retained correctly as logo, but logo derivatives also exist in gallery data. Root identity is legitimate brand information, not proof of branch-specific menu/prices or imagery; no automatic brand-root block. Need separate asset semantics and brand-vs-location menu label, plus actual source evidence before claiming branch completeness.
4. Litani’s imported street120CorrimalStreet does not replace preexisting base address CorrimalStreet. This is not unexplained loss: base-value precedence is explicit. No automatic replacement is justified without owner/source freshness conflict policy.
5. Kos House and Barka have no menu evidence in this snapshot; rendered menu lists remain empty, with no invented menu items/prices. Barka lacks usable phone/hero. This is incomplete information, not a verified complete business home.

## Preserving owners and evidence

Any future public filtering must touch only machine namespace and keep explicit owner links, values, null clears and original source provenance. Data repair would require current source/owner fingerprints and separate approval; none is proposed here. No inference that a successful crawl or populated field establishes correct identity.

|ID|Name|Source|Rendered menu links|
|---|---|---|---|
|00a26d92-238d-4d26-9dea-6b3969dece8f|Nick The Greek|https://www.nickthegreek.com/|1|
|00aa51ae-4188-4665-aa8e-79dfbb11729f|Kos House|https://www.koshouse.de/|0|
|012f38f4-9ba4-40e3-9f8a-739247e383bb|Litani's Greek Mediterranean Restaurant|https://www.agfg.com.au/restaurant/litanis-greek-mediterranean-restaurant-55968|0|
|018a38cb-a800-454b-97ff-ede370ed3492|Aphrodite Restaurant Köln|https://www.aphroditerestaurant.de/|0|
|018cb572-a491-42bf-9f89-3a8c7af18640|Barka — Řecká Restaurace|https://barkarr.cz/|0|

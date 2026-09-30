# Existing community capability audit — 30 September 2026

Read-only public RPC evidence is retained in `public-listing-inventory-2026-09-30.json`. No private account data, customer records or authenticated mutations were used. This is an aggregate inventory plus bounded record inspection, **not a claim that every individual listing has been reviewed**. Capability recommendations below are product inferences, not verified offers from these organizations.

## Inventory and data quality

`dir_counts` reported 28,901 records: 8,990 churches; 6,232 businesses; 3,415 organizations; 3,187 professionals; 1,483 schools; 1,264 vendors; 1,168 events; 1,038 creators; 797 artists; 787 travel places; 297 venues; 243 sports. The sports browse subsequently returned 244 unique records, indicating the count and browse are not one consistent snapshot. Do not present either as an immutable audited total.

The public API clamps search pages to 48. The audit followed actual 48-row pages until exhaustion, collecting 244 sports records and 284 matches for “dance.” Dance matches include festivals and descriptions, not exclusively dance groups. “Salon” also matches Thessaloniki and returns unrelated coffee shops/law offices: keyword matches cannot safely drive individualized tool assignment. Sports categories include churches, schools and charities; classification needs evidence review rather than a blanket sports template.

## Concrete existing organizations and their different needs

| Evidence | Proposed capability and confidence |
|---|---|
| Olympic Flame Soccer Club Toronto, `54f32daa-b7eb-4be9-bbe3-3e951e966dab`, `/sports/olympic-flame-soccer-club-toronto` | High-confidence existing football club, not a league startup. Official site offers returning-player registration, tryouts, house-league schedules, competitive programs and sponsors. Needs season/team hierarchy, roster permissions, registration handoff, fixtures and sponsor presentation. Youth participation requires a separately designed guardian/consent system; adult membership is insufficient. |
| KOPA League, `36732144-ce87-4ef6-bc8e-89da0f9637c4`, `/sports/uk-london-kopa-league` | Listing-level evidence of an actual league. Needs clubs→teams→season→division→fixtures→results, authorized score entry and disputed-result workflow; standings cannot be invented from an ordinary calendar. Medium confidence pending official organization verification. |
| Diaspora Greek Dance Group (Surrey), `5415d6bf-f0a3-4a9d-983c-7967b672cffe`, `/organization/ca-surrey-diaspora-greek-dance-group` | Dance-troupe category supports membership requests, private approved roster, rehearsals, attendance and festival participation. Medium confidence; organizer confirmation needed for actual age groups, pricing and schedule. |
| EGEO, `bcebda3d-91b9-4009-a56a-a5b3a1f10174`, `/organization/egeo-escuela-danzas-griegas-mx` | Dance-school classification suggests distinct class/cohort enrollment, instructor assignments and attendance. Do not conflate a school with a performing troupe. Medium confidence. |
| Orthodox Parish of Helsinki, `67e9ba6c-749a-46ac-af0b-33647b88d27b`, `/church/orthodox-parish-of-helsinki-finland` | Confirmed service calendar, ministries and volunteer shifts; local calendar practice must be explicitly configured, not inferred from location. Medium confidence for workflow; actual service times require parish input. |
| Olympic Hall, `9ca606a8-bb17-43c4-bfce-84de3f442d39`, `/venue/olympic-hall-adelaide` | Existing hall description lists stage/kitchen/bar. Needs capacity/resource availability, event enquiries and coordinated supplier confirmations. Listing facts are not guarantees of current availability. Medium confidence. |
| Meraki Greek Restaurant Sheffield, `dc12ad21-d30a-44de-aaea-75bd284bed7a`, `/business/meraki-greek-restaurant-sheffield-sheffield` | Restaurant booking/table capacity, menus and real operating hours; not generic professional matters. Medium confidence from category. |
| Arthur Comino, `0bc76ac5-0d59-4337-9882-1ac1edfff235`, `/professional/arthur-comino-brisbane` | Lawyer search result suggests consultations, secure client intake, matter/deadline tracking; no inferred legal advice or automated filing. Medium confidence pending profession verification. |
| Bouzouki Shows, `219d20b7-8828-42ec-98f4-58689b02ed42`, `/artist/bouzouki-shows-sydney` | Actual artist listing needs showreel/music links, booking briefs, deliverables and performance calendar; no fabricated streams or audience metrics. Medium confidence. |

## Olympic Flame profile defects visible now

The public profile has an empty top-level `social_links` object but Instagram and X URLs in `profile._enrich.social`; rendering must merge verified available sources (the current renderer has a merge path, to be regression checked). Its stored primary phone and enriched phone disagree; the latter is a generic 1-800 number and must not replace the club contact automatically. `geo_precision` says `none` while `_geo.precision` says `street`, so coordinate provenance is inconsistent. The listing is flagged `stale` in browse despite a recent update timestamp. Update time alone does not establish source correctness.

The profile contains sport/heritage but no actual teams, schedules, registration destinations or league tables. An advanced sports page must allow verified club-supplied structured data and link to its existing operational services. Do not claim those integrations already exist.

Official sources checked: [club home](https://www.olympicflamesoccer.ca/), [house-league navigation](https://www.olympicflamesoccer.ca/page/nav/4627737), [competitive programs](https://www.olympicflamesoccer.ca/page/show/4627736-elite-development-and-grassroots-programs). Direct home fetch failed in the browser research tool; indexed official-site content and navigation were available. No registration fees, deadlines, staff contacts or age eligibility were copied into the product.

## Delivery order grounded in these records

1. Finish the shared organization calendar with real optional volunteer shifts, suitable for confirmed parish services and dance rehearsals.
2. Deliver adult dance-group membership approval and rehearsal attendance with restricted rosters. State clearly that youth enrollment is not implemented.
3. Introduce distinct sports club/team/league/athlete schemas with explicit organizational relationships. Preserve existing external registration and results links until a verified integration exists.
4. Add season/fixture/results workflows and authorized standings calculation; only then expose national/professional team and athlete homes with licensed or authorized data. Never imply a provider exists merely because a profile was created.
5. Continue classification and source-quality review across the inventory; require organizer confirmation before turning inferred needs into claimed services.

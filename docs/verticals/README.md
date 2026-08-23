# Zoi verticals — the build contract

Six specialist briefs define what each kind of listing needs. This file is the
**implementable summary**: the `profile` JSONB contract, the schema.org type, the
primary conversion, and what still needs backend. It is what `api/_verticals.js`
codes against.

## The rule that governs everything

`profile` is owner-supplied and the page renders **only** what is actually
there. A section with no data does not render a heading — it becomes a line in
the claim panel instead. Nothing is inferred, scraped, or generated and then
presented as fact.

Enforced in code, not policy:

| Guard | Where | What it stops |
|---|---|---|
| `safeProfile()` | `_verticals.js` | strips `rating`/`review`/`score` keys from the blob so an owner cannot inject an unverifiable rating into JSON-LD |
| `reviewsAllowed()` | `entity.js` | returns false for health (AHPRA bans patient testimonials in AU/NZ), legal, financial, and churches — hard gate, not a setting |
| `inSeason()` | `_verticals.js` | an expired seasonal offer is not rendered and not emitted; a vasilopita offer cannot outlive its window |
| `openNow()` | `_verticals.js` | computed server-side in the venue's own timezone; a browser clock cannot be trusted and a wrong "Open" is a lie |
| `freshness()` | `_verticals.js` | date-stamps a menu so staleness is visible rather than silent |
| metric gate | *to build* | render a number only when it carries `source` + `verified_at` inside 30 days. No follower counts, no attendance, no stream plays without provider OAuth |

## Shared keys (every vertical)

```jsonc
{
  "timezone": "America/Toronto",        // IANA. Required wherever hours exist — drives open-now.
  "tagline": "…", "tagline_el": "…",    // any display string may carry an _el sibling; never machine-translated
  "hours":  [{ "day": "tue", "open": "17:00", "close": "23:00", "note": "kitchen closes 22:15" }],
  "photos": [{ "url": "…", "alt": "…", "tag": "room|food|team|exterior" }],
  "languages": [{ "code": "el", "name": "Greek", "level": "native" }],   // first-class: the diaspora conversion mechanism
  "service_areas": ["Sydney", "Inner West"],
  "booking": { "mode": "agent|direct|both", "agent": {…}, "direct": {…},
               "enquiries_to": "agent", "accepts": [], "declines": [],
               "lead_time_days": 21, "response_sla_hours": 48 },
  "rate_card": { "currency": "AUD", "display": "from|band|poa", "items": [], "deposit_pct": 30 },
  "press_kit": { "bio_short": "…", "bio_long": "…", "bio_el": "…", "onepager_pdf": "…", "photos": [] },
  "provider_stats": null,               // OAUTH-WRITE-ONLY. Never owner-editable.
  "_meta": { "verified_at": "2026-06-12", "updated_by": "…" }
}
```

Money is `price_cents` (integer minor units) **or** a decimal **string**, always
with an explicit `currency`. Never a float, never a symbol in the data.

## The verticals

| Vertical | Routed by | schema.org | Primary conversion | Signature keys |
|---|---|---|---|---|
| **Orthodox parish** | `church` | `Church` | request a sacrament / give | `services[]` (rrule + season), `feast_overrides[]`, `sacraments.requests[]`, `stewardship.funds[]`, `ministries[]`, `festival`, `patronal_feast` |
| **Monastery / pilgrimage** | `heritage-pilgrimage` | `Monastery` | plan a correct visit | `visit{gender,dress,permit}`, `akolouthia[]`, `vigils[]`, `guesthouse`, `relics[]` |
| **Greek school** | `greek-schools` | `School` + `Course`/`CourseInstance` | enrol | `programs[]`, `enrolment{status,deadline}`, `tuition`, `calendar[]`, `exam_prep[]` |
| **Association** | `hellenic-associations` | `NGO` | become a member | `org.origin{region,village}`, `membership.categories[]`, `events[]`, `scholarships[]` |
| **Charity** | cause categories | `NGO` | donate | `programs[]`, `giving.funds[]`, `appeal`, `transparency`, `get_help` |
| **Restaurant / taverna** | `restaurants`, `tavernas` | `Restaurant` | reserve a table | `menu[]`, `menu_updated`, `reserve{mode}`, `order[]`, `specials[]`, `catering` |
| **Cafe / kafeneio** | `cafes` | `CafeOrCoffeeShop` | directions / order ahead | `coffee{roaster,brews}`, `amenities[]`, `loyalty` |
| **Bakery** | `bakeries` | `Bakery` | pre-order | `seasonal[]` (vasilopita/tsoureki with `order_by`), `preorder{mode,deposit}`, `custom_cakes` |
| **Hotel / villa** | `hotels` | `Hotel` / `LodgingBusiness` | direct booking | `rooms[]`, `amenities[]`, `checkin`, `cancellation`, `licence_number`, `season_from/to` |
| **Food shop** | `groceries`, `olive-oil-honey`, `jewelers` | `GroceryStore` / `JewelryStore` | shop / order | `products[]` with variants, `shipping.zones[]`, `provenance[]`, `wholesale` |
| **Law practice** | `lawyers` | `Attorney` | consultation | `practice_areas[]`, `admissions[]`, `jurisdictions[]`, `consult`, `regulator`, `disclaimers[]` |
| **Clinic / dentist** | `doctors`, `dentists` | `MedicalClinic` / `Dentist` | book an appointment | `specialties[]`, `appointment_types[]`, `billing`, `registration`, `treatments[]` |
| **Accountant** | `accountants` | `AccountingService` | fixed-price quote | `services[]`, `registrations[]`, `cross_border`, `key_dates[]` |
| **Real estate** | `realtors` | `RealEstateAgent` | free appraisal | `brokerage`, `licence`, `service_areas[]`, `listings[]`, `appraisal` |
| **Architect / engineer** | `architects-engineers` | `ProfessionalService` | start a project | `portfolio[]` (+ `role_note` attribution), `registrations[]`, `authorities[]`, `fees` |
| **Financial adviser** | `insur`, `financ` | `InsuranceAgency` / `FinancialService` | first meeting | `licensing[]`, `advice_areas[]`, `fee_model`, `disclosure_docs[]`, `advice_warning` |
| **Musician** | `musicians-djs` | `MusicGroup` | booking enquiry | `listen{}`, `releases[]`, `tour[]`, `press_kit`, `proof{venues,press}` |
| **DJ** | `/\bdj\b/` | `Person` + `Offer` | availability + quote | `sets[]`, `packages[]`, `music_policy`, `kit`, `availability` |
| **Creator** | `influencers`, `media-creators` | `Person` | brand enquiry | `platforms{}`, `work[]`, `rate_card` (usage rights, whitelisting), `audience_declared` |
| **Radio / podcast** | `radio-stations` | `RadioStation` / `PodcastSeries` | listen live / subscribe | `stream{url_https}`, `podcast{rss}`, `schedule[]`, `episodes[]`, `advertise` |
| **Performer** | `theatre-comedy` | `Person` / `TheaterGroup` | tickets or booking | `shows[]`, `performances[]`, `credits[]`, `skills` |
| **Chef** | `chefs` | `Person` + `Recipe` | hire / book a seat | `services[]`, `menus[]`, `experiences[]`, `recipes[]` |
| **Visual artist** | `artists` | `Person` + `VisualArtwork` | enquire / commission | `works[]`, `exhibitions[]`, `commissions`, `series[]` |
| **Event / festival** | `festivals` | `Festival` | tickets | `starts`+`timezone`, `dates[]`, `tickets.tiers[]`, `lineup[]`, `venue` |
| **Venue** | `cultural-centres` | `EventVenue` | hire enquiry | `spaces[]` with per-layout capacity, `rates[]`, `calendar[]`, `catering.model` |
| **Sports club** | `sports-youth` | `SportsTeam` | join / trials | `teams[]`, `fixtures[]`, `results[]` (+ `source_url`), `join` |
| **Place to visit** | `heritage-pilgrimage` | `TouristAttraction` | directions | `seasons[]` (MM-DD, recurring), `entry{as_of}`, `visit{dress_code}`, `highlights[]` |

## Compliance, by vertical

Regulated verticals are not a styling problem. These are renderer-enforced:

- **Health (AU/NZ)** — AHPRA prohibits patient testimonials in advertising. No reviews, no ratings, no embedded Google reviews. Protected titles ("specialist", "orthodontist", "surgeon") gated on specialist registration. No "safe", "painless", "guaranteed", "cure".
- **Legal** — licence number and regulator mandatory; "no attorney–client relationship" on every enquiry; intake must **not** solicit case facts; `notable_work[]` forces "Prior results do not guarantee a similar outcome"; "no win no fee" suppressed where the jurisdiction restricts it.
- **Financial** — general advice warning is structural, rendered under the H1, non-dismissible. Licence identifiers (AFSL/AR, FRN, CRD/NPN) mandatory or the whole advice section is suppressed. No returns, no projections, no testimonials. Product-panel disclosure required when `providers[]` is set.
- **Real estate** — licence number mandatory; brokerage with equal prominence. **Fair-housing**: "Greek-speaking agent" is legal; "great for Greek families" or "close to the Greek church" in a *listing description* is a violation. Lint listing text against protected-class phrases.
- **Architecture / engineering** — "architect" and "engineer" are legally protected titles. No registration → the word is suppressed and the listing reads "building designer". Portfolio work from a previous employer requires `role_note`.
- **Accounting** — registration number mandatory or "tax agent"/"lodge" are suppressed. No "maximum refund" claims. No contingent fees on returns.
- **Bakery / food** — allergen text is owner free text plus a standing disclaimer; do not build a structured allergen matrix we cannot verify.

## The Orthodox calendar

`api/_orthocal.js` — built and tested (`tests/unit/orthocal.test.mjs`, 12 tests).
Orthodox Pascha via the Julian Paschalion, 38 moveable feasts as offsets, 24
fixed feasts, fasting seasons, name days. Verified against the published
Paschalion 2020–2030 and a 40-year Sunday invariant. Orthodox Pascha is **not**
Western Easter — they coincide in 2025 and 2028 and diverge by up to five weeks
otherwise, so a Western Easter library is wrong most years.

Parishes supply *times only*. Every date is computed. A hand-typed liturgical
date is wrong within a year.

## What needs backend (ranked)

1. **`profile` must be writable.** `bizpage_save` takes description/phone/hours/photo/social but no `profile` jsonb; `seo_entity` returns it but nothing sets it. Until this exists, claiming cannot fill the page. **This gates everything above.**
2. **Enquiry storage + routing.** Every vertical's primary conversion is currently a `mailto:` at best. One table (`entity_id`, `vertical`, payload JSONB, status, routed_to, ref, created_at) + templated auto-reply + an owner inbox unlocks all 26 verticals at once. This was the single most repeated finding across all six briefs.
3. **Media pipeline** — signed upload, derivatives (webp/avif at 2400/1200/600), EXIF strip, mandatory photo credit. Photos are the difference between a listing and a page.
4. **Facet aggregate RPC** — `(country, city, category_slug, count)` plus a total-count RPC. Neither exists; the search RPC caps at 48 rows and returns no total. Required before any category or city landing page can be built.
5. **Payments** — one Stripe rail, env-gated, reused by tickets, stewardship, deposits, tuition and pre-orders. Not six integrations.
6. **Provider OAuth** — Spotify/Instagram/YouTube/podcast hosts. The *only* honest source of any follower or play count.
7. **RSS ingestion** for podcast episodes; **iCal** for hotel availability and venue calendars. Owners must not hand-type these.

## Sensitive data

Some enquiry types are not ordinary leads and need separate storage, access
control and retention:

- sacrament requests (names of the departed, marriage documents)
- school enrolment (children's data)
- charity "get help" (beneficiary hardship data)
- health appointment requests (no symptoms field, ever)
- financial enquiries (regulated business records, 7-year retention, audit log)

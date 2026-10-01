# Toronto concert catalogue proposal

Read-only research and unexecuted SQL proposal. No listing, ownership, inventory or payment changes made.

## Source identity and facts

The official [Signature concert page](https://www.signatureproductions.ca/giannisploutarchosandromache) was fetched on 2026-10-01. It names Parkview Manor and March 20, specifies 10 seats per table/booth, no food service, doors 20:00 and show 22:00. Its ticket request form promises an organizer response with available options; it does not establish connected checkout or a live seat feed. The year 2027 comes from the retained official poster, previously visually reviewed, and the existing source-facts module—not from the page's month/day text alone.

Evidence retained:

- `/tmp/toronto-event-official-2026-10-01.html`: SHA256 `45eba0739771f53199ed2980ff7e256728f209f6b3ee1da3646a1602e2f93d10`.
- `assets/events/signature/poster.jpg`: SHA256 `74d9c5eaaf6e261e416a3654581fb892d05721cff6304032ccb1c30732877e97`.
- `assets/events/signature/source-facts.mjs`: SHA256 `9a8a1ea390d88938959bb2b0787f6e812fd7876ca38f0390a30e32942c5cc660`.
- `assets/events/signature/source-notes.md` documents retained poster review, source facts and remaining inventory/payment limits.

## Catalogue audit

Read-only searches of `zoi.listings` found no exact `giannis-ploutarchos-andromache-toronto-2027` slug and no corresponding event under performer names or the official Signature event URL. A broader Toronto/North York/Parkview/Signature event metadata search also did not find it. The Montréal event exists separately and must remain untouched.

The existing organizer is `9d969028-74cb-4b49-97f1-58eba8fc0e69`, slug `signatureproductions-6aa61d`, entity type business. Its category is the existing `events-entertainment` category (ID 6). The proposal links this organizer as a factual relationship; it does not copy organizer ownership onto the new event. Database metadata confirms the listing ID default is `gen_random_uuid()`.

`ops/toronto-event-catalog-proposal.sql` omits ID to use that default. It rechecks organizer identity and category, takes a transaction advisory lock, rejects an exact slug or a possible source/name/location duplicate, and inserts one announcement-only event. A possible older event on the reused official URL deliberately stops the insert for human review. Default transaction end is ROLLBACK. No conflict-upsert or overwrite is used.

No street address or coordinates, prices/currency, sellable table inventory, owner/workspace, paid status or bookable capability is invented. Published source table capacity is a descriptive note, not inventory. Post-insert checks require no owner, no coordinates, unclaimed, not bookable, published and correct public slug. The SQL has not been executed, including as a rollback transaction; root must review and validate before any application.

## Route integration required before publication

Keep the existing interactive experience at `/events/giannis-ploutarchos-andromache-toronto-2027/` as the single guest destination. Do not create another generic event page.

1. Root owns `vercel.json`: add exact permanent redirects for `/event/giannis-ploutarchos-andromache-toronto-2027` and its trailing-slash variant to the existing plural `/events/.../` page. Preserve query parameters and test fragment navigation. The exact rules must take precedence over generic event routing.
2. Search currently builds `/<entity_type>/<slug>` in `assets/zoi-search.js:hrefFor`; therefore storing a custom canonical_path alone does not solve the journey. The exact redirects cover search, Explore, generic detail links and native web links without broadly changing other event routes.
3. Proposal supplies the plural canonical_path, but root must inspect its effective stored/public value after database triggers and confirm canonical metadata at the destination. The current static page has `noindex,follow`, OG URL pointing to the plural path and no explicit canonical link. Root should intentionally reconcile indexability/canonical metadata when publishing this catalogue record; the redirect alone is not an SEO completion claim.
4. Link the database-generated event ID to the existing private-plan integration only through the established configuration/adapter. Do not substitute the ID into ticket inventory or infer a host claim. That integration is a separate reviewed change if currently absent.
5. Verify actual production search for performer + Toronto, Explore event filter, organizer concert link, direct singular URL and plural URL on 390/1440. Each must reach the same interactive room, select a real table and continue into the existing group journey. Inspect current capability descriptions; do not claim reservation/payment without backend receipts.
6. Native deliberate handoff must open that same guest URL; no native 3D performance acceptance has been performed here. Unknown coordinates mean this insertion does not create a falsely precise map pin.

## Root handoff

Only the two assigned proposal artifacts changed. No `vercel.json`, source-facts, runtime, owner editor or other lane changes. Source presence and missing catalogue identity are evidenced; route, rendered catalogue visibility and exercised production journeys remain pending root integration.

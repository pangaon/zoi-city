# Melanthi reviewed source-HTML canary — applied and exercised

Exactly one listing: `04ae2053-1e91-49b2-bd31-19a5e9158a2a`, Melanthi Hotel, Makrinitsa, Greece. Canonical public page: https://www.zoi.city/travel-place/melanthi-hotel-makrinitsa . No shared implementation edits or other listing changes in this task.

## Source and review

Parent's immutable source-only capture `c023dfa34f83fa3011f63bf3c94a2c254bfdd828f09cc6a3916ed191657379b0` under `.recovery/melanthi-source-html-reviewed/` was hash-verified. It contains substantial official Greek HTML, not a browser render. Source text confirms Makrinitsa/Pelion, traditional hospitality, telephone +302428099977, Facebook `/melanthi.gr/` and Instagram `/melanthihotel/`. English description faithfully summarizes those facts; no opening hours, coordinates, availability, room stock or booking capability was invented.

Parent independently reviewed the image bytes; specialist also visually inspected both approved450×620 room photographs:
- `6b4b6726ea08e9b31fb6cc2efed52e9152c9fb7fe12dcdba3cc9ecd2ef23d82d` — Ifigenia room.
- `ee2bcce0f8b90f0fa7a625b6562c7ccdb102af7b8102983a23dcc7b7e0e36452` — Kallisti room.

Rejected programme banner `6c8529b87833b72db49bfcccf8fb36154c8a79f4ba79ce0f535c046311a3096c` never entered the applied photograph list. Review receipt binds these two hashes and the exact source capture. No recapture occurred.

## Guarded write and persistent readback

Fresh locked preconditions confirmed exact identity/source, published/clean, unowned state, current fingerprint and protected base hash. One genuine `public.enrich_sample_lease(uuid[])` lease was obtained for this ID. Existing `reviewedEnrichmentBatch` generated the payload from that lease, capture and review; prior machine hash `66163bba740f6168cc4203244ed3c84e29f94e1110f5edd0a30d7498ebfe208a` was bound to the review. The prior machine namespace contained error metadata only, so no useful earlier fields were removed.

One `public.enrich_apply` call ran within a guarded transaction that compared current prior machine JSON, source/owner/base invariants, required applied:true and verified the evidence hash before commit. Receipt: `melanthi-hotel-makrinitsa`, `applied:true`. Independent subsequent readback confirmed crawl_status:ok, exactly the two approved photo URLs, source-only evidence hash and cleared lease.

Before/after invariants:
- Source fingerprint: `d162ff8739a05071a5e4e7cf5181bb26`.
- Protected base MD5, excluding profile/updated_at/search_tsv: `121d8de71959e2f031d11ec53840505d`.
- Owner-content MD5: `99914b932bd37a50b983c5e7c90ae93b`.

Lease identifiers and private pending payload remain in the restricted recovery directory, not this report. No ambiguous write retry or direct table UPDATE was used.

## Actual public journey

At390×900 and1440×900, canonical page rendered the English description, two source photos, phone and both official social links. Opened both gallery buttons at both widths; each actual image decoded450×620. Sparse service sections remain absent. Entered1–4 February2027/two guests and clicked the actual planning button; result offered `tel:+302428099977` and explicitly said no reservation had been made. No calls, emails, social actions or provider bookings were triggered. Date values were assigned through DOM input/change events; actual submit/gallery clicks were exercised. No page errors or document overflow; browser closed.

Evidence: `/tmp/melanthi-public-acceptance.json` (53 successful commands), `/tmp/melanthi-public{390,1440}.png`, `/tmp/melanthi-gallery{0,1}-{390,1440}.png`, `/tmp/melanthi-plan{390,1440}.png`, `/tmp/melanthi-contact{390,1440}.png`.

## Explicit remaining limits

The approved originals are portrait450×620 photographs. The desktop hero enlarges/crops one and is visibly softer than a native wide photograph; this is **not** high-resolution hero acceptance. A separately source-verified larger image would improve it. Gallery subjects are genuine and readable. This canary proves reviewed source-HTML capture → guarded apply → public projection/gallery/contact preparation, not complete hotel inventory, online booking, every source offering, or site-wide enrichment completion. Earlier protected-render timeout remains preserved as its own historical failure.

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

## Larger original photographs — subsequent guarded canary

Capture `f1f36d784728c0f2a2e4f1d0e9344670881c59373ec1900d567b3448565624c1` under `.recovery/melanthi-large-reviewed/` includes the actual source-declared RevSlider originals discovered by the shared lazy-image correction. Root visually approved three decoded1500×1001 photographs: exterior/night view (`e32dab4f3341d1ac073bbe9d3d116c625d57ad4e60cce4db375fbc89ceeca0df`), Iliana bedroom (`8576229e10c259e27f6b301c3ae6e9966017da6cf3bf1571c020d133b4158eaf`), and breakfast buffet (`fac18e2fc90b0be31f32dfec4f0c74088980feb1e7c07105bea70197db324a39`). Programme banner6c8529 remains rejected. Extractor evidence is55b42d410217aa3858ff44c16bd9c18c9ffbf350e4408937cbc73d693d42ddc0; no recapture or guessed original URLs occurred in this application.

A fresh genuine targeted lease and reviewed adapter bound prior-machine SHA256 `5dd549cc729c0cfcf7d2da309102fe14fa03be2f5c03f388bb1925b9f9976966`. The guarded apply preserved the earlier two room images and English description/contact/social fields. One pre-apply transaction failed on a SQL operator-precedence error before the writer ran and rolled back; its parenthesized correction succeeded. No ambiguous write retry occurred. Separate readback confirmed five photos, exterior hero, cleared lease and unchanged fingerprint/base/owner hashes listed above. Earlier initial read queries using stale column assumptions failed harmlessly and were replaced with authoritative row inspection before leasing.

Actual canonical390×900 and1440×900 acceptance: all five gallery images opened and decoded (three1500×1001, two450×620), exterior hero visually inspected at both widths, no programme banner, no document overflow or page errors. Existing date/guest planning still produced the local telephone handoff and explicit no-reservation status; no calls/bookings/messages were sent. Browser closed. Evidence `/tmp/melanthi-large-public-acceptance.json` (95 successful commands), `/tmp/melanthi-large-public{390,1440}.png`, `/tmp/melanthi-large-gallery{0,1,2,3,4}-{390,1440}.png` and corresponding plan/contact screenshots.

This resolves the previously documented450px hero limitation with genuine1500px source photography. It does not imply native4K assets, connected reservation inventory, full extraction of every hotel service or completed catalogue-wide enrichment. Shared worker deployment remains a separate release action.

# Independent hospitality catalogue review

Reviewed 1 October 2026. Local candidate acceptance only; no production writes or worker deployment performed by this reviewer.

## Findings corrected

- Reproduced same-domain property contamination: a source at `/hotel-a/` accepted a Hotel B schema root, Hotel B room link and Hotel B amenity. Both extraction and review validation accepted the original candidate. The corrected helper binds schema and linked offerings to the property prefix; the identical independent reproduction now returns an empty catalogue. Public model also filters imported room links against the current property's source.
- Found initial worker redirect gap after supplemental and review paths were guarded. The worker now removes initial catalogue fields/provenance when the fetched source leaves the original lease property. Supplemental catalogue acceptance requires both initial and supplemental final URLs to match that original property, and validates rows against it. Reviewed the actual worker boundary and independently reran its regression.

## Source, rendering and exercised evidence

Source evidence remains the specialist's separately hashed AMARA captures; this reviewer did not refetch them. The committed excerpt is source-derived test material, not a production enrichment receipt. Single-page source capture does not follow catalogue links. Worker supplementary discovery retains the two-page maximum and prioritizes menu/contact.

Independently ran all 56 focused tests across catalogue extraction, actual extractor body, source capture, reviewed lease payload, hospitality model, and existing source safeguards. Capture-to-review-to-canonical-public-model tests pass. Owner null/empty catalogue clears suppress machine and curated values; partial owner changes retain unrelated categories. Source mismatch and quarantine suppress machine facts.

Independently ran all eight browser combinations: four templates at 390 and 1440 pixels. Room details, exact official source link, Escape/focus restoration, shortlist-to-arrival flow, and sparse/explicit-clear states pass. Visually inspected Concierge phone and Atelier desktop detail dialogs: titles and source action remain legible and contained. No booking or provider availability was asserted.

## Accepted runtime hashes

- `_hospitality.js`: `6534840528877f48e587dc6831a1d8d2156597d38bb4a536042dbc492f3611f4`
- Worker `index.ts`: `137462a5ae220842903ead0edb168b22b8540855ce01ddd6bbf775d7748fcf83`
- `scripts/enrichment/extractor.mjs`: `c867db262c1d83f24ff68d417c04a7588684da7becd83d867dba23bfd82d3fac`
- `scripts/enrichment/source-html.mjs`: `b08988a45ef16763942a72e259230d8a6926a78e42bfb8dca50109e92548d433`
- `scripts/enrichment/reviewed-batch.mjs`: `0fa23a54b3de1288a9a883e4937163e9b35f0953fcf1caec885f93471fde36ef`
- Hospitality `model.mjs`: `3db4c37585ddc51530fbec885f79981f1cfb1404a91595b975d6ff9c68c9924f`

## Remaining boundaries

No category-wide source audit, live enrichment application, production catalogue readback, owner catalogue editor lifecycle, room photography coverage or booking inventory is established by this patch. Unrecognized sources deliberately remain sparse. Release checks and any operational canary remain lead-owned.

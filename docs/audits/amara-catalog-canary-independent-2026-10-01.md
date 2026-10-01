# Independent AMARA catalogue canary review

Reviewed 1 October 2026 before any lease acquisition or apply. This review used the retained original HTML, proposed report and row snapshot, plus the current adapter. No production read, mutation, provider call or lease was performed by this reviewer.

## Exact source and identity

The snapshot and report agree on listing `361c983b-29aa-4b4a-8bfa-ca4a17993e40`, slug `amara-hotel-limassol`, stored website `https://www.amarahotel.com`, and fingerprint `b26611773659c15d3cc8106cab224288`. The source title identifies THE AMARA LUXURY HOTEL CYPRUS. Both names occur in real visible anchor text outside scripts in retained `/tmp/hotel-audit-amara-rooms.html`, linking to these exact same-property pages:

- Deluxe Sea View Room: `https://www.amarahotel.com/room/deluxe-sea-view-room/`
- Deluxe Grand Sea View Room: `https://www.amarahotel.com/room/deluxe-grand-sea-view-room/`

Independently hashing the original bytes matches source SHA-256 `07f839e6171ec591f539b6d81258e001ebf1b2847b4ebe0bfe6a5e4bf6608b4d`. Running the actual current extractor over those bytes returns exactly the proposed two room rows. Neither occupancy, price, description, availability nor new image is included.

Canonical report hash independently matches `fd4e6ff05e31972ac6638eb17abcdde6d08b061f390c1e63147bc4d5c1430539`; current extractor hash matches `d0d0e5dcb839526ca9dfb02aa3fd4281acf9cfcce573a27a53041e91c949ccb7`; prior machine hash matches `b3655fdaac41a365c0261cdd4c377343f9a424c5969246163c3f8b54adf62f66`.

## Adapter and preservation

Exercised `reviewedEnrichmentBatch` offline with an explicitly synthetic contract-only lease marker, never submitted anywhere. It adds exactly the room data and source-review metadata while preserving the snapshot's description, tagline, image, language, socials and external booking provider. Existing provenance entries are retained; stored website remains the original homepage string, not `/rooms/`.

Altered lease website, source fingerprint and prior machine profile each reject. Review report hash, listing identity and mandatory independent-review fields remain enforced by the adapter. No arbitrary catalogue overrides were used; image approval is explicitly empty. The source report truthfully has `render:null` and does not manufacture browser rendering evidence.

## Acceptance boundary

The proposal is accepted for lead-controlled promotion only after re-reading current row identity, owner fields/clears and machine snapshot, then obtaining a genuine existing-writer lease. Any changed source/fingerprint/prior state requires new review. This artifact does not prove the snapshot is still current or grant authority to bypass lease checks.

After confirmed apply, compare unrelated fields and public model, then exercise both cards, correct source links, modal focus, shortlist and existing provider/hero preservation at 390/1440. No production success is claimed here. Full hotel coverage and room inventory remain outside this two-link canary.

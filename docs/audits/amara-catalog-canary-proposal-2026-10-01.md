# AMARA catalogue canary — read-only proposal

Prepared 2026-10-01. No lease obtained, source worker deployed, RPC apply executed or listing modified.

## Exact record and current production baseline

- Listing `361c983b-29aa-4b4a-8bfa-ca4a17993e40`, **Amara Hotel**, canonical `/business/amara-hotel-limassol`.
- Stored website `https://www.amarahotel.com` (no trailing slash); published, clean, unclaimed, no owner user/workspace.
- Row snapshot MD5 `93a6722cecdece94edc293381bc91d39`; current quality/source fingerprint `b26611773659c15d3cc8106cab224288`.
- `zoi.public_owner_content(id)` returned `{}`. Direct profile has no rooms/dining/venues/amenities keys or explicit catalogue clears. These conditions must be rechecked immediately before obtaining a real lease.
- Production HTML readback is HTTP 200, but **rooms/dining/venues/amenities are all empty**. Existing hero is Suite-Terrace-2-1920x1201.jpg on the official site, and booking provider is `https://amarahotel.reserve-online.net/`. Both must survive unchanged. `/tmp/amara-production-before.json` holds the parsed hotel model.

Snapshot is `amara-catalog-canary-snapshot-2026-10-01.json`. It contains existing public source data, no account credentials.

## Proposed addition and retained source

Only add the two actual named room links found in the original captured `/rooms/` HTML:

1. Deluxe Sea View Room — `https://www.amarahotel.com/room/deluxe-sea-view-room/`
2. Deluxe Grand Sea View Room — `https://www.amarahotel.com/room/deluxe-grand-sea-view-room/`

No room imagery, descriptions, inventory, rates, occupancy or amenity claims are added. Existing hero, description, social channels, booking provider, other profile fields, owner fields and listing identity are retained.

`amara-catalog-canary-report-2026-10-01.json` is a **review proposal assembled from the real captured source HTML**, not an automatic browser-render receipt. Its source SHA-256 is `07f839e6171ec591f539b6d81258e001ebf1b2847b4ebe0bfe6a5e4bf6608b4d`; original bytes remain `/tmp/hotel-audit-amara-rooms.html`. `render` is null; new images and image approvals are empty because none is being introduced. Its collection timestamp is the retained source artifact timestamp. It intentionally carries only the room fields for this canary.

- Canonical report SHA-256: `fd4e6ff05e31972ac6638eb17abcdde6d08b061f390c1e63147bc4d5c1430539`
- Prior machine profile SHA-256: `b3655fdaac41a365c0261cdd4c377343f9a424c5969246163c3f8b54adf62f66`
- Extractor SHA-256: `d0d0e5dcb839526ca9dfb02aa3fd4281acf9cfcce573a27a53041e91c949ccb7`

A local projection of the proposed merge renders both names and preserves the exact current provider and hero. `/tmp/amara-catalog-proposed-home.html` is a proposal, not published proof.

## Promotion route for the lead after review

1. Finish independent code review/release checks. Independently inspect original rooms source, identity and both detail links; verify source/report hashes. Re-fetch and regenerate the report if evidence has changed. A homepage-only `captureSourceHTML` call cannot substitute for this rooms-page evidence.
2. Re-read exact listing ID, snapshot/fingerprint, owner clears and previous `_enrich`; stop on any difference requiring new review. Obtain an actual lease through existing `public.enrich_sample_lease(ARRAY[id])`, never a fabricated lease or direct listing update. Bind the report/review to the real lease fingerprint and exact current prior machine hash.
3. Use `reviewedEnrichmentBatch(report, review, lease)` with the actual independent reviewer identity/time, identity confirmation, image confirmation with **empty approved image hashes**, no arbitrary catalogue override, and the real prior profile snapshot. It returns existing machine facts plus rooms and source-HTML evidence. Obtain no broad queue lease and do not run unrelated enrichments.
4. Submit the resulting single payload through `public.enrich_apply`; require the confirmed accepted receipt. Preserve owner/base fields and compare all unrelated machine fields before/after, allowing only normal writer metadata plus rooms/source evidence/provenance. Do not change website to `/rooms/`.
5. Verify canonical production page at 390/1440: two exact room cards; each detail modal opens and links to its corresponding official room; Escape/focus restore; room shortlist enters the stay plan; no pricing/availability promise; existing hero/provider/socials retained. Record deployed version and actual public readback separately.

The operational canary does not require deploying the autonomous worker merely to apply this reviewed artifact; worker deployment remains a separate lead decision. It does require the approved review adapter/model candidate. Full 388-hotel coverage stays open.

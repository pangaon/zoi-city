# Greek artist source follow-through — 2 October 2026

## Source evidence

Retained exact-identity inventory and Signature artist relationship audit identify Giorgos Sabanis (`b2ccabbb-bf1c-4b01-b0b3-bd6e88beadab`, `/artist/giorgos-sabanis-athens-b2ccab`). The 30 September metadata snapshot marks the published, unowned artist as source_missing with no enrichment. This is not a fresh ownership or row fingerprint.

The official [Votanikos venue](https://www.votanikos.gr/) currently names Sabanis and Nikos Makropoulos for its 2026–27 programme, Friday/Saturday at 23:00. It gives no individual start/end dates establishing calendar occurrences. The venue's telephone/email belong to the venue, not the artist's booking team. Its linked Sabanis video is `https://www.youtube.com/watch?v=znfSSGadCtg`; provider fetch was throttled, so no playback or artist-channel identity is claimed. Universal Music France artist URL retrieval timed out; no enrichment derives from it. No portrait, artist website, invented dated show, capacity or ticket availability is proposed.

Source captures, SHA-256 hashes and explicit proposals are under `evidence/greek-artist-followthrough-2026-10-02/`. Sabanis remains pending a fresh record snapshot and an admissible artist source; a venue programme cannot be smuggled into website assignment. Completed Argiros/Ferris/Oikonomopoulos work and held Kakosaios packet were not repeated. Kallimani/APON identity gaps remain retained in their earlier batch audit.

The current [Anna Vissi official site](https://www.annavissilive.com/) directly links its [official store](https://shop.annavissilive.com/). Both returned 200 during this bounded source capture. Store products/prices are deliberately not copied; stock/checkout/shipping remain external. The prior September audit recorded shop_url but missing generic render action. No fresh public entity snapshot was queried during this task; fixture data is reconstructed explicitly from official source evidence.

## Shared correction

`api/_music-home.js` now resolves shop_url across generic and curated artist homes. Explicit owner, owner-profile and profile values—including null, empty or invalid URLs—take precedence. Imported links require matching current effective official website and first-party source kind, with quarantine/organization/publisher exclusions. Owner website clears or changes cannot revive an old source shop. HTTP(S) navigation rejects embedded credentials and executable protocols; media/embed validators are unchanged.

The shared music renderer presents the official-store action in all four layouts only when a safe link exists. It explains that products and checkout belong to the external store; no checkout, payment, inventory synchronization or provider integration is claimed. This patch does not add an owner editor field or assert shop_url is newly writable through existing editors. Public profile/owner overrides are honored if provided; existing write/projection contract expansion remains separate.

## Rendered and exercised evidence

12 focused music/store/source/publisher unit cases passed. Actual canonical renderer/browser runs use controlled network at 390 and 1440, with populated source, explicit clear, sparse long name and owner replacement. Keyboard Enter opens the exact external destination; no horizontal overflow or page errors. Eight browser cases and screenshots are in `/tmp/music-store`; logs `/tmp/music-store-units.log` and `/tmp/music-store-browser.log`.

Native parity is the existing public artist-home browser handoff; no new native commerce surface or installed-device checkout was tested. No database writes, source assignment, production deployment or completed enrichment is claimed. A current source→public-read check and lead release are still required before declaring the action live for Anna Vissi.

## Superseding owner workflow correction

Subsequent actual editor inspection established that the supported editable store field is `merch`, not `shop_url`. The combined candidate now honors merch presence/clear and legacy shop_url compatibility. See `artist-owner-catalogue-2026-10-02.md` for actual editor save/readback/public journeys and revised scope; the earlier standalone store freeze hashes are superseded.

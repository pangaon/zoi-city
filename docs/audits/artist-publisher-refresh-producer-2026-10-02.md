# Greek artist publisher recovery — producer candidate

This is a bounded source proposal for Giorgos Kakosaios and Giorgos Sabanis, plus one shared artist-provider projection correction. No live enrichment, source assignment, migration or commit was performed. Two records are ready for independent packet review; the category remains open.

## Exact source and current record evidence

Fresh management reads retained both complete rows, their exact PostgreSQL JSON text (including numeric scale) and function definitions. Kakosaios remains `5a1da680-196d-465b-acd1-25bfb6059df8`, whole-row MD5 `fc2cce08b7558ef82ec98c5bd20b1e7e`; Sabanis remains `b2ccabbb-bf1c-4b01-b0b3-bd6e88beadab`, MD5 `6fce561305bf476412020028a6a7829b`. Both are public, unclaimed, unowned and have no source assignment or machine enrichment. Kakosaios’s previous unsuccessful transaction did not leave a partial assignment.

The exact [Minos EMI artist page](https://www.minosemi.gr/artists/γιώργος-κακοσαίος/) identifies Kakosaios and directly links Spotify artist `4uyuai6Pqgz3kSx1Jme2PJ`. Its current native portrait is 1000×1000 JPEG, 92,587 bytes, SHA256 `559f50a1d7542d229c5d4e5d3578c49696784a774c5cd1be639a8d38dfc9a8e4`. Fresh guarded source bytes were retained, decoded offline in sandboxed Chromium 1234 and visually inspected. Relative age and an undated summer tour are excluded; publisher menu tiles are excluded. Original protected profile biography and city-centroid coordinates are preserved, not promoted as verified/current facts.

[Universal Music France’s exact publisher page](https://www.universalmusic.fr/artistes/30792301385) provides the Greek identity Γεώργιος Σαμπάνης, the transliteration Giorgos Sampanis/Sabanis, a biography and directly linked Spotify artist `6ZGwdAmu91r8mpA6SXodzd`. This packet supplies a concise original biography and listening destination. Its extracted images belong to unrelated publisher news releases; no portrait/gallery image is approved. Corporate contact/store/social channels are excluded. A [Votanikos programme](https://www.votanikos.gr/) is not converted to dated appearances without published start/end dates.

Direct Heaven Kallimani and Panik APON fetches returned challenge HTML despite HTTP 200. Their retained HTTP status is not source acceptance. Exact current listing IDs/source reconciliation and usable fresh captures remain open. Previously completed Vissi/Argiros/Ferris/Oikonomopoulos records are not rewritten to inflate this batch.

## Shared pipeline findings and implemented correction

Missing source URLs prevent these records entering the existing source lease queue. Previously reviewed shared publisher scope, selected portrait ordering and publisher attribution fixes already exist in the branch; this work reuses them and the existing lease/apply writers. No per-artist renderer bypass was added.

An actual current Sabanis field exposed a second failure after enrichment: inherited top-level `social_links.spotify=https://open.spotify.com/` displaced the exact source-bound artist destination. `api/_music-home.js` now uses the existing `publicMedia` validator when selecting inherited Spotify/YouTube destinations and omits unusable provider roots from automatic social actions. Qualified inherited destinations remain authoritative. Owner dictionaries/direct fields and explicit null/empty clears retain their precedence; source mismatch/quarantine continues to prevent machine fallback. This applies to every artist entering the shared model, including sparse records.

The isolated actual-writer test found another proposal issue: PostgreSQL `profile_strip` deliberately removes keys beginning `review`. The historical `reviewed_publisher_proposal` metadata therefore cannot be a durable receipt. New proposals use `publisher_source_evidence`, with post-write assertions for exact packet/source hashes, prior row, actual fingerprint, reviewer and approved image hashes. This is a proposal correction, not a database function change.

## Local verification and limits

33 focused tests pass across provider selection, populated/sparse rows, malformed/root URLs, owner precedence/clears, publisher attribution, guarded source capture and reviewed source packaging. The actual shared model projects both proposed records correctly; these hypothetical outputs are explicitly labelled local models, not public readback.

12 isolated PostgreSQL16 checks pass. The fixture round-trips exact current row MD5, installs retained actual function bodies, executes the default ROLLBACK proposals with the genuine sample lease/apply functions, verifies retained evidence and `fetched` enrichment/`pending` verification coverage, and restores the exact rows. Missing approval, wrong packet hash, changed owner/protected profile and actual helper-definition drift refuse. The fixture models the complete listing row shape; production listing triggers are not recreated. Fixture approval strings are test-only and confer no production approval. The local server is stopped and removed automatically.

Source capture first failed because the default Playwright cache points at an absent 1243 executable. Diagnosis selected the installed sandboxed 1234 browser; the accepted decoder reused the already retained guarded source/image bytes and records artifact replay rather than fabricated network/render evidence. Source HTML is not a browser-render receipt.

## Lead and independent acceptance gates

1. Review exact frozen packet/source/image/row/function hashes. Independent approval must name the actual reviewer and exact packet hash. Producer is not the independent approver.
2. Run each guarded proposal as a bounded production ROLLBACK dry run only after approval and database stability. It uses whole-row/identity/owner/source/function preflight guards, lock 3s / statement 15s, existing real lease binding and protected-field/readback checks. Timeout or stale state is failure, not a cue to relax guards or loop retries.
3. Only the lead may prepare/review a commit variant after a successful dry run and unchanged current preflight. Source assignment and enrichment must remain atomic. No default COMMIT is included here. Record the actual applied receipt and current source-bound public `seo_entity` result.
4. Release the shared projection correction with source-bound readback. Exercise the actual deployed 390/1440 homes: biography, portrait/gallery where present, exact Spotify dock destination, source attribution/outbound URL, unavailable provider response and close/reopen behavior. Repeat owner clear/override public reads. External provider playback remains a provider handoff unless actual playback is independently exercised.
5. Record native implementation/handoff and physical iOS/Android checks separately. These source proposals do not connect provider accounts, import dated shows, create ticket inventory or verify geography.

Reproduction from repository root:

```
node ops/build-reviewed-artist-proposals.mjs
ZOI_ARTIST_PGPORT=15547 node ops/verify-reviewed-artist-proposals-pg.mjs
node --test tests/unit/music-provider-destination.test.mjs tests/unit/music-publisher-credit.test.mjs tests/unit/source-html.test.mjs tests/unit/reviewed-source-html.test.mjs
```

Rebuilding changes the manifest creation time; verify the frozen hashes rather than regenerating approved evidence. `ready-packets-2026-10-02/manifest.json` binds the individual SQL/packet hashes. The separate frozen manifest binds source, runtime and verification dependencies for independent acceptance.

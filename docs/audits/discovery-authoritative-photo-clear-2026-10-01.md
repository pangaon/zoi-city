# Discovery photo clear consistency — 2026-10-01

## Actual shared failure

Explore card → Quick look starts with the search-row image while the authoritative profile request loads. The previous hydration code replaced the cover only if the profile returned a nonempty photo. An explicit owner clear therefore left the stale search-row photo visible, while the full restaurant/artist page correctly rendered no hero/portrait. This affects the shared quick-look path across listing types, not a Yamas-specific adapter.

The actual Explore UI with the original hydration condition reproduced the stale image on390: expected null, actual `https://www.yamas.co.ke/images/flavors-of-greece.png`. Retained `/tmp/discovery-media-consistency-before.log`. BASELINE=1 restores only that prior conditional in the served page for negative regression reproduction; no production mutation.

## Bounded correction

`assets/discovery/profile-preview.mjs` exposes `photoAuthoritative`: a resolved photo, an explicitly present photo_url, a supported explicit hero_url, or a gallery decision establishes an authoritative media result. A genuinely omitted media field with no replacement does not. Explicit owner/profile photo clears take precedence over source fallback. Gallery clears suppress gallery fallback without erasing a separately supplied source hero.

`explore/index.html` hydrates an authoritative photo decision, resetting cleared images to the listing's initials and removing stale poster/image classes. Loading and genuinely omitted media preserve the existing search-row cover. Existing request-version/closed-dialog checks reject old responses.

No enrichment, database projection, card-cache invalidation or source-image transformation is changed. No official-website behavior was revisited.

## Source and fixture boundaries

Yamas identity84bdafb9-966b-489a-a4d3-0dc3dc92acf9, canonical slug and source image URL come from the retained approved Yamas evidence and prior production journey audit. This test is a controlled owner-clear/replacement scenario, not a new live profile snapshot or fresh source audit. The artist is explicitly synthetic. Image responses use a small deterministic PNG so this is URL/clear/lifecycle verification, not art-direction acceptance. Both populated and sparse records are exercised; source photos or identities were not guessed for production.

Actual local Explore card/quick-look controls and current restaurant/music full-page adapters are used. All RPCs are controlled and external integrations blocked.48 cases pass across390/1440: restaurant/artist × clear, invalid, replacement, omitted, sparse, held-clear/reopen plus trusted-source nullable base, omitted base, owner clear, profile photo clear, profile hero clear and gallery clear. Full-page payload matches the authoritative image decision for clear, invalid, replacement, sparse and all six source-backed cases. The pending dialog retains its old image, then an old held clear cannot erase a newer reopened dialog's replacement. Evidence `/tmp/discovery-media-consistency/findings.json`, `/tmp/discovery-media-consistency-source-backed.log`.

28 tests in relevant unit suites also pass: quicklook-details, phone-target, professional-source, explore-artwork, explore-dialog-navigation. Production backend503 remains a separate blocker; no live database/customer writes, provider actions or deployment performed.

Frozen runtime hashes:
- profile-preview.mjs:aa596c34b4ce9a04125077d9d397d7ab62342c0d64500c9552cd3aba6f510e36
- explore/index.html:130dfbf2463213a3a43cf5a8c2c2c1cb6bcac07978e67c9c0a9a459f4402c64b

Root owns cache version integration/release; independent review pending.

## Nullable projection and supported field boundary (October 2 amendment)

The retained `home_entity` definition in `20260930090501_canonical_home_identity_index.sql` always projects `photo_url`, including null. Base null is therefore not proof of an owner deletion. Both current restaurant and music adapters intentionally use identity-bound source imagery for a missing base photo. The source-backed browser cases verify this behavior with both null and omitted base fields, then verify explicit owner/profile clears against those same adapters.

The supported hero decisions tested here are owner/profile `photo_url` and profile `hero_url`; gallery `photos:[]` is separately tested with and without a usable source hero. This is not a claim that arbitrary `hero`, `hero_image`, `portrait_url` or every family-specific media alias has canonical parity. No new alias schema or full-page precedence change was introduced. Actual image quality and live database state remain outside this controlled regression acceptance.

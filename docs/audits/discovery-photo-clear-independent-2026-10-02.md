# Discovery photo clearing — independent acceptance, 2026-10-02

Accepted locally for the shared quick-look media decision correction. No production deployment, current source-photo quality or all-family media alias claim.

Reviewed runtime hashes:

- `assets/discovery/profile-preview.mjs`: `aa596c34b4ce9a04125077d9d397d7ab62342c0d64500c9552cd3aba6f510e36`
- `explore/index.html`: `130dfbf2463213a3a43cf5a8c2c2c1cb6bcac07978e67c9c0a9a459f4402c64b`
- Specialist browser harness reviewed and independently run: `34dbac70296de13237c5909aec059411ad0171b0998ddfbf2bc436be448834f4`

The retained `home_entity` definition in migration `20260930090501_canonical_home_identity_index.sql` explicitly projects nullable base `photo_url`. Thus a base null alone is not an owner clear. The candidate preserves identity-matched source fallback in that case. Explicit owner/profile photo and supported hero clears stop fallback. A gallery clear stops gallery fallback while leaving an independent source hero available. An authoritative empty decision resets the already-rendered search cover; genuinely absent media retains it while details are unavailable. Existing request-version checks prevent a held old clear from replacing a newly opened result.

Fresh independent execution passed 28 relevant units and all 48 controlled browser cases at 390/1440. Actual Explore card and quick-look controls navigate to actual restaurant/music full-page adapters; populated and sparse cases, invalid/clear/replacement decisions, nullable/omitted source-backed media and held-clear/reopen behavior pass. Full-page assertions inspect actual embedded adapter media payloads. The fixture substitutes deterministic image bytes, so this is media identity/clear and journey evidence rather than photographic or visual-art-direction acceptance.

Commands:

```sh
node --test tests/unit/quicklook-details.test.mjs tests/unit/phone-target.test.mjs tests/unit/professional-source.test.mjs tests/unit/explore-artwork.test.mjs tests/unit/explore-dialog-navigation.test.mjs
OUTPUT_DIR=/tmp/discovery-media-independent node tests/browser/discovery-media-consistency/audit.cjs
```

Independent report `/tmp/discovery-media-independent/findings.json` contains 48 passing records; log `/tmp/discovery-media-independent.log`. All remote RPC/media responses are controlled; no live source change, customer write or provider request. Only supported fields documented in the candidate are accepted; arbitrary `hero_image`, `portrait_url` and category-specific aliases are outside this change. Root owns dependency cache integration and production verification.

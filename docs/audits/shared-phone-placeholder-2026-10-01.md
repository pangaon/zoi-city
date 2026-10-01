# Shared phone placeholder correction

Frozen code candidate; no production data repair or worker deployment claimed.

The actual Stalactites map preview could recover machine phone 5555555555 when the top-level phone was null. Both shared display validation and dial-target validation accepted it. A single conservative validator now rejects repeated-digit strings of at least seven digits and the existing explicit example sequences. It does not reject a real number merely because an exchange contains 555. International, domestic, leading-zero and extension formats retain their previous behavior. Known malformed +0-prefixed numbers remain readable where previously permitted, but never gain a Call target. Owner explicit clears still prevent imported fallback.

Owned runtime files:
- supabase/functions/zoi-enrich/_phone.js (new shared pure helper)
- supabase/functions/zoi-enrich/index.ts (JSON-LD/tel extraction guard)
- assets/homes/phone.mjs (dial guard)
- assets/discovery/profile-preview.mjs (placeholder fall-through preserving explicit clears)
- assets/homes/templates/restaurant/model.mjs (same display/selection guard)
- assets/homes/source-contact.mjs (shared display guard)
- mobile/src/profile.ts (known-placeholder display suppression)
- scripts/enrichment/extractor.mjs (injected helper and capture fingerprint)

Owned verification files:
- tests/unit/phone-target.test.mjs
- tests/unit/enrichment-profile-extraction.test.mjs
- tests/unit/extractor-fingerprint.test.mjs
- tests/unit/enrichment-packaging.test.mjs
- tests/browser/phone-placeholder/verify.cjs

No map HTML or database files changed. Existing map-preview code consumes the shared helpers. Native profile normalizer is exercised directly; a device build or production native rollout is not claimed.

## Evidence

75 tests passed: node --test tests/unit/phone-target.test.mjs tests/unit/enrichment-profile-extraction.test.mjs tests/unit/extractor-fingerprint.test.mjs tests/unit/enrichment-packaging.test.mjs tests/unit/enrichment-member-worker.test.mjs tests/unit/profile-merge.test.mjs tests/unit/music-generic-source.test.mjs tests/unit/hospitality-source-catalog.test.mjs tests/unit/church-generic.test.mjs tests/unit/church-source-scope.test.mjs tests/unit/home-metadata.test.mjs.

Mounted actual map-preview module at 390 and 1440 pixels: fake machine fallback produces no Call link; real +61 3 9663 3316 produces tel:+61396633316. Save-on-device action still works in all six isolated scenarios, no page errors. Command: node tests/browser/phone-placeholder/verify.cjs. This exercises current source modules with controlled entity responses, not production data.

Original official Stalactites source retained at /workspaces/zoi-city/.recovery/geo-source-review-20261001/054dd95e-5253-4a86-9630-fe91c3f29c90.html, SHA256 96d7c36196e622fa0cb9176bc1793a61659f3fdfc0d352df544ba1efba84e87c, publishes Restaurant telephone +61396633316. Real-data correction requires a fresh snapshot after the independently applied geography change; no old snapshot is reused here. Public guard suppresses the invalid action without deleting stored values. Future worker extraction excludes the placeholder but does not silently bulk-rewrite prior machine values.

Worker deployment dependency adds _phone.js; packaging test verifies it is traced, and local extraction capture hash includes its bytes. Root controls deployment and reviewed data correction.

Review follow-up: nonauthoritative top-level placeholder falls through to the already source-scoped valid phone; explicit owner, owner.profile or raw profile phone presence (including null/empty) wins and never revives machine contact. Native typecheck passed using mobile/node_modules/.bin/tsc --noEmit from mobile. Mounted preview now includes this fallback scenario at both widths (six passes).


## Expanded final freeze

Root approved the same selection/display guard across hospitality, artist/professional person-data, generic event, parish, owner-home override and shared metadata. Their exact paths are included below. publicPhone centralizes authoritative presence; existing source scopes remain upstream. Eight family/authority cases supplement the mounted map journey. No arbitrary number cleanup or production data edits. Other unrelated contact quality (theme-vendor contacts, factual ownership of plausible numbers) is not solved by a placeholder guard.

- assets/homes/phone.mjs: `19de02905af33ff6f06832a9ee800279dd0156f169d350081fe760e3ed66a0ad`
- assets/homes/source-contact.mjs: `cc76c43454af610e7c9dd92b740528bc80f854da27cd91947f6666edab44369b`
- assets/discovery/profile-preview.mjs: `1111758cf78ab4ede0dfecfe2e27fda9505f7cc91c8320b1820cd8ee7a102607`
- assets/homes/templates/restaurant/model.mjs: `eebd6bb383b3c603e76e9e1a1a3d986452f9bb40acbde6a22ff47de6c8fb70a7`
- assets/homes/templates/hospitality/model.mjs: `fa61c6b016bf085495120542d7b8ea6489e55daf9f3750b378ccf3658064b420`
- assets/homes/person-data.mjs: `4c58495e582f0be4342b8c13d0cd0ad5db7a4baa771eedaef8cae3bcd46e1453`
- api/_generic-event-data.js: `0b2b2d20a4b859315c829924199f00c48220b93c96c493e63d44dd6ec6330d10`
- api/_church-home.js: `b4ce2ae1ba21491b58777b3c284a0acead47e98de2d9d8422b9cba4696b1acf0`
- api/_owner-home-content.js: `7c74eef4500f4c1bee54e0fbf5d26d89ae8955fa5fc8e712c6c4ac6e408874f6`
- api/_home-metadata.js: `2809718b37628f5185972c6d9fae41535271c5d1466d97251d1661b37881029e`
- mobile/src/profile.ts: `0fe8aaff4f1e4b29e00da253c84a8cf7ad9f8167fb5d86bce30542c87122e7f7`
- supabase/functions/zoi-enrich/_phone.js: `0c4f359572a280f33b104989a3ef9c5fec0bdbc4f501a3ee8c42ce9f1c693c3b`
- supabase/functions/zoi-enrich/index.ts: `8e60de28d8b940ec24f45b7b6e2c4d096bd90362db1a1e4c9f03b2d49510d6e7`
- scripts/enrichment/extractor.mjs: `2cfe9947a91ec73cc19094fc6496531d63d9d1548cbc3cd524c4ad9ff355470e`

Root-review correction: valid email metadata no longer depends on phone validity. Regression verifies hello@official.example.org remains while placeholder telephone is omitted. Final focused suite: 75 passed. phone-target test SHA256 599b8808d536615330f18728e0cc116626f5d108cfa9ae968425c7ef9b004f8d.

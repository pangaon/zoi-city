# Shared public media release regressions

The first full staged release check failed five groups. Its original log is retained unchanged in docs/audits/evidence/discovery-media-regression-repair-2026-10-03/first-full-stage-failure.log. Two were harness drift; two were actual media contracts. The remaining missing source fixture is supplied by the lead from the immutable before-source manifest, not fabricated.

## Corrections

- Extracted Explore runSearch tests now execute the actual normalizeListing source with the actual shared media module. Older network responses still cannot replace current results; failure retry assertions remain unchanged.
- Handler navigation tests inspect the actual early inline policy rather than an optional helper marker. Both generic and venue success require one auto policy, reduced-motion opt-out, early ordering and HTTP 200; HTTP 404/503 and redirect 301 remain excluded. Redirect destination/body are asserted. No navigation runtime edit.
- A populated current base photo takes precedence over a populated legacy raw profile hero, preventing its stale poster role from following the replacement. Owner/op selections and explicit profile hero/photo clears still win. Source mismatch/quarantine suppresses imported/base fallback as before. Explicit raw profile assets retain their established ownership semantics. No SQL or source attachment change.
- Quick look distinguishes absent photos from explicit clears. An omitted sparse photo is not authoritative; an actual image, explicit photo/hero/gallery field or projected photo field remains authoritative. This preserves the existing loaded cover on genuinely omitted detail data and replaces it for explicit clears.

## Evidence

Focused 29 tests passed, including unchanged pre-existing quicklook-details tests and new shared contract coverage across 12 sparse families. A clean copy of the lead's exact staged archive plus five owned overrides and exact retained source fixture passed 1721 tests: 1706 passed, 15 skipped, zero failures; standalone 17 page and 16 unit invariants passed. The mutable workspace full test had one unrelated collision scan failure in local .qa-image/.recovery fixtures; that failed log is preserved and not reinterpreted.

Controlled card/Quick look rerun: 18 cases passed, real remote original assets loaded naturally; API fixtures are the retained public source/API whitelist, not live schema acceptance. Separate settled canonical harness: eight Signature/Parkview cases passed at 390/1440 and normal/reduced motion, waiting for transition completion, fonts and original hero load. Signature desktop settled hero and Yamas phone Quick look were visually inspected. Initial missing FROZEN_ROOT harness invocation is preserved separately; corrected invocation is explicit. No runtime pageerror filtering.

## Reproduction and freeze

Reconstruct immutable base media packet docs/audits/evidence/discovery-public-media-candidate/manifest.json (SHA256 bd22a700b52b04d4eaa688f27fd42193ab86a6bae3d8a96e51351f533ecf00c9), then apply this supplement's five owned snapshots. Source/API fixture and every unchanged runtime import are already in that manifest; only the three media source/test files in its manifest differ. Two repaired harness files and the settled browser harness are added in this supplement. Root owns exact clean staged archive and release inclusion, so full stage acceptance is a separate log rather than claiming the base-only overlay contains all lead release changes.

Commands: node --test tests/unit/explore-geography-ui.test.mjs tests/unit/home-navigation.test.mjs tests/unit/quicklook-details.test.mjs tests/unit/public-listing-media.test.mjs; NODE_PATH=$PWD/node_modules QA_DISCOVERY_MEDIA_DIR=/tmp/repair-card node tests/browser/discovery-public-media/verify.cjs; FROZEN_ROOT=$PWD NODE_PATH=$PWD/node_modules QA_DISCOVERY_MEDIA_DIR=/tmp/repair-canonical node tests/browser/discovery-media-settled-independent/verify.cjs.

This supplement supersedes prior approval only for the five named files. Original frozen packet, SQL migration and prior failed captures remain unchanged. No production writes or deployment. Owner authenticated publish/transfer and actual deployed UI remain lead gates. The 171 source conflicts are not resolved by this repair; first source15 review holds blanket old-media reattachment pending individual visual/canary review. Cross-host 126 capture queue remains separate and paused.

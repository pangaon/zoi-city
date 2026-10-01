# Reviewed map Directions — independent acceptance

1 October 2026. Independent review of the shared map destination change. No production migration, coordinate mutation or customer action performed by this reviewer.

## Source and authority evidence

The first candidate trusted the shape of `profile._geo` metadata and current feed coordinates. That could incorrectly certify a later changed point. It was held and replaced before acceptance.

The frozen `public.geography_reviewed_point(uuid)` reader checks the private service-only review ledger: current whole-row fingerprint, non-reverted receipt, matching listing/request IDs and identical receipt/current coordinates and precision. Only published, clean, visible and unowned listings qualify. It returns just listing ID, request ID, latitude, longitude and precision. Source reports, reviewer identities and private ledger rows are not exposed. Any later source, identity, address, ownership or coordinate edit conservatively removes the proof until reviewed again.

The browser attaches that reader result separately to a fresh public entity, overwriting any similarly named imported field. The shared loader requires entity/feed/proof identity and coordinates to match, rejects conflicting/area/coarse points, and does not trust `_geo` hash shapes. A failed or missing proof retains the existing address fallback. A selection repaint clears its prior reviewed flag. No coordinates are written by this feature.

Independent execution: `node tests/database/public-reviewed-geography.integration.mjs` passed nine isolated PostgreSQL groups, including changed row/source/identity, hidden/moderated/owned rows, reverted/mismatched receipts and denied direct ledger access. `node --test tests/unit/map-precision.test.mjs tests/unit/map-preview.test.mjs` passed 31 tests.

## Rendered and exercised journey evidence

The browser fixture loads actual public AMARA map records and pins, intercepts only the candidate map HTML/modules and proof-reader response, and blocks mutation requests. Candidate evidence does not imply that the new RPC is already deployed.

Independent valid-proof run with the strengthened response/enrichment waits passed 390×900 and 1440×900 normal motion, plus 390×700 and 1440×700 reduced motion. Pin selection updates Directions to `34.7136232,33.1552567`. Missing-proof fallback passed the same four cases. Logs and JSON are `/tmp/map-directions-independent-valid-v2.*` and `/tmp/map-directions-independent-missing.*`. Phone screenshot was visually inspected: selected place, pin, sheet and Directions controls render legibly.

An initial valid-proof run passed the first phone case then timed out on desktop. The unchanged runtime passed the complete rerun. The original run has no sufficient response trace to attribute the timeout conclusively to a remote request; it is recorded as an unreproduced browser timeout, not silently counted as a pass.

## Frozen runtime hashes

- `supabase/migrations/20261001103000_public_reviewed_geography_point.sql`: `47f5197db4353be4a35480c308d70f124e3cc61f6da2cee54abf2c0fcccb13ff`
- `assets/map-data/loader.mjs`: `fc8d7242a95ccdabe607cd231ecb8280da898d2d087810e434666d40530f1b81`
- `assets/map-data/preview.mjs`: `cef6751872ee04e6a5bbfc7ece1d43993cd8eea9bf17e27715d2b73926c11448`
- `explore/map/index.html`: `365e7a5b058beb9a9c8d1d0422433bdef84e8016b913108bd495f4ff6af461b2`

## Scope limits

This proves candidate destination precedence for unchanged independently reviewed rows and conservative fallback; it does not certify every imported address or map pin. Full-row fingerprinting intentionally invalidates proof after unrelated row changes too. Existing address fallback can still contain incomplete imported addresses. The integrator must verify the actual deployed public reader and final Directions URL without a proof fixture after migration/release.

Final negative proof matrix: stale proof with a different latitude passed all four dimensions after waiting for the completed reader response and subsequent enrichment. Directions retained the imported address and never promoted the stale point. Evidence: `/tmp/map-directions-independent-stale.json` and `.log`. All twelve final candidate browser cases passed. Frozen candidate accepted for the narrow reviewed-destination change; production reader/release verification remains the integrator’s step.

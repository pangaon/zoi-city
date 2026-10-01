# Independent shared phone review — 2026-10-01

Initial bounded review; acceptance pending fallback correction below. Read-only review of the artist lane's six runtime files; no runtime edits or production data writes.

Independently reran the documented eight unit files: 52 passed. Independently ran `node tests/browser/phone-placeholder/verify.cjs`: actual map-preview module at 390/1440 suppresses the repeated-digit machine fallback, preserves the real international Call target and retains working Save-on-device action in all four cases, with no page errors. Fixture entity responses are controlled; this is exercised module behavior, not live data repair or visual acceptance of the entire map.

The shared helper rejects only repeated-digit sequences of seven or more digits and pre-existing explicit example sequences. Valid numbers containing a 555 exchange are retained; country inference is not introduced. Domestic leading zeros, international prefixes and extensions keep existing behavior. Existing malformed +0 source display behavior remains distinct from invalid dial behavior. Owner explicit clears do not recover machine contact fallback.

Web imports use the established public shared-helper path under supabase/functions/zoi-enrich; existing person/professional helpers already use that pattern. Native Metro explicitly watches this helper directory; the actual native normalizeProfile module is exercised in unit tests. A fresh native bundle/device rollout was not performed by this reviewer. Worker uses a relative import; packaging traversal includes the new helper. Local extractor injects that exact helper and includes its bytes in capture fingerprint. Root must package the new file and verify deployed module availability; worker production deployment remains separately controlled.

No claim that this validates telephone ownership, repairs all stored data, or rejects every conceivable placeholder. Additional root-requested case found: a nonempty top-level placeholder currently shadows a valid profile/native or trusted source/web fallback. Artist lane is correcting this while preserving explicit owner clears; rerun acceptance is pending.

Expanded14-file candidate independently ran74 tests and6 mounted scenarios. Root subsequently identified an unrelated metadata email condition accidentally coupled to placeholder phone; acceptance remains pending its correction. The reviewer confirmed that defect and requested the dedicated regression.

## Final corrected candidate

Accepted after the metadata correction. Independently reran all eleven documented files: 75 tests passed. The actual six mounted map-preview scenarios had already passed on unchanged preview/runtime bytes. Metadata diff now changes only telephone inclusion; valid email remains independent of missing/placeholder phone. Corrected metadata SHA256 `2809718b37628f5185972c6d9fae41535271c5d1466d97251d1661b37881029e`.

Reviewed semantic changes across the final fourteen runtime paths, including common publicPhone selection, generic event/venue/promoter, hospitality, person, parish, restaurant, native and owner overrides. Explicit owner, nested owner-profile and raw-profile presence remain authoritative; a nonauthoritative base placeholder can fall through only to the existing scoped source input. Metadata suppression does not establish factual telephone ownership. Production helper availability and actual native distribution remain release checks, not claimed here. Prior pending-acceptance notes above are resolved by this final candidate.

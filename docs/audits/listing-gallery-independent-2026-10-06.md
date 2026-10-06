# Independent shared gallery acceptance

Approved bounded candidate, before deployment. All12 frozen manifest hashes verified. Reviewer made no implementation changes.

Found and reported one blocker before freeze: unconditional pagehide disposal left gallery buttons dead after BFCache return. Producer corrected persisted-pagehide handling; the frozen shared regression reopens the gallery after simulated persisted lifecycle events. Ordinary unload and explicit disposal still remove it.

Independent executions:

-42 canonical renderer/client cases passed: restaurant, bakery, hotel, creator, artist, church and generic venue at390/1440, sparse and populated inputs, one-photo where supported. Creator populated fixtures both use its actual curated two-image collection; these are not single-image Creator cases.
-Two generic fallback/shared viewer cases passed: touch-event swipe, literal captions, attribution/source link, unsafe URL refusal, Escape focus return, BFCache-event reopening and cleanup.
-Eight owner-media/reviewed-artist regression tests passed, including authoritative owner clears and quarantined source defaults. Source models were not modified; this is not a new live owner-save acceptance.

Failed image reads followed by explicit retry succeed in controlled fixtures; sparse cases expose no invented photos. Keyboard arrows respect bounds, one-image navigation disables the unavailable direction, close returns focus, and dialog content does not overflow. Phone church and desktop artist captures were visually inspected: captions, credit/source and controls remain readable. Supplied source URLs are loaded unchanged, with contained natural dimensions; the helper does not fabricate high-resolution variants or improve low-resolution originals.

Source safety review: HTTP(S) only, no embedded credentials, no caption HTML interpretation, existing model/caller projections retained. This client presentation allowlist is not a server fetch/SSRF validator. It does not make arbitrary supplied images trustworthy. Existing owner/source identity checks remain upstream. No new data, provider calls, ownership changes or persistence were added.

Evidence: evidence/listing-gallery-independent-2026-10-06/report.json, verified-manifest.json and inspected screenshots. Commands: node tests/browser/listing-photo-gallery/verify.mjs; node tests/browser/listing-photo-gallery/shared.mjs; node --test tests/unit/public-owner-media.test.mjs tests/unit/music-reviewed-media.test.mjs. Image responses were explicitly controlled SVG fixtures. Actual remote-image availability, physical-device touch and native BFCache restoration remain unverified; no production capability claim follows from these tests. Lead owns entry-module cache invalidation/release. Production API incident remains unresolved.

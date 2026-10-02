# Kakosaios explicit publisher capture proposal — October 2

Not applied. Root owns source assignment, real enrichment lease/application and public readback.

## Shared confirmed gaps and bounded repair

Current source-HTML adapter hardcoded official_site and dropped source_kind/listen. Reviewed batch allowed neither field, so a correctly identified record-label artist page could lose publisher attribution. Actual Minos extraction also put six label-navigation images ahead of the real portrait; the default first4 cap excluded it.

Approved owned scripts `scripts/enrichment/source-html.mjs` and `reviewed-batch.mjs` now admit explicitly requested record_label/label_artist_profile for artist records only. Capture strips corporate contact/social/address/catalogue fields and only retains an exact HTTPS Spotify artist link. No label is automatically classified as an artist-owned site. An optional maximum4 publisher image selection must occur in the actual extracted fetched page; guessed URLs fail. The normal global image ordering is unchanged.

Reviewed batching additionally requires independent publisher-scope confirmation and exact listing/name/artist/source identity matching the real lease. Corporate contact fields are refused. Previous machine corporate/contact metadata requires separate review rather than silently reclassifying it. Existing artifact hash, prior-machine hash, approved image-byte hashes, source fingerprint and lease binding remain required. Prior unrelated machine evidence survives; protected top-level profile/base fields are outside this adapter's writes.

One bounded live definition read confirmed actual profile_strip is a rating/system-key denylist and preserves source_kind/listen. Actual enrich_apply validates published visibility, exact stored lease/source/fingerprint/expiry, strips incoming machine fields, retains top-level profile and updates only enrichment/coverage plus updated_at. No database code changed.

## Fresh source and actual capture

Fresh Minos page20060523bytes, SHA2a2034cdc6dbcf0b83e002aca0f98bc8cd770fee7d60ac2d3b817dda421afaa1. This differs from October1 HTML hash and requires amended independent review. Portrait20092587bytes hash559f50a1d7542d229c5d4e5d3578c49696784a774c5cd1be639a8d38dfc9a8e4 is unchanged; actual offline image decoder confirmed1000×1000. Candidate capture consumed these fresh retained response bytes, not fabricated HTML or image metadata.

`evidence/kakosaios/source-capture-proposal.json` retains actual source capture including the selected portrait and exact extracted Spotify artist ID. It deliberately uses `PROPOSAL_ONLY_NO_DATABASE_LEASE` because source assignment and a real source lease have not occurred. It is not an apply-ready batch. `full-enrichment-proposal.json` adds only the prior independently reviewed concise factual biography and lists remaining gates. Apple Music remains retained original evidence, not a newly advertised player integration. No future dates, residence, contacts, rates or badges supplied.

## Exercised evidence

28 source capture/review tests pass, including explicit publisher identity approval, wrong identity/type, corporate contacts, unsafe Spotify, stale prior metadata, guessed image refusal, and existing hotel source compatibility. Actual proposed public profile at390/1440 renders Record label artist page rather than Artist website, the source portrait and biography, opens the exact Spotify artist iframe and removes it on Close. Normal provider playback is not tested; the provider iframe endpoint is controlled. Browser report `/tmp/kakosaios-reviewed-profile/report.json`; source HTML/portrait `/tmp/kakosaios-official-source/`.

The expected-public entity fixture preserves the fresh original row's profile.bio, genre, commerce_notes and _geo. Source assignment alone remains insufficient and must not be called a completed profile. No production assignment, lease, enrichment or live customer action executed.

## Refreeze and atomic writer path

Artist gallery/portrait credit now reuses the label-source description only for source-derived publisher imagery. Explicit owner photos retain existing Provided by the owner credit; other source kinds retain existing wording.29 unit tests and both actual browser widths pass after this correction.

`ops/kakosaios-atomic-publisher-enrichment-proposal.sql` is the concrete intermediate-safe alternative to standalone assignment: strict latest full-row guard, assignment, genuine `public.enrich_sample_lease`, stored real task/fingerprint validation, existing `zoi.enrich_apply`, then protected-base/profile and publisher-field readback assertions in ONE transaction. No fake lease and no direct enrichment write. It ends ROLLBACK and requires an explicitly supplied actual independent-review actor. Atomic visibility prevents guests seeing the publisher URL temporarily labeled Artist website before source_kind arrives.

The actual profile_strip/enrich_apply definitions were read successfully. A subsequent bounded read of current sample-lease definition/proposed fingerprint timed out; no retry. Therefore the atomic proposal uses the retained sample-lease contract from20260930053625 and is not approved for live execution until current definition is confirmed. Its evidence uses a distinct atomic_reviewed_publisher_proposal receipt, not a falsely claimed source-HTML report fingerprint; the raw capture still honestly marks its missing database lease. Lead must independently review this guarded receipt path before use. The standalone website-only rollback is not sufficient after enrichment; any full atomic rollback must restore the retained profile only under exact post-apply whole-row equality and remain lead-reviewed.

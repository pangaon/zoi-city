# Rendered enrichment preservation — local candidate

Confirmed reproduction in `automaticRenderedPayload`: a successful partial capture replaced prior `photo_urls` and the whole `social` map. A prior photograph and Facebook URL disappeared when a newer page supplied only a different photograph and Instagram. This affects the shared rendered-source queue, not one listing.

Candidate merges new photograph URLs ahead of retained prior URLs with exact deduplication, and merges nonempty social channels while allowing newly extracted values to replace the matching channel. Empty/absent machine fields preserve existing values. Current source fingerprint and exact identity checks, owner-managed refusal and existing lease/apply mechanism remain unchanged.

Current worker contact semantics are respected: an `email_conflict` capture goes to preservation/review instead of filtering email:null and reviving an older address. An extracted email plus explicit email_conflict:null clears a stale conflict marker; absent email cannot. This queue does not independently choose between conflicting contacts.

39 focused tests pass across rendered-source, source-html and reviewed-source-html suites, including populated/partial/empty captures, input immutability, owner refusal, fingerprint mismatch, conflict refusal and resolved contact. No source fetches, listing writes or deployment were performed for this candidate. Independent review and integration belong to the release lead. Historical catalogue missing-image counts are triage hints, not proof of current renderer defects or completed audits.

## Stored public-image classification follow-up

A separate executable projection reproduction found that the actual reviewed `Logo+best+quality+no+words.jpg` and `Poppis_weblogos-03.png` filename forms could still become both hero and gallery photographs through `profileMedia`, despite the extraction-side correction. Existing stored machine records therefore needed a shared display correction as well.

`api/_profile-media.js` now recognizes these bounded logo tokens, including plus delimiters and web-logo filename forms. Genuine Poppis dining and LogoVillage terrace photo names remain eligible. Explicit owner-selected hero/gallery images remain authoritative, and owner null/empty clears remain effective. Source data is never mutated. Populated homes fall back to a genuine photograph; sparse logo-only homes show no invented photography while retaining the logo role.

41 focused public-media/restaurant/hospitality tests pass, including populated and sparse family projections and owner overrides/clears. This is local implementation evidence, not a new production deployment or browser acceptance claim. Candidate files: `api/_profile-media.js`, `tests/unit/image-context.test.mjs`.

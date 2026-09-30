# Shared social link authority repair

Status: candidate, not deployed. No production listing or owner data changed.

## Reproduced defect

The actual generic entity handler rendered an enriched YouTube button and JSON-LD sameAs after the public contract explicitly carried `owner_content.social_links={}`. Sparse control had neither. The editor independently merged `_enrich.social` into saved empty base social_links, reintroducing the removed link on reopen. Generic event/person models also omitted extracted `social` while reading only `social_links`.

Production `bizpage_get(uuid,uuid)` was inspected read-only: base social_links is always coalesced to `{}` and contains no authored marker. Existing `home_content_get` did not expose the marker either. Treating every empty base dictionary as an owner deletion would therefore suppress untouched source suggestions.

## Shared correction

`assets/homes/social-links.mjs` centralizes authority without fetching or trusting new source data. Explicit public owner dictionaries replace the full set; null/empty clears survive. Populated legacy profile/base fields preserve their established layering. Missing owner fields still permit validated source fallback. Callers retain URL validation and publisher/member/identity scope checks.

Consumers: generic public buttons and JSON-LD; vertical music mapping; generic event, parish, professional/person models; restaurant social model; generic and curated music; owner editor reopening. Music social fallback players clear, including downstream public widgets. Separately authored spotify_url/youtube_url/media remain independent.

Migration `20260930214309_owner_content_social_authority_snapshot.sql` adds the existing public owner-content projection to the authenticated snapshot, retaining current authorization and version calculation. `owner-entity.mjs` carries it into the editor. Release backend and frontend together; older backend cannot distinguish never-authored from cleared source suggestions.

## Evidence

- 69 targeted Node tests pass, including populated/sparse/explicit clear/replacement, public buttons and JSON-LD, source-identity rejection, music/widget fallback suppression and explicit Spotify preservation.
- 13 real PostgreSQL integration groups pass. Transaction rollback exercises actual save → public owner projection → reopened private snapshot; enriched source evidence remains stored. Existing tenant authorization, role revocation, version conflict, idempotence and simultaneous save tests pass unchanged.
- Exact production rollback fixture `ops/qa-owner-social-rollback.sql` passes against isolated PostgreSQL and creates no retained synthetic row/receipt. Not run in production by this specialist.
- Actual mounted bizpage.js in a local synthetic RPC fixture: source YouTube row → pointer Remove → pointer Save → reopen. One save carries an empty social dictionary; reopening shows no link. Mock browser transport is separate from real PostgreSQL evidence, not a claim of deployed full-stack acceptance.
- Inspected screenshots `/tmp/social-owner-clear390.png`, `/tmp/social-owner-clear1440.png`; 390px has no horizontal overflow. Browser closed.

## Limits

No third-party OAuth, posting, following, live feeds or music licensing is introduced. Source channels remain external handoffs. This fixes public/owner projection consistency, not enrichment coverage for all listings. Premium sparse-profile art direction remains separate. Independent review requested from journey_qa before release.

## Independent playlist finding resolved

The reviewer reproduced a curated artist's `video_playlist` clear being preserved as a marker but never assigned to the rendered model. The follow-up assigns explicit owner-profile or raw-profile playlist values before source fallback. Null, empty string and invalid array clear; a replacement URL replaces the reviewed playlist. A separately authored YouTube video and explicit playlist can coexist. Tests inspect both the model and actual music-home serialized rendering; 70 targeted tests now pass. Only `_owner-home-content.js` and `social-links.test.mjs` changed for this follow-up. Migration and production rollback fixture hashes remain unchanged. Independent re-review requested; still no deployment by this specialist.

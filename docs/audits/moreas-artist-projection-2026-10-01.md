# MOREAS artist source → projection → render

Read-only investigation by room_repair. Listing `01ef14b0-6c59-4171-93d5-8bbbb8c1151e`, canonical `association-moreas-paris`.

## Source and public evidence

Retained source `/tmp/moreas-source-body` is2284 bytes, SHA-256 `f641b72572a7b9b304ec1f54c7d2df4407e0cd2bd8043673100dba9b552a21b6`. The official HTML title names Groupe de Musique Grecque MORÉAS and its description identifies Greek music, performances, rebetiko and sirtaki. After decoding repair, public `home_entity` returns the full accented French description inside `profile._enrich.description`.

Public snapshot `/tmp/moreas-public-entity.json`:

- website `http://www.musique-grecque.com`
- source_url `http://www.musique-grecque.com/`, status `ok`
- owner_content `{}`; profile keys `gate`, `_enrich`, `_coverage`
- protected base English description unchanged
- source hero/logo/photo null, photo_urls empty
- no organization/member/source-scope quarantine flag in this enrichment object

Actual `https://www.zoi.city/artist/association-moreas-paris` SSR captured in `/tmp/moreas-render-current.html`: hydrated artist.website is empty; description and story use the base English sentence; portrait empty. Local musicHomeContent against that same public snapshot reproduces all three values.

## Causes and proposed ownership

1. `assets/homes/person-data.mjs` personURL allows HTTPS only and supplies artist.website from e.website. It strips this published HTTP website.
2. `api/_music-home.js` sameSource allows only HTTPS enrichment URL. The matching HTTP origin therefore cannot pass sourceBound, despite no quarantine flag.
3. `assets/homes/templates/music/render.mjs` generic link helper accepts HTTPS only, and `app.mjs` fallback website action also uses safeHttps. Merely changing the projection would still omit the official action.
4. Generic music story uses `d.description || q.description`. Existing base copy always wins, even if sourceBound were true. It is a shared precedence issue, not a missing French string in the API.

Proposed narrow artist-family repair ownership: api/_music-home.js plus dedicated official outbound-link normalization used in music model/render/app and tests. Keep media/embed URLs HTTPS-only, source identity/quarantine gates intact, exact host/path matching and credentials rejection. If accepting HTTP public sources, do so explicitly for official source identity/outbound navigation; do not silently convert to HTTPS or globally relax person/media URL policy.

Source description precedence should distinguish explicit owner/profile edits and clears from imported base copy. Preserve owner description/press and explicit empty values; only verified same-source machine content may enrich an unowned/default story. A matching host alone is not a new independent identity-review claim.

The current absence of portrait is supported by available public source fields. No photo should be fabricated to fill it. Any further page/frame image harvesting needs separate source/identity evidence.

No renderer, database or production mutation made for this investigation. Worker decoding repair alone does not fix these projection and rendered-action gaps.

## Candidate shared correction and acceptance (not deployed)
- Added `assets/homes/official-url.mjs` for credential-free HTTP/HTTPS outbound navigation only. Existing media/embed validators remain HTTPS-only. Shared person projection respects owner/nested/profile website values including explicit clears.
- Generic music source binding accepts matching HTTP/HTTPS official hosts and source paths; rejects credentials on either source, mismatched ports, hosts, scoped paths and existing quarantine flags. A matching enriched description now precedes imported base text unless a description was explicitly supplied/cleared by owner/profile; owner press still wins. Final description and story agree.
- Music server render and client missing-photo website action use the navigation validator, with HTTP retained as published rather than silently upgraded.
- 23 focused unit tests pass across new HTTP/source/owner-clear checks, generic music, canonical music, source attribution and shared person families. Four music layouts checked populated and sparse; artist/creator/professional shared projection checked.
- Actual retained public MOREAS snapshot rendered through candidate server plus local candidate assets in browser at 390 and 1440 widths. French biography and official link visible; link click opened exact HTTP destination (external destination controlled to avoid depending on third-party uptime). Owner description/website clear variant removes both source biography and outbound link. No horizontal overflow or page errors. Report `/tmp/music-official-source/report.json`; inspected `/tmp/music-official-source/390-source.png` and `1440-source.png`.
- Browser CLI was unavailable; retained Playwright fixture `tests/browser/music-official-source/verify.cjs` performs reproducible browser verification. This proves candidate rendered/navigation behavior, not deployment or a live third-party response. No photography exists in the source snapshot; no picture fabricated. Broader creator/professional renderers may still enforce their own HTTPS-only navigation and are not claimed fixed by this artist rendering change.

## Read-only family follow-through after freeze
- `assets/homes/templates/professional/render.mjs` already emits escaped `d.website` as Official website; generic professionals therefore receive the repaired HTTP URL from shared personData. Curated `professional/model.mjs` merges selected owner fields but omits website, so owner website edits/clears remain a separate correction.
- `assets/homes/templates/creator/render.mjs` does not render `x.website` at all, even when HTTPS; only separate contact/story/show/social URLs render. `api/_creator-home.js` projects website and emits it in schema, but an ordinary sparse creator lacks a visible official website action. Proposed visible official action should use officialURL, without changing safeLink for imagery/media.
- Curated music and creator return source defaults through ownerHomeContent, whose current override list also omits website. Generic path is fixed; curated owner website override needs shared helper work with focused regressions and explicit file ownership. Not silently marked complete.

## Family continuation (supersedes earlier open-path notes)
Creator contact section now exposes the existing official website through the navigation-only validator. Generic professional renderer already emitted this value. Shared ownerHomeContent and curated professional projection now honor top-level proven owner website edits, including null/empty/invalid clears. Nested/profile website is not a supported owner writer field: the current home_content_save p_profile whitelist rejects it; p_base website is supported. No claim is made that arbitrary profile.website is an authorized curated override.

Actual post-save state was also checked: p_base save updates entity.website, not only owner_content.website. If this proven edit no longer matches the curated source, music, creator and professional projections now use their generic family path rather than returning null or carrying old curated assets. Wrong-source records without that owner-write proof still fail existing identity guards. Focused tests exercise base+owner changes for all actual curated source identities, and sparse/public navigation across four designs. No source defaults silently resurrect a cleared site.

Controlled family browser journey at 390/1440 opens HTTP official destination in a new tab; no page errors/overflow. Creator390 and professional1440 screenshots inspected. Initial .example popup fixture used page routing, which cannot intercept a popup's first request; corrected to context routing in both family and MOREAS fixtures. Re-run MOREAS four cases passed with the external destination truly controlled. This was a verifier correction, not a runtime/provider bug.

Final continuation browser evidence: `POST_SAVE=1` runs actual curated identities with base website and owner_content website both changed; all six artist/creator/professional ×390/1440 outbound click cases pass. `POST_SAVE=1 CLEAR=1` all six clear cases pass. Reports `/tmp/person-official-post-save/report.json` and `/tmp/person-official-post-save-clear/report.json`. These are controlled projected-state fixtures, not a live authenticated owner save. Earlier artist browser attempt chose a collapsed footer link and waited for an unopened popup; fixture now selects the visible artist intro action. Runtime was unchanged for this verifier correction.

## Actual production projection prerequisite discovered (release hold)
Read-only production pg_get_functiondef confirmed public_owner_content omits website even though bizpage_save writes website and sets updated_by=suite-bizpage. home_entity delegates to seo_entity, which calls this projection. Therefore previous controlled base+owner fixtures modeled the needed contract, not the current deployed contract. Root notified to hold profile release.

Minimal migration `20261001153000_public_owner_website_projection.sql` adds only website within existing suite-bizpage gate. It guards exact observed production definition MD5 `d34e6bb9fa641480743f2ccc9a9419d0`, changes no ACL/security attributes and retains rooms/dining/venues/amenities/event_publicity fields. Any concurrent function change fails closed for renewed review. Retained definition `tests/database/fixtures/public-owner-content-before-website.sql`; actual ACL `{postgres=X/postgres}`. Isolated PostgreSQL verification passes five groups: exact single-field diff including unchanged hospitality data/security/ACL, null and empty/changed values, non-owner/absent rejection, private helper direct access denial, unexpected-definition rejection. No production migration applied by specialist.

# Squarespace official location extraction

Frozen candidate, independent review pending. No database writes, new provider calls, source approvals or coordinate applications.

## Actual source identity

AGORA listing `14adb70f-1ed2-4089-a1f2-4e69c1872ef8`, slug `agora-london`, official website `https://agora.london/` redirects to `https://www.agora.london/`. Guarded HTTP 200 source retained at `/workspaces/zoi-city/.recovery/geo-source-review-20261001/next-agora.html`, SHA256 `1cbb1c3a19c32582107184fb7d38e84059144da6bd556619ffddb5fe7f8acbaa`.

The website's specific Squarespace static context publishes website.location mapLat 51.505369 and mapLng -0.08999159999999999, AGORA, 2-4 Bedale Street, London, England, SE1 9AL, United Kingdom. Its separate LocalBusiness JSON-LD repeats that name and full postal address. Stored address is Bedale Street, Borough Market, London SE1 9AL, current coordinates 51.505594,-0.090347 with precision none. This address reconciliation remains subject to independent review; no production identity-review envelope was invented.

The fixture is a minimal source-derived configuration and schema excerpt, not the original document. Its synthetic review binds the fixture bytes and synthetic listing snapshot, and is not production approval.

## Bounded parser and evidence contract

Only one script with data-name static-context and the exact Static/window.Static initialization followed by Static.SQUARESPACE_CONTEXT JSON assignment is accepted. JSON.parse is used; no JavaScript evaluation. Only website.location mapLat/mapLng are read. Website authenticUrl, baseUrl and primaryDomain must bind to the listing's official domain/property path. Exact reviewed address components and exact listing name must match. A separate matching business/place JSON-LD name and string address corroborates the location. Comments and template/noscript blocks cannot provide this evidence.

The existing review-required envelope, snapshot and source-byte binding, official-source requirement, owner exclusion, finite coordinate check and conflicting-point refusal remain active. New candidate evidence_kind is `squarespace_website_location` and evidence_path is `Static.SQUARESPACE_CONTEXT.website.location`. Precision remains source_published. Root's guarded writer must explicitly review support for the new evidence kind before any future application; this parser does not authorize a write.

Sparse config, missing identity review, wrong domain/branch/name, absent corroborating schema, arbitrary JS suffix, duplicate static scripts, null coordinates, commented/template-only evidence and conflicting independently matching JSON-LD points are refused. Unsupported source formats remain gaps rather than guessed coordinates.

## Verification and frozen manifest

`node --test tests/unit/source-coordinates.test.mjs`: 18 passed.

- scripts/geography/source-coordinates.mjs: `64b631854d802640de24d0f58e2a2b0d5d273c4dae5b3349ddc4057e02c065d4`
- tests/unit/source-coordinates.test.mjs: `6650a4cbad87dcbb487ab01b3d1da479fbb8ff02395222fe8249914642b9286a`
- tests/fixtures/geography/agora-location.source.txt: `07d7c20675f4cee5ff6e4bc4170b26252bbf04ba119d8e6655b57e907ad58c2f`

Remaining: independent parser review; real AGORA address identity and locality/non-centroid review against fresh source and database snapshots; root-controlled guarded application if approved; public projection and map journey evidence. No site-wide coordinate completeness is claimed.

Full retained AGORA document also exercised through the parser using an isolated synthetic listing/reviewer and its exact final URL/raw hash: result coordinate_plausibility_review_required / squarespace_website_location / zero writes. This confirms the fixture grammar matches actual retained source; it is still only extraction mechanics, not an approval of the real database row.

Independent review follow-up: the shared JSON-LD loop also strips commented, template, noscript and style blocks. Inert schema neither supplies a pin nor introduces a false conflict. Candidate re-frozen at the hashes above.

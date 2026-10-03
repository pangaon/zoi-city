# Independent named-place geography full-flow review · 2026-10-02

Accepted the frozen implementation as a controlled local pipeline candidate. This does **not** approve production migration/application or any real Olympia coordinate. Fresh installed writer/security/ACL preflight and current real listing ownership/source/address snapshot remain missing gates.

## Evidence/identity review

The collector selects a same-publisher contact page only through an explicit identity review bound to listing/snapshot/source URL/hash and address. Exact fetched decoded source bytes, snapshot, identity and report are retained. The new extractor requires one exact reviewed details card with matching heading/address and a unique Driving Directions shortlink; parking/nearby context is rejected. The retained offline capture binds one permitted redirect, exact terminal URL/status/body hash, place ID/name and explicit destination coordinates. Camera coordinates are not accepted as the destination. Independent review then binds source/identity/card/capture hashes, URLs/place ID and the same locality extent.

This is privileged reviewed evidence, not automatic proof that Google certifies a surveyed entrance. Capture/name substring checks do not replace the independent identity review. The generic implementation contains no Olympia exemption.

## Security and database review

The fetcher remains the bounded existing source session: HTTPS without credentials/nondefault ports/private host literals, public DNS validation and pinned connection address, same-host redirects and request/byte/deadline bounds. Shortlink capture is consumed offline; the database never fetches arbitrary URLs. Independently exercised no-network URL/IP refusal and cross-host/private redirect refusal in addition to the focused adversarial suites.

The new writer branch retains request advisory lock, current listing row lock, unowned/public eligibility, whole-row fingerprint CAS, immutable payload/receipt replay, changed-row refusal and exact revert behavior. New named-place evidence requires matching independent bindings, canonical source paths, parsed Google place name/ID/destination and bounded locality. Prior evidence kinds retain their property-path gate. Decoder is private; existing writer ACL is preserved by replacement, not expanded. Anonymous/authenticated write and ledger access remain denied in isolated PostgreSQL.

Migration has5s lock/30s statement limits and refuses a writer prosrc other than retained hash40584122364ab00beddaf6e458cd190d49e00d8a13c38b0560ad9ffbeb212765. A retained hash guard is not fresh installed-definition or ACL verification; no live DDL was attempted.

## Fresh independent execution

-36 focused unit tests passed: source-shortlink, original coordinates, reviewed request and audit retention. Log `/tmp/named-place-units-independent.log`. Wrong hosts/URLs/name/place ID/point, capture bytes/status, ambiguous/parking cards, identity/owner changes, locality and review binding are rejected.
-9 isolated PostgreSQL groups passed with the real extractor→request→writer→anonymous receipt-backed point reader. Includes guarded replacement, unrelated-field preservation, idempotent/concurrent replay, changed-row proof invalidation, exact return to null/unmapped coordinates, owner transfer and private ACLs. Log `/tmp/named-place-pg-independent.log`; projection `/tmp/named-place-projection-independent.json`.
-4 actual repository map journeys passed390/1440 using that isolated projection: reviewed street pin→preview→numeric Directions and canonical listing link; sparse record retains zero pins and address Directions. `/tmp/named-place-browser-independent/{report.json,*png}`. Phone reviewed screenshot visually inspected. No page errors captured. Public map tiles may load, but every data RPC is controlled; no production listing/read/write acceptance is inferred.

## Frozen hashes

```text
3114ad8fdda17df7dfedda9b94f74d29270d60228d3b0c2dcddb9bf0075fd11a  scripts/geography/source-coordinates.mjs
775ab45e92e81d05fdee00b12be5669fa7b51d88d4c9ffbf1b02a7be563c6928  scripts/geography/source-coordinate-audit.mjs
5dba122e20c7d081b676bcba893aa3ee920da5c8c4423f176aa644e93cdf5132  scripts/geography/reviewed-coordinate-request.mjs
c28836055c0e300298f561ee43ff8bd9d4179301800ad045a81b1d89b9ddcfd3  supabase/migrations/20261002152932_reviewed_named_place_shortlink.sql
```

No source/runtime edits, stage, deployment or live database mutations by the reviewer. Lead retains exact production preflight, any future separately reviewed record apply, readback and live map acceptance.

# Reviewed named-place shortlink — full controlled flow candidate

The earlier extractor-only freeze is superseded by this candidate. Runtime files are limited to the geography extractor, its source collector and reviewed request adapter, plus a new local migration. Publisher enrichment files and public map runtime are unchanged. No production write, DDL, project probe/retry or configuration change occurred.

## What the complete path now does

1. A frozen eligible unowned listing snapshot and explicit same-publisher contact-page review select a source URL. The collector fetches that exact reviewed page using the existing bounded source session and retains decoded bytes/report/snapshot/review hashes. Unreviewed source paths keep the existing website fetch.
2. The extractor accepts one exact details-card byte range from the official source: reviewed property heading and postal address, one Driving Directions link, no parking/nearby context. It requires a retained single-hop HTTPS Google shortlink→named-place capture, status200 and exact body hash with matching name/place ID, and the explicit place destination coordinate pair. Camera-only coordinates cannot satisfy it. Other Google formats are intentionally unsupported.
3. A distinct independent review must match source, identity-review, card and capture hashes, URL, place ID, explicit publisher scope and the same independently sourced locality extent. The request adapter verifies those bindings and preserves the existing exact report bytes/database snapshot/review freshness contract.
4. The new server migration retains the existing writer lock, owner/public eligibility, source fingerprint, whole-row CAS, immutable receipt, replay and rollback behavior. It adds only the named-place evidence branch and a private URL-component decoder. The server independently checks the same review bindings, host and canonical source paths, parses the named destination URL, and compares its name/place ID/coordinates to the current listing and report. Parent-page scope alone never bypasses identity review. Existing evidence types keep their path gate.
5. The unchanged public reader exposes a point only while the applied row still exactly matches the private immutable receipt. The actual map consumes that isolated public output; sparse records remain unmapped.

Retained bytes/hash approval is evidence supplied by the privileged review pipeline, not a cryptographic assertion that Google certifies the hotel entrance. Capture hashes and approved source hashes stay independently reviewed. The server does not download arbitrary URLs. Unsupported redirect chains, formats, ambiguous branches and missing source evidence stay rejected.

## SQL release boundary

Migration `20261002152932_reviewed_named_place_shortlink.sql` was created with the Supabase CLI. It has5s lock/30s statement limits and checks the retained original writer's `prosrc` SHA256 `40584122364ab00beddaf6e458cd190d49e00d8a13c38b0560ad9ffbeb212765` before replacement. This is a retained-source definition guard, **not a fresh production readback**. Fresh installed definition/security/ACL preflight remains pending while management access is unreliable. The migration is not applied and must not be blindly replayed. Existing function ACL is preserved by CREATE OR REPLACE; the new decoder is private.

## Evidence

-36 focused unit tests pass across source-shortlink, original source extraction, reviewed request and evidence-retention suites. Positive independent review and controlled collector are exercised alongside owner/source changes, sparse identity, parking/branch/card ambiguity, consent/body/hash failure, wrong hosts/names/place IDs, query injection and locality rejection.
-Isolated PostgreSQL executes source→request→writer→anonymous public reader with explicit name/URL/point and source/card/capture/locality rejection. It verifies field preservation, idempotent and concurrent replay, changed-row proof invalidation, exact reversal to null coordinates, owner-transfer refusal, private ledger/decoder and migration definition guard.
-Actual repository map browser at390 and1440 passes four controlled journeys: receipt-backed street pin/preview/Directions and canonical home link, plus sparse unpositioned detail with zero pins. Phone reviewed and desktop sparse screenshots were visually inspected. Report/screenshots are in `/tmp/named-place-geography-browser`; database projection is `/tmp/named-place-geography-projection.json`. Provider navigation URL is checked, not a claimed navigation session or accurate surveyed entrance.

Commands are in `tests/browser/named-place-geography/README.md`. No real row is changed by these tests.

## Olympia remains a proposal

Independent NSW Paddington polygon evidence and official hotel contact card are retained in `olympia-locality-followthrough-2026-10-02.md`. The official point is inside the actual polygon. The real current row UUID remains known from retained inventory, but its current owner/source/address fingerprint is not verified after the failed read. Therefore no real Olympia extraction approval, assignment, coordinate apply or production pin journey is claimed. The generic implementation contains no hardcoded Olympia exception. Lead and independent review acceptance are required before release/apply consideration.

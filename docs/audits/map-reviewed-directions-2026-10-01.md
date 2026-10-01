# Reviewed map destination — candidate 2026-10-01

## Observed production behavior

After the guarded AMARA correction, the original pin-visibility run timed out (`/tmp/amara-map-production.log`). A fresh traced phone run and then all four original dimensions succeeded (`/tmp/amara-map-investigation.log`, `/tmp/amara-map-repeat-matrix.log`). The original timeout was not reproduced; no causal claim is made.

A separate exercised defect was confirmed: the public map showed the corrected AMARA street point, but Directions preferred its incomplete imported address, sending `Amathountos, Limassol, Limassol, Cyprus`. Source address is preserved; corrected directions should use the independently reviewed destination 34.7136232,33.1552567.

## Candidate correction

`geography_reviewed_point(uuid)` exposes only listing/request IDs, coordinates and precision from a current public, clean, unowned record that exactly matches a non-reverted private review receipt and its full-row fingerprint. Hidden, moderated, owned, edited and reverted rows return null. Reports and private ledger remain inaccessible. Any unrelated edit also conservatively invalidates this certification until reviewed again.

Map preview loads fresh details and this public proof, clearing prior certification before loading. It accepts only proof matching the fresh entity and map point. Editable `_geo` fields alone cannot certify coordinates. Missing, failed, stale or mismatched proof retains the existing address/name fallback. An initial list row can retain the address fallback until its detailed preview retrieves proof; this change does not bulk-certify the entire feed.

## Evidence

- Isolated PostgreSQL: `node tests/database/public-reviewed-geography.integration.mjs` — nine groups passed. Current receipt permitted; coordinates, identity, address, source, owner, publication, moderation, hidden state, reversal and receipt mismatch rejected; direct private ledger access denied.
- Client: `node --test tests/unit/map-precision.test.mjs tests/unit/map-preview.test.mjs` — 31 tests passed, including feed and entity both moving while stale proof remains.
- Browser: `PROOF_FIXTURE=valid QA_REPORT=/tmp/amara-directions-receipt-fixture.json node tests/browser/map-reviewed-directions/verify.cjs` — four real public-map pin/preview journeys passed at 390/1440 widths and normal/reduced motion. Only the not-yet-deployed proof RPC was intercepted; this is candidate evidence, not production proof-reader acceptance.
- No production migration or deployment performed by this specialist. Independent acceptance and real public-reader journey remain release gates.

- Strengthened negative browser run: `PROOF_FIXTURE=stale QA_REPORT=/tmp/amara-directions-stale-complete.json node tests/browser/map-reviewed-directions/verify.cjs` passed all four dimensions after waiting for proof response and detail enrichment. Address fallback remained after stale proof arrived.

## Lead integration check

The reviewed public reader migration was applied successfully on 2026-10-01. Production readback returns AMARA’s unchanged reviewed point; anonymous execution is allowed and anonymous private-ledger SELECT is denied. Root repeated the nine database groups and 31 client tests successfully. Clean staged archive `8cbb4b6aca3cc97d3ae333b9447c9902c955ef71` passed `npm run verify:local` (262 node:test files plus two standalone suites).

The candidate client with the actual production proof endpoint passed earlier dimensions, then timed out waiting for the map pin. Evidence: `/tmp/map-reviewed-directions-real-reader.json` and `.log`. Client deployment is held while traced diagnosis investigates this now recurring intermittent failure. Supabase security advisor call returned a query read timeout; this is not a clean advisor result.

## Real reader diagnostics after parent deployed migration

The parent real-reader run passed 390×900 then timed out waiting for the 1440×900 pin (`/tmp/map-reviewed-directions-real-reader.log`). Directions had not run in the failed case. The original verifier did not retain failed-page state, so it cannot establish a cause.

Added verifier-only failed-page capture: all request statuses/failures/pending requests, console errors, map load/style/source state, queried source features, pin rectangles, page text and screenshot. A fresh actual-reader four-case matrix passed (`/tmp/map-reviewed-directions-trace.json`). Four bounded 1440×900 diagnostic trials also passed (`/tmp/map-reviewed-directions-desktop-trace.json`), each with 16 directory page requests and no HTTP failures. Directory request-header wall spans were 1899,1290,1298,1401ms; document-start to last directory response headers was 2181,1552,1542,1628ms. Largest observed single response-header delay was 5767ms for explore_search in trial4, after directory responses; home_entity2436ms/reader2499ms were later detail calls (see raw exact timings).

These response-header measurements do not establish full body completion; instrumentation was subsequently strengthened to retain requests until requestfinished and distinguish headersMs from full ms for the next gate. No additional unbounded reruns or production/runtime changes were made. The intermittent pin timeout remains unexplained; successful diagnostics do not erase earlier failures or prove reliability.

## Release decision

Proceed with the independently accepted destination correction after the actual-reader matrix and bounded traced desktop runs passed. This changes destination proof and link selection, not pin loading. The intermittent earlier pin failure remains an open reliability defect with improved diagnostic capture; this release does not claim to resolve it. Production client verification remains required after deployment.

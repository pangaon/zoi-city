# Independent host-allocation candidate review

2026-09-30. Reviewer: discovery_repair; implementation owned by prior production_recovery. No production writes, messaging or payments made. Review did not alter candidate SQL/UI.

Migration `20260930144328_event_host_table_allocations.sql` SHA256 `faa7c01a9f3ff641d961e239c1d3c4766cba0ab8678891912bc042b2a91295c0`.

## Executed evidence

- `node tests/database/event-host-allocations.integration.mjs`: all14 isolated PostgreSQL groups passed, actualexit0. Covers exclusive allocation vs timed holds,3/1/5 quota, exact retry, concurrent grant/guest/claim races, ownership/role fences, expiry, private receipts, hash-only capability persistence, request budget, rollbackfixture zero retained rows.
- Terminal release fix inspected: request receipt checked before `allocation_already_released`; exact old request can replay, a fresh request after terminal release is rejected before versionupdate/ledgerinsert. Final budget test exercises fresh terminal release rejection.
- `node --test tests/unit/host-allocation-client.test.mjs`:7passed. Storage refusal, lostresponse retaining nonce/payload without secrets, missingreceipt, malformedreceipt, late account response and uncertain retry covered.
- Local browser used synthetic adapter fixture with explicit390px viewport meta and actual candidate module. No real backend mutation. Organizer reviewed9-ticket allocation, simulated committedwrite/lostresponse, recovered receipt: exactly1write and pending cleared. Host created3-ticket guest, private fragmentlink appeared and rawtoken not in sessionStorage. Logout removed guest label/sharelink and showed signin. Remounted recipient route from claimlink: fragment immediately scrubbed; signedout→signedin kept pending capability; explicitaccept returned3tickets with unpaid/noadmission message and removedAccept. No horizontal overflow at390 or1440. Buttons measured46px atdesktop.
- Inspected screenshots `/workspaces/zoi-city/.recovery/logs/host-independent-390.png` (darkmobile organizer) and `host-independent-1440-light.png` (lightdesktop receipt). They prove responsive, readable controls; not the user's requested elite final polish.

## Release distinction

No newly found blocker to deploying this constrained private allocation kernel, after normal exact-tree CI/backend checks. It does NOT deliver the requested end-to-end paid booking or one-click email/SMS flow. Actual authenticated production UI/API roundtrip remains release acceptance work. Synthetic recipient fixture intentionally returns sampleallocations and is NOT privacy evidence; privacy assertions come from isolatedPostgreSQL tests.

Outstanding UX/product work:
- RawhostprofileUUID reference remains organizer setup input; guided verified hostselection not implemented.
- Recipient cannot preview quantity/price/event before accepting capability; nocharge occurs, but this is not ready as customerpurchaseapproval.
- Host list lacks remainingquota/per-recipientpricedisplay and guest edit/delete/reallocation tools beyond unclaimedlinkrotation.
- Payment methods/deposit/doorpolicies, transactional email/SMS delivery, contactbinding, admissionissuance and bottleordering remain unimplemented.
- Contract 'Still missing' incorrectly includes routeadapters already implemented; update before externally describing capability.

Candidate file list remains `/workspaces/zoi-city/.recovery/logs/host-checkpoint.json`; no checkpointedfilehash changed by this review. Private `.qa-image/host-independent-review.html` is a syntheticfixture; do not deploy it.

## Follow-up implementation at lead request

The same reviewer was explicitly assigned ownership of the pending SQL/UI candidate after the initial review. Therefore this section is implementation evidence and requires a separate reviewer before release.

Added authenticated read-only `event_host_claim_preview`; finalmigration SHA256 `ab52b97a42a8b2b2e303450177d6c4be33d250668d9b1e8e603c868fa3dce578`. All15isolatedPGgroups pass; additionalgroup proves correctquantity/price, no guest row or requestledger mutation, anonymous denial, wrongtoken denial, otherclaimant denial, acceptedself read and releasedallocation denial. ClaimUI validates preview and requires it before Accept. Screenshot `host-claim-preview-390.png` inspected: event, booth,3tickets CAD825total/CAD275each, expiry, exactacceptlabel and honestunpaid/noadmission copy readable, nooverflow.

HostUI now displays per-recipientprices and remainingquota; explicit editguest uses sameID/version and rotates onlyunclaimedlink with disclosure. Actual local syntheticUI verified3→5ticketedit sameguestID expectedversion1/newtoken, resulting5assigned/4remaining. No revocation RPC exists; noRemove action invented. Copyhostreference and selfhost selection reduce UUIDtyping, while verified searchablehostdirectory remains open.

10client/UI-modeltests pass (7prior plus3quantity/price/previewtests). Contract updated. Existing SQL concurrency and backendeligibility are preserved. Settlement, transmission/contactbinding, admission and organizer-specific pay-at-door rules remain open. Candidate notdeployed.

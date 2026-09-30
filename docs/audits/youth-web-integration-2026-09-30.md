# Youth programme web integration review — 30 September 2026

Status: candidate reviewed locally; this report does not establish deployment or a production enrolment. No real child records, enrolments, emails or attendance writes were made during this review.

## Available flow

The existing adult membership module now also mounts the previously queued guardian and youth programme interface. Guardians can manage private child records, review published programme terms, submit consent and an enrolment request, and withdraw. Authorized organizers can create/edit programmes, manage explicit instructor access, link actual calendar classes, review applications and record attendance. The existing server controls remain authoritative; staff membership alone does not grant instructor access.

Read-only production metadata confirmed the eleven UI RPC signatures. Only `youth_catalog` allows anonymous access. The remaining family and operator functions require authentication. Youth backend deployment was independently reported in release 221c1c4, migration 20260930073344; no schema changes are included here.

## Privacy and interrupted requests

JWT-only sessions are supported; a stored account identifier that conflicts with the token subject fails closed. A same-account token refresh preserves the current form.

A shared scope guard immediately clears private DOM on the real `zoi:auth-change` event. It fences reads and writes against the original account/workspace, rejects late responses and clears UI after authorization denial. Workspace mutations are checked before every request as well as during periodic scope checks. Replacing a module on the same root disposes the previous guard.

Before each youth write, local storage records only the request nonce, operation, actor, workspace, listing/program identifiers and timestamp. It stores no child name, guardian contact or submission payload. The exact retry payload exists only in memory. An unresolved marker blocks further writes; reviewing saved records does not remove it. There is no Discard action that could authorize a duplicate submission.

A validated receipt clears its matching marker. A recognized definitive server refusal can clear it only on the first attempt. A refusal during a retry cannot establish whether an earlier ambiguous attempt committed and therefore preserves the marker. Network failures, unknown errors and payload conflicts remain unresolved.

After reloading an unresolved request, the UI offers review and organizer/support guidance, not a reconstructed submission or a new nonce. This is deliberately conservative: the deployed backend has no general nonce-recovery reader for all youth mutations. Account/workspace scopes remain isolated.

## Verification

- Eight deterministic scope/pending-state tests passed, including immediate account changes, late responses, pre-write workspace changes, storage failure, marker privacy and retry-refusal preservation.
- Seventeen actual local PostgreSQL integration checks passed: guardian isolation, instructor revocation including historical retry, capacity, policy renewal, listing visibility, ownership transfer and rollback fixtures. These are database tests, not production browser acceptance.
- Explicitly mocked local browser fixtures exercised real UI handlers: interrupted child creation, blocked review state, identical-nonce retry producing one record, and guardian consent producing one pending enrolment.
- Reloading an interrupted request retained the marker without child/contact data and exposed neither a blind retry nor Discard. Changing workspace before programme submission produced zero programme writes. Actual auth events removed both youth and adult private DOM.
- Local fixture layouts at 390 and 1440 pixels had no horizontal overflow. No real RPC mutations were sent.

Private fixture evidence is under `.recovery/logs/` and is excluded from source control. Browser fixtures use synthetic local data and must not be described as live end-to-end enrolment proof.

## Form hierarchy review

An eight-case isolated visual matrix covered guardian/operator, light/dark, and 390/1440 pixels with no horizontal overflow or sensitive pending-storage fields. The organizer originally showed a full creation form ahead of every roster. The candidate now opens that form only through Create or Edit. It focuses the title input, restores the opener on Cancel, and asks before discarding edited fields. Draft field values survive unrelated record refreshes; a confirmed programme save closes the form.

Actual synthetic browser interactions verified initial form absence, Create focus, declining Cancel preserving typed content, confirmed Cancel restoring focus, Edit loading the existing title, and Edit cancellation returning focus. A simulated failed programme submission made exactly one mocked call, disabled Cancel/Create, retained the nonce without programme text, and offered only the identical-request recovery path. The four operator theme/width captures were repeated after this change. These are local fixtures, not production writes.

## Release and remaining acceptance

Include `groups.mjs`, `youth.mjs` and `private-scope.mjs` together. The release owner must update the versioned group imports in the suite/public entry points so cached pages load the new modules. Preserve the existing youth model/core imports.

Before calling this journey production-accepted, exercise guardian and authorized organizer flows with appropriately approved private QA records, confirm current-role removal, and review actual device accessibility. This work does not add payments, external messages, child accounts, medical records or public child profiles. Native parity is assessed separately.

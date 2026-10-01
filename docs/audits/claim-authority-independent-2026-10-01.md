# Independent claim authority review — 2026-10-01

Accepted for parent-controlled integration; no production claims were created or resolved by this reviewer.

## Frozen scope

Migration `supabase/migrations/20261001160000_claim_authority_and_receipts.sql` SHA256 `18d52a0dbc36a57d938a37d2c8f0b9a38ed0c00cd265cc86f64aa0afbe078270`; test `tests/database/claim-authority.integration.mjs` SHA256 `cf2ce3689e0e6b3565cc605c4a3c8defddd616815a5600f0cbde0270b15c5cd6`.

The implementation preserves RPC signatures while requiring current confirmed, enabled Auth identities and active sessions; owner/admin membership; eligible public targets; serialized listing ownership; and scoped claim/listing/workspace/status receipts. Private authority epochs invalidate stale pending proof and settled ownership replays after transfer away/back. Automatic domain proof is conservative and exact; listing email or caller method is not sufficient proof.

Resolver authorization locks the actual `app_settings.admin_emails` authority row and current Auth/session, then rechecks after lock waits. Locked claim scope is rechecked. Current claimant identity, membership revision, workspace ownership epoch and source context are required for approval. Rejection remains possible for stale claims without granting ownership. The reader normalizes the old `pending` alias, returns explicit scope IDs, and requires the same current administrator authority. Direct client privileges remain denied according to the retained production catalog evidence; new private authority data is explicitly revoked and RLS enabled.

## Independent evidence

- Final isolated PostgreSQL run: all 19 groups passed, `/tmp/claim-authority-final-independent.log`. Includes competing approvals, concurrent same-workspace and cross-workspace submission, current email/role after waits, transfer ABA, disputed targets, changed locked claim scope, revoked administrator allowlist, queue alias and unauthorized access.
- Additional reviewer cases on the unchanged create/resolve core passed: changed listing source cannot inherit pending proof; expired claimant/admin sessions fail closed. `/tmp/claim-authority-independent-extra.log` and temporary harness `/tmp/claim-authority-independent-extra.mjs`.
- Early omissions concerning disputed target status and administrator source locking were corrected before this final freeze. Exact actual administrator helper was compared with the retained implementation contract rather than treating a test-only admin flag as production evidence.
- DDL is bounded by 5-second lock and 30-second statement timeouts. Unexpected duplicates fail the added unique indexes rather than being silently deleted.

## Administrator interface

`explore/app/index.html` SHA256 `b768208a1ba9a44fe72462948480d849c841e14cdbfc80196671e39325b68240` accepted. Independent run of `tests/browser/admin-claim-review/verify.cjs` passed at 390/1440, log `/tmp/admin-claim-independent.log`. It exercises the actual extracted `scrAdminClaims` function with actual page styles and controlled RPC replies: correct pending filter, exact receipt scope/status, wrong-receipt retry and account-switch private clearing during reads/writes. Source review confirms the real transport freezes the request token and turns failures into null. This is not full application navigation or a live administrator write.

Settled same-decision replay is status-idempotent, not a nonce-bound new-note receipt: it neither transfers ownership again nor saves a second administrator's changed note. UI should not describe retry as editing a settled note. The ordinary approve/reject status result is truthful.

## Release boundary

Pair the new scoped receipts/reader with the reviewed claim handoff and administrator UI. Production migration/readback, deployment and any authorized isolated canary belong to the parent. This review does not establish real customer claim completion or a comprehensive pending-claim tracking product.

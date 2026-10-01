# Workspace claim handoff — 2026-10-01

## Reproduced defect and change

The existing Business home claim CTA discarded the active workspace. Explore also removed workspace query intent while rewriting search filters; its claim success link discarded both workspace and listing. A user with multiple workspaces could therefore return to the wrong Business home after a claim.

The CTA now carries workspace intent, and Explore preserves it while rewriting search filters. It preselects only a single valid UUID present in the current user's owner/admin workspaces. Invalid, duplicate or unauthorized intent requires an explicit authorized selection. Membership and the same account token are checked again before submitting. The claim RPC remains authoritative; browser role checks are not a security boundary.

A successful receipt must identify the exact selected workspace and public listing plus a claim UUID. Settled ownership opens that exact editor; a pending review opens only its workspace and explicitly leaves editing locked. This UI requires the separately reviewed backend scoped-receipt migration; do not release it alone against the old unbound RPC response.

## Verification

`tests/browser/claim-workspace-handoff/verify.cjs` exercises the actual Explore HTML/RPC helper and real Business home module, with controlled RPC responses and all external traffic intercepted. Passed at 390 and 1440 pixels: active-workspace round trip; pending/settled destinations; viewer exclusion; duplicate intent; changed role before submit; account change during membership and claim responses; wrong-workspace receipt rejection. Existing `tests/browser/owner-listing-intent/verify.cjs` passed at both widths.

Phone screenshot `/tmp/zoi-claim-handoff-390.png` was inspected: selector, submit and dialog actions are readable and within the viewport. Desktop screenshot is `/tmp/zoi-claim-handoff-1440.png`.

No customer claims or ownership mutations were performed. This is exercised local browser evidence with controlled transport, not a production ownership proof.

## Remaining gaps and separate backend work

Logged-out claim currently opens `/social` without a durable return-to-claim flow. This patch does not expand authentication routing. Business home does not provide a full pending-claim tracking interface; copy no longer promises it.

`0017_fix_claim_entity.sql` authorizes any membership role, checks claims in separate reads before insert, reads email without checking confirmation, and has no public-visibility/current-owner guard before insertion. These are existing backend defects documented in `legacy-claim-security-review-2026-09-30.md`; the backend specialist is separately verifying current deployed code and preparing role/current-identity/race/ownership protections. This UI does not claim to resolve those database boundaries.

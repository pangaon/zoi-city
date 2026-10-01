# Creator interrupted-save recovery and host preview correction — 1 October 2026

Candidate, not yet deployed. Root owns integration; independent journey QA owns database/browser acceptance; discovery specialist owns host and native changes.

## Concrete failure and change

A new creator deliverable could commit while its response was lost. Its temporary UUID existed only in memory, so reopening and submitting again could create a second deliverable and linked Operations task. Draft and deliverable updates used version checks but had no exact receipt to resolve a lost committed response. See `creator-recovery-gap-2026-10-01.md` for the operation-by-operation audit.

The new actor-scoped receipt wrapper dispatches only the seven existing creator mutations. It reuses their authorization, business checks, immutable briefs and Operations writes. The receipt commits in the same transaction. Exact replay returns its minimal identifiers without repeating the underlying write. Changed arguments conflict. A status/cancel call takes the same transaction lock as execution: cancellation returns an already-saved receipt or records a tombstone that blocks delayed execution. It never reverses an existing saved change.

The private receipt table has RLS and no direct anonymous/authenticated table grants. Receipt reads recheck the original actor plus current operator role or original customer relationship. No brief text, contact, proof URL or response body is stored in the ledger. Only a digest binds the input. Browser recovery stores an opaque request UUID and action in actor/workspace-scoped session storage; full arguments remain in memory. Storage is read back before sending. Reload retains a recovery marker, not private drafts. Access loss drops private payloads while preserving recovery metadata.

Legacy direct RPCs remain for older deployed clients; they do not participate in the new receipt/cancellation mechanism. Updated clients must route every write through the wrapper. Clearing browser session storage deliberately loses its local recovery reference; this is not cross-device draft synchronization.

The host allocation correction preserves guest label/whole-ticket quantity and grant table/host/quota/expiry when returning from preview to editing. Drafts stay in memory and clear on account/access changes. It does not activate inventory or send invitations.

## Evidence

- Independent isolated PostgreSQL: all seven mutation types, exact replay, draft version/audit once, deliverable/task once, changed-input rejection, actor/anonymous/table boundaries, revoked operator, customer receipt, failed write without phantom receipt, and both controlled cancellation races. Twelve groups pass in `tests/database/creator-recovery.integration.mjs`.
- Actual browser creator modules at 390/1440 with controlled RPC: committed-but-lost deliverable response, reload with no private payload, receipt recovery, exact retry, missing receipt remains fenced, cancel, denial drops payload but retains marker, account clearing, successful controls re-enabled. `tests/browser/creator-recovery/verify.cjs`.
- Existing creator access/OTP generation harness passes both widths. Journal unit tests check privacy, actor/scope isolation, receipt validation, unavailable/corrupt/silently-failed storage.
- Actual host allocation controller at 390/1440: guest/grant Review → Back values persist, denied/account state clears, zero reservation/message writes. `tests/browser/host-allocation-drafts/verify.cjs`; ten existing host tests pass.
- Native: 196 tests, TypeScript and actual fixture Expo export pass. Mounted Expo-web390/1440 verifies lost save → reload → receipt recovery; nonce-only storage; no retry payload after reload; denial clears private editor while preserving recovery marker. Independent review caught and verified a fix for account change during storage readback. Physical devices remain untested.
- Exact staged release checks and production client parity/guest entry checks pending.

## Remaining scope

No physical iOS/Android distribution is claimed. No real campaign or customer message was sent by these tests. Event online settlement, admission/refunds, provider configuration, owner-authenticated production lifecycle, broad listing enrichment/GIS and the wider business platform remain separate open requirements.

## Backend prerequisite applied

The independently tested additive `creator_mutation_receipts` migration was applied once through Supabase MCP on 1 October. Production readback confirms RLS enabled, no direct authenticated table read, authenticated execute/status grants and no anonymous execute/status grants. A rolled-back unauthenticated guard probe rejected both mutation and cancellation; receipt count remained zero before client release. No customer data was created or changed by that check.

Security advisors report the intentional private RLS table without direct policies and authenticated security-definer RPC entry points. These are bounded gateways to existing private creator mutations, with empty search paths, explicit actor/current-role checks, fixed action dispatch and revoked direct table/helper access; they are not unrestricted table APIs. The isolated PostgreSQL suite exercises those boundaries. Existing project-wide advisor findings are not claimed resolved by this change. The browser/native release is still pending at this checkpoint.

# Creator durable recovery — independent review, 1 October 2026

## Database and web evidence

Independent `tests/database/creator-recovery.integration.mjs` passed 12 isolated PostgreSQL groups against the existing creator migration plus candidate `20261001004632_creator_mutation_receipts.sql`. Covers all seven mutation actions, exact nonce replay, draft/update version/audit preservation, no duplicate linked task, argument conflicts, actor/private-table/anonymous boundaries, revoked operator receipt/replay denial, customer receipts, missing/error outcomes and controlled concurrent cancellation in both orders. No production calls or deployment claimed.

Tracked mounted web tests `tests/browser/creator-recovery/verify.cjs` passed at390/1440 with actual studio/pending modules and controlled RPC responses. Commit/lost-response, remount nonce preservation without private payload, replacement-write fence, exact retry, receipt recovery, nonterminal missing, cancellation, denial and actor clearing were exercised. Existing `creator-access/verify.cjs` also passed both widths. Browser marker persistence now includes readback before dispatch.

## Native review and corrected finding

Reviewed `mobile/src/creatorRecovery.ts`, `CreatorStudio.tsx`, and `Auth.tsx`. All seven write actions dispatch through `creator_mutation_execute`; status/cancel use `creator_request_status`. Actor/workspace-scoped SecureStore/sessionStorage stores only actor, action and nonce; form payload remains in memory. A shared recovery object in the parent survives campaign navigation, while private payload is dropped on child exit/denial. Missing responses and failed clears retain the fence. Receipt matching checks nonce/action, UUID identities and known campaign/item when memory payload remains. No unsafe local pending-discard control remains in the new recovery path.

Found an async scope gap: send awaited persistent readback after its last scope assertion and could dispatch after an account/workspace change during that wait. Reported to owner, who added assertions after readback, before execute/status/retry, and after final clear verification. Independently reran `mobile/tests/creatorRecovery.test.mjs`: seven tests passed, including the new change-during-readback case proving zero dispatch and retained marker.

Native mounted Expo-web acceptance is still being finalized by the owning specialist at this audit's writing. This review does not certify a new app-store build or physical iOS/Android behaviour. SQL fixtures, web controlled responses and native pure tests are separate layers of evidence; no real customer mutation was performed.

## Integration boundaries

Legacy direct creator RPCs remain callable for compatibility and do not participate in wrapper cancellation/receipt bookkeeping. Updated web/native write paths must consistently use the wrapper. Submission receipts legitimately contain a null version because submissions have no version column. An unresolved timeout is not a confirmed failure; cancellation only clears after an exact server result. The migration and clients require a coordinated release.

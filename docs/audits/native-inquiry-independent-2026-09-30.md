# Native inquiry independent review

Reviewed `Inquiries.tsx`, `Auth.tsx`, `inquiryRecovery.ts`, `privateRequests.ts` and recovery tests after the original implementer froze the candidate. This is source and executable contract evidence; physical iOS/Android and mounted Expo browser acceptance were not performed.

## Accepted contract evidence

- Inquiry storage uses a distinct account-scoped namespace and actual SecureStore on native. Web inquiry storage access throws when sessionStorage is unavailable rather than silently doing nothing.
- Each new send saves nonce/kind/target/account before its RPC and reads that marker back. No message body is persisted by this workflow. Failed or silently dropped persistence prevents dispatch.
- Existing uncertain sends retain their exact in-memory payload and nonce for retry. Reload recovery requests the original actor-scoped receipt or safe cancellation. `found:false` is never interpreted as proof that nothing was sent.
- Recovery matches request UUID, operation kind and listing/thread target. Cancellation must match the nonce. Markers are only cleared after a confirmed matching result.
- Account/workspace keyed mounts and post-await current-account/alive checks protect late UI writes. A→B→A persistence tests preserve A's unresolved record. This does not constitute mounted lifecycle acceptance.
- Operator settings now distinguish ineligible ownership from an enabled contact channel, using the server eligibility field. No guessed recipient or event binding is introduced.

## Confirmed defect and bounded correction

A denied same-account inbox refresh left the previous private report and selected conversation mounted. A denied conversation refresh similarly retained its old detail. The reviewer was authorized to fix these catches in `Inquiries.tsx`: failures clear the affected protected view and transient notice, retaining the durable uncertain-send marker. Inbox Refresh stays available when data has been cleared so a transient failure can be retried. A failed operator conversation read also clears its parent inbox report/selection, preventing retained status/assignment outside the cleared child. No server permission or historical read policy changed.

Independent `npx tsc --noEmit` passed. All 182 mobile tests passed after the additional corruption regressions. The existing isolated PostgreSQL browser fixture mounts the separate web inquiry implementation; it was not reused to claim native acceptance. No existing mounted Expo fixture was found in this worktree.

## Corrupt-storage correction

An active private-store chunk whose JSON value is literal `null` currently becomes indistinguishable from absence at InquiryRecovery.load. Valid inquiry writes are objects, so this is a corrupt-storage fail-closed edge, not a normal saved state. Lead authorized the narrow shared-store correction: active parsed-null payload now throws without deleting its marker. Added executable regressions for both shared-store load and inquiry begin, proving an attempted replacement nonce is blocked and the corrupt recovery evidence remains. Typecheck and all 182 tests passed.

## Lead build verification

The final candidate independently passed all182 mobile tests and TypeScript checking. `npx expo export --platform web --output-dir /tmp/zoi-native-inquiry-web` exited0 and bundled467modules. This confirms bundling, not mounted private-flow behavior or physical iOS/Android distribution. Those remaining acceptance gaps are unchanged.

# Operations recovery independent acceptance — 2026-10-01

## Local database evidence

Independently ran `node tests/database/operations-recovery.integration.mjs`: **11 checks passed**, process exited zero and isolated fixture cleaned up. Covered committed response loss/replay, stable save/archive receipts, changed-payload nonce conflict, actor isolation and ledger permissions, revoked writer receipt refusal, cancellation tombstones, concurrent identical execution, cancellation/execution ordering, editor restrictions and no phantom receipt after invalid writes.

Reviewed `20261001010515_operations_mutation_receipts.sql` and the shared recovery helper. Receipts are minimal and actor/workspace scoped; current permissions are checked. Writes and cancellation serialize on the same nonce. Client persistence contains the recovery reference only, with asynchronous scope revalidation and readback before mutation.

## Actual mounted web UI, controlled transport

Independently ran `tests/browser/operations-recovery/verify.cjs` with Chromium 1234 against the real `assets/suite/operations.js` and `assets/operations/recovery.mjs`. **390px and 1440px passed**, no recorded page errors; browser and local server closed.

Exercised actual pointer/input controls:

- New company saves in the synthetic server, then the response is lost. Replacement saving becomes disabled.
- Session storage contains the nonce reference and no private company text.
- Remount retains the unresolved reference and removes the unavailable exact-retry option; checking the saved receipt opens the original company with one simulated write.
- A transient refresh failure preserves the unsaved form.
- An authoritative 403 clears the private list and editor. Restored authority can refresh the company again.
- A delayed read after logout cannot repaint the private company or inputs.

Source review also checked the shared helper's missing/cancelled receipt handling, exact in-memory retry, confirmed storage clearing, and pre/post account/workspace guards. These branches are not all mounted-browser assertions in the current harness.

## Disposition and limits

No blocker found in the reviewed web recovery and authorization paths. This combines isolated real-PostgreSQL evidence with a separate real-module browser fixture using controlled RPC responses; it is **not** an authenticated production end-to-end write. No production records, messages, sessions or payments were created. Native mounted acceptance and deployed production verification are separate work.

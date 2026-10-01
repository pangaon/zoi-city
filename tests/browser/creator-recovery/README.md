# Mounted creator recovery acceptance

Run `node tests/browser/creator-recovery/verify.cjs` from the repository root. Set `CHROMIUM_EXECUTABLE_PATH` to an existing Chromium binary if needed.

The ephemeral loopback fixture imports actual shared creator studio/pending modules. Synthetic read-only RPC responses simulate a saved new-deliverable result whose response is lost, an uncommitted missing result, receipt lookup and cancellation. No production credentials, writes, OTP or messages are used; external browser requests are blocked.

At 390/1440, assertions cover: durable nonce without private form payload; unresolved write fence; remount drops memory retry but preserves marker; receipt recovery opens the saved campaign with no second write; exact retry preserves the complete arguments/nonce; missing receipt remains unresolved; explicit cancellation clears the marker; permission denial drops payload but retains marker; actor change clears private content; successful recovery reenables write controls. Browser/server cleanup runs on failure too.

This is frontend controlled-response acceptance. Transactional cancellation, duplicate task prevention and current-role receipt authorization are independently exercised in `tests/database/creator-recovery.integration.mjs`. It does not claim backend deployment, real authentication or native-device parity.

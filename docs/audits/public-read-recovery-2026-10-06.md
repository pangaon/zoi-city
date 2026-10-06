# Public read recovery packet

Implemented in isolated guest-nav-20261006 off637d70a. Existing12 For Business navigation corrections remain separate exact href changes. This packet modifies four existing entry modules only at catalog/read errors or the signed-out planner view; four HTML entry imports are cache-versioned.

Shop catalog errors no longer expose JSON parser/provider internals. Retry uses the same search/pagination and preserves saved basket. Previously loaded items are identified as such. Product detail and checkout/write handlers are unchanged.

League public reads have a visitor-facing unavailable message and retry instead of transaction uncertainty copy. Existing season/fixture selection remains. The pre-existing lack of a rapid-season request epoch is outside this patch; no claim to have fixed it.

Properties initial/search reads use a separate unavailable/retry path retaining filters; the retry stops propagation so it cannot trigger the unrelated generic dirty-discard handler. Private mutation nonce/recovery, saved-refresh paths and models remain unchanged.

Planner now explicitly opens /social?signin=1 in a new tab and explains returning to the original plan. Continue reloads the existing same-origin location, retaining its plan query. No ignored returnTo parameter or external redirect was invented. Original inventory wording overstated a missing sign-in link: the old page did have an inline generic /social/ link, but lacked explicit sign-in intent and clear continuation.

Validation:24 existing focused unit tests passed;16 actual-page controlled browser cases passed at390/1440 light/dark. Slow503/HTML → keyboard retry → successful empty results; basket ID/quantity/prices and property filters retained; exact planner query retained; no private/mutation RPC accepted by fixture. No recorded page errors or horizontal overflow. Phone dark planner screenshot inspected. Driver tests/browser/public-read-recovery/verify.cjs, results/hash manifest in evidence/public-read-recovery-2026-10-06; screenshots /tmp/zoi-public-read-recovery.

These are local controlled-source and rendering/journey results. No real sign-in, send, purchase or production write occurred. Live provider/populated-record acceptance remains separate; current canonical profile503 incident was reported to lead.

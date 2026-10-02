# Shared search account-history repair — producer evidence

Root authorized reviewer-lane implementation ownership of `assets/zoi-search.js` and focused test/audit files. This report is producer evidence, **not independent acceptance**. Root owns second review, consumer cache updates and release.

## Reproduced customer defect

The actual site-wide palette persisted queries in unscoped `zoi_recent_searches`. At390/1440, account A searched and selected a listing; after switching to account B and reopening, A's query appeared under Recent. Baseline `/tmp/search-account-history-baseline.json`, screenshots and retained `tests/browser/search-account-history/baseline.cjs` demonstrate this without live API calls.

## Correction

History uses a UUID account namespace only when the stored session includes an access token and finite unexpired timestamp. JWT subject is used only as a consistency check against the stored UUID, never as authority or as a substitute account ID. Session ID, when present, detects session replacement; ordinary same-session token rotation preserves history. No display names, email addresses, opaque tokens or raw JWTs enter storage keys. This is local personalization and grants no server access.

The ambiguous legacy shared key is discarded rather than assigned to whichever account opens next. Signed-out/unresolved/mismatched sessions retain public search but do not persist history. Stored entries are bounded, typed and length-validated.

Account changes retire the open input, result/history DOM and queued response. Same-tab auth events, cross-tab storage (including clear), focus, input, result click, keyboard action and response handling reconcile the captured scope. Delayed responses cannot revive the old account's query/results. Existing account A history is available when A returns; account B never inherits it.

## Verification

- Corrected actual palette390/1440 isolation fixture passed: `node tests/browser/search-account-history/verify.cjs`; `/tmp/search-account-history-fixed.json` and `.log`.
- Existing full palette390/1440 clear/reopen/stale Enter/HTTP retry/empty/populated/sparse/timeout regression passed: `/tmp/search-palette-regression.log`.
- Eight search-hardening units passed: `/tmp/search-history-units.log`.
- Classic script syntax check passed.

Frozen runtime `assets/zoi-search.js`: `09886e3712f8ccf5e9320bb58ac1cf92820044fd253fcd64e4cc4b785fcabadf`.
Focused verifier: `4022ad7600639caef150ccdd137dced6a2a6e90d0db87557242a9463d7d87e6f`.

No production mutation, authentication send, provider query or customer data read occurred. Header consumers across the site need root's version-query integration before deployment; local tests do not establish deployed behavior.

# Core owner / creator / inbox acceptance — 1 October 2026

## Public production entrypoints

At 390 and 1440 pixels, `/business`, `/social/bizpage`, `/social#creator`, `/social#inbox`, `/inquiries/` and `/creator/` loaded their expected public landing or sign-in gate. No captured page errors or horizontal document overflow occurred. No OTP, account creation or message was sent. The same-document transition between workspace hashes correctly produced no new HTTP response; an initial test script assumed every navigation returned one, failed, and was corrected before the full pass. This was a harness error, not a route failure.

Customer enquiries explicitly disclose that external notifications are not sent. Creator shared-work UI distinguishes acknowledgment from legal signature/payment, and planned fees from collection. These observations support the current entry boundaries, not the complete creator monetisation/owner lifecycle in `docs/recovery-scope.json`.

## Highest-impact reproduced defect: creator private DOM survives account change

Actual deployed `/assets/creator/studio.mjs` was imported on the live `/creator/` page with a local synthetic read-only `C` fixture. The only returned campaign was labelled `SYNTHETIC PRIVATE CUSTOMER CAMPAIGN`; no real authentication or customer record was used. After mount, the fixture actor was set to null and `zoi:authchange`, `zoi:auth-change`, `storage` and `focus` events were dispatched. After 500ms the prior campaign remained visible at both widths.

This is reproducible presentation/privacy retention, not a demonstrated bypass of server read authorization. A person using the same open browser can still see the previous account's rendered campaign content after the actor changes.

Source: `assets/creator/studio.mjs` uses an unguarded `C.api.rpc` wrapper, does not capture/check actor identity before and after asynchronous reads, and returns no destroy handle. Its MutationObserver aborts event listeners only when its wrapper is removed. `assets/creator/customer.mjs` invokes load initially/after its own OTP verification but does not clear/reload on account changes. The existing workspace shell may clear operator content on navigation; that does not protect the standalone customer route.

Bounded repair recommendation: actor-bound mounted lifecycle shared across customer/operator studio; clear private list/detail/forms immediately on account/root/workspace loss and explicit authorization denial; reject late async results; return destroy handle; preserve unresolved mutation nonce rather than silently issuing a replacement. Add mounted signout/account-switch and delayed-response regressions. Coordinate uncertain-write behavior with existing creator request semantics before expanding changes.

Evidence: `/tmp/core-entry-audit.mjs` and `/tmp/core-entry-audit.json`; `/tmp/creator-scope-repro.mjs`, `/tmp/creator-scope-repro.json`, `/tmp/creator-scope-repro-{390,1440}.png`. The synthetic fixture was injected into the current browser page only; no production assets were modified. Browser closed.

## Acceptance limits

No authenticated production owner edit, business inbox send, creator campaign mutation or receipt was exercised. Previous isolated SQL lifecycle evidence remains separate. Pending inquiry operator revocation hardening is under independent review and must not be treated as fixing this distinct creator module automatically.

# BuyGreek unresolved-option sharing audit

## Proven production defect

On 30 September 2026, actual production `/shop/?product=all-over-print-gym-bag&variant=99999999999999` correctly presented an unselected replacement option and disabled Add, but enabled Share. With only the browser clipboard replaced by a local capture (no message sent), Share produced `https://www.zoi.city/shop/?product=all-over-print-gym-bag`. Opening that result silently selected variant `42633200271545` and enabled Add. The share journey therefore removed the unresolved choice that the earlier checkout repair deliberately preserved. Native already disables Share while unresolved; this was a remaining web parity defect.

Evidence: `.qa-image/commerce-share-audit.mjs`, `commerce-share-audit.json`, and `commerce-share-audit390.png`. Both product responses came from the real public commerce API. No checkout or purchase occurred.

## Bounded repair and exercised candidate

Only `assets/commerce/shop.mjs` changes: Share is disabled until a current option exists, an associated visible explanation tells the customer to choose an option, and delegated clicks guard against programmatic dispatch while unresolved. Selecting a valid option reenables Share and preserves its exact ID in the resulting URL. Known unavailable options may still be shared as their exact identity; they remain unavailable for Add.

Actual mounted production page with only the candidate shop module overridden, at390 and1440: unresolved Share disabled, explanation visible, programmatic click produces no clipboard output; deliberate selection reenables Share and yields the exact `variant=42633200271545` URL. Test assertions are in `.qa-image/commerce-share-candidate.mjs`; results in `commerce-share-candidate-results.json`. Eight existing commerce unit checks pass. No provider share sheet or message delivery claimed.

## Other commerce and reservation boundaries checked

`api/_commerce.js` rereads exact variant IDs and current availability/prices; the checkout receipt binds IDs, quantities and the allowlisted BuyGreek cart URL. Availability is not an inventory hold, and the UI explicitly says items are not reserved and final availability/tax/shipping come from BuyGreek. The adapter does not claim Zoi payment collection or cross-site order synchronization.

The existing `/tickets/hosts/` flow is separate: organizer-approved allocations, per-recipient whole-ticket counts, private claim links and host-approved payment preferences. Its renderer explicitly distinguishes an accepted allocation from issued admission tickets, and states payment collection/automatic invitation delivery are not configured. No live allocations, claims, payments or invitations were created during this audit. The concrete share bypass above was prioritized over those disclosed provider boundaries.

Candidate is not deployed by this specialist. Root owns release and subsequent production acceptance.

## Independent acceptance

QA specialist independently reran .qa-image/commerce-share-candidate.mjs against the actual public product API with only the candidate module overridden at390/1440. Unresolved Share stays disabled; programmatic click produces no copied link; deliberate selection enables Share and preserves exact variant42633200271545. No purchases, external checkout or messages. Browser closed. Candidate accepted for this bounded unresolved-option sharing correction; this is not production-deployment or commerce fulfillment certification.

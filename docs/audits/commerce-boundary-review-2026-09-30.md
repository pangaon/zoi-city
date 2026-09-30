# BuyGreek checkout review

The existing public Storefront integration re-reads variants before producing a fixed BuyGreek cart URL. It accepts at most 30 unique numeric variant IDs, quantities 1–20, and rejects missing, substituted or unavailable variants. No customer accounts, orders, payment capture or privileged provider credentials are exposed by this endpoint. A basket is not an inventory reservation; final stock, shipping, taxes and discounts are determined by BuyGreek.

Read-only production catalogue acceptance returned HTTP 200 with 12 products and another page available (approximately 516 ms). No production checkout, payment or order was submitted. No exploitable customer-data exposure was found in this bounded review; this is not a certification of the external checkout.

## Web review expiry

Price reviews now expire after two minutes, matching native. Returning to the page invalidates both an existing review and an in-flight review response. Cart changes and closing the cart also invalidate it. An expired checkout click is blocked, selections remain intact and “Check current prices” explicitly requests a fresh review. No foreground action automatically submits a cart or navigates to checkout. Changed prices are shown before the customer chooses to continue. Returning from BuyGreek never implies that payment or an order succeeded.

Six focused unit checks pass, covering existing API/cart boundaries and expiry, clock rollback, exact cart scope and no payment claim. A local browser fixture exercised changed prices, expired-link prevention, explicit refresh, foreground invalidation without another request, and rejection of a delayed old response. At 390 px the document remains 390 px wide; screenshots at 390/1440 are stored in the private QA logs. The fixture uses intercepted responses and does not establish an actual external payment outcome.

Files: assets/commerce/shop.mjs, assets/commerce/review.mjs, tests/unit/commerce-review.test.mjs. Bump the shop entry's module version when releasing.

Deferred capabilities remain explicit: no Zoi payment capture, order-status synchronization, seller onboarding, split payments or multi-seller marketplace is implemented by this integration.

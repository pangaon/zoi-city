# BuyGreek live boundary check

30 September 2026; bounded read-only follow-up to `commerce-boundary-review-2026-09-30.md`.

## Actual production checks

- `https://www.zoi.city/shop/` loaded 12 actual products, CAD prices, unavailable labels and pagination. At 390 px no horizontal overflow or browser errors.
- Unavailable adidas backpack: its actual option is labelled unavailable and Add to basket is disabled. Shipping restrictions remain visible in the returned description.
- Available All-over print gym bag: actual image, one variant and price loaded in a 358 px-wide mobile dialog. Product/delivery link explicitly points to BuyGreek.
- `https://buygreek.shop/products/all-over-print-gym-bag` and store homepage returned HTTP 200. `/account` redirected to BuyGreek's own `/account/login?return_url=%2Faccount`, then HTTP 200. This is not Zoi single sign-on; no account credentials or customer records were accessed.
- At 1440 px the empty basket opens correctly and makes no order/payment assertion. No items were added and no checkout/cart permalink was followed.
- Screenshots: workspace `.recovery/logs/commerce-live-detail-390.png` and `commerce-live-basket-1440.png`.

## Source and deterministic verification

Six commerce/review tests pass. Current source still requires explicit variant/quantity validation, a fresh server variant read, exact fixed BuyGreek cart URL, separate currency totals and a two-minute review expiry. Return/focus invalidates a prior review; it never claims an order succeeded. These safeguards were inspected and unit-tested; checkout itself was not executed in this pass.

No newly proven blocking frontend issue was found in this limited journey, so no product code was changed. The catalog and product links work; this does not establish completed orders, payment capture, refunds, external account recovery or global delivery coverage. Zoi still has no order-status synchronization, seller onboarding, split payments or multi-seller marketplace implementation through this integration. The prior audit's simulated checkout tests remain fixture evidence, not actual purchases.

## Independent follow-up and changed-price correction

Independently exercised production on30 September: opened the actual All-over print gym bag, added one variant to this browser's local basket, and explicitly requested a price review. The endpoint re-read the public variant and returned CAD69.99 with the exact handoff `https://buygreek.shop/cart/42633200271545:1`. The cart link was not followed. No external cart, order, payment, customer account or outbound message was created. Browser focus invalidated the prior review without requesting another one. This is stronger evidence for the read-only price review, not completed checkout.

Reproduced a real presentation defect by simulating stale local basket price CAD1.00 in this isolated browser: the actual server review returned CAD69.99 and the lower receipt correctly announced changed pricing, but the original basket row and estimated total still displayed CAD1.00. Screenshot `.recovery/logs/commerce-stale-price-reproduced.png`. Cleared this test browser's basket afterwards.

Candidate fix refreshes existing basket price labels and per-currency totals immediately after receipt validation; quantities, variant IDs, controls, review expiry and explicit checkout handoff remain intact. Changed pricing still shows its explicit review heading. No automatic checkout occurs. The new helper changes text content only. Also corrected the missing-photo cart layout so a sparse product's title does not occupy the narrow thumbnail column and overlap quantity controls.

Seven commerce unit tests pass, including changed-price row/total synchronization, mixed currencies, exact variants/quantities, unavailable rejection and expiry. Actual local browser fixture exercised unavailable response→no checkout link→explicit retry→CAD69.99×3=CAD209.97 in both basket and receipt, quantity3 unchanged, correct fixed handoff, and focus invalidation without another request. No horizontal overflow at390/1440; no page errors. Fixture uses mocked API responses and does not establish a real purchase. Screenshots `.recovery/logs/commerce-price-final390.png` (final sparse layout), `commerce-price-fixed1440.png` (price consistency before sparse-layout adjustment). Production baseline images `commerce-independent-basket390.png` and `commerce-independent-review1440.png` were visually inspected.

Basket contents are anonymous browser-local product selections, not a signed-in order history. Public Storefront review sends only variant IDs and quantities; it does not obtain Zoi account identity or customer orders. External BuyGreek authentication, payment, delivery eligibility and order status remain separate. Existing unsupported commerce capabilities listed above remain open. Candidate not yet deployed at this audit entry.

# Commerce inventory recovery production acceptance — a50fd0c

The deployed shop HTML and both changed browser modules were fetched from `https://www.zoi.city` and compared byte-for-byte with the verified release archive `/tmp/zoi-commerce-release-0sdxjmqd`, tree `e37504c9859e5f312d3eae21bbf1b788c4a33555`. All three matched:

| Path | SHA-256 |
| --- | --- |
| `shop/index.html` | `ce1c12739bc2fd6c73b4546c35d34ceeebc84560ac1dd6646a6dc44d4bcbd0a5` |
| `assets/commerce/shop.mjs` | `c36053d9b4e6fb57e2c52e6be22dfe6e5cff58910c01971a60256fe680094d7f` |
| `assets/commerce/unavailable.mjs` | `6fd0641cfb00cd2424f00258a947486f7583845611119a2e17dc66152db05fbd` |

## Actual public source read

A separate unintercepted `GET /api/commerce?handle=jigsaw-puzzle` returned HTTP 200, `ok:true`, source `buygreek.shop`, the exact `jigsaw-puzzle` product, and two variants. This proves this current catalogue read, not inventory-failure handling or a completed order.

## Production-rendered controlled failure/retry

The real production `/shop/` HTML, scripts and styling were exercised at 390 and 1440 pixels. Only commerce API responses and browser-local basket contents were controlled to induce deterministic inventory changes; no application modules were substituted. At each width:

1. A successful checkout review appeared for two distinct products.
2. An unavailable response identified only the first requested product/variant/quantity. The previous checkout disappeared and the unaffected second row remained.
3. A successful same-basket retry removed the old unavailable notice and offered a fresh checkout review.
4. A subsequent unavailable response exposed current options for that exact first product. Opening it preserved the unavailable variant and kept Add disabled.
5. Removing the unavailable row preserved the second item, and the new review linked to exactly `https://buygreek.shop/cart/987654321:1` (a fixture identity, never navigated).

Both widths passed, with no captured page errors. Phone and desktop unavailable-state screenshots were visually inspected; the recovery copy and action are legible in the production dialog. The phone screenshot is scrolled within the dialog. Browser contexts and the test server closed.

Evidence: `/tmp/commerce-a50fd0c-byte-parity.json`, `/tmp/commerce-a50fd0c-public-product.json`, `/tmp/commerce-production-recovery.cjs`, `/tmp/commerce-production-recovery-web-{390,1440}.png`.

## Limits

This is production-module acceptance with controlled inventory responses, not a claim that real BuyGreek inventory changed or a live unavailable checkout was observed. No provider checkout was navigated, no purchase/payment/customer information/message/provider write occurred. Native component failure/retry acceptance is separately recorded in `buygreek-current-gap-2026-10-01.md`; physical iOS/Android acceptance, fulfillment, order reconciliation and the broader marketplace programme remain open. Lead owns CI and deployment status evidence.

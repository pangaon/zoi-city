# Commerce production acceptance — d08f52d, 1 October 2026

Actual production `/shop/` was exercised at 390 and 1440 pixels after deployment of `d08f52d6f0865f9f4f9a019783ea63082a7396b7`. No application or API resource override was used. Only browser clipboard sharing was intercepted locally to avoid sending a message.

At both widths:

- Unknown explicit variants kept Add and Share disabled until a deliberate valid selection.
- All-over print gym bag retained variant `42633200271545`, quantity 1 and CAD 69.99 through basket and fresh checkout review. The technical “Default Title” was absent from the basket/review. Share retained the exact variant, and checkout linked to `https://buygreek.shop/cart/42633200271545:1`.
- Jigsaw puzzle retained its named “520 pieces” option, variant `42632731328697` and CAD 49.99 through basket and review. Share and checkout preserved that exact ID.
- The unavailable adidas backpack remained unavailable with Add disabled.
- No captured page errors or horizontal document overflow occurred. The mobile default-product basket screenshot was visually inspected.

Deployed `/assets/commerce/model.mjs`, `shop.mjs` and `price-display.mjs` each returned 200 and matched the reviewed local candidate bytes exactly. SHA-256 evidence is recorded in `/tmp/commerce-d08f-module-parity.json`.

Evidence: `/tmp/commerce-d08f-{named,default}.mjs`, corresponding `*-results.json`, and `/tmp/commerce-d08f-{named,default}-{390,1440}.png`. Browsers closed. No checkout navigation, purchase, payment, customer information or message was submitted in this smoke test. The earlier complete external handoff is separately documented in `commerce-current-acceptance-2026-09-30.md`; native-device operation and broader commerce fulfilment remain outside this acceptance.

Disposition: the deployed presentation correction passes this bounded production check without changing option identity, price or checkout contents.

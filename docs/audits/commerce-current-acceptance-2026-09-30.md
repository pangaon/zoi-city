# Current BuyGreek commerce acceptance — 30 September 2026

## Scope and disposition

Independent production browser acceptance at 390 and 1440 pixels. The current `/shop/` journey passes for catalogue → product quick view → deliberate variant → local basket → current-price review → external BuyGreek checkout. This is acceptance of that boundary, not completion of the BuyGreek programme in `docs/recovery-scope.json`.

No payment, order submission, customer contact information, account login or message delivery was performed. Sharing was captured through a local browser clipboard stub; the production application and commerce API were not replaced. Generated provider checkout-session identifiers are intentionally omitted here.

## Source and rendered evidence

Actual public `/api/commerce` catalogue, product and review responses were captured in `/tmp/commerce-current-results.json`. They reported:

| Product / variant | Current source price | Availability | Exercised result |
| --- | --- | --- | --- |
| All-over print gym bag / 42633200271545 | CAD 69.99 | Available | Quantity 2, CAD 139.98 subtotal |
| Jigsaw puzzle / 42632731328697, 520 pieces | CAD 49.99 | Available | Exact selected option retained through review and share |
| Jigsaw puzzle / 42632731295929, 252 pieces | CAD 39.99 | Available | Source comparison establishes differently priced options; not purchased |
| adidas backpack / 42638765293753 | CAD 81.13 | Unavailable | Unavailable shown and Add disabled |

The basket says no payment has been collected, items are not reserved, and shipping, taxes, discounts and final availability are confirmed by BuyGreek. Current API checkout validation is a read-only Shopify GraphQL query, not an order/payment mutation. Its receipt explicitly returns `payment_collected:false` and an allowlisted BuyGreek cart permalink.

## Exercised journeys

At both widths, actual pointer controls opened the gym bag quick view from search, selected its exact variant, added two units, opened the basket and reviewed checkout. Continue navigated to `buygreek.shop` and rendered the provider checkout with the same item, quantity and CAD 139.98 subtotal. No payment control was submitted. The provider screenshot shows a normal checkout; an additional error heading found in the DOM was hidden template content, not an observed visible failure.

Share produced `https://www.zoi.city/shop/?product=all-over-print-gym-bag&variant=42633200271545`. This proves link generation, not native share-sheet support or delivery.

A second production pass opened Jigsaw puzzle with an unknown explicit variant. Add and Share were both disabled. Deliberately choosing 520 pieces enabled the actions, retained CAD 49.99, generated the exact `variant=42632731328697` share link and reviewed a handoff ending `/cart/42632731328697:1`. The unavailable backpack remained disabled for Add. No captured page errors or horizontal overflow occurred in these bounded runs.

Evidence scripts: `/tmp/commerce-current.mjs` and `/tmp/commerce-options-current.mjs`; results also include `/tmp/commerce-options-current-results.json`. Screenshots: `/tmp/commerce-current-receipt-{390,1440}.png`, `/tmp/commerce-current-provider-{390,1440}.png`, `/tmp/commerce-options-current-{390,1440}.png`. Mobile basket and desktop provider screenshots were visually inspected. Browser sessions were closed.

## Concrete gaps against requested scope

- No functional blocker was reproduced in the tested catalogue-to-provider boundary. Real payment completion, resulting order reconciliation, returns, fulfilment, seller payouts, digital access, subscriptions and creator commissions remain unproved by this acceptance. They must not be marked complete from a successful handoff.
- The basket is browser-local storage; it is not evidence of a synchronized signed-in Zoi/BuyGreek customer basket or cross-site order history.
- Current source price and availability agree in these examples. A price changing during review, inventory racing after handoff and provider refusal were not induced in production; earlier isolated regression evidence must remain separately labelled.
- Provider checkout controls and marketing opt-in belong to BuyGreek. Its marketing checkbox appeared checked, but no email was entered or subscription submitted. Zoi should not claim that its own preferences control this provider choice.
- Single-option products expose Shopify's `Default Title` as customer copy. This is a visible polish defect; a customer-facing label such as “Standard” could hide that technical value without changing the real variant identity.
- Delivery restrictions currently remain in source product descriptions: the unavailable backpack says US/territories only. No destination-aware Zoi eligibility guarantee was established.
- The scope also requests shoppable images and reusable offers across business, creator, festival and community surfaces. Testing `/shop/` does not establish those placements or category-wide operation.
- Physical native-app checkout, native sharing and app-to-provider return continuity were not exercised. Mobile-width web evidence is not native-device evidence.

No implementation files were changed by this audit.

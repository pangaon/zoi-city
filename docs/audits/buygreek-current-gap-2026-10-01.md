# BuyGreek inventory recovery — 1 October 2026

## Source/code finding

The previously accepted catalogue → basket → fresh review → external BuyGreek handoff remains the integration boundary. It does not establish Zoi order reconciliation, fulfilment, returns, payouts or synchronized customer baskets.

A current code audit found a material recovery defect: `validateCheckout` stopped at the first missing/unavailable variant and returned only a generic error. Buyers could not identify the affected row in a multi-item basket. The web basket offered no current-options action. Native already offered a current-product action, but its review refresh retained the earlier successful checkout when the next request failed: a stale checkout remained actionable within its two-minute lifetime.

## Candidate correction

- Server checks every requested option and returns only exact unavailable ID/quantity/product-handle rows. Missing provider nodes carry a null handle; substituted IDs fail as a store error. No checkout URL is returned with an unavailable line.
- Shared client parser rejects foreign IDs, different quantities/handles, duplicates and malformed reports. No product identity is guessed.
- Web marks the affected row and offers current options for the confirmed matching handle. A disappeared option can be removed. Refresh clears prior availability notices, including when the same item becomes available again.
- Native clears both the rendered prior review and its synchronous review reference before refreshing, then marks the exact unavailable row. Basket changes clear stale availability notices. Unaffected rows are retained in both clients.

## Exercised evidence

14 focused commerce unit tests pass, including the real API handler with controlled read-only provider response, multiple unavailable items, missing/substituted identities, strict response binding and retry after removing an unavailable row. Mobile TypeScript check passes.

`tests/browser/commerce-recovery/verify.cjs` exercised the actual web shop at 390/1440 using controlled API responses. The `--native` mode exercised actual ShopScreen after Expo57 web export at the same widths. Both passed: successful review → unavailable response → old checkout absent → successful same-basket retry → unavailable again → remove offending row → successful remaining-item review. Web also opened current options at the exact unavailable variant with Add disabled. No page errors occurred. Screenshot evidence is under `/tmp/commerce-recovery-{web,native}-{390,1440}.png`; phone screenshots were visually inspected. Initial web fixture lacked the `.shop` wrapper and was corrected to load actual scoped styling before the final run.

## Remaining boundaries

This candidate has not been deployed by the specialist. Production smoke, exact release acceptance and physical native-device operation remain lead/release work. No actual purchase, payment, customer information, message or provider write was performed. Controlled inventory failures are not claims that a live BuyGreek product was changed. Full requested marketplace operations remain open.

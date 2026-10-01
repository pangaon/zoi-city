# Commerce default-option label — 1 October 2026

Candidate only; independent review pending. No stage, deployment or purchases performed by this lane.

## Manifest

- `assets/commerce/model.mjs`: shared display helper and bounded basket presentation metadata.
- `assets/commerce/shop.mjs`: quick view, basket and fresh checkout-review labels.
- `assets/commerce/price-display.mjs`: refreshed basket price labels.
- `mobile/src/commerce.ts`, `mobile/src/Shop.tsx`: shared helper reuse, native basket mapping and displays.
- `tests/unit/commerce-variant-label.test.mjs`, `mobile/tests/commerce.test.mjs`: default, named/multiple, incomplete and persisted-basket cases.

## Boundary

Suppress the literal provider placeholder `Default Title` only when the observed product has exactly one variant and `more_variants === false`. Preserve raw provider title, variant ID, price, quantity, availability and exact share/checkout link. This is presentation metadata, never purchase authorization or inventory evidence.

Current product selection replaces previous presentation metadata when merging a basket line. Old basket rows without single-default proof remain literal until revisited through current product data. A genuine `Default Title` label among multiple options is retained, as are all other named variants. Fresh checkout continues validating provider IDs, quantities, prices and availability using existing contracts; no API or GraphQL schema changed.

## Evidence

- Ten focused web commerce tests passed.
- Eight native commerce tests passed; native TypeScript check passed.
- Actual production DOM with candidate JavaScript overrides at 390px and 1440px, using live commerce API responses: `all-over-print-gym-bag` quick view → add to browser basket → fresh checkout review displayed no placeholder. Exact variant `42633200271545` remained in the validated checkout URL. No checkout handoff or purchase was executed.
- Initial Adidas backpack probe was unavailable and Add remained disabled; acceptance used a genuinely available product instead of bypassing availability.
- Browser acceptance script retained at `/tmp/default-title-qa.cjs`; browser closed after validation.

Native physical iOS/Android devices and mounted native visual presentation were not tested. Unit/typecheck evidence is not device acceptance. Production publication of this candidate remains the release owner's responsibility.

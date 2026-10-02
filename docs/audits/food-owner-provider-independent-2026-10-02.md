# Independent food owner/provider acceptance — 2026-10-02

Accepted local shared restaurant/bakery projection correction. Existing owner editor, versioned writer, price handling and customer actions remain reused.

Source review confirms explicit owner order_url replaces all older order/preorder aliases, reserve_url replaces reserve/booking aliases, and specials/catering supersede bakery seasonal/wholesale aliases. Null, empty and unsafe values remove the action rather than resurrecting an imported provider. Omitted fields retain source fallback. Explicit website clear cannot resolve a relative provider URL against the previous website. Restaurant, bakery and generic vertical normalization use the same correction.

Independent 54 focused tests passed (`/tmp/food-provider-units-independent.log`). Four actual owner-editor journeys passed: restaurant and bakery at390/1440, versioned save/remount, canonical provider navigation, explicit clearing, and bakery private request draft (`/tmp/food-provider-browser-independent.log`). Populated and cleared/sparse public screenshots retained under `/tmp/food-provider-independent`; phone bakery published view inspected and clearly states that orders are handled externally. Provider destination requests were controlled, not real purchases.

Frozen runtime:
- restaurant model `94bc75868888666882e76587b5949435e5d210215d48831dd5a0bf3962792307`
- bakery model `43a18c7a5c40778055939d0bfcb8d19c575b39ab0ee6e7d69e4a1329f52c417b`
- API vertical normalization `733b92a8281f5b89931f4cb4a880e2a5443720ac5d02fa0a2d96af7c022679c5`

Root owns cache integration and exact staged server tracing/build. No production owner save, provider authentication, order/payment confirmation, live inventory, delivery or booking integration is inferred from these controlled journeys.

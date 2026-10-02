# Restaurant and bakery owner → customer provider journey

## Reproduced shared gap

Existing menu/versioned owner workflows were already implemented and accepted in `owner-menu-editor-release-2026-09-30.md`; this work does not replace their editor, prices, request receipts or concurrency model. Actual canonical adapters reproduced a different failure: a saved owner `order_url:null` or new URL left older machine `order[]` / bakery `preorder` active, and `reserve_url:null` left machine `reserve` active. Bakery also replaced owner specials/catering with older seasonal/wholesale fields. Guests could therefore follow a provider that the owner had removed.

## Shared correction

`restaurant/model.mjs` now supplies a presence-based owner food profile normalization used by the restaurant, bakery and generic vertical normalization. Supported owner_profile/profile `order_url` overrides old order/preorder aliases; `reserve_url` overrides old reserve/booking aliases; unsafe/empty/null values clear instead of falling back. An explicitly cleared website cannot provide a base for relative provider URLs. The actual editor’s specials and catering fields also supersede bakery seasonal/wholesale aliases. Omitted fields retain existing source behavior. Existing links/media safe URL rules, menu fields, money handling and source-specific brand choices remain unchanged.

No cart, payment, live stock, delivery integration or booking capability was added. The customer follows the current owner-selected provider or prepares the existing local bakery request draft. Provider pricing and order acceptance remain external.

## Evidence

54 relevant food/vertical/menu unit tests passed in `/tmp/food-owner-family.log`; focused tests cover persisted-profile and owner-overlay modes, explicit clears/invalid URLs/new values, legacy omitted fallback, promotion/catering parity and cleared website with relative provider URLs.

`tests/browser/food-owner-provider/verify.cjs` loads the actual Business home editor and existing nested menu controls. Controlled versioned writer persists the exact supported fields, and remount/readback confirms them. Both canonical restaurant and bakery pages are rendered with actual modules. At390/1440 the journey edits menu/promotion/provider/catering, leaves optional prices blank, saves/readbacks, keyboard-opens the current provider, clears actual fields, saves/remounts, and verifies old destinations and promotions do not return. Bakery prepares its existing12-item local request before/after provider clear and checks “No order has been placed.” No live API/provider writes occur.

Fixture debugging caught two test-harness issues: shared `_phone.js` browser dependency initially received a controlled HTML fallback, now served as actual JS; and the saved textarea’s wrapped label includes its initial text, so the restored draft field is selected by its stable accessible-name prefix rather than an incorrect exact label. Diagnostic capture proved the dialog was open with the restored draft. No unrelated production client patch was made.

Current listing/source data was not mutated or freshly queried. Sources here are explicitly controlled stale-alias fixtures; retained restaurant source audits remain separate evidence. Native remains existing public-home/browser workflow, not a new native order engine. Parent owns cache entrypoints/release and independent review. This is local controlled-contract verification, not production persistence or provider checkout acceptance.

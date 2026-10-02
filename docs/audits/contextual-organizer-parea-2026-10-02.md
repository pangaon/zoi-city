# Contextual organizer setup → host → recipient · 2026-10-02

## Actual gap and delivered workflow

Previously the host route only told an organizer with disabled inventory to enable it in the separate Tickets editor. Table identity and reviewed pricing forms existed in a different modal. The host page now opens those same forms in current workspace/event context, with a return-and-refresh action that reloads the authoritative configured inventory before host allocation. It also provides direct focus into the existing organizer payment-arrangement section.

No identity, pricing or payment model is duplicated. New organizer-setup.mjs embeds mountTableInventory, which already embeds table identity setup and its versioned writers. The owner enters confirmed labels/capacity, selects minimum whole-ticket quantity, price/currency, inclusive taxes/fees and actual offset-bearing start, reviews and saves. The existing request CAS and uncertain-save receipts remain intact. Return uses current configured choices; source room geometry never supplies operational capacity.

The exercised lifecycle continues through actual host allocation, recipient quantity review/private claim and current permitted unpaid door preference. No claim becomes an admission ticket or paid reservation. External checkout, automated delivery and service orders remain separate capabilities.

## Scope and recovery

Coordinator permits only existing identity/inventory read/write/receipt RPCs and checks exact workspace/event parameters, current Auth actor and owned surface before refresh, after refresh and after transport. A removed/replaced/reattached surface permanently retires, including synchronous mutation records before sends. Auth denial clears private editor and returns control to the parent. Parent account/route changes destroy the coordinator. Child click/submit delegation is isolated from host handlers with similarly named data attributes.

Unsaved edits are explicitly discarded on leaving setup. Unknown server outcomes preserve existing account/event/workspace request markers; no marker is deleted to enable another request. Reopening reuses the editor's receipt recovery. No table-editor callback changes were required.

Host CSS changes are scoped to the embedded setup. Phone visual inspection found host-wide input styles making checkboxes oversized; scoped checkbox dimensions/flex labels and button spacing corrected it. Other suites and table editor schemas are unchanged.

## Source / rendered / exercised evidence

- Source: retained actual identity/inventory/host/payment contracts and current modules; no fresh production configuration reads. Earlier organizer-readiness audit records unresolved ownership/inventory mapping for showcase events. This implementation does not assign ownership or infer live stock.
- 37 relevant unit tests pass: `node --test tests/unit/table-inventory*.test.mjs tests/unit/table-identity*.test.mjs tests/unit/host*.test.mjs tests/unit/parea*.test.mjs`.
- Coordinator actual editor390/1440: empty identities→new owner-entered table→inclusive CAD125 price→uncertain save→remount receipt recovery without duplicate mutation; stale version does not alter saved price; role denial clears editor; held refresh plus account/scope/replacement sends zero stale writes.
- Full actual host-route390/1440: identity save→inventory configure→existing payment-policy configure→host allocation→private guest save→recipient accepts2→pay-at-door preference remains unpaid. Dynamic configured capacity8/minimum2 and exact CAD125 per guest carry into the host form. Exact generated table UUID is retained into recipient preview. All calls are controlled existing contracts, not live transactional proof.
- Existing Parea readiness full browser regression passes both widths. No frozen native/payment/service modules edited.
- Logs /tmp/organizer-setup-{units,browser,lifecycle,parea-regression}.log. Screenshots /tmp/organizer-setup/ show corrected390 setup, host and recipient; inspected phone layout and actual recipient unpaid state.

## Prerequisites and parity

Production still requires verified event/workspace authority, actual approved inventory configuration and installed compatible backend contracts. The existing payment deadline candidate and held service schema are lead-owned gates; controlled fixture success does not install them. Native's accepted browser handoff opens the same contextual host route after independent browser sign-in; no native organizer editor added. No production write, customer send, payment or schema activation occurred.

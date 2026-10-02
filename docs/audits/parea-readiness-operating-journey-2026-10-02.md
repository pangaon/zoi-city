# Parea readiness and recipient follow-through · 2026-10-02

## Delivered locally

The existing host allocation route now provides a current group review: accepted ticket quantities, quantities awaiting acceptance, and remaining quota. Actions focus the actual first unclaimed recipient or guest quantity form. A fully accepted current allocation says everyone accepted their invitation; it never reports a paid booking. Expired/released allocations show historical counts without readiness next actions. Invalid, duplicated or overallocated rows cannot produce a ready summary.

After a successful personal claim the recipient gets a direct keyboard-accessible handoff into the existing payment-arrangement panel. Existing already-accepted previews have the same handoff. The existing claimant-only policy contract decides whether a payment option is available; the host does not get another person's payment preferences or infer payment from acceptance. No new ready-state writer, claim, payment, admission, service membership or delivery contract is invented.

Current server rows reconstruct readiness on reload. Existing roster drafts and bearer links remain memory-only. Lost invitation tokens still require explicit reviewed replacement of an unclaimed link. Existing contact composer carries only the exact current private link and selected recipient into a user-reviewed messaging-app link; opening/copying is not delivery.

## Source and operational boundaries

Sources are retained event-host-allocation/payment-policy contracts and actual client code. Host detail exposes guest ID/label/quantity/status/version, not guest payment status. The separate pending service lifecycle introduces explicit service admission and stock; neither an accepted pre-show allocation nor this readiness review authorizes bottles/orders. No held service files or dirty payment-policy files were modified. No live database, provider, customer send or payment performed.

## Exercised evidence

- `node --test tests/unit/parea-readiness.test.mjs tests/unit/parea-roster*.test.mjs`:7 pass; quantity accounting, duplicate/invalid/overquota rejection, expiry boundary and invitation-only semantics.
- `node tests/browser/parea-readiness/verify.cjs`: both390/1440 pass using actual mounted host/recipient/contact/payment modules with controlled existing RPC contracts. Three guests with3/2/1 quantities; second lost response blocks remaining queue; receipt recovery; exact private link in reviewed Maria email composer; recipient accepts2 and chooses permitted door preference which remains unpaid; fresh host remount shows2accepted/4awaiting/4unassigned; expired state and denied refresh clear actionable/private state.
- Retained account, route, root replacement, detach/reinsert and held-refresh negatives send no stale roster writes. Reload preserves durable guests but no secret link/draft resurrection. Existing original Parea browser regression also passes both widths.
- Logs `/tmp/parea-readiness-{units,browser,regression}.log`; screenshots `/tmp/parea-readiness/`. Visually inspected390 readiness and1440 returned-host cards; clear counts/readable actions. Actual recipient and composer screenshots retained. Keyboard focus assertion exposed the workspace contact picker input preceding the guest field; targeted the actual guest label field, then reran successfully.

## Remaining / native

Host-wide payment reporting needs a reviewed backend permission contract; this feature deliberately does not expose the organizer report to hosts. Online settlement, admission tickets, automated delivery and verified phone/email recipient binding remain unavailable here. Native uses the existing authenticated host browser handoff; no new native screen claimed. Production availability depends on lead deployment and configured organizer inventory; this packet performs neither activation nor schema changes.

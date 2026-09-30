# Event payment arrangements — candidate, not yet deployed

This extends the existing organiser allocation and accepted guest-claim flow. It does not make the Signature drawing into inventory, create a payment provider, issue admission tickets, collect cash, or settle a bill.

An owner/admin opens `/tickets/hosts/?workspace=<workspace UUID>&event=<event UUID>`, with existing configured event inventory. The additional editor defaults to no enabled methods. The only implemented method is **pay at the door**. Online payment is rejected by the database even if a client submits it manually. Organiser policy is separate from table pricing, so changing a payment option does not reprice tickets or release inventory.

After accepting their personal allocation link, a signed-in guest sees their own active guest allocations and the methods that organiser currently permits. They choose pay at the door for their whole allocated quantity. The receipt and interface remain **unpaid**, with no admission issued. A subsequent policy version change marks the old preference **needs review**, requiring the guest to review again. The organiser can read guest labels, table labels, quantities and unpaid preference amounts. This is not a settlement ledger: receiving money elsewhere does not automatically update this list.

## RPCs

- `event_payment_policy_get(p_workspace,p_event)` — current owner/admin, returns version0/defaultfalse if unconfigured.
- `event_payment_policy_save(p_workspace,p_event,p_expected_version,p_request,p_allow_pay_at_door,p_allow_pay_online:false)` — owner/admin, policy CAS, exact request replay. `true` online always fails `online_provider_unavailable`.
- `event_guest_payment_options(p_event:null)` — authenticated claimant-only active accepted allocations. Returns first100 plus total; no guest contact or other claimant details. Opening an event limits scope.
- `event_guest_payment_choose(p_guest,p_method:'pay_at_door',p_expected_policy_version,p_expected_version,p_request)` — accepted claimant only, current valid allocation, current permitted method, policy CAS and choice CAS. Uses server quantity/unit price/currency; no client amount accepted.
- `event_payment_operator_report(p_workspace,p_event)` — current owner/admin only, first1,000 preferences plus total. No general viewer/door-staff role has been granted access. Guest labels are private host-supplied labels, not verified identities.
- Existing `event_host_receipt(p_request)` now rechecks current operator or claimant authority for these new receipt types. Historical receipts are followed by a current-state refresh in the UI.

## Consistency and recovery

New writes reuse `event_host_requests` and the actor/request locks, actor budget and event settings row lock. Policy changes, choices and existing inventory/host operations serialize against the same event settings. Guest acceptance, allocation validity, role/ownership and version checks remain server-side. Direct table access and anonymous RPC access are revoked; tables have RLS enabled.

The client persists only a stable request UUID and its immutable nonsecret policy/guest-reference parameters, scoped by signed-in account. Unknown outcomes do not permit replacement requests. Reload supports same-payload retry or existing receipt lookup. Refusal after an uncertain retry retains the original pending reference. Account changes clear visible protected data and reject late responses. Failed reads hide prior policy/report/guest data rather than retaining a stale authorised report.

Ownership transfer invalidates old allocations and policy writes. A deliberate administrative transfer/reset workflow remains unimplemented; the new owner cannot silently adopt the previous workspace's policy. No generic claim revocation UI is added; backend revoked/expired allocation checks are covered.

## Evidence and limits

`node tests/database/event-payment-preferences.integration.mjs` exercises actual PostgreSQL: owner/viewer permissions, claimant isolation, online rejection, policy/choice CAS, identical and competing concurrent retries, revoked/expired claims, ownership transfer, unchanged table inventory and no tab payment creation. It also runs the exact production `ops/verify-event-payment-preferences.sql` transaction and verifies zero retained policy rows.

`node --test tests/unit/event-payment-policy.test.mjs` covers receipt validation, reload recovery, account changes, uncertain outcomes and safe data projections.

A browser fixture used an isolated real PostgreSQL database through a loopback-only RPC bridge: owner enabled door payment, guest selected it, owner report showed3tickets/CAD375. Screenshots at390 and1440 were inspected. This is local operational evidence, not a production customer payment. Independent review found and corrected a submit-event delegation bug and stale protected-data rendering after failed refresh.

Remaining: online checkout/provider settlement; admission issuance; cash reconciliation; recipient email/phone binding; automated delivery; refunds; other payment methods; >1,000 report export; native mobile implementation. No production event, owner or inventory was seeded.

# Organizer-approved host table allocations

Production RPC definitions and public host UI inspected on 2026-09-30: table allocations, guest quantities, authenticated claim preview and claim acceptance are deployed. This is not evidence of a completed real-organizer browser journey. No operational Signature event/table inventory was found in the bounded production lookup; its illustrated room is not connected to these allocations. No payments or admission tickets are created by these operations.

## Actual boundary

A current event owner/admin explicitly assigns an existing configured table to a known host profile, with a whole-ticket quota, reviewed pricing version and expiry before the event (maximum90days). This is an organizer allocation, not a paid booking. It exclusively removes that table from ordinary timed-hold availability. Expiry/release restores availability under the existing settings-row lock. Configuration changes are blocked while allocations remain active. Public map never exposes host/guest identities.

## Authenticated RPCs

- `event_host_allocate(p_workspace,p_event,p_table,p_host,p_quota,p_expires_at,p_expected_pricing_version,p_request)` → `{ok,allocation,payment_collected:false,delivery_configured:false}`. Owner/admin only. Exact actor/request/payload replay; pricing CAS. Allocation fields: `id,event_id,table_id,host_profile_id,quota,pricing_version,price_per_guest_cents,currency,expires_at,version,status` (active/released/expired/invalidated).
- `event_host_list(p_workspace:null,p_event:null)` → own host allocations, latest100. Supplying workspace requires current owner/admin and a specific event; returns that event’s allocations. No guest identities.
- `event_host_get(p_allocation)` → `{ok,allocation,guests:[{id,label,quantity,status,version}],payment_collected:false,delivery_configured:false}`. Current host or current owner/admin, current event ownership required.
- `event_host_guest_save(p_allocation,p_guest,p_expected_version,p_request,p_label,p_quantity,p_token)` → `{ok,guest,delivery_configured:false,payment_collected:false}`. Host only; client-generated stable guest UUID; version0new. Quantity1..quota, sum across nonrevoked guests≤quota. Invited rows can be edited/rotated using their exact version; accepted rows are immutable. Names are private labels, not verified recipient identities.
- `event_host_claim(p_token,p_request)` → `{ok,event_id,table_id,guest_id,quantity,status:'accepted',price_per_guest_cents,currency,payment_collected:false,ticket_issued:false}`. Requires sign-in, current valid allocation, one claimant. Exact request retry supported. This accepts an allocation; it does not issue admission or record payment.
- `event_host_release(p_allocation,p_expected_version,p_request)` → `{ok,allocation,payment_collected:false}`. Current owner/admin only, CAS and exact retry. Ends allocation and invalidates uncompleted claims without inventing refunds.
- `event_host_receipt(p_request)` → `{ok,found,receipt,historical:true}`. Actor-only; role/current owner fences for organizer/host writes. Receipt is historical; clients must refresh allocation before showing current validity.

## Capability and recovery tradeoff

The client must generate32 cryptographically random bytes (`crypto.getRandomValues`) and hex-encode them. The database validates64lowercasehex and stores only SHA256, including in request payloads. No plaintext token is retained or returned by receipt recovery. Use a fragment-based link handled after an explicit user action, never log it or include it in analytics/referrers. No sending adapter is implemented here.

Keep the exact token and save payload in memory across uncertain retries. Persist only actor/allocation/request locators. After reload, recover the save receipt; a successfully saved but lost token cannot be reconstructed. The host can explicitly rotate an *unclaimed* invitation with a fresh token, known version and new request. Do not silently replace a pending save or rotate an accepted claim. This is a bearer capability: the first authenticated holder can accept it; no email/phone recipient-binding claim is made until verified delivery/identity binding exists.

## Still missing

Configured email/SMS delivery, verified contact binding, payment provider, admission-ticket issuance, refunds, guest-level cancellation/reallocation, bottle stock/service windows and sponsor fulfilment. Existing table-tab cash/menu primitives do not provide those contracts. Approved Toronto logo/assets can be used only in clearly labelled sponsor TEST previews; no paid sponsorship or placement is implied.

## Tests

`node tests/database/event-host-allocations.integration.mjs`:15 isolated PostgreSQL groups including real3/1/5 quantities, concurrent competing allocations, existing hold exclusion, expiry reclaim, role/ownership/privacy and token-hash-only storage. Includes the exact `ops/verify-event-host-allocations.sql` BEGIN/ROLLBACK fixture with zero retained allocations. The test command is isolated evidence; do not infer a production customer booking from it.

Mutation budget:300 new allocation/guest/claim receipts per actor per24hours, serialized request → actor → event settings. Exact retries do not consume the budget; organizer release remains available. `invited` is an internal link-created state, displayed as “Link ready”, never proof a message was sent.

## Guided private route and claim preview

`/tickets/hosts/` now provides organizer grants, host guest allocations, explicit unclaimedguest edits (same guest ID/version; replacement bearer link), reference copying/self-host selection, remainingquota and whole-ticket prices. There is no supported guest revoke/delete RPC, so no fake removal action is shown. Changing an unclaimed guest explains that the previous link stops working.

`event_host_claim_preview(p_token text)` is authenticated and read-only. It checks the same currentvalidallocation, ownership, tokenhash and claimant boundaries as acceptance; returns only eventname/tablelabel/quantity/unitprice/currency/expiry/status plus explicit unpaid/noadmission flags. It returns neither otherguests nor hostcontacts/private guestlabel. Invalid, revoked, expired or otherclaimant capabilities fail generically. Preview does not reserve new stock, write a requestledger, or guarantee acceptance against a concurrent claim. The256-bit capability is required; acceptance revalidates atomically under the existing lock.

Recipient UI validates that receipt and shows exact quantity/total before enabling Accept; unavailable preview cannot be bypassed by normal UI. Existing acceptedself preview is displayed without a newaccept action. Provider settlement/delivery remains a separate incomplete domain.

## Device contact sharing

The contact composer uses a user-selected phone contact only when the browser exposes a supported picker. Otherwise names, email and phone are entered manually. Contact details stay in the open composer; they are not uploaded to Zoi or bound to the claim. The host reviews and sends through their own messaging app. A generated link, opened composer, copied message or native share completion is not a delivery receipt. Actual iOS/Android messaging-app delivery is separate from browser testing.

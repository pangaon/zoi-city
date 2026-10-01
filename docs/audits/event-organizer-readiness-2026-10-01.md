# Toronto and Montréal organizer readiness — bounded read-only audit

2026-10-01, approximately03:19 UTC. Scope: published listing identity/ownership,
configuration counts and policy metadata, function catalogue, checked-in runtime
contracts and public provider capability booleans. No guest/contact rows, tokens,
credentials or private profile values were read. No business RPC mutation, message,
checkout, payment, reservation or ownership assignment was invoked.

## Actual configuration

| Item | Toronto | Montréal |
| --- | --- | --- |
| Exact event slug | giannis-ploutarchos-andromache-toronto-2027 | giannis-ploutarchos-andromache-montreal-2027 |
| Listing result | No row for exact slug | 9b241a00-f0c9-5748-8e22-79e2e0b57f79 |
| Published guest experience | Checked-in static /events/... page with planning illustration | Published event listing, clean moderation |
| Owner workspace | No event row available to bind | NULL |
| Configured event venues | No event row available | 0 |
| Saved table identities | No event row available | 0 |
| Priced table inventory | No event row available | 0 |
| Inventory version/start/enabled | No event row available | No settings row |
| Operational capacities, currency and inclusive fees | Not configured | Not configured |
| Door-payment policy | Not configured | No policy row |

A broader bounded query for event names containing Ploutarchos/Andromache or slug
containing plut found only Montréal. This is not a fuzzy audit of every event in
the database. Toronto's static page explicitly offers private planning; it is not
an operational owned event merely because a room illustration renders.

Associated published businesses are also unowned in the catalogue:

- Signature Productions:9d969028-74cb-4b49-97f1-58eba8fc0e69,
  slug signatureproductions-6aa61d, owner_workspace_id=NULL.
- OPA Productions:3778e7a6-08f7-5d32-b9dd-d105476765e9,
  slug opa-productions, owner_workspace_id=NULL.

No workspace/operator authority can be inferred from these public names. A
verified organizer ownership assignment and exact event identity must precede
inventory setup. Published graphic labels/prices do not supply operational
capacity, authoritative currency, included-fee confirmation or availability.
The inventory editor accepts reviewed per-guest cents/currency, bounded capacity,
minimum party and a positive all-fees-included acknowledgement. Those settings
have not been configured for these records.

## Host and recipient lifecycle available in code/catalogue

The live function catalogue includes event_host_allocate/list/get/guest_save,
claim_preview/claim/release/receipt and payment policy/get/save/operator_report,
guest_payment_options/choose. All inspected public lifecycle methods deny anon
EXECUTE and grant authenticated EXECUTE; their checked-in definitions enforce
current role/event/host/claimant authority. Catalogue presence is not an exercised
production organizer journey.

Owner/admin grants one configured table to a known host profile with quota,
pricing version and expiry. Host assigns whole-ticket quantities to private guest
labels and creates a256-bit bearer link. Server stores the hash, not the plaintext
capability. Recipient signs in, previews quantity/price, and explicitly accepts.
The link is not bound to a verified email or phone; first eligible authenticated
holder may accept. Guest status invited means link created, not message delivered.
Unclaimed links can be explicitly rotated; accepted guest edits and a generic
guest revoke/reallocation UI are not implemented. Organizer release ends the
allocation. None of these actions creates admission tickets or records payment.

## Delivery and payment reality

Public social-config GET returned200 with only these capability booleans:
email=false, stripe=false, payments=false, ai=false. No secret was retrieved.
These are general platform readiness signals, not event-specific transport
credentials or a live delivery test. SMS readiness is not reported by that route.

The host invitation module currently opens mailto/sms composers, uses device
sharing/copy and a supported contact picker or manual entry. It expressly says
Zoi has sent nothing. There is no wired one-click server batch SMS/email transport,
recipient verification binding, delivery status or retry provider in this flow.
Contacts selected on the device remain in the composer.

Event payment policy supports only an organizer-enabled pay_at_door preference.
The client/server contract rejects online payment; result remains unpaid and
sets payment_collected=false/ticket_issued=false. Policy changes mark affected
preferences for review. Operator reporting is not a settlement ledger, cash
reconciliation or refund workflow. Neither event currently has a policy row.
A separate legacy tickets-checkout edge handler checks Stripe credentials but is
not a connected host-allocation checkout. It must not be used as evidence that
these table invitations collect payment. No checkout handler was invoked.

## Next concrete code defect and proposed ownership

The host request client can permanently strand an account after a request never
reaches the server and the page reloads. Reproduced locally with actual
createHostClient and an in-memory transport (no network mutation):

1. First write throws before any server receipt exists.
2. Reload reconstructs only the stored actor/request/kind locator; private token
   and original payload are correctly absent.
3. event_host_receipt returns found=false; recover returns null, keeps pending.
4. canRetry=false, and every new write throws "Check your previous request first."

Observed result: recovery:null, canRetry:false, pending:true, one attempted
transport write. There is no safe cancel/tombstone endpoint in the inspected
lifecycle catalogue. This is the same class of recovery gap corrected in workspace
settings; simply dropping the locator is unsafe because an original delayed
request could still arrive.

Proposed bounded next ownership, requiring root sequencing approval:
assets/tickets/host-allocation-client.mjs, host-allocations.mjs, a dedicated
CLI-created request-cancellation migration and matching unit/database/browser
acceptance. Add explicit serialized cancellation that returns an existing receipt
if completed, otherwise commits a cancellation tombstone consulted by every
matching host mutation before writing. Preserve current authorization before and
after lock waits, immutable actor/request identity, and token-hash-only storage.
Test late write vs cancellation in both orders, remount recovery, unauthorized
cancellation, role changes, and no automated resubmission. This repairs recovery;
it does not invent organizer ownership, approved inventory or provider readiness.

Audit owns only this document. No new implementation or production configuration
change was made for this readiness task. Earlier SaaS, map, enrichment, transport,
payment and event visual scope remains open.

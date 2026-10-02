# Approved sponsorship fulfillment — local candidate

## Delivered journey

Festival approved sponsor applications now open an existing Creator workflow scoped to the exact workspace, event and inquiry. The immutable application offer supplies the benefit names; later package edits do not replace accepted promises. An operator explicitly creates the private campaign and reviews each prepared deliverable before saving. Existing Creator version checks and receipt recovery are retained. Shared brief acknowledgment, proof submission and customer acceptance remain separate from artwork approval, public placement and payment. The public artwork checker verifies the exact application's placements against the current public room feed; it does not claim they have rendered on a guest's screen.

Parent and embedded transport revalidate current actor/workspace/owned surface after refresh and before sends. Current permission loss clears private details. Same-account unsaved work uses existing leave confirmation. Connected-container replacement preserves the replacement and stops old operations. A regression found observer cleanup erasing the access-denied explanation; disconnecting the observer before access-loss teardown preserves the explanation.

## Evidence

Source/contract: retained Festival applications original `terms`, Creator real writers and immutable mutation receipts, placement operator/public reader contracts. No live customer query or mutation.

Rendered/exercised: `tests/browser/sponsor-fulfillment/verify.cjs` passes 390/1440 against actual modules with controlled contracts, including original benefits versus changed future package, campaign conversion, two benefit tasks, lost committed response/remount/recovery, shared brief/customer acceptance, proof/customer acceptance/task completion, placement feed inclusion/removal, cancellation, viewer downgrade and held-refresh account/workspace/surface changes. Evidence `/tmp/sponsor-fulfillment`, log `/tmp/sponsor-fulfillment-browser.log`.

Regression: existing Creator recovery and access browser journeys pass both widths (`/tmp/sponsor-fulfillment-existing-{recovery,access}.log`). Existing Festival artwork 17-journey fixture passes both widths (`/tmp/sponsor-existing-festival.log`), including denial cleanup and recovery. Those three retained fixtures only gained the actual Core `ensureFresh` dependency stub; assertions retained. Ten focused Creator/pending/sponsorship unit tests pass (`/tmp/sponsor-fulfillment-units.log`).

## Boundaries and next gate

This UI is not deployed and production database health is not inferred from mocks. Atomic application approval/cancellation enforcement requires the separately reviewed local migration; UI rechecks alone do not close that race. No fabricated sponsors, prices, capacity, provider delivery or paid state. Existing Creator list/pagination limits remain; unavailable exact source fails closed. Benefits are prepared from immutable terms but matched to existing tasks by exact title for convenience. Customer acceptance uses the existing proof contract, not a new payment or legal-acceptance assertion.

## Atomic server candidate

`20261002165444_sponsor_fulfillment_binding.sql` adds a private RLS binding table containing campaign/application/inquiry/workspace/event/customer and the original terms/quantity. Exact existing sponsor campaigns are backfilled under bounded table locks; inconsistent historical identities abort the migration. Public RPC bodies, signatures, grants, CAS and immutable receipt format are unchanged.

Campaign insertion and sponsor application insertion serialize on the same inquiry advisory lock, including the absent-counterpart case. Late attachment to a preexisting campaign is refused. Application source identity/terms cannot be changed, and bound quantities cannot drift. Ordinary cancellation/withdrawal does not acquire the inquiry lock, avoiding inversion against conversion's existing inquiry→application order. Each underlying campaign/deliverable/brief/submission write takes an application share lock and verifies current approval plus the exact immutable binding. Direct legacy RPCs are therefore covered alongside receipt-wrapped writes. Customer brief/proof decisions after cancellation are refused; historical reads and existing receipts remain readable under existing authorization. Any earlier Operations task update in the same failed transaction is rolled back.

`node tests/database/sponsor-fulfillment.integration.mjs` passes 15 isolated PostgreSQL groups (`/tmp/sponsor-fulfillment-pg.log`): backfill, private ACL, unapproved/wrong-kind refusal, immutable source, genuine Creator workflow, new customer acceptance, legacy cancellation denial, task rollback, historical receipt/read access, withdrawal, role downgrade, generic unbound Creator preservation, both cancellation/write orderings and both concurrent absent-counterpart application/campaign orderings.

Frozen SQL SHA256 `6861bb2f527cb46e4840d45fc42ac817196609d516e3acec97fd9880ac3f3137`; database fixture `67d27bdd7831662f00259318d94bfb86c79170bb807231f5bcb269b66d3f86d6`. This additive migration has not been applied to production. Independent review and lead-controlled healthy schema preflight remain required. Browser success does not imply its server guard is live.

## Superseding capability gate

Lead review identified that approved application data from the old reader does not prove the atomic binding migration is installed. The packet was reopened: `festival_fulfillment_source` is now installed atomically with the guards, validates all six expected relation/trigger/function identities and enabled state, captures current active workspace/session authority with the retained locking helper and rechecks after source/event waits. It returns `festival_creator_binding_v1` and the exact current approved application; a bound campaign is validated too. Shared fulfillment requires this before importing/listing Creator and before every mutation. An absent reader, malformed capability or unavailable invariant cannot open conversion. This supersedes the earlier15-group/hash freeze above.

The revised isolated database suite passes18 groups including disabled-trigger capability rejection, expired-session rejection and demotion while waiting for the workspace lock. Actual390/1440 sponsorship journeys pass again; a missing capability explicitly produces zero Creator reads and writes. Native handoff follows the same gate; see native-sponsor-fulfillment-handoff-2026-10-02.md. Production application remains lead-owned and unapplied.

# Parea roster operating journey — 2026-10-02

Candidate only; no deployment, production writes or delivery. This extends the existing ticket host suite for every configured event rather than a Toronto/OPA-specific copy.

## What changed

Hosts can prepare several named recipients and exact ticket quantities together, review the complete distribution, then create private invitation links using the existing `event_host_guest_save` writer. Each recipient displays not saved, checking saved result, link ready/not sent, or current accepted/changed status. The server's allocation quota/pricing remains authoritative. A fresh allocation read precedes the reviewed queue, and each write uses a fresh authenticated current actor and unchanged page scope. Each receipt must match its individual guest ID and quantity.

There is deliberately no fictional bulk transaction. An uncertain response freezes the remaining queue. Existing exact-request recovery resolves that recipient; continuing unsaved recipients requires a new explicit review. Rejected quota changes stop before writing. Same-account route changes, detached ancestors and actor changes clear private planning state and prevent held-refresh sends. Current authorization denials clear private roster/form data.

The organizer allocation form now follows the selected configured table's minimum party size and capacity/default instead of static 1–100 limits. Selecting a different table updates those values immediately. The new roster input reuses the authorized workspace Operations contact picker where a workspace is available. This is not a unified Audience/address-book directory. Contact selection changes the name only; the host reviews quantity and sends nothing automatically.

Confirmed links and unsaved roster names are memory-only. Reload preserves only the existing actor-scoped pending request reference; receipt recovery and the persisted server guest list remain available. A lost secret is recovered by the established explicit Replace claim link action for an unclaimed guest. No names or claim tokens are put into session storage. Updating/accepting/removing a saved guest invalidates its obsolete roster link after a current detail refresh.

## Source and contract evidence

The inputs are existing configured inventory, host allocation, guest-save/claim and payment-policy contracts in `assets/tickets/`. Capacities/prices are never taken from approximate source floor plans. Existing organizer/host authority, quota, receipt and token hashing are server responsibilities; no SQL/schema/writer change is included.

The controlled fixture uses an explicit QA event/table, not invented production inventory. The original OPA eight-stop source backlog remains open; this feature neither creates those shows nor confirms their tickets, sponsors, venues or capacity.

## Rendered evidence

Actual repository modules, dark-theme screenshots inspected at 390 and 1440: `/tmp/parea-roster/390-roster.png` and `1440-roster.png`. Corrected an initial light fallback background which conflicted with the dark text token. Final screenshots show separate recipient cards, exact amounts, readable statuses and full-width phone actions. Ordinary nested labels and button keyboard behavior are retained. Host HTML and cache release integration belong to lead.

## Exercised journeys

- `node --test tests/unit/parea-roster-plan.test.mjs tests/unit/host-allocation-client.test.mjs tests/unit/host-allocation-ui-model.test.mjs tests/unit/host-request-recovery.test.mjs`: 16 passing tests.
- `node tests/browser/parea-roster/verify.cjs`: at each width, contact selection → three-recipient plan → explicit review → first confirmed / second ambiguous / third unsent → exact receipt recovery → explicit remaining save → recipient-specific share link → new guest session accepts two tickets → organizer-enabled pay-at-door preference remains unpaid. Additional account/detach/route held-refresh, reduced quota and reload recovery scenarios pass.
- Existing `tests/browser/host-allocation-drafts/verify.cjs` at both widths: original review/back draft preservation and denial/account cleanup assertions retained. Fixture adds only the actual Core ensureFresh dependency.
- No external browser request is permitted; all RPC responses are controlled contract fixtures. This is not an isolated-Postgres writer rerun and not a live transaction acceptance.

Logs: `/tmp/parea-roster-units.log`, `/tmp/parea-roster-browser.log`, `/tmp/parea-roster-existing-drafts.log`.

## Production prerequisites and remaining scope

Lead must independently review and release the runtime plus versioned new planner dependency. Signature/OPA still need actual authorized organizer ownership and configured inventory before real allocations. Existing payment policy/service schema release gates remain separate. This candidate connects to the already implemented payment-policy UI in controlled tests; it does not make its unapplied backend live. No connected online payment, admission ticket, automatic invitation delivery, stock, sponsorship or equal/custom split settlement is claimed. Native is the existing web handoff, not a newly implemented native roster screen. Drafts do not survive reload, and the UI states this explicitly.

## Independent correction

Independent reviewer reproduced an actual stale send when the connected mount container's contents were replaced during authentication refresh. Fixed by capturing a dedicated child surface, permanently invalidating it on removal (including remove/reinsert), and draining observer records before dispatch. Cleanup clears only that captured child, preserving unrelated replacement content. The committed fixture now exercises both cases at each width, asserting zero writes and preserved unrelated tool content. Full roster and original draft journeys rerun successfully. Final host hash `bafeab4213c53c155a76725e401f7162541d7f0029911e48d9939b38197ead4a`; browser harness `20804f1f3bc5982b7be1cff6b2cc00ab994d3e7ed01ddff090e5288c4131ae8d`.

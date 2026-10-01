# Independent workspace claim tracking review — 2026-10-01

Accepted corrected candidate for parent-controlled integration. No production/customer claim writes performed.

## Frozen scope

- Migration `20261001094723_bizpage_status_current_membership.sql`: `68b797c4f067cb5b58fe508f89fe8f217ba4585b109ca84ca7266de447fc3559`
- `assets/suite/workspace-claims.mjs`: `612cb8355d36fad0c3a8a89be45cef2e262b6c635bb6f94c3291a6cb66f0d342`
- `assets/suite/bizpage.js`: `6d843335d51946d244d86ba9d645d4fce1910b9eeee1933a906bd91d88fc7ba6`

The reader preserves owned/claims payloads and adds an exact workspace success envelope. Access requires current recorded ownership or a current recognized workspace membership. Historical creation is insufficient. Workspace then member share locks preserve authority while reading; the actual deployed invitation Auth/session helper checks current verified enabled identity after those waits. Current recorded-owner fallback without a member is deliberately read-only. Anonymous execution and direct table access remain denied.

Tracking is mounted inside the existing business-home suite. Pending/disputed/rejected/historical approval statuses do not grant editing. Edit requires a currently owned listing ID and owner/admin/editor role; historical approved requests display their loss of ownership explicitly. Refresh clears retained status before reads, and scope/boot-generation fences discard stale responses. The whole new status envelope is validated before deriving owned choices or reading content, not merely inside the tracking renderer.

## Independent evidence

- `node tests/database/bizpage-status.integration.mjs`: 8 groups passed, `/tmp/bizpage-status-independent.log`. Includes distinct Auth/profile IDs, four read roles, historical creator and transferred owner denial, member removal while waiting, ban committed while waiting, disabled/unconfirmed/deleted/anonymous/expired/revoked identity/session cases and anonymous/direct-table denial.
- `tests/browser/workspace-claims/verify.cjs` passed at 390 and 1440, `/tmp/workspace-claims-independent.log`. Actual Bizpage module, controlled RPC responses: pending locked, approved/current-owned exact editor, historical approval without editing, viewer read-only, denied refresh clears claims, wrong workspace blocks subsequent content reads, held account and workspace response fences.
- Reviewer inspected `/tmp/zoi-workspace-claims-390.png`: legible status hierarchy and actions with no visible overflow. This isolated module fixture lacks the full Social shell styling; it is not integrated production visual acceptance.

Early review issues were fixed before freeze: missing current Auth/session checks and partial-only workspace envelope validation. Browser scope-switch coverage was made explicit rather than inferred from a wrong-scope fixture.

## Limits

This is manual status tracking and refresh, not push notifications or a new moderation workflow. Production readback, complete shell deployment and live isolated canary remain parent-owned. The current database management timeout is an operational release gate, not evidence these local checks exercised production.

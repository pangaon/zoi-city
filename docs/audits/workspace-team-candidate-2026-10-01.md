# Organization team-management candidate — 1 October 2026

Status: candidate only, not production-applied or deployed. Root owns migration/release and independent acceptance.

## Actual capability

Settings now loads the current organization membership roster through scoped `workspace_team_get`. Existing members are displayed without exposing email addresses. Owners can change another non-owner member between administrator, editor and viewer, or remove them after inline confirmation. Administrators can manage subordinate editors/viewers; they cannot modify peer administrators, owners, themselves, or grant administrator. Recorded ownership and any owner membership are protected from this management interface.

A former owner's stale `role=owner` membership after recorded ownership transfer receives read-only team authority. Explicit current-owner membership downgrade is respected; ownership does not override a recorded lower role. Legacy `ws_members_list`, `ws_member_set_role`, and `ws_member_remove` signatures remain; boolean missing-member results remain. Unsafe legacy owner/peer changes are intentionally rejected. No ownership-transfer UI or invitation delivery is claimed.

## Persistence and authority

The candidate migration adds per-membership revision UUIDs, changed on every mutation, and rejects changes to membership identity. Versioned writes compare both membership ID and revision, protecting against role ABA and remove/recreate. Workspace locking precedes current membership authorization; actor locking serializes request receipts. Current actor membership is share-locked until the transaction ends. Recorded-owner transfer shares the workspace row lock. Private request receipts have RLS and no direct client grants. Only the authenticated public RPC surface is granted; each function checks current workspace authority. Receipt replay and recovery reauthorize, including after role loss.

Receipts retain cancellation tombstones so a delayed original write cannot restart after cancellation. Creation is bounded at 300 actor requests per day and 5,000 workspace receipts, with supporting indexes. Existing receipt reads/replay remain available at the limit. No unsafe receipt deletion job was added. Workspace-capacity resolution remains an operator maintenance task; this is a deliberate remaining operational limitation.

The browser stores only request UUIDs, namespaced by account and workspace, before a mutation. Unknown outcomes block additional team changes, survive remount, and offer read-only checking or atomic cancellation. Account/workspace changes clear private UI through the existing Settings lifecycle; authority denial in team requests also clears the parent Settings surface. Confirmed conflicts reload current membership instead of overwriting it. Storage failure before submit prevents the write.

## Separate evidence

- Source/code: `supabase/migrations/20261001050608_workspace_team_authority.sql`, `assets/suite/workspace-team.mjs`, existing `assets/suite/settings.js` integration.
- Real isolated PostgreSQL: `node tests/database/workspace-team.integration.mjs` — 15 groups passed: roster; CAS/replay; stale/payload mismatch; owner/self/admin protection; viewer restriction; ABA; cancellation; accepted-write recovery; authority loss; cross-workspace/anonymous/direct access; concurrent CAS; remove/recreate; after-workspace-lock admin downgrade; ownership transfer; bounded request creation.
- Rendered/exercised controlled browser: `node tests/browser/workspace-team/verify.cjs` — 390 and 1440 px, actual Settings script and team module mounted, controlled RPC fixture. Role save, owner/admin/viewer controls, lost response + remount, unknown + cancel, stale conflict, removal confirmation/cancel, loading failure/retry, account clear. No page exceptions or horizontal overflow. Screenshot `/tmp/workspace-team-390.png` visually inspected: readable inline confirmation and stacked phone controls; `/tmp/workspace-team-1440.png` retained.
- Existing Settings regression: `node tests/browser/workspace-settings-cas/verify.cjs` passed both widths, including name/voice CAS, lost outcomes, storage failure and account clear.
- Syntax checks passed for both runtime files.

## Remaining evidence / scope

No production migration, owner-account mutation, native iOS/Android implementation or device verification was performed. This is web organization membership management, not invitations, email/SMS delivery, billing, event staff, or full enterprise organization acceptance. The existing Settings web route is the integration point. Root must independently review the SQL and UI, apply the exact candidate migration, bump the parent Settings asset cache version in the shell, and verify the deployed artifact and authorized owner journey without claiming a simulated fixture was a live transaction.

Frozen candidate SHA-256:

- settings.js: `8c9df6c1ea19508650dae95313d7427c5ec723a31f707eb9435ab6fc3250f9bf`
- workspace-team.mjs: `d615c23b5c03fa93d86885dfd81bad45146d4e16a47166a5826503fe9c8e9f2b`
- migration: `cc6620af027a68a1015241f211ffa0ec4f2e8520b31051e4e1bedcfc38ac80b8`

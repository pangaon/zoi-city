# Workspace team — independent acceptance

1 October 2026. Accepted the frozen candidate for the bounded existing-members web journey. No production changes or actual customer membership mutations were made by this reviewer.

Reviewed SQL authority, lock ordering, membership identity/revision comparisons, receipt replay/cancellation, quotas, grants and the actual Settings/team integration. Workspace ownership lock precedes membership authorization; actor membership is read under a share lock; stale former-owner membership cannot retain management authority after recorded ownership transfer. Explicit owner downgrade remains effective. Protected owner/self and administrator-peer boundaries are checked server-side, including legacy RPC entry points. Versioned writes reject stale member IDs/revisions and retain cancellation tombstones; legacy entry points deliberately do not acquire CAS semantics. Private receipt tables have RLS and no application-client grants. Root independently ran the real isolated PostgreSQL 15-group suite; this review inspected those tests and the SQL rather than duplicating the same database execution.

Independently ran the actual mounted Settings browser fixture at 390 and 1440 widths. Role changes, protected owner, admin/viewer controls, lost response/remount recovery, unknown-result cancellation, stale conflict, removal confirmation/cancellation, loading retry and account clearing all passed. Additional independent probes at both widths confirmed session-storage failure submits zero writes, and authorization denial on team refresh clears the whole private Settings surface. Probe script/log: `/tmp/workspace-team-independent-extra.cjs` and `/tmp/workspace-team-independent-extra.log`. Standard fixture log: `/tmp/workspace-team-independent.log`.

Independently reran existing Settings CAS regression at both widths; passed conflict/draft review, unknown and lost outcome recovery, remount and private clearing. Log `/tmp/workspace-settings-independent.log`. Directly inspected `/tmp/workspace-team-390.png`: inline removal confirmation, readable controls and no horizontal clipping. Browser fixtures use controlled RPCs; they are not production owner-account transaction evidence.

Frozen SHA256:

- settings.js: `8c9df6c1ea19508650dae95313d7427c5ec723a31f707eb9435ab6fc3250f9bf`
- workspace-team.mjs: `d615c23b5c03fa93d86885dfd81bad45146d4e16a47166a5826503fe9c8e9f2b`
- workspace_team_authority migration: `cc6620af027a68a1015241f211ffa0ec4f2e8520b31051e4e1bedcfc38ac80b8`

No invite delivery, ownership-transfer UI, billing, native implementation, real operator production mutation or full enterprise acceptance is claimed. Existing members only; larger organization scope remains open. Receipt capacity maintenance is still an operational limitation; no unsafe expiry/deletion has been inferred or added.

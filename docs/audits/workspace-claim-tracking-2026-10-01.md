# Workspace ownership-request tracking — 2026-10-01

## Source and authority

Read-only production function definitions showed `bizpage_status(uuid)` already returns owned listings and workspace claim history, but delegates authorization to `zoi.assert_ws`. That helper permits historical `created_by_auth`, including a removed creator after an ownership transfer. `zoi_my_claims()` is actor-wide and lacks workspace/listing identity; it is not reused for workspace tracking.

The separate reader migration preserves the existing owned/claims field shapes, adds `ok` and `workspace_id`, and checks current recorded owner or current owner/admin/editor/viewer membership. Historical creation grants no authority. It takes workspace then membership share locks, then reuses the deployed verified current Auth/session guard. Recorded current owner without a membership row remains an intentional read-only compatibility path. Anonymous, removed, disabled, unconfirmed, deleted, expired or revoked-session access fails. The shared `assert_ws` helper is unchanged; its other callers are covered by the separate authority inventory audit.

## Existing Business home integration

Ownership requests appear within the current Business home, including its claim-first state. The list shows In review, Not approved, Approved, Previously approved, Under review and Transferred as appropriate. Approval history never grants editing. An Edit action requires the exact listing in the current owned list plus an owner/admin/editor UI role; the authoritative editor RPC still checks access.

The entire status envelope must match the requested workspace before any owned-listing selection or content read. Refresh clears old claim snapshots before reading, so a revoked-authority failure does not redisplay stale claims. Existing account/workspace lifecycle fencing discards delayed responses. No new dashboard, claim writer or admin approval action is introduced.

## Validation

Eight isolated PostgreSQL groups passed: historical creator denial; four member roles and preserved payload/scope; recorded owner fallback; transferred owner denial; removal while waiting; Auth ban while waiting; disabled/unconfirmed/deleted/anonymous/expired/revoked identities; anonymous and direct-table denial. The harness loads the actual deployed Auth/session helper source, not a permissive stub.

Actual Business home browser module tests passed at 390 and 1440: pending locked, approved and currently owned exact edit, historical approval without edit, viewer read-only actions, revoked refresh clearing, wrong-workspace receipt blocking content reads, delayed response after actor change, and delayed response after workspace change. Existing exact-listing, workspace-shell and workspace-onboarding browser regressions passed at both widths; their fixtures received only the new scoped status envelope fields.

Phone module screenshot `/tmp/zoi-workspace-claims-390.png` inspected; desktop `/tmp/zoi-workspace-claims-1440.png` recorded. These are controlled local transport/SQL fixtures, not live ownership changes. Root owns production migration, cache changes, deployment and live verification. All new changes remain unstaged, separate from the already staged claim handoff release.

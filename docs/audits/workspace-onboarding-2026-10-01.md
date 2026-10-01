# Workspace onboarding and organization selection — 2026-10-01

Implemented bounded broken-journey correction in actual `social/index.html`; no new suite or backend writer. Previously an explicit inaccessible/revoked `workspace` or legacy `ws` query silently selected the first accessible organization while retaining the original listing intent. The shell now stops before context/private module reads and shows a workspace chooser. Deliberate choice validates current membership list, rewrites the exact workspace, removes stale listing and legacy query, and resumes the requested tool through existing route normalization. No explicit query still uses normal saved-workspace fallback; no workspaces still enters normal creation.

Chooser access recheck refreshes membership. Account changes clear the old chooser and re-evaluate the new account; delayed callbacks are generation/token fenced. Creating from recovery explicitly clears prior workspace/listing intent and enters the existing nonce-only creation recovery controller. A pending unconfirmed creation still blocks new writes; the chooser cannot bypass it.

Actual shell/CSS controlled-RPC browser evidence at390/1440: explicit missing workspace does not call workspace context RPCs; intentional organization switch selects exact ID, clears stale listing and retains tool intent; account change removes old organization options; viewer role passes unchanged into existing overview/setup role display; creation recovery keeps a stale pending request fenced without sending; saved default fallback still works. Existing workspace-shell regression also passes both widths (exact creation, duplicate Enter, lost receipt, private clear, missing exact listing and query/hash routing). Commands:

- `node tests/browser/workspace-onboarding/verify.cjs`
- `CHROMIUM_EXECUTABLE_PATH=/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome node tests/browser/workspace-shell/verify.cjs`

Both widths inspected with actual suite styling. Recovery buttons have responsive wrapping and spacing. Fixture stubs only RPC/provider responses and module bodies outside the exercised shell; no real OTP, invitations, organization creation or customer writes.

Remaining SaaS gaps: Settings currently exposes workspace identity/voice and current-role permissions, not a complete team roster/invitation/role-management journey. Navigation keywords mention team membership, but that is not evidence those controls exist. This correction prevents wrong-organization entry; it does not implement team administration, provider setup, or native onboarding. Those requirements remain open.

Root-requested festival.js query bump `20261001-approved-sponsors` is a separate single-line change in the same file, so release can select it independently.

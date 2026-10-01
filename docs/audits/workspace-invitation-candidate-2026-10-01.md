# Recipient-bound organization invitation candidate

Implemented in the recovery release worktree. Not deployed and no production migration applied by the specialist. Root owns release. Independent review pending at this write.

## Actual capability

An owner or administrator opens Settings → Your team → Invite a colleague, enters an email address, permitted role and one/three/seven-day expiry, then creates a private invitation link. They can copy it or invoke the device share sheet themselves. The recipient opens `/workspace/join/#token=…`, signs into Zoi with that verified email, reviews the organization and role, then explicitly joins. Existing memberships retain their current role. New users without a Zoi profile get a profile only inside the successful acceptance transaction.

The invitation email provider is not connected. This implementation neither sends invitations nor claims delivery. OTP sign-in uses the existing Zoi authentication implementation; tests intercept all provider requests and do not send real messages. Native team invitation controls are not added; the public web acceptance route is the implemented surface.

## Authority and persistence

- 256-bit client-generated token; only SHA256 digest stored in SQL. Token removed from URL before app scripts load, private capture in sessionStorage, no referrer, no analytics scripts on acceptance page.
- Recipient equality uses normalized current verified `auth.users.email`, confirmed identity, current existing auth session and expiry. Banned/deleted/anonymous users cannot use invitation operations.
- Owner/admin grant limits; no owner grant. Issuer membership ID + revision and monotonic ownership epoch prevent stale links reviving after role or ownership transfer away and back. Disabled issuers invalidate pending links.
- Workspace-first row lock order; authority/current recipient email rechecked after waits; accept/revoke serialize. Acceptance uses preview revision CAS.
- Per-auth-user nonce receipts and cancellation tombstones recover lost responses without blindly repeating writes. Exact acceptance replay cannot recreate a later removed membership. First-time read/preview/recovery/conflict does not create profiles.
- Server budgets cap 150 requests per actor/day, 5000 request receipts per workspace, and 1000 invitation records per workspace. Records are not silently pruned because pruning cancellation receipts could revive delayed requests. Capacity requires an explicit future maintenance policy.
- Raw outgoing links survive only the creating browser session. Elsewhere the operator sees invitation state and can revoke/recreate a link, rather than recover a raw secret from the database.
- Confirmed outcomes clear pending markers independently of optional list/preview refresh. Actual shared ZoiCore throws top-level `ok:false` envelopes; those cases deliberately enter scoped receipt recovery, whose nested outcome is validated before settlement.

## Evidence

Source/schema: `supabase/migrations/20261001082945_workspace_recipient_invitations.sql`. Baseline production inspection found no recipient-bound workspace invitation pipeline, so this is a new schema/RPC candidate; existing team functions remain compatible.

Exercised database: `node tests/database/workspace-invitations.integration.mjs` passed all 22 groups on an isolated local PostgreSQL16 cluster. Includes actor/profile separation, first-time profile atomic creation, wrong recipient/current email, disabled/revoked identities, existing-member non-escalation, receipt replay after removal, issuer/owner ABA, expiry/revoke/CAS, admin grant limits, cancellation, and accept/revoke plus email/authority lock races.

Rendered/exercised browser: `node tests/browser/workspace-invitations/verify.cjs` passed at 390px and 1440px. Mounts the actual Settings and team modules, actual ZoiCore HTTP transport, actual recipient document. Backend HTTP responses are controlled fixtures, separately backed by real SQL tests. Covers lost create response/remount/recovery, private fragment removal, explicit recipient acceptance, actual transport conflict recovery, cancellation with unavailable preview, accepted receipt plus failed refresh, account-switch clearing, no unexpected email calls, no horizontal overflow or page errors. Screenshots `/tmp/workspace-invite-owner-390.png`, `-1440.png`, and recipient equivalents visually inspected.

Regression: `node tests/browser/workspace-team/verify.cjs` passed 390px/1440px existing-member role/remove/owner/admin/viewer, unknown/cancel/conflict, read failure and account fencing.

## Release integration

Ship SQL migration and new `/workspace/join/` route/assets with Settings/team changes as one coordinated capability. Root should update the parent Suite Settings script cache version in the deployed shell if necessary; child dynamic import version already changed to `20261001-invites`. Require independent review and actual production operator/recipient canary before calling the feature live. No production canary or real invitation has been created by this specialist.

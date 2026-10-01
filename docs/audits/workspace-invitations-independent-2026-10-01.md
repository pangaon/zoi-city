# Workspace invitations — independent implementation review

1 October 2026. Candidate review only. No production migration, actual invitation message or customer membership mutation by this reviewer.

## Backend evidence

Frozen migration `supabase/migrations/20261001082945_workspace_recipient_invitations.sql` SHA256 `05d4e42ec4a67be6f0dc9a0736205583b09b613f4e37dce57e87a1ffaea13787`; specialist harness SHA256 `58f1f1136fbb012e77b5f3e0d87a75fbabe92f0f51a0e0cd77e15343f2c465fb`.

Independently executed the full 22-group isolated PostgreSQL harness successfully. Additional independent execution extended it to 27 groups, proving unrelated-workspace list denial, exact creation receipt replay versus changed-payload refusal, issuer membership deletion/recreation invalidation, concurrent distinct acceptance requests granting only once, and mutation quota refusal with continued authorized status reads. Logs: `/tmp/workspace-invitations-independent-pre-freeze.log` (frozen hashes confirmed) and `/tmp/workspace-invitations-independent-extra.log`; extra reviewer harness `/tmp/workspace-invitations-independent-extra.mjs`.

The backend enforces verified current auth email, enabled user and current real auth session, independently of JWT email/profile metadata. Identity checks occur after workspace/member lock waits; recipient email and issuer authority races are exercised. Receipt actor IDs are auth user IDs while membership/owner comparisons use personal profile IDs. First-time preview/recovery/conflict creates no profile; explicit successful acceptance atomically creates a missing profile and membership. Existing members keep their role.

Owner revision plus issuer membership ID/revision prevents transfer-away/back and membership-role/remove/recreate resurrection. Owner grants are prohibited; administrator cannot invite administrator. Expired, revoked, disabled-issuer and wrong-recipient acceptance fails. Workspace locking serializes accept/revoke. Exact receipt replay never recreates a membership subsequently removed. Cancellation tombstones prevent delayed creation/acceptance. Private tables have RLS and no anonymous/authenticated direct access; helpers are not publicly executable. Tokens are server-hashed; delivery is explicitly manual sharing.

These tests use a controlled isolated PostgreSQL schema, not live customer accounts. The frozen backend is accepted for integration with the complete reviewed UI. This is not production or end-to-end acceptance.

## UI review in progress

Two early issues were corrected before freeze: confirmed receipts previously remained pending when a follow-up preview/list read failed, and nested response identities needed stronger scope checks. Real ZoiCore throws top-level `ok:false` envelopes; the specialist deliberately retains the core transport and uses the receipt recovery path for those cases. Actual-core browser exercise is required so mocked RPC behavior cannot hide that boundary.

Browser/source hashes, rendered evidence and exercised journeys will be added after the UI freeze. No invitation UI or production completion is asserted here.

## Frozen UI acceptance

Independent `node tests/browser/workspace-invitations/verify.cjs` passed at 390px and 1440px using the actual Settings/team modules, actual ZoiCore HTTP transport and real join document, with controlled backend responses. It exercises lost creation response + remount + receipt recovery without a duplicate create, fragment removal before app loading, no acceptance on page open, actual-core conflict recovery, cancellation despite unavailable preview, confirmed acceptance despite failed optional refresh, and removal of private organization UI after account switch. No page errors or horizontal overflow. Evidence: `/tmp/workspace-invitations-independent-browser.log`.

An additional independent actual clipboard run at both widths clicked Copy invitation link and read the resulting clipboard, verifying the exact origin + `/workspace/join/#token=` + generated 64-hex secret; it also asserted no sending/OTP/email RPC occurred. This shared only to the local test clipboard, not to a recipient. Evidence: `/tmp/workspace-invitations-independent-clipboard.cjs` and `.log`.

Visually inspected `/tmp/workspace-invite-owner-390.png` and `/tmp/workspace-invite-recipient-390.png`. The form, role/expiry options, private-link controls and explicit join/account switch controls are legible with consistent Zoi logo and palette. The owner rendering is the real module inside a controlled host fixture; it is not evidence of the deployed Suite shell.

Frozen hashes:

- Settings: `9c824ed8be52d49cd248e31d44f3ef52d5b8620482fae6c777c7609915bb4be5`
- Team: `fc76112876ab72d773a4b404e1c643dc31fc6b50e0b08e19640c16f5b0a10215`
- Owner invitations: `6bac618c6bf0360b5a2ab0c5a8a3dbdc19866e4d90e0edb80ff0e5ad2e5c894f`
- Shared helpers: `88a6b475538ce3817540214561591969a4a696ccad88fc0636ffa772d8ac59c3`
- Recipient controller: `c5ccc1af6dfd6de2e417c43dab97f126de012c8dc812fbb62eb9e1839fa1cab9`
- Join HTML: `bd2dfe79b51cbbfafc16b8bc5dd9ea519c4c9720a1465c139c040ad4b08d7057`

No remaining blocking issue found in these frozen candidate paths. Accepted for coordinated integration, subject to the integrator updating the Suite Settings cache version and deploying the migration together with the join page/assets. Live authenticated owner→recipient→actual roster verification remains distinct from this controlled browser + real isolated database evidence. No provider delivery, native invitation controls, physical-device sign-in or whole-SaaS completion is claimed. Session-only raw-link recovery and deliberate capacity stops are documented limitations.

Existing team browser regression also independently passed 390px/1440px after invitation integration, covering role/remove authority, conflict/cancel/unknown receipt handling and account clearing. Log: `/tmp/workspace-team-invitations-regression-independent.log`.

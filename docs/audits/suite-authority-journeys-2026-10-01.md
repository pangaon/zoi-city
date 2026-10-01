# Suite authority browser journeys — 2026-10-01

Controlled browser testing uses real Audience, Email, Bio and Settings modules and actual suite theme styles with synthetic RPC fixtures. Every external request is blocked. No live messages, campaigns, bio pages, claims or payments were created. This verifies browser behavior separately from the independently accepted 17-group PostgreSQL authority tests; it is not a connected production transaction claim.

## Reproduced and repaired

At both 390px and 1440px, the initial run reproduced:
- Audience retained its private edit form after `suite_session_unavailable` (`42501`/403). Its previous denial classifier only recognized older message strings.
- Email and Bio retained private saved drafts and editable controls after `zoi:auth-change`. Neither module had account/workspace lifecycle fencing.
- Settings already cleared correctly on the same current-session error.

Audience now recognizes SQLSTATE/status and current-session denial, clearing private contacts/forms. Email and Bio capture mount identity and workspace, remove their content on account change, check before and after every RPC, stop subsequent writes after scope changes, clear on authorization denial, ignore stale results, and return destroy/unmount controllers. Their existing persistence, scheduling and publish receipt semantics remain intact. Email clears failed reload snapshots. Root owns script cache-version integration.

## Verified local outcomes

`node tests/browser/suite-authority/verify.cjs` passes at 390px and 1440px:
- Audience add and subsequent expired-session edit denial clears private fields and contacts.
- Email saves a draft, schedules the synthetic campaign, then unschedules it; no provider connection is exercised.
- Bio saves a draft and publishes through the synthetic successful receipt, preserving public URL presentation.
- Settings saves the workspace name and clears after session expiry.
- Email/Bio account-switch content clearing, viewer downgrade denial, delayed write result after account switch, delayed read after workspace replacement, and zero new writes after workspace changes.
- No page JavaScript errors during these checks.

Existing regression suites pass at both widths: `tests/browser/audience-roles/verify.cjs` (viewer read/export; editor add/edit/delete/import; role denial; stale private-response cleanup) and `tests/browser/workspace-settings-cas/verify.cjs` (conflicts, explicit review, lost response, unknown receipt recovery/cancel, remount and private cleanup). Eight `email-persistence.test.mjs` tests pass; the extracted-function fixture now supplies the new active-account dependency and asserts that inactive sessions cannot start another mutation.

Artifacts: `/tmp/suite-authority-specialist/findings.json`, module/width screenshots and `*-owner-*` screenshots. Inspected Email scheduled controls at 390px and Bio published editor/preview at 1440px. Bio QR loads an external provider; its image is intentionally unavailable under this harness network block. QR/provider behavior is not accepted by this test.

Frozen hashes:
- audience.js `0528d04869ae795fc5e4c042a28aa239056959fc273eaa6dce2a13b48e31268f`
- email.js `0c58e8b185b0a731dcd339929bd4e9ed8a59ef380e2de474c584246bc0b781c4`
- bio.js `915d21ea6a50238be0b3b3c0ed07dce436c7311e3f822f1d16e6749ffd529fff`
- unit test `a91a37c53e3ccab13887c54ecf2826fd865a98a96cf4b5b6e55dc4b823cc8a3d`
- browser fixture `19f9e558fe24f534f59c9ddc05bc86b93923b6d9197fa2acb4c250bc0cec8935`
- browser verifier `65b2eef3fc7dbc79937478ab70e2d1b56a9abf2f0879e3502b27ddd789481b80`

Independent review requested. SQL authority candidate remains unchanged; no production apply or deployment performed in this lane.

Follow-up inventory: AI, Analytics, Calendar and Connect module files contain RPC calls without a local `zoi:auth-change` listener; Composer reads auth identity but lacks that listener. These require shell-plus-module lifecycle review before treating them as defects: absence of a local listener alone is not proof of an exposure. This candidate does not claim every suite module has been independently exercised.

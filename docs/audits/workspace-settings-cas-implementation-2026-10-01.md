# Workspace settings concurrent editing and recovery candidate

Author: workspace_qa. This is an uncommitted candidate, not a live deployment.
No production schema changes or production settings mutations were performed.

## Ownership and inventory

Owned runtime: `assets/suite/settings.js`.
Owned migrations: `20261001022938_workspace_settings_cas.sql` and the separate
second-stage `20261001022939_workspace_settings_legacy_write_disable.sql`.
Owned acceptance: `tests/database/workspace-settings-cas.integration.mjs`,
`tests/browser/workspace-settings-cas/`, and compatibility updates to existing
`tests/browser/workspace-settings/`.

Repository search across assets, mobile, API and Edge functions found settings.js
as the only runtime caller of `workspace_rename` and `ai_profile_save`. The AI
assistant calls `ai_profile_get` only; that read RPC remains unchanged. Historical
migrations/tests are not active client callers. External old clients cannot be
inventoried from repository search alone.

## Implemented boundary

- Versioned identity/voice snapshots, exact workspace/section binding, current
  actor authorization and section-specific writer roles.
- Identity revision advances on changed name; voice revision lives in a separate
  private ledger so insert, update and delete cannot recreate the old absent-row
  revision. Voice profiles cannot be reparented to a different workspace.
- An existing voice save locks the profile before its revision, matching direct
  update/delete lock order. A workspace name save locks only that workspace.
- Actor-wide advisory serialization protects receipt replay and both daily and
  total capacity checks. Permission is rechecked after waiting before returning
  a receipt or creating a cancellation. Receipts bind workspace, section, expected
  revision and desired values using SHA-256. Different reuse is rejected.
- Receipt storage is private/RLS with no client direct grants. Daily new receipts
  are limited to 500 per actor, with a total 10,000 per actor capacity. Old receipts
  are not silently deleted because that would erase replay/cancellation evidence.
  Capacity exhaustion is explicit; long-term lifecycle/archival policy remains a
  separate operational requirement.
- A missing request can be explicitly cancelled via the request RPC's section and
  `p_cancel_if_missing` parameters. A cancellation tombstone prevents a late save
  with that request ID from mutating. An already completed save returns its original
  receipt instead; cancellation does not undo it.
- Legacy ownership retains identity permission. Voice read/write retains membership
  requirements; a membershipless legacy owner snapshot has `voice:null`, rather
  than gaining access to previously denied private voice content. The current
  member-based suite does not advertise this legacy-only case as a complete editor.

## Client behavior

The existing Settings tool now sends loaded revisions. A conflict preserves the
user's draft and displays the newer values with readable labels. The user can use
those values or keep their draft for review; saving again is an explicit step.
Transport ambiguity checks the original receipt, without automatic repeated saves.
A remount retains only actor/workspace-scoped request references in session storage.
Unknown requests offer check-again or explicit safe cancellation, then reload the
current section. No business draft is written to browser storage.

A failure to store recovery metadata happens before any RPC: no write occurs, the
UI says nothing was submitted and offers a storage recovery/reload action. Account
changes and authoritative permission denials remove private controls. A confirmed
save reads current section values again before updating the shell, so a later
concurrent change is shown rather than falsely presenting the older receipt as
current state. Native remains an explicit web settings handoff, not a new editor.

## Review corrections and evidence

Independent reviewer found and this candidate corrected:

1. A permission revoke during actor-lock wait could formerly replay a receipt.
   Authorization now repeats after the wait; a real PostgreSQL regression covers it.
2. Moving a voice row to another workspace could leave the old ledger unchanged.
   Reparent is now rejected before mutation.
3. A missing receipt could strand the editor indefinitely. Explicit serialized
   cancellation and its immutable tombstone now provide a safe recovery path.

Dedicated browser checks passed at 390px and 1440px: stale name conflict, deliberate
reapply, lost reply recovery, unknown-request remount/cancel, private storage
reference, voice conflict/use-latest, storage failure before dispatch and account
change. Existing settings fixture was updated for versioned RPCs and retained
identity-vs-voice, permission, delayed-account and sparse-state checks.

Run the actual local checks:

```sh
node tests/database/workspace-settings-cas.integration.mjs
node tests/browser/workspace-settings-cas/verify.cjs
CHROMIUM_EXECUTABLE_PATH=/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome node tests/browser/workspace-settings/verify.cjs
```

PostgreSQL uses a disposable local cluster and synthetic actors, including direct
writes, competing requests and current authorization. Browser checks use actual
settings.js with controlled RPC responses. Neither is an authenticated production
settings write, and these do not prove all organization tools complete.

## Release sequencing and remaining limits

Lead owns application and release. Apply only the foundation migration first;
deploy/version the new settings client and verify it; then separately review/apply
the legacy-disable migration. The second migration preserves old signatures but
returns `client_upgrade_required` after authorization instead of mutating. Until
that second stage is applied, old writers remain unversioned and universal stale
write protection must not be claimed.

A direct administrative insert racing a CAS creation into a genuinely absent voice
row can still encounter PostgreSQL deadlock/unique-key transaction rejection. The
race test accepts a rolled-back contender and checks the surviving revisioned
value; it does not claim every privileged direct write is transparent or retried.
The client resolves ambiguous results through the receipt/cancellation path. Review
this operational tradeoff before migration approval. No schema is applied yet.

### Styled browser verification

The dedicated fixture now injects the actual `social/index.html` shell styles,
loads `/assets/zoi-theme.css` with the correct CSS MIME, and mounts in the suite's
`mount` container. It does not duplicate design tokens. Controlled RPC checks
passed again at 390 and 1440 pixels. Conflict and unresolved/cancellation captures:
`/tmp/settings-cas-conflict-{390,1440}.png` and
`/tmp/settings-cas-unknown-{390,1440}.png`. Phone and desktop were visually inspected;
recovery buttons now use the existing `zs-actions` wrapping flex gap and explanations
have spacing above them. Unknown recovery has no horizontal document overflow.
These exercise actual module and stylesheet bytes in an isolated container, not
the production authenticated shell or a live settings write. External fonts remain
blocked by the fixture and fall back to the suite's system font stack.

### Production asset and controlled journey readback — 02:56 UTC

After root reported deployment a6874a52f6ce654b9e23a3978197f053464af7a2,
independent readback at 2026-10-01T02:56:38Z returned:

| Production asset | Bytes | SHA256 |
| --- | ---: | --- |
| `/assets/suite/settings.js?v=20261001-workspace-cas` | 28260 | `c0f4a5f56bad982a041eebdd2cdb0e924b35d94aebae8b1fdbc03a6ac017078c` |
| `/social/index.html` | 44838 | `ca07ac8dac1c6400677aa222c28cd60865b569aac5b261f6e9d61edb8e506959` |
| `/assets/zoi-theme.css` | 45267 | `fb431bf80f8d71cf20b8f237b6d0e5b1b514eb33813fc2732050c42be30b5537` |

The temporary harness `/tmp/zoi-settings-production-verify.cjs` fetched those
production bytes, required the accepted settings module hash, and ran the existing
controlled RPC journeys at 390 and 1440 pixels. Both passed, including conflicts,
explicit review before resubmission, lost receipt recovery, unknown cancellation
following remount, voice latest-value choice, storage failure before submission,
and account-change cleanup. Phone conflict and desktop unknown state screenshots
were visually inspected again; screenshot prefix is `/tmp/settings-cas-production-`.

This confirms deployed browser code/style bytes and controlled interaction behavior.
It is not an authenticated production customer save. Root owns live migration,
permissions readback, CI and the separate legacy-writer cutoff; this agent made no
production writes or schema changes. Foundation application was reported by root,
not independently applied here. Legacy cutoff was still pending at this readback.

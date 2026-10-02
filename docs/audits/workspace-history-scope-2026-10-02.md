# Workspace history scope correction

## Reproduction

The actual Social shell at390/1440 reproduced: open workspace A, navigate Business home, switch to workspace B, press browser Back. The URL reverted to A while the header and mounted context still showed B (`Other business`). `restoreRoute` handled module/view only, ignoring the workspace intent. This could cause work performed under B while the user was looking at an A-scoped URL.

## Correction

History now parses a single UUID workspace intent (`workspace` or legacy `ws`, never both/duplicates), checks it against active context and routes changed workspace through fresh `zoi_me`/existing context loading. Invalid, missing history intent or unavailable membership clears the prior private surface and opens the existing explicit workspace chooser. Pending edits use the existing leave confirmation and restore the current URL on cancellation.

The adjacent existing loader captures requested route and generation, refuses malformed explicit intent, filters unknown roles and duplicate memberships, and re-enters routing if the URL changed during a held membership read. Rapid events for the same pending route do not start duplicate loads. Existing initial no-query workspace selection remains supported. This is routing correctness; backend services still enforce current permissions.

## Evidence

- `tests/browser/workspace-history/verify.cjs` passes390/1440 against actual Social shell, actual Business home module and controlled Auth/backend/Overview fixture: A→B→Back→Forward; exact header/URL/context; invalid, duplicate, conflicting alias, missing and unavailable intent; pending edit cancellation; rapid held membership responses arriving out of order; duplicate hash event causes no extra membership read; revoked role yields chooser with no previous mount.
- Existing `tests/browser/workspace-shell/verify.cjs` passes390/1440: organization/community creation, held/lost creation, exact workspace context, account clearing and claim tracking/editor routes.
- No customer workspace writes or live Auth mutations. Fixture-controlled writes are not production evidence. This does not claim every Contacts/Documents/Operations CRUD journey was rerun.

## Preserved work and remaining Contacts gap

Unstaged service-menu/service-queue additions in `workspace-navigation.mjs` were inspected and left untouched. Existing Social cache/version/service content was preserved.

The primary navigation item `Contacts & audience` is `audience.js`, which uses `audience_access(p_workspace)` then `audience_list(p_workspace,p_q,p_tag)`. Operations has a separate contact record edition using `ops_records_list`. Accepted parea name reuse currently covers Operations contacts only; it does not unify those stores or claim primary Audience contacts are available there.

The next adapter should reuse Audience access proof and current workspace search, project names only, label the source clearly, and allow supported phone selection before guest entry without writing a duplicate contact store. Retained `audience_access` has exact workspace/role/write/consent metadata; the UI currently accepts an array from `audience_list`, so its authoritative row projection needs confirmation from retained definitions before claiming a strict per-row scope contract. No provider delivery is implied.

## Freeze

- social/index.html158d67d4387d717243620a855800be5c10f0cd204e28b3ee61d9a1c4147673cb
- tests/browser/workspace-history/verify.cjs7b7db6e61a786e3e75ab6d6da879e68d8204f5f28370ff0c1e386c21fba846fa

# Volunteer shift operating journey — 2026-10-02

## Candidate and authority

Local candidate only. No production database reads, migration applications, customer messages or invitations occurred in this work. Root owns deployment and healthy authoritative preflight. Independent acceptance is pending.

The existing Programs & volunteers suite now uses the existing program, shift, registration and audit stores for an operating journey: save a program, publish a shift, let a signed-in volunteer reserve one place, and let an authorized organizer mark arrival, completion or no-show. Attendance corrections require an explanation and preserve historical receipts/audit. Attendance never changes signup, place count or payment, and does not infer hours worked.

Staff saves have actor/request/workspace/operation/target/payload-bound durable receipts. A lost create response retains the allocated record ID. The UI persists recovery in actor/workspace-bound session storage, blocks further edits until resolved, and clears a confirmed receipt before optional reloading. Request cancellation creates a tombstone that fences a later save. Exact historical replay does not reapply attendance after cancellation/rejoining. Registration revision advances on retained signup/cancel writes too; rejoining resets current attendance while earlier staff records remain historical.

Current workspace role/session is rechecked for staff reads, writes and receipt replay. Workspace→actor receipt→program→shift→registration ordering matches retained shift/signup locking. Session expiry after waits prevents commit. Guest signup/cancel retain the existing unique registration, overlap, capacity and cancellation rules, with wall-clock start eligibility and active-session checks after waits. Staff correction notes are omitted from guest registration receipts.

## Source and database evidence

Retained source: `20260930004540_organization_volunteer_scheduling.sql`; current authority helpers from `20261001170000_workspace_current_authority.sql`. The candidate guards exact retained `prosrc` hashes for program save, shift save, roster, signup, cancellation and schedule list before changing them. Existing source may differ in production: a matching readback is a release prerequisite, not assumed.

`node tests/database/volunteer-shift-operations.integration.mjs` passes23 isolated PostgreSQL groups. These exercise actual retained and replacement functions, create/replay/cancellation receipts, attendance CAS/correction, current role/session replay, final-place concurrency, staff-cancel versus attendance serialization, historical replay after rejoin, real shift-lock waits crossing signup/cancel start, actor-lock waits crossing create start/session expiry, and the current private schedule reader. They do not constitute production execution.

Receipts have a finite actor quota (9900 saves,10000 total including cancellation reserve). Receipt cleanup is intentionally absent so deleted receipts cannot permit duplicate old creates. Exhausting this quota blocks more saves and requires an independently designed archival/reset policy; the UI retains unresolved recovery. This limitation remains open.

## Rendered and exercised journeys

- `node --test tests/unit/volunteer-operations.test.mjs`:7 exact scope/revision/receipt tests.
- `node tests/browser/volunteer-shift-operations/verify.cjs`: actual registered operator wrapper/core and public module at390/1440 with controlled persistence: program create loses response→destroy/remount→recover exactly one program→shift create→public signup→staff arrival→completion→inline correction→viewer restriction.
- `node tests/browser/volunteer-shift-operations/actual-shell.cjs`: actual Social shell at390/1440 using updated controlled contracts, same-account save/readback, role denial, held roster/account change, false refresh, held workspace/surface transition, malformed identity.
- `node tests/browser/volunteer-shift-operations/ownership.cjs`:12 held refresh/read × actor/workspace/surface cases; disconnected retained private DOM cannot reappear.
- `node tests/browser/volunteer-shift-operations/import-ownership.cjs`:6 held initial imports; actor/workspace change and same-turn ancestor removal/reinsertion dispatch zero stale reads and preserve replacement content.
- `node tests/browser/volunteer-shift-operations/public-scope.cjs`:16 public refresh/read cases covering actor change, ancestor retirement, same-session token rotation and denied session; no stale signup dispatch or confirmation.

Phone screenshot `/tmp/volunteer-operating-390.png` inspected: legible rounded controls and roster, inline correction form rather than browser prompt. Desktop `/tmp/volunteer-operating-1440.png` captured. These are controlled local renderings. No claim of live backend availability or real volunteer registration is made.

## Native and rollout gates

The native companion preserves the existing program/shift forms and adds the same receipt contract; see `native-volunteer-operations-2026-10-02.md`. Older installed apps retain the exact public `org_program_save` / `org_shift_save` signatures and result shapes. Those compatibility wrappers invoke the hardened private writers under current workspace/member/session locks and recheck session after record waits. Existing CAS, capacity and temporal validation remain authoritative. Legacy create has no nonce or recovery receipt: after an uncertain response, older clients must inspect the schedule rather than blindly retry. New web/native clients exclusively use the modern receipt writers; no fallback was added.

The compatibility regression exercises both old RPCs for create/update/read, stale-version rejection, viewer/paused roles, deleted/expired sessions, role downgrade while queued behind an actual workspace lock, and expiry while waiting on actual program/shift rows. Failed updates and audit entries roll back together. Modern exact nonce replay and rejection of a missing nonce still pass. Direct table writes stay denied.

Apply only after independent review and healthy exact-definition readback. The migration uses bounded5s lock/30s statement timeouts and transactional DDL. Tables/receipt history are additive; do not undo by restoring weaker authority or deleting receipts after writes have occurred. An older client can retain its existing save functionality but cannot provide the new lost-response recovery or attendance controls until updated. Native source/build verification does not update already installed binaries. No email/SMS provider, notification delivery, online payment, signed mobile distribution or physical-device test is claimed.

## Frozen source hashes

- `supabase/migrations/20261002180000_volunteer_shift_operations.sql` `0e4ca5b114919c71ae3f908b4497426197134ad1c984daec32daf2140054f21e`
- `assets/organizations/core.mjs` `1e76621dc757885c1f76c665e8e77d6d70de6247ebf24312594ad842e5a37fbd`
- `assets/organizations/shift-roster.mjs` `a63c6bfc9d05431deced1b06bb8f2a16ab7a7e5c642e63ccbee5435f7932fc67`
- `assets/suite/organizations.js` `2ebb814ec2e31b7de8b367d58f898f5cdd6405b3d1abb6b2191b91c1954796f1`
- `tests/database/volunteer-shift-operations.integration.mjs` `13a221e3d7a9e297abb0821ed140adb5ffa69b73595a3765a96c83e8888024a6`
- `tests/unit/volunteer-operations.test.mjs` `8e3baddb1ebbae576d69e6be64c501c87ffdd403ae94f71677d0142909480796`
- `tests/browser/volunteer-shift-operations/verify.cjs` `60774aca8986fe16fc5576530f455175643ff05caccf6612a1f9201d62af02c2`
- `tests/browser/volunteer-shift-operations/ownership.cjs` `e57a54469e63e4d2ef3f5737001f4ae495fdc1d651df0150f97d867aea4cf067`
- `tests/browser/volunteer-shift-operations/import-ownership.cjs` `4dd7f04ef56ddda26517d8d3cc2a3dfadf3350c44153bd195c2e6bcb5ca2af68`
- `tests/browser/volunteer-shift-operations/actual-shell.cjs` `870b53d869463dbeca25801e4777574c27b3f542043a8994afdb67697428c51b`
- `tests/browser/volunteer-shift-operations/public-scope.cjs` `00b1feeba4a6fe721bcd259884be923c56e7651e2f1d024c2c846b43057edc7d`

- `assets/organizations/volunteer-operation-model.mjs` `92217d892457db3530c5d0bc2c4e8cb906438b95bca7901434bcab7d21b4cea2`

The pure receipt/model predicates were extracted unchanged into `volunteer-operation-model.mjs` so web and native use the same validation without importing DOM/session-query dependencies into Metro. Web roster reexports remain compatible. Source/behavior regression passed after extraction. Root cache parents are `social/index.html` organization script and `volunteer/index.html` core module import; wrapper/core dependency queries are already versioned.

## Installed capability boundary — superseding freeze

The same transactional migration installs `org_programs_list` metadata `actor_profile_id` and `capabilities: {volunteer_operations: 1}` after current workspace/member/session authorization. The client requires an exact numeric version, scoped workspace, valid internal profile ID and recognized role. Existing installations without the new scoped envelope show an explicit unavailable state; scoped schedules without the exact capability remain read-only. No uncertain save is ever retried through a legacy writer. New clients do not call modern save, roster or receipt APIs until this capability is verified.

Web and native local pending markers load without a server request. Missing capability disables Check/Cancel without deleting the marker; availability refresh remains usable even with pending recovery. Once exact capability is observed, the original request can be checked. Refresh resets capability and private forms; actor/workspace/lifecycle retirement still clears the surface. Public signup/cancel contracts are unchanged.

Verification:23 isolated PG groups plus authenticated/anonymous execute-grant assertions;24 combined model/native tests;14 web capability cases at390/1440 (legacy, absent, string, unknown version, invalid profile, role and workspace), each retains a pending marker with zero modern API calls before capability, then recovers after enabling. Actual Expo390/1440 includes absent capability both before first create and after lost-response remount, then successful recovery/attendance. Existing web operator/public, Social,12 private scope,6 import and16 public scope cases still pass. TypeScript passes. New fixture: `tests/browser/volunteer-shift-operations/capability.cjs`.

This supersedes earlier frozen hashes/acceptance only for changed capability files. Independent review and authoritative production preflight remain required. No application or deployment occurred.

- `tests/browser/volunteer-shift-operations/capability.cjs` `6780861e1365800dcfbce830e0c8e6b9599c8dc86a3e0d80b42c94ccf0d14e28`

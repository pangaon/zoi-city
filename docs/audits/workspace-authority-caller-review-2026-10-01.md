# Workspace authorization caller review — 2026-10-01

Read-only production definition review. No customer writer RPCs or claims executed. Authoritative definitions and available ACLs are retained in `workspace-authority-live-callers-2026-10-01.json`. This is a code-path finding, not a claim of successful customer exploitation. Claim backend and the separate `bizpage_status` correction are outside this proposed patch.

## Confirmed problems

`zoi.assert_ws` grants access to `workspaces.created_by_auth` even when the creator has been removed or ownership transferred. It also admits every current membership role. This makes it unsuitable as the sole write authorization gate.

| Priority | Current callers | Effect |
| --- | --- | --- |
| 1 | `audience_list` | Removed historical creator can read contact rows, including private contact data. |
| 1 | `audience_upsert`, `audience_import`, `audience_delete`, `asset_save`, `asset_delete` | Separate `audience_asset_role` restores owner authority to a historical creator once their membership is absent. Explicit viewer membership currently overrides this fallback, but deletion re-enables it. |
| 1 | `workspace_settings_save`, `workspace_settings_request` | `settings_authorize` permits identity writes for historical creator even with explicit viewer membership. Read helper also exposes workspace identity after removal. Voice writes already require current membership role. |
| 1 | `email_campaign_save/delete/duplicate/schedule/unschedule`, `bio_save`, `link_save` | Sole `assert_ws` gate permits removed creator and current viewer mutations. Campaign scheduling here is database state, not proof that an email provider sends. Bio publishing changes public-facing content. |
| 1 | `social_post_approve/reject` | Additional `IF ws_role(...) NOT IN (...)` fails open when role is NULL after removal. Approvals can mutate publication/scheduling state; external publishing is not exercised by this audit. |
| 2 | `social_post_submit`, `hashtag_save/delete`, `template_save/delete`, `slot_save/delete` | Same sole membership gate allows viewer and removed-creator writes. |
| 2 | `asset_list`, `email_campaign_list`, `bio_status`, `link_list`, `template_list`, `hashtag_list`, `slot_list`, `social_post_targets_list`, `tickets_event_stats`, `bizpage_get` | Historical-creator read access survives removal/transfer; includes unpublished content, campaign state, analytics or event totals depending on caller. |

Real product entry points include `assets/suite/audience.js` (audience_list), `assets/suite/email.js` (campaign scheduling), `assets/suite/bio.js` (bio_save), and `assets/suite/settings.js` (versioned settings writer). Existing client authentication does not fix server authorization.

## Existing protections and exclusions

`bizpage_save` and `zoi.bizpage_save_profile` additionally use newer `home_content_authorize`: current membership role plus locked owned-listing authorization. Do not remove that guard or regress explicit owner content handling. `bizpage_get` lacks that stronger actor gate. `ops_role`, `org_role`, and `ws_role` are current membership readers; their NULL results must be explicitly denied where used for permission checks. Legacy `workspace_rename` and `ai_profile_save` now reject with `client_upgrade_required`, so they are not active mutation paths. Workspace creation/profile-linking uses of `created_by_auth` are not by themselves stale-authority defects.

`workspace_team` owns the narrow `bizpage_status` fix; this lane will not duplicate it. The reviewed claim migration is frozen and will not be changed by this correction.

## Proposed correction, pending ownership agreement

1. Introduce one current-role resolver with read and locking-write modes. Explicit membership role always wins, including viewer or unknown/NULL roles (deny writes). Remove historical `created_by_auth` fallback entirely. Preserve a narrowly documented legacy **current** `owner_profile_id` fallback only when no membership exists; it must disappear immediately on actual ownership transfer. Before choosing this compatibility path, confirm current workspace creation/team ownership invariants and measure only aggregate orphan-owner counts. Do not silently seed memberships or change ownership.
2. Make `assert_ws` delegate to read authorization, preserving signature and legitimate viewer reads. Keep read authorization compatible with existing STABLE list routines (`hashtag_list`, `link_list`, `slot_list`, `template_list`); do not insert a locking SELECT into these paths without explicit PostgreSQL compatibility tests.
3. Add a distinct writer gate and replace the sole `assert_ws` checks in exposed mutation routines. Content and audience/assets require owner/admin/editor; identity settings require owner/admin. Preserve existing stronger role restrictions. Use `coalesce(role,'')` for fail-closed checks.
4. Writer authorization locks workspace and current membership in a consistent order, then rechecks authority after lock waits. Transfer/removal/demotion must serialize with writes, including delayed receipt/replay paths. Match current team writer lock order before implementation. Do not promote old receipt possession to authorization.
5. Route `audience_asset_role` and `settings_authorize` through the same role semantics while retaining existing response shapes, CAS versions, request receipts, consent restrictions, storage URL rules and explicit clears. Preserve existing reader/writer ACLs unless independently proven wrong.

Proposed ownership: new narrowly scoped migration + isolated PostgreSQL integration suite + this audit. No UI ownership or production apply. Full exact current definitions in retained inventory should be the patch baseline, avoiding older migration bodies that omit subsequent fixes.

## Required compatibility and adversarial acceptance

- Current owner/admin/editor/viewer positive read cases; correct writer allow/deny matrix per family.
- Removed creator denied even after membership row deletion; explicit viewer creator cannot rename/publish; ownership transfer denies former owner. Transfer-away-and-back requires current authority, never historical creator status.
- Current actual legacy owner without membership: explicit expected compatibility decision and fixture; ownership pointer mismatch must deny. Missing user profile/workspace, anonymous and unknown role deny.
- STABLE list functions still execute under expected isolation without illegal locking behavior.
- Two-session demotion/removal/transfer before writer lock acquisition causes denial, with unchanged target rows and no success receipt; mutation already holding authority locks serializes the team change correctly.
- Existing settings lost-response recovery, conflict receipts and cancellation remain scoped and reauthorized; audience consent restrictions remain separate from contact editing.
- Exact routine signatures, ACLs, RLS/direct-table access and unaffected home-content guards retained.
- Browser exercises representative Audience, Email, Bio and Settings owner workflows and downgraded-account rejection, with no customer send/publish writes. Source authorization evidence, controlled journey results and eventual production verification must remain separate.

No implementation or production change is included in this audit. Broader account/session eligibility changes should be separately scoped rather than silently changing all suite login requirements in an authorization helper patch.

## Local compatibility follow-up

Retained actual `zoi_create_workspace` and `zoi_link_profile` both create the owner membership with the workspace; missing-membership owner access is legacy recovery compatibility, not the normal new-workspace path. Existing reviewed `20261001050608_workspace_team_authority.sql` explicitly preserves current `owner_profile_id` fallback only when membership is absent, lets explicit roles win, and downgrades stale `role='owner'` when the profile no longer equals the current owner pointer. Reuse those semantics rather than inventing a conflicting suite model. Its lock order is workspace FOR UPDATE then actor membership FOR SHARE; new writers should match it. Current-owner missing-membership aggregate production counts remain unqueried while root investigates database connectivity.

Add a regression for stale owner membership surviving ownership transfer: it must not retain owner-level writes merely because its role text still says owner. This is distinct from historical creator fallback and explicit viewer downgrade.

## Implemented candidate, not deployed

Parent authorized local implementation after the read-only proposal. Frozen candidate `supabase/migrations/20261001170000_workspace_current_authority.sql` adds a STABLE current-role reader and separate workspace-first locking writer gate. It replaces three existing helper bodies, sixteen mutation authorization calls, and adds the gate to two settings receipt paths immediately after the existing actor advisory lock. Settings initial eligibility remains nonlocking, so a demotion completed during advisory wait is observed before receipt access. Historical creator fallback is removed; existing team current-owner/explicit-membership/stale-owner semantics are retained.

All twenty-one replaced existing definitions have exact live-definition MD5 guards. DDL is transactional, with 5-second lock and 30-second statement limits; a newer function definition aborts rather than overwrites it. CREATE OR REPLACE preserves existing ACLs. Three new private helpers revoke public/anon/authenticated execution. This migration changes no ownership, membership, customer content, receipt schema or provider integration.

`node tests/database/workspace-current-authority.integration.mjs` passes 13 isolated PostgreSQL groups, using exact retained production bodies from `tests/database/fixtures/workspace-authority-before.sql` and the full inventory. Captured ACLs are restored where present; unrecorded ACLs use fixture defaults and are checked only for preservation, not claimed as production ACL evidence. Positive tests exercise 21 mutation paths and six readers; populated campaign/social transition assertions and settings CAS/receipt assertions supplement permission-only calls. Role denial, STABLE compatibility, transfer/removal/demotion races, write-first serialization, post-advisory replay revocation, unknown roles and cross-workspace/direct-table denial are covered.

Frozen hashes:
- Migration: `cd7d38bfaf4e4e130dd7cc362c9ef486caa1997538f6ad72b6a64e178ce6b119`
- Test: `fe5237f0da822ff95815d0164bc3a303cd9c6c4561d523df9c16717ad121c0a0`
- Before fixture: `fd16cb18374cc5203723ddbeacb7db18e04414751303c94c000e9629affa5541`

Independent review requested. Browser suite journeys and production deployment are not yet verified for this candidate. The read helper intentionally uses transaction visibility without row locks; the mutation guard provides serialization. Current Auth account/session eligibility remains the existing suite contract in this bounded patch. Frozen claim migration and separately owned `bizpage_status` are untouched.

## Superseding current-session requirement

Root explicitly expanded the candidate to require an enabled, nonanonymous current Auth account and an active matching `auth.sessions` row, while preserving phone-auth users with no email or email confirmation. New private helpers `suite_current_session` (STABLE, no locks) and `suite_lock_session` (current Auth user/session share locks after workspace/member waits) implement that contract. This supersedes the earlier role-only candidate and its account-eligibility limitation. Read checks use normal statement snapshot visibility; writer checks run after authority waits and serialize later account/session revocations.

Final local run passes **17 groups**, adding deleted/banned/anonymous account rejection; expired/missing/malformed/unknown/mismatched session rejection; phone-only positive behavior; ban and revoke completed during workspace wait; and writer-first session-revocation serialization. Final frozen hashes:
- Migration: `67bfcd07af32c9d8da78ace87ed67c2aeffd209d751e8ffad2417f8114e3a07a`
- Test: `288c5a81d3866a1c77b60374cabcd8dcd6bd7a7a435f4a195bdb9d12c53f8fc7`
- Exact before fixture remains `fd16cb18374cc5203723ddbeacb7db18e04414751303c94c000e9629affa5541`.

No production apply or customer mutation. Independent review is rerunning this superseding candidate.

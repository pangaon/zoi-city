# Member start and assigned work — 2026-10-02

Local implementation candidate, no schema changes/customer invites/sends/live writes. Root owns release and independent acceptance.

## Real operating journey

After confirmed recipient-bound invitation acceptance, Open your workspace now points to existing Overview with exact workspace ID. Overview includes current access and My assigned work, using existing workspace_team_get actor_profile_id plus ops_records_list task rows. Internal profile ID remains distinct from Auth user ID. Fresh role snapshots must agree; all rows must match workspace. No-deadline assigned tasks are included, while other colleagues’ tasks are excluded from this personal section. Existing global priority report remains below, now accurately labelled Workspace activity.

A task opens its exact saved record via durable #operations/task/UUID. Existing Operations revision/nonce/receipt writer edits status; lost response is recovered through the same request before another save. No new task writer or task store. Viewers review records only; membership denial clears assigned work. Malformed/missing work context fails closed with a working Choose workspace record action.

Shell delta is one conditional: owner/admin retain existing setup cards; editor/viewer no longer receive owner setup cards above assigned work. Existing workspace/history/account guards untouched. Initial role remains server loaded; each private member refresh independently checks authoritative reader permissions.

## Evidence

- Actual Social shell at390/1440: `node tests/browser/member-start/verify.cjs`. Editor has no owner setup cards, opens own no-deadline task, completes via persisted-contract fixture, recovers lost response exactly once, returns to completed task state. Viewer cannot save, removed membership clears task content. Light/dark screenshots saved `/tmp/member-start-{390,1440}.png` and `/tmp/member-start-dark-{390,1440}.png`; phone light inspected.
- `node tests/browser/member-start/ownership.cjs`:12cases at390/1440. Held refresh + actor/workspace/surface replacement dispatches0RPC; held reader + same transitions dispatches only original1RPC, clears retained surface and preserves replacement.
- `node --test tests/unit/member-start.test.mjs tests/unit/organization-project-route.test.mjs`:16pass. Identity distinction, role/scope mismatch, exact task route and invalid document/task combinations covered.
- Existing organization workflow390/1440, workspace history390/1440 and workspace invitations actual-ZoiCore390/1440 all pass. Chromium executable explicit where fixtures require it.

## Boundaries and follow-up

Controlled backend data exercise actual mounted clients; no production membership/task mutation claimed. Invitation authentication/email transport unchanged; no invitation sent. Existing native task workflow already supports assigned tasks and contextual work; this new Overview member-start view is web-only until corresponding native navigation work is assessed. The general Social header still offers Business home/Design home according to existing role mapping; authorization remains checked by its backend.

Design debt retained from root: Documents legacy introduction repeats headings and crowds file-format/implementation details. Not changed in this member operating slice. Existing live backend availability gates remain separate.

## Frozen files

- `assets/suite/member-start.mjs` `3b361f5365dc1522f41a2636d012ee2fca76b26d9038830f30e88c9689b64b0c`
- `assets/priorities/view.mjs` `6544baa96b94b4148c2e247037310f75191124074b48698dbbbed07034ad3f98`
- `assets/suite/priorities.js` `92fca3391db9acbd75fca43a5c68863cbffa8267e58c178e490a8d014ab6c96f`
- `assets/workspace/invitation-accept.mjs` `bcfeb9d0bfc949b86d3eae0ebd857caf269168e43c3554e5893d4947ed3fd8e1`
- `assets/suite/operations.js` `d6c6a0eb4b4c0bfa76b2a8c66a7b74f0addff02c7fa3dbbf5d8fd0bffec9ebf8`
- `assets/suite/workspace-navigation.mjs` `004d503b88da1c6a563f4522d6673d63dd5ffc59d6da4173db2944f2d8ed2dcb`
- `social/index.html` `d8b15bb392804613ae13f35430316a542249a5a5b6956d8016fb935f7a005a6e`
- `tests/browser/member-start/verify.cjs` `94b3373b6ad6be5174ddb115df183ecb1bba25c14c4e563003dfcff643b87891`
- `tests/browser/member-start/ownership.cjs` `f4584e494f70fddbbcf30df78cc43c8ec442d6c6dab85909e595583911097f7a`
- `tests/unit/member-start.test.mjs` `14ad136bcea3574614a81b289b8f40853a373e883336e5d2b70da25f081bcb66`

## Review correction: refreshed sessions and workspace activity

The Overview now compares authoritative session identity, captured workspace and owned surface rather than raw token equality. Legitimate same-account refresh preserves assigned work. Its existing workspace activity loader receives a scoped transport adapter: refresh authentication, recheck scope, dispatch with `auth:prefer`, and recheck scope after response. No source reader or ranking contract changed.

Producer reran the actual member journey at390/1440 and all12 member scope cases. Reviewer fixtures `refresh-independent.cjs` and `activity-scope-independent.cjs` also passed in producer runs: same-actor token rotation retains assigned work; held activity refresh followed by workspace or surface replacement dispatches zero stale source requests at both widths. These are controlled browser tests, not production backend evidence.

The reviewer’s same-turn detach/reinsert navigation case is now fenced synchronously: both the member panel and lazy Overview wrapper consume observer removal records before accepting any scope check. A retired owned surface cannot navigate or resume after reattachment. The controlled navigation-retirement fixture passes390/1440; the full member journey,12scope cases and16units were rerun successfully after this correction.

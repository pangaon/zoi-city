# SaaS organization setup — 2026-10-01

Candidate, not a production completion claim. Reviewed the full recovery scope, consolidation plan, guided website onboarding brief, current suite navigation/context, Settings, Operations, business-home editor entry and native Account.

## Concrete defect and correction

Settings incorrectly populated the workspace name from the AI profile’s business_name. These are separate records: a renamed organization could appear to revert to stale copywriting branding. Both save buttons also announced success without verifying the actual saved state; late account responses could retain private AI notes.

The shared Settings module now reads the selected workspace through authenticated zoi_me, keeps AI branding independent, and checks fresh authoritative state after rename/voice writes. An unconfirmed result offers a read-only check rather than sending another change; no false Saved/callback. Pending values remain in memory only. Account/workspace changes, detachment and authoritative denial clear private fields. A failed initial AI read cannot enable an empty form to overwrite existing content. Workspace viewer/editor restrictions are visible; server remains authoritative.

Live read-only inspection found workspace_rename called assert_ws, which accepted any workspace membership. The new migration preserves legacy created_by_auth and owner_profile_id ownership while restricting membership authorization to owner/admin. It retains the boolean return and denies blank/oversized names and anonymous callers. This migration has NOT been applied by this lane.

Root owns shell integration of onWorkspaceRenamed({workspaceId,name}), guarded against stale actor/workspace context. The shell updates only after the exact fresh name is confirmed. Native Account exposes fixed-origin links for the currently loaded, selected workspace’s Settings and Business home editor; these are explicitly browser tools with possible separate sign-in, not native editor claims.

## Journey evidence

- Source/contract: live workspace column types and assert_ws/rename behavior inspected; current ai_profile_get/save migration and zoi_me consumer inspected.
- Render/journey: actual settings module at 390 and 1440 via tests/browser/workspace-settings/verify.cjs. Different workspace/AI names remain distinct; lost reply resolves via readback with one write; mismatch stays unconfirmed; late account response and denied read remove private fields. Zero page errors.
- Server: tests/database/workspace-rename.integration.mjs: nine real isolated PostgreSQL checks for owner/admin, legacy creator/profile-owner, viewer/editor/member denial, revoked/unrelated actor, anonymous/no actor, and invalid-name preservation.
- Native: accountWorkspaceLinks tests cover selected UUID, fixed origin, no tokens and invalid IDs. Full native test/typecheck results reported with handoff. No physical iOS/Android or installed-app browser-opening test claimed.
- No production client edits, real messages, purchases, formation filings or provider connections performed.

## Requirement ledger

The full scope remains authoritative; rows outside this bounded lane are explicitly not marked complete.

| Scope area | Current evidence / next step |
| --- | --- |
| Site-wide brand and product overhaul | Settings form identity and read-only/error states corrected. This does not certify site-wide visual completion. |
| Mobile application | Added explicit selected-workspace browser handoffs; native route tests and typecheck. Physical-device acceptance remains open. |
| Production recovery | No deployment in this lane. Root owns migration review, exact archive and release. |
| Unified business foundation | Implemented candidate identity separation and owner/admin rename authorization; isolated mounted/SQL tests pass. Full team lifecycle still needs authenticated production acceptance. |
| Creator growth | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| Creative production | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| Marketing and automation | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| BuyGreek commerce | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| Global Greek community | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| Profession-specific operations | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| Ownr-style business administration | Real Operations records remain separate from incorporation/filing providers; no government filing connection introduced. |
| User experience and release quality | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| Ticketing, seating and immersive venue experience | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| Greek dance and cultural groups | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| Festivals and community events | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| Coordinated weddings, funerals and event spaces | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| Greek sports leagues — planned now | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| Additional community operating needs | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| Geographic editorial editions and client brand identity | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| Shared Zoi Studio and live creation | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| Culinary recipes and Community cook-along | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| Signature event operating suite and reusable global event journeys | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| Site-wide following, reputation and contextual reviews | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| Signature whole-ticket groups and social distribution | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| Account-aware discovery and reusable autocomplete | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| Verified map coordinates and stable close-range GIS | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| Signature experience design competition and integrated delivery | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| OPA Productions Montréal rollout after Toronto acceptance | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| Greek artist discovery and enrichment from Bandsintown | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |
| OPA Ploutarchos and Andromache all-eight-stop official source discovery | Outside this bounded settings/organization identity acceptance; retain existing scope and specialist evidence. No completion claim added. |

## Remaining owner journey work

Guided website onboarding must still be judged against actual draft ownership and exact editor handoff, not workspace creation alone. The isolated owner save→preview→publish harness is evidence for synthetic records, not a live client publishing acceptance. Company records are not formation/filing services. Email, payment and social-provider availability are unchanged. Native organization setup currently uses the explicit website handoff. Production actor/role acceptance and complete multi-workspace shell journeys remain release-owner checks.

## Final edge cases and limits

The mounted regression also covers viewer controls, failed initial AI reads (disabled until retry), valid sparse `{}`/legacy null AI profile creation, and definitive rename validation/boolean-false responses restoring editing without claiming success. Uncertain outcomes remain check-only; this legacy setter has no durable cancellation API, so the UI does not pretend to cancel an in-flight write. AI settings remain separate from public listing content and publication.

Live `zoi_me()` currently exposes membership-joined workspaces only. A legacy creator/profile-owner without a membership can retain server rename authorization but cannot discover that workspace through the existing shell; this candidate does not widen private read projections. Membership reconciliation remains a separate controlled task.

Final native typecheck passed and all 199 native tests passed. Native helper validates the selected loaded workspace and fixed-origin destinations; Account guards links against account changes and reports browser-opening failure. Physical-device browser handoff was not exercised. Both mounted web runs completed with zero page errors and closed their browser/server.

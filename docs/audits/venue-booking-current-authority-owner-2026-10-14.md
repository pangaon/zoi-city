# Venue and booking current authority

Read-only production inspection found `venue_require_member` accepted `auth.uid()` and an unlocked membership row, without checking an active account/session. Its `ensure_profile` call did not add a session check. The booking operator reader then used a raw owner/admin membership label instead of the foundation's locked effective role. A false owner label could pass that private-data check.

The candidate migration replaces only the exactly guarded private helper and booking operator reader. It reuses `workspace_locked_role` and its current account/session locks unchanged. Venue management remains owner/admin; existing viewer/editor venue reference reads remain allowed. Booking customer-data reads remain owner/admin only. Actual-owner fallback follows the installed foundation, with a truthful returned owner role; a false owner membership label never grants management or private booking-data access. Workspace precedes profile/resource/seat locks. The helper rechecks effective permission while the current profile is stable. Direct private helper access remains denied to anonymous, authenticated and service roles.

Production preflight captures: helper body MD5 `1f5ff6ca087ccb437798f8011242b65d`, owner postgres, ACL `{postgres=X/postgres}`; booking reader MD5 `4c4ff17fee2130740905717d06f9a012`, owner postgres, ACL `{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}`. Migration refuses drift before replacement. No writer signature or business payload validation is replaced.

Read-only full current direct dependency review found 13 callers, all entering the helper before their data/resource/seat operation:

| Caller | Existing policy | Body MD5 |
| --- | --- | --- |
| booking_item_save | owner/admin | 554ac0c0578a71fe41de3667a24daf2e |
| booking_operator_list | owner/admin customer data; corrected locked role | 4c4ff17fee2130740905717d06f9a012 |
| booking_plan_history | owner/admin | c552c5fec72ce50929b0979e15ee9293 |
| booking_plan_preview | owner/admin | 3a6fee5d6e8c59b24c7ca5d17e059e3c |
| booking_plan_save | owner/admin | 4b52a05a4d17eb9e9c5c9779f7ca4063 |
| booking_settings_save | owner/admin | 71b451991c6820c95470cfb3a55d913b |
| booking_slot_save | owner/admin | 40ade015850834b0d76f14f1ac13372a |
| tickets_checkin | owner/admin | 5799de73c14abb97dffc6e33f45f2f9b |
| venue_plan_get | current valid workspace role | d181f1769fbd5505cb60892292df426f |
| venue_plan_list | current valid workspace role | 4deca160c7aa3f506552e473cd022a41 |
| venue_plan_publish | owner/admin | c7dfab7ebfc11bc788860118b019451c |
| venue_plan_save | owner/admin | 96364b284f927a67e082b04c304c629f |
| venue_reference_capabilities | current valid workspace role | 9b411df7ebc5e393f2bb8be910699bd2 |

Exercised evidence is narrower than the dependency review. The isolated PostgreSQL runner uses the captured production foundation, original booking writer/schema and actual venue reference RPC. It checks role positives/refusals, owner fallback, forged owner, foreign workspace, exposed ACL drift, expired session, banned/deleted/anonymous accounts and real concurrent role/session revocation. No always-allow/deny authority helper is substituted. The other venue/ticket operational journeys remain separately unverified.

No production schema change, provider call, ticket check-in, public publication or inventory change was performed. Independent SQL review and the lead's production rollback/no-side-effect fixture precede deployment. Generic owner item/slot save lost-response receipts, customer booking authority outside these 13 callers and complete organizer operations remain separate follow-up requirements. This correction does not claim the entire booking or venue product accepted.

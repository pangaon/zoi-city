# Service operator authorization — 2026-09-30

## Observed production definitions

Read-only `pg_get_functiondef` inspection on project `csebihpaychdkanjjsmz` confirmed `20260930122305_menu_and_kds_operator_fences.sql` behavior is already live: `menu_item_save` and `kds_ticket_advance` require owner/admin/editor, lock current membership, and check the actual workspace chain. KDS writes enforce forward state transitions, same-state no-op, terminal protection and linked-event current ownership. Earlier reuse-map language describes original definitions and is stale for those two writers.

The current `table_tab_list` and `kds_tickets_list` still require only membership. That exposes private tab balances/member counts and kitchen order customer names/notes/items to viewers. Their current venue-workspace checks also omit linked-event ownership. A read-only grant inspection found no direct anon/authenticated table grants for menu_items, table_tabs, table_members, event_orders or event_order_items; the confirmed gap is the two privileged read RPCs.

## Candidate correction

`supabase/migrations/20260930194502_service_operator_read_authorization.sql` was generated with the Supabase CLI. It replaces only the two reads, preserving signatures and response shapes:

- Authenticated current owner/admin/editor membership, checked under a shared membership lock. Viewers receive insufficient_permission. Removed membership receives not_workspace_member.
- Existing table → venue → workspace chain stays authoritative.
- If the venue has an event ID, the event must still exist and be owned by that workspace. Deleted, detached-owner and transferred events are excluded.
- Workspace-owned venues without an event remain supported; no fake listing/event link is introduced.
- Existing KDS station filter and terminal-state exclusion remain unchanged.
- PUBLIC and anon execute grants revoked; authenticated/service_role execute retained with the same in-function actor checks.

No writes, stock, payments, event data or ownership changes are introduced by these functions. No new worker role, assigned-station permission model, online integration or guest ordering UI is claimed. The role policy is deliberately the same as the existing operator writers.

## Verification

`node tests/database/service-operator-reads.integration.mjs`: four groups passed against isolated real PostgreSQL16. Cases cover anonymous/viewer refusal; all three allowed roles; station filtering; foreign workspace with and without membership; changed/deleted event ownership; venue transfer; non-event compatibility; a concurrent role-revocation transaction; deleted membership; terminal queue filtering; execute ACL; and the exact rollback fixture.

`node tests/database/menu-kds-safety.integration.mjs`: eight existing writer groups passed unchanged. This verifies compatibility, not new write functionality.

`ops/verify-service-operator-reads.sql` uses the existing dedicated QA actor/workspace, asserts scope, creates synthetic private service rows inside one transaction, tests reads/role removal/orphaned event, and ends ROLLBACK. The local harness asserts all row counts and QA membership are restored. No production fixture execution or deployment has been performed by this specialist.

## Release and remaining scope

Root must independently review, include the exact migration and rollback fixture in the controlled backend manifest, deploy, then execute the rollback fixture and inspect production definitions. Until then this is a tested candidate, not a live fix. No browser UI changed, so no new visual journey evidence is claimed.

Catalogue creation still lacks immutable request recovery and version-CAS; public menu listing is workspace-scoped rather than event-publication-bound. KDS has no per-station staff assignment model. Existing studio simulation remains a demonstration and is not evidence of production event ordering. These remain separate work, not silently closed by the authorization patch.

# Shared table and host current-session authority

The real isolated writer journey found that the installed `zoi.table_inventory_actor()` checked only `auth.uid()` and profile resolution. An expired session could still rotate a guest invitation. The retained initial failure is not browser simulation or a missing UI capability.

The new draft migration `20261003094500_event_table_current_session.sql` reuses the existing `suite_current_session()` at entry and `suite_lock_session()` at successful operation boundaries. It rechecks the unchanged internal actor after domain waits. A failed final check rolls back all writes and request receipts in the same transaction. Historical nonce replies and cancellations receive the same current-session fence. Current role and listing-owner checks remain in the existing operator helper; its post-lock actor check is added without taking an early auth lock that would hide revocation during later domain waits.

The shared blast radius includes host allocation/save/claim/get/list/receipt/release/cancel, holds, owner inventory and table identity. Twenty definitions are replaced. Twenty-nine exact installed definitions are preflighted, including unchanged payment consumers, both session helpers and the host validity/pricing dependency. The guard also checks postgres ownership, SECURITY DEFINER, empty search path and the exact existing ACLs. Any drift refuses the whole transaction. No customer rows, parameters, prices, payload fingerprints, idempotency records or grants are changed by the migration itself.

`evidence/event-table-current-session-producer-2026-10-03/baseline-functions.json` retains all exact installed sources and hashes. `generate.py` reproduces the draft from those sources, checks its replacement anchors and records the replaced functions in `change-scope.json`. The source and ACLs are independently hydrated into an isolated PostgreSQL cluster for the test; this is not a production apply.

## Exercised evidence

The real integration test refuses source, ACL and search-path drift, verifies a transactional ROLLBACK leaves original definitions intact, then installs only in the isolated cluster. It checks expired, deleted, anonymous, banned, absent-session and signedout actors across private read/write/history surfaces.

Seven races first observe an actual `pg_stat_activity.wait_event_type = 'Lock'`: guest save versus session deletion; hold versus expiry; claim versus ban; owner configuration versus session deletion; identity receipt versus session deletion; guest save versus removed profile binding; and initial owner-role lock versus demotion. They assert unchanged guest/version/nonce, no hold or claim, unchanged price/version or refused private read as appropriate. The final cases verify actual authenticated execution, anonymous/private helper ACL denial, valid release/hold pricing, unchanged exact nonce retry/payload conflict and zero money rows.

The native-client SQL journey separately exercises actual whole-ticket assignment, claim, door preference, committed-response loss/remount, expiry and cancellation with this draft installed. The default legacy-schema native test remains capable of detecting the original gap; release evidence uses `PAREA_AUTHORITY_MIGRATION=1` without the diagnostic gap bypass.

## Release gate

No live schema write has been made by this lane. Root must obtain independent review, compare the current live 29-definition/permission preflight, apply the migration under the actual migration ledger, and retain post-install metadata and signedout ACL readback before deploying the native operation. Physical-device behaviour and organiser activation remain separate from SQL authority acceptance.

Run `PGPORT=15567 node tests/database/event-table-current-session.integration.mjs` and `PAREA_AUTHORITY_MIGRATION=1 PGPORT=15568 node tests/database/native-parea-journey.integration.mjs` in the frozen repository snapshot. The test owns only its temporary local PostgreSQL cluster. A reproduction manifest records source, test, evidence and shared dependency hashes.

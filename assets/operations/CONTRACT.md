# Operations interrupted-write recovery

Candidate only until its migration and web release are confirmed; native distribution is separate.

The existing `ops_records_list`/`ops_audit_list` reads and `ops_record_save`/`ops_record_archive` validators retain their contracts. Company saves and all archives require owner/admin. Contact/project/task saves permit owner/admin/editor. Existing parent-link validation, compare-and-swap versions and audit writes run inside the new wrapper's transaction.

- `ops_mutation_execute(p_workspace uuid,p_request uuid,p_action text,p_args jsonb)`: action `save` accepts only `p_kind,p_data,p_id,p_expected_version`; `archive` accepts only `p_id,p_expected_version`. Returns `{ok:true,state:'saved',workspace_id,request_id,action,record_id,kind,version}`. Ledger stores argument hash and opaque identifiers, not notes/contact values or full row snapshots.
- `ops_request_status(p_workspace uuid,p_request uuid,p_cancel_if_missing boolean=false)`: returns matching saved receipt, `{ok:true,state:'missing',workspace_id,request_id}`, or a durable `cancelled` receipt. A missing result alone never permits a replacement write.

Both functions authenticate and check current workspace writer membership. Saved receipts recheck company/archive role restrictions. Receipts belong to their original actor; another account cannot recover them. Execute and cancel serialize on the same actor/request advisory lock. Cancel inserts a tombstone only if no committed result exists; a delayed execute is then refused. New ledger entries, including cancellations, are bounded to 500 per actor per rolling 24 hours under an actor lock. Exact replays do not consume another entry. Private ledger access is revoked and RLS enabled.

The shared web/native recovery controller persists only actor, workspace, action and request UUID. Web uses session storage; native uses existing account-scoped PrivateRequestStore/SecureStore with a distinct workspace namespace. A write cannot dispatch until the saved marker is read back. Unknown results block new mutations. Exact payload retries exist only in memory. Remount, permission revocation and account changes discard private payloads while preserving the recovery reference. Check and Cancel work after reload. A saved receipt followed by a failed fresh read remains a saved result; current row data is read separately.

## Compatibility

The old write functions remain callable for existing clients and for creator SQL's internal project/task writes. This migration does not silently change their signatures or claim old clients gain duplicate protection. Current Operations web and native callers move to the new wrapper. Existing creator writes are protected by their own creator request wrapper. Deploy the Operations backend before the changed clients.

## Evidence

- `node tests/database/operations-recovery.integration.mjs`: isolated real PostgreSQL migration, duplicate-free create replay, update/archive versions, payload conflict, concurrent retry, cancellation race, actor isolation, current-role checks, ACLs and invalid request rollback.
- `node --test tests/unit/operations*.test.mjs`: shared controller tests including storage readback failure, scope change during readback, mismatched receipts, reload and uncertainty fences.
- `tests/browser/operations-recovery/verify.cjs`: actual web module mounted with controlled RPCs at 390px and 1440px; committed-but-lost create, remount receipt recovery, no duplicate dispatch, transient draft retention, revoked read clearing and delayed logout.

No production customer record is created by these tests. Native mounted Expo-web evidence and physical-device limitations are reported separately; Expo web is not iOS/Android distribution acceptance.

### Native mounted acceptance — 2026-10-01

The actual `OperationsPanel` was bundled with Expo web and a fixture-only Auth resolver (`mobile/.qa-operations`). Local runner `.qa-image/native-operations-recovery.cjs` passed at 390px and 1440px: committed-but-lost new company save, remount with nonce-only storage, matching receipt recovery with exactly one dispatch, transient read failure preserving an unsaved draft, authoritative denied read removing private editor/list data, and restored access refreshing the list. Both pages had zero page errors; the runner denied outbound requests and closed its browser/server. These controlled RPCs are separate from the 11 real PostgreSQL transaction checks. No physical iOS/Android installation or production authenticated mutation was exercised.

Final native typecheck passed; the full native suite passed 197 tests. The tracked web runner also holds the dynamic recovery import across an account change and verifies that the stale mount cannot replace the next surface, at both widths. Entry import cache versions use `20261001-ops-recovery`; root integrates the suite script entry version.

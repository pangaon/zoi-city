# Event table inventory production SQL acceptance

Release `136f5c4a2c7137332ae6c9299bb5883eeb33e412`, CI run `36721808560`, backend job `109908680885`: succeeded.

Only the requested two migrations were included in this release manifest:

- Source `20260930125216_versioned_event_table_holds.sql`; live ledger version **20260930132820**, name `versioned_event_table_holds`.
- Source `20260930130840_event_table_configuration_receipt.sql`; live ledger version **20260930132822**, name `event_table_configuration_receipt`.

The first rollback fixture failed at `table_map_failed`, before any hold was created. Production’s existing listing publication trigger correctly demoted the synthetic event because the original fixture omitted its category. Read-only inspection confirmed the guard; all table settings/inventory/holds/config receipts and test listings remained zero. No backend guard was weakened.

Both fixtures were corrected to use the existing category **6 / events-entertainment**, guarded by exact ID+slug, and explicitly assert that their new uncommitted QA event remains published/clean/visible and belongs to the dedicated QA workspace. The isolated runner now models this category publication boundary; all 16 groups passed before corrected production execution.

Executed each corrected fixture once, with dedicated QA identity and BEGIN/ROLLBACK:

- `ops/verify-event-table-holds.sql`: `event_table_hold_rollback_checks_passed`.
- `ops/verify-event-table-configuration-receipt.sql`: `event_table_configuration_receipt_rollback_checks_passed`.

Covered configure/exact retry, public availability, hold/retry/current recovery, release/terminal retry, private ledger grants, nonce-only config recovery, unknown-request handling and viewer-role denial. After both transactions: **0 settings, 0 inventory rows, 0 holds, 0 config receipts, 0 QA listings**; QA workspace role remains **owner**. No Signature inventory was seeded, no payment or ordinary customer transaction occurred.

This is production SQL acceptance under scoped QA claims, not a claim of a real organiser-signed-in browser transaction or payment completion.

Corrected file SHA-256:

- Holds fixture: `bb46018f863f4f7aec7fc1f8705fa0d5ee328bef2f3440a18c68fb13fb944d1b`.
- Receipt fixture: `cf7dc1c38349558183214e686914168ea9e5cc8ded28ff6c2690f66f63975780`.
- PostgreSQL runner: `48bea14b58ba80bd688bd90d7726713b8dfb925334bf2481b390370583d1206e`.

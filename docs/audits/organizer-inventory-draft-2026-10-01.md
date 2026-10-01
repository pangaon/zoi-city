# Organizer inventory draft preservation

Local candidate, 1 October 2026. No production writes, messages, reservations or provider activity.

## Reproduced defect

Mounted actual `table-inventory-operator.mjs` with controlled server responses. Changed the configured price from 275 to 300 and event start from 22:00 to 21:00, then clicked Set up table identities. Both silently reverted to 275/22:00 because the parent rebuilt its form from the original snapshot. Reproduction: `/tmp/zoi-inventory-draft-repro.cjs`.

## Correction

Keep an in-memory raw form draft across identity panel toggles and successful child identity saves. Raw strings preserve incomplete invalid entries for correction. Refresh the authoritative identity inventory after setup and retain only surviving draft row IDs; new identities start from their saved inventory state and do not inherit another table's price. Any rebuilt form invalidates the earlier price preview. Explicit Reload saved settings restores the authoritative form. Account changes and teardown clear the draft; no additional business values enter browser storage.

## Evidence

17 existing inventory/identity unit tests pass. Actual module browser test passes at 390 and 1440 with real Tickets/theme/component styles: changed start/price survive toggle and child-save refresh, earlier review disappears, added table remains unselected/unpriced, invalid price text survives, explicit reload restores original values, account switch clears fields. No page errors observed. Phone screenshot visually inspected. Files: `tests/browser/table-inventory-draft/verify.cjs`; screenshots `/tmp/table-inventory-draft-{390,1440}.png`.

The fixture uses controlled local RPCs and does not establish real organizer configuration or production persistence. Shared Tickets import cache tag must be advanced with release. Existing broader room, parea, payments, sponsor approval and native requirements remain open.

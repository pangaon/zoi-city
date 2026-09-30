# Table inventory owner journey — candidate

The real organiser entry is `/tickets/`: each event card has **Table inventory**, opening the existing dashboard dialog. `/apps/tickets-studio/` redirects and is not the integration target. The venue drawing studio remains unchanged.

Only current workspace owners and administrators can load/configure table inventory. Existing table UUIDs and layout capacities come from `table_inventory_operator`; the editor never creates tables from a picture. Select one or several existing tables, map an explicit source label, enter capacity/minimum party/per-guest price/currency, confirm all taxes and fees are included, enter a timestamp with its UTC offset, review, then save. Currency, prices, fees and enabling have no inferred defaults. Previously saved values are shown as saved facts. Enable remains subject to published event eligibility and the backend's incompatible ticket/seat inventory fence. No Signature inventory is seeded.

The editor invokes the original `table_inventory_configure` with an immutable snapshot, current version and stable nonce. Only a verified receipt is a successful save. Connection loss preserves exact in-memory retry arguments and a sessionStorage actor/workspace/event/nonce/version marker; table prices are not persisted on the device. Reload checks the new private `table_inventory_configure_receipt(p_workspace,p_event,p_request)` RPC. It rechecks current owner/admin membership and current event ownership, serializes with the same request lock, and returns `{ok,found,receipt?}` without configuration payload. A missing receipt remains unresolved rather than authorizing a new request. Definitive initial version-conflict responses clear the rejected nonce and require reload. An unresolved request with no completed receipt after a browser restart remains a conservative support/recovery limitation; no replacement request is silently invented.

Account changes immediately clear the form. Async results are fenced by actor identity; modal close/workspace switch/sign-out disposes listeners and private in-memory drafts. The dashboard uses its existing authenticated RPC transport and captured token. Native does not yet have this operator editor; existing app builds do not gain native table-inventory parity from this web change.

## Evidence

- `node --test tests/unit/table-inventory-operator.test.mjs`: 11 focused tests, including exact retry, malformed/missing receipt, account switch, blocked storage, conflict reload and actual dashboard integration.
- `node tests/database/event-table-holds.integration.mjs`: 16 passing groups: original 14 independently reviewed groups plus actor/event/workspace-scoped configuration receipt and exact production rollback fixture.
- `ops/verify-event-table-configuration-receipt.sql`: dedicated QA identity only, BEGIN/ROLLBACK; no retained inventory, holds or customer data.
- Independent browser acceptance is tracked separately; the private synthetic fixture `.qa-image/table-inventory-owner.html` is not production inventory.

This completes a candidate owner settings journey and temporary exclusive-table hold foundation. It does not implement per-chair shared table sales, group invitations, split payments, paid tickets, event drinks service or a confirmed reservation.

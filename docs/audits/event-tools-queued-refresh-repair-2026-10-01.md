# Event tools queued refresh transport correction — 2026-10-01

Parent explicitly reassigned narrow menu/payment runtime ownership to the independent reviewer after reproduction. Therefore this document records implementation evidence; the parent must independently accept the correction. SQL, the payment client receipt contract, paused setup and KDS were not changed.

## Reproduced with actual Core

`tests/browser/event-queued-scope/verify.cjs` loads the actual released Core and actual tool modules. A near-expiry session has a valid actor/session identity; the actual refresh HTTP response is held. At 390/1440, menu sent the old private read after the same actor changed workspace or its surface detached; payment-policy sent after its handle was destroyed or root detached. Eight stale sends reproduced. Paused setup already prevented all four tested stale sends. Evidence `/tmp/event-queued-scope-baseline.json` and matching log. All responses were controlled; no live Auth, customer data or mutation.

## Correction

- `assets/events/service-menu.mjs` now explicitly awaits refresh, rechecks captured actor/workspace/connected lifecycle, refuses failed refresh as401, then sends with the existing token and checks again after response.
- `assets/tickets/event-payment-policy.mjs` uses a scoped transport adapter. It captures the lifecycle version and actor for every private call, checks connected/non-destroyed mount and current actor before/after refresh and after transport. Failed refresh refuses transmission. Workspace/event are immutable mount arguments; changing the host workspace destroys/remounts the payment controller.
- `assets/events/event-service-configuration.mjs` unchanged: `e0074fd44cdef98e64b2feb885143444d574cc1ec31502c789c883f2aeec708e`.

No request is automatically retried. Existing pending markers survive uncertain outcomes and retain their exact original scope/nonce. No claim is made that an already-transmitted server write can be cancelled by navigating away.

## Regression evidence

The new actual-Core browser harness expands to30 cases: read/write scope transitions and valid same-actor refresh controls at390/1440. Existing service-menu component and actual Social shell pass at both widths; creation, editing/restoring availability, exact receipt/reload recovery and conflict behavior remain exercised. Existing deadline component and actual host module pass owner/guest set/clear/recovery/closed responses at both widths. Twelve payment-policy unit tests pass. Existing browser mocks gained only an explicit successful ensureFresh method to match the real transport contract.

Logs: `/tmp/event-queued-scope-fixed.log`, `/tmp/service-menu-queued-regression.log`, `/tmp/service-menu-shell-queued-regression.log`, `/tmp/payment-queued-regression.log`. New evidence `/tmp/event-queued-scope-fixed.json`.

## Release boundary

Local controlled evidence only. No migration, provider call or guest activation occurred. Root must review the correction, apply cache integration, reconcile current live schemas and verify deployment separately. Menu/setup/deadline SQL acceptance remains distinct from these browser transport changes.

Frozen correction hashes:

- Menu runtime: `942007e9fd75a1bc8161ce707a40181052be052a9d2af68f977588f48eea9512`
- Payment mount runtime: `b003160dddf6e97cf149d78dff48418e767ff164f946873e93c8b65c3c725d21`
- Actual-Core browser verifier: `a4cb4a7d33834c2448fb5e0a4da5ec2457932e38357d1a757154c5fc912c3825`

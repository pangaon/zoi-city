# Independent paused event-service setup review

Review in progress 2026-10-01. No production configuration, guest orders, payments or messages.

## Independently checked backend

SQL candidate 0ff15b9982642e3945674cb728621c06ab6e7514376ef0c2275607d37632e477 is additive and depends on reviewed current workspace/session authority and menu revision/receipt helpers. Authorization locks current workspace/member, owned event and scoped venue before mutation; current session is rechecked after waits. Tables must belong to the venue; items must belong to workspace and match reviewed revision, availability, CAD and valid station/price. Per-actor receipts plus per-venue first-create lock and expected revision prevent duplicate application. Replay and cancellation require current authority and exact scope. Direct private table privileges are denied with RLS enabled.

13 isolated PostgreSQL groups independently passed, /tmp/event-service-setup-pg-independent.log, including different-actor first-create CAS, same-actor retries/cancellation, authority/session denial, explicit empty selections, expiry during advisory wait and cursor pagination. The configuration has no activation field. Legacy event ordering gate remains untouched. Initial quantities are saved setup values, not an operational stock ledger.

## Independently exercised candidate UI

Actual component/suite registration and actual Social shell390/1440 passed: real selected event/venue/table IDs, paused save, lost response/remount recovery, cancellation, wrong-scope and generic denial clear, held account-switch response refusal. Logs /tmp/event-service-setup-browser-independent.log and /tmp/event-service-setup-shell-independent.log. Inspected phone screenshot /tmp/zoi-event-service-setup-390.png: fields/cards fit, explicit timezone offset/initial quantities/staff approval and paused-state notice are legible. Controlled APIs only; no live database application or physical-device behavior claimed.

## Review blocker sent implementation owner

Initial module39c353ca calls C.api.rpc with auth:require after a scope guard. Core can await token refresh before sending, allowing account change between guard/send. Requested explicit refresh then scope check and prefer transport, including false-refresh refusal and paused-refresh zero-send regression. Backend remains accepted locally; UI acceptance pending this correction. Existing baseline menu/lazy mount regression will be rechecked after final freeze.

## Product limits retained

No service activation, guest/cart acceptance, mixed-station order dispatch, stock ledger, KDS transition receipts or payment capability is supplied. Receipt capacity120/hour also applies unknown cancellation tombstones; capacity failure retains unknown pending status. Deployment requires root prerequisite/current-schema readback and integration.

## Final local acceptance

Corrected module e0074fd44cdef98e64b2feb885143444d574cc1ec31502c789c883f2aeec708e explicitly refreshes, rechecks scope, refuses false refresh, and sends with prefer before its post-response guard. Independently reran corrected component and actual Social shell390/1440 successfully. Added fixture checks verify paused-refresh account change sends zero RPCs and false-refresh sends zero RPCs. Logs /tmp/event-service-setup-final-independent.log and /tmp/event-service-setup-shell-final-independent.log. Independently reran existing menu baseline390/1440, including restore, exact lost-response recovery, CAS, refresh failure and scope/account fences: /tmp/event-service-menu-baseline-independent.log.

SQL0ff15b99 and lazy wrapper0c132367 unchanged. Accepted for paused configuration only; root owns prerequisite verification/application/release. No guest-service activation claim.

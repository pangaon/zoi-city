# Menu and kitchen status writer containment

Candidate only; no production application or customer transaction. Live `pg_get_functiondef` was read on 2026-09-30 for exactly `public.menu_item_save(uuid,uuid,text,text,integer,text,boolean)` and `public.kds_ticket_advance(uuid,uuid,text)`. Both admitted any workspace membership, including viewer. The kitchen writer accepted any supported status from any prior status.

## Narrow change

Migration `20260930122305_menu_and_kds_operator_fences.sql` preserves names, argument defaults, JSON return types and existing `ok`/`error` handling. Both require an authenticated user and current owner/admin/editor membership, locked through the transaction. No invented staff role or JWT-supplied role is trusted.

Menu updates lock the actual item and check its current workspace. Existing create behavior and CAD default remain unchanged. No price/currency migration or inventory activation is introduced.

Kitchen updates lock the order, table and venue, check venue workspace and, when linked to an event, the event listing's current owner workspace. Valid moves are received→preparing→ready→delivered, or cancellation from received/preparing/ready. Delivered/cancelled cannot reopen; same-state retry is a no-op without timestamp change. Unknown stored states fail closed. Cancellation changes fulfillment only; it does not refund money or reconcile the tab.

Public/anonymous execution is explicitly revoked. Authenticated/service-role execution retains the internal authenticated-user/current-membership requirement.

## Caller compatibility and limits

`apps/tickets-studio/index.html` functions `createRealMenuItem` and `advanceRealKds` use the unchanged signatures and handle `ok:false` by showing the returned error and reloading kitchen state. Its dropdown currently displays every status, so disallowed jumps now produce `invalid_transition`; a later real operator UI should display permitted actions instead. The surrounding studio contains demonstrator data and is not proof of a live service workflow.

There is still no create nonce or optimistic version on these legacy menu/KDS endpoints. A menu create retried after an uncertain result can duplicate the item; menu concurrent updates remain last-writer-wins. This containment does not claim to solve those limitations. A future `menu_item_save_once` should accept stable request UUID, expected version and exact payload, expose actor-scoped receipt recovery, and ship with its caller adapter. A future KDS versioned endpoint must pair expected state/version with request UUID and a matching reload/retry UI. No unused new RPC is added now.

Read endpoints (`menu_items_list`, `kds_tickets_list`, `table_tab_list`), direct-table privileges/policies, station assignment, service windows, paid processing and audit history are outside this two-function live review. Their security/readiness must not be inferred from these checks. Event-linked new orders remain separately disabled by the prior cash/order candidate until explicit service configuration exists; this migration does not enable them.

## Evidence

`node tests/database/menu-kds-safety.integration.mjs` passed eight groups in isolated PostgreSQL16, using existing table DDL from0027 and menu DDL from0034:

- anonymous and viewer writes denied without mutation;
- owner/admin/editor menu compatibility and cross-workspace item denial;
- sequential status changes, no-op replay and terminal protection;
- cancellation and unknown-state refusal;
- current venue and linked-event ownership checks;
- concurrent same-state advances serialize;
- committed role revocation wins the locked authorization check and anonymous execute is absent;
- exact `ops/verify-menu-kds-safety.sql` dedicated-QA fixture rolls back all menu/order/venue/table records and the temporary QA membership changes.

Fixtures use local synthetic records only. No current production menu, guest, order or venue was changed. Parent review and production execution of the reviewed rollback fixture remain required before release. The fixture pins the existing QA auth UUID, profile UUID and workspace UUID; it uses NULL-safe checks and modifies no ordinary business record.

Supabase function security guidance reviewed: https://supabase.com/docs/guides/database/functions . Markdown changelog retrieval through the web tool returned unsupported-content-type; no platform-specific new capability is assumed by this SQL-only containment.

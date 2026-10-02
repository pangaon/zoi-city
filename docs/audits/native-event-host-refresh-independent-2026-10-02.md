# Independent native host-link refresh review · 2026-10-02

Accepted the narrow native selected-event organizer read-transport correction for integration. No runtime changes, deployment, provider calls or customer writes were made by the reviewer.

## Source contract

`scopedEventHostRpc` allows only `zoi_me` and `table_inventory_operator`, captures the Auth actor and invokes the caller's mounted account/workspace fence before refresh, after actual SessionClient token refresh and after the response. Dispatch uses that captured refreshed token directly through `request`, avoiding a second asynchronous refresh between the scope check and send. Unsupported writer names fail before dispatch. Tickets supplies its account-keyed mounted component and current selected-workspace ref fence, and rechecks before opening the URL.

The canonical guest URL carries only a validated selected event UUID. Organizer proof requires exactly one selected-workspace membership with owner/admin authority, then exact event inventory proof. The URL carries only event/workspace UUIDs. Internal `zoi_me.profile.id` is validated as a profile ID rather than wrongly equated to the Auth actor. No first-workspace fallback or credential URL is added. Existing SessionClient and reservation writers are outside this delta and unchanged by it.

## Fresh independent execution

`node --test mobile/tests/eventHostLink.test.mjs mobile/tests/eventHostTransport.test.mjs mobile/tests/session.test.mjs` passed all 24 tests. Actual SessionClient controlled transport exercised renewed-token dispatch, held-refresh workspace change and changed returned actor with zero private sends, late-response refusal, invalid actor/guest/unsupported writer refusal and refresh failure. Membership duplicates/viewer/missing scope and wrong-event proofs also fail closed. Log: `/tmp/native-host-independent.log`.

`./mobile/node_modules/.bin/tsc --noEmit -p mobile/tsconfig.json` passed. Log: `/tmp/native-host-typecheck-independent.log`.

No new visual/browser or physical-device run was required or claimed for this transport-only correction. This does not establish native operator service-console entry, automatic app return, durable selected-event restart restoration, signed mobile distribution, production browser service activation or payment collection. Those capability gaps remain recorded in the specialist audit.

## Reviewed SHA-256

```text
7360239e040aa6fbca79f6fc494ab9927ff16fbec50bcbbf21140faf97610993  mobile/src/Tickets.tsx
232fd1711c28f3d7765cdddff17ecd2934ef35ff866b15b7197969fe12cef84e  mobile/src/eventHostLink.ts
d41c041eb125f4d13b6dc73c66575bf9c6895e6848f302be8685df8e23cba2c3  mobile/tests/eventHostTransport.test.mjs
```

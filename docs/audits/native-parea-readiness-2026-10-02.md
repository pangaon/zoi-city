# Native Parea readiness and private invitation handoff · 2026-10-02

## Source contract and behavior

The selected-event Tickets screen now contains a native Parea review. Existing read-only event_host_list and event_host_get provide current quantities, expiry, table price and currency. Actual retained host migration and contract return explicit payment_collected:false. The reader obtains the internal host profile from zoi_me; it does not equate that profile UUID with the Auth UUID. Every list/detail identity must match the selected event and current host profile. Invalid quantities, duplicate guests, over-allocation and wrong envelopes fail closed.

A recipient explicitly pastes an existing canonical HTTPS www.zoi.city/tickets/hosts/?event=UUID#claim=64hex link. Duplicate or extra context parameters, foreign hosts, wrong selected event and malformed tokens are refused before private RPC. Native authenticated preview checks event/table/quantity/current expiry/currency/no-payment/no-ticket envelope. Before browser opening it reads again and requires unchanged reviewed table, quantity, price, expiry and status. A changed result requires a new review.

Browser handoff carries the original private bearer capability only in its fragment; app access/refresh credentials never enter the URL. The browser signs in independently and authorizes again. Host handoff is event-scoped because the existing browser route has no allocation deep link; copy explicitly says to select the group there. Native performs no claim, editing, payment or delivery.

Private pasted text is masked, memory-only and cleared after handoff or failure. Event/account/workspace keys remount the component; unmount permanently retires queued callbacks. Existing scoped token-refresh transport checks current actor/scope before refresh, after refresh and after request. Empty refreshed token fails closed. Each explicit action is fenced while pending. Generic native organizer behavior is preserved.

## Evidence

- `node --test mobile/tests/eventHostLink.test.mjs mobile/tests/pareaHandoff.test.mjs`:11 pass, including exact source/profile/guest binding, malformed input, expiry, mixed quantities and refresh/response retirement.
- `mobile/node_modules/.bin/tsc --noEmit -p mobile/tsconfig.json`:pass.
- `EXPO_ORIGIN=http://localhost:8198 node tests/browser/native-parea/verify.cjs`:actual Expo Tickets/Auth/client/component390/1440 pass. Host8 quota→3accepted/2awaiting/3unassigned→revalidated event browser link; recipient2 tickets/current CAD250 allocation amount→keyboard exact bearer handoff; empty allocations; expired group has no host action; malformed local event causes zero proof RPC; wrong returned event and changed table prevent opening; held preview across actual Grow workspace navigation never opens later or restores private input.
- Existing `tests/browser/native-event-host/verify.cjs`:owner/viewer390/1440 all pass on same current Expo process.
- Screenshots /tmp/native-parea/{390,1440}-{preview,handoff}.png inspected: clear group quantities, masked private input, readable controls, no horizontal overflow. Normal vertical scrolling remains.
- Logs /tmp/native-parea-{units,tsc,browser,existing-host}.log. Existing8197 Expo process served stale CI-mode source with reload disabled; initial expected new component was absent. Isolated8198 --clear rebuilt exact current source and all final evidence uses8198. No production issue inferred from that fixture-server state.

## Limits / release

Latest100 host allocations is the existing reader boundary, not a complete cross-event wallet. Host payment status is not available in these readers; invitation acceptance never means paid/admitted. Browser retains current organizer-enabled payment choices; this packet changes no payment/service file or schema. It performs no DB mutation, live source update, external message or purchase. Physical iOS/Android device validation remains outstanding; Expo web verifies actual native components and scoped transport only. Lead owns packaging/deployment and configured organizer prerequisites.

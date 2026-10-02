# Native event and service handoff — 2026-10-02

## Implemented correction

The actual Tickets selected-event organiser action now uses `scopedEventHostRpc`. It checks the captured Auth actor and selected workspace before refresh, waits for the real SessionClient token refresh, checks again before private dispatch, and checks after the response. Only the two read-only access-proof RPCs are allowed. Tokens remain in memory and never enter handoff URLs or storage through this helper. Existing reservation writers and SessionClient are untouched.

The prior helper checked around `client.rpc`, which internally awaited refresh before sending; a workspace change during that wait could still send the old workspace's private access query. The new transport fixture holds the actual refresh response and proves zero private requests after workspace or actor change. The captured actor is an Auth identity; `zoi_me.profile.id` remains a separate internal profile identity and is not incorrectly compared with it.

## Journey scope

Guest selected-event handoff carries exactly the canonical event UUID to `/tickets/hosts/?event=...`. The pending shared web lifecycle adds an explicit admitted-table service button there; it requires a separate active browser account and verified admission. Native never invents admission, transfers credentials, places an order or records a payment merely by opening the page.

Organiser handoff verifies exactly the selected workspace (never first-workspace fallback), owner/admin membership and exact-event `table_inventory_operator` proof. It carries event and workspace UUIDs to the existing group-allocation tools. Viewer, missing/duplicate workspace and mismatched event proof fail closed. The native action honestly labels group/organiser web tools, not a connected native service console.

## Evidence

- `node --test mobile/tests/eventHostLink.test.mjs mobile/tests/eventHostTransport.test.mjs mobile/tests/session.test.mjs`: 24 tests pass, including actual SessionClient controlled transport, renewed credential, actor/workspace changes during held refresh, late read rejection, guest/invalid actor/unsupported writer refusal and refresh failure.
- `npx --prefix mobile tsc --noEmit -p mobile/tsconfig.json`: passes.
- Source integration inspected: Tickets callback uses the adapter; account-keyed event component plus selected-workspace ref fence remains intact. No new visual layout or browser/device run is claimed for this transport-only correction.

## Remaining capability and release gaps

- Native has no exact-event operator handoff into the Menu & bottles event-service sibling yet. Current organiser route opens group allocations/payment arrangements. Do not describe it as complete operator service access.
- Browser service remains a separately gated deployment/migration packet; local native link tests do not establish production service activation or online payment support.
- There is no automatic browser-to-app service return link in this flow. Returning manually to the running app preserves its selected event; process restart requires existing `zoi://tickets/<event UUID>` entry. No durable selected-event restoration or cross-app return was verified.
- `app.json` declares scheme `zoi`; EAS config has internal preview, simulator iOS and store channels. These are configuration evidence only. No physical iOS/Android test, current signed build, TestFlight/store distribution or universal-link association was verified in this task.

## Frozen files

- `mobile/src/Tickets.tsx`: 7360239e040aa6fbca79f6fc494ab9927ff16fbec50bcbbf21140faf97610993
- `mobile/src/eventHostLink.ts`: 232fd1711c28f3d7765cdddff17ecd2934ef35ff866b15b7197969fe12cef84e
- `mobile/tests/eventHostTransport.test.mjs`: d41c041eb125f4d13b6dc73c66575bf9c6895e6848f302be8685df8e23cba2c3

No staging, backend mutations, customer contact, transaction, device build or deployment performed.

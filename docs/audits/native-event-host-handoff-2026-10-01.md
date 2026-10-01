# Native selected-event group arrangements

Local candidate, 2026-10-01. No deployment, customer mutation, email or payment action performed. Reuses the existing browser host tools rather than claiming native payment/deadline controls.

## Behavior

`Tickets.tsx` now offers an event-specific guest handoff from the selected event. URL carries only the canonical event UUID. The generic Events landing handoff remains generic because no event is selected there.

The organizer action uses only Auth's currently selected workspace. It never selects a first workspace. On explicit click, `eventHostLink.ts` reads `zoi_me`, requires exactly one matching owner/admin membership, then reads `table_inventory_operator` for that same workspace and event. A scoped verified event result is required before opening the browser with both UUIDs. Server web tools still authenticate and authorize independently. Copy explicitly warns that browser sign-in may be needed; tokens are never transferred in URLs.

Account, event unmount and selected-workspace changes fence late responses. The selected event component's existing `current()` fence plus a current workspace ref guard both fresh authority reads and opening the link. Guest handoff needs no organizer membership. The separate web deadline candidate controls available arrangements and responses once the browser authenticates.

## Evidence

- Six unit cases: canonical guest path, exact selected workspace even with another membership first, viewer/missing/duplicate role rejection, no selection fallback, wrong event/operator rejection, delayed account/workspace fence.
- `mobile/node_modules/.bin/tsc --noEmit`: pass.
- `tests/browser/native-event-host/verify.cjs`: actual running Expo web app at390/1440, owner and viewer. Controlled network, not live API. Explicitly selects the second workspace, exercises guest URL, organizer role/ownership request and exact URL, denies viewer before inventory reader, and navigates away/changes workspace during held authority response without opening a link.
- `/tmp/native-event-host-390.png` inspected: approved logo, selected event, browser handoff labels and no horizontal overflow.
- Versioned [Expo57 reference](https://docs.expo.dev/versions/v57.0.0/) checked against installed57 dependency. No new platform package or router introduced.

## Limits

Expo web is not physical iOS/Android device evidence. Browser account may differ and must pass server checks again. This is a context-preserving browser handoff, not native replication of host/payment tools or a connected payment provider.

Identity review: retained `zoi_link_profile` resolves an internal profile by `auth_user_id`, so tests deliberately use distinct Auth and profile UUIDs. The exact `public.zoi_me` projection definition was not available in retained migrations. No unsupported equality of `me.profile.id` and Auth UID was introduced. Captured current Auth identity fences each await; the authenticated exact-workspace/event operator RPC supplies the final authority proof. Root will reconcile the precise projection when a bounded live definition read is available.

# Independent native member-start acceptance — 2026-10-02

Accepted local native source candidate. No backend probes, real customer writes or messages occurred. This is actual Expo-web plus isolated SessionClient evidence, not installed iOS/Android acceptance.

## Contract review

Assigned work uses the verified workspace team response's internal actor_profile_id, not the Auth UUID. Team/task roles must agree; each returned task must match the selected workspace and valid record shape. No-deadline tasks remain visible. The exact selected task ID opens the existing Operations editor and retains its CAS writer and durable request recovery. No new task store or duplicate completion writer was introduced.

The four private member/activity readers capture UUID actor/workspace and check lifecycle scope before token refresh, after refresh before dispatch, and after response. Parent current-scope references fence workspace replacement before unmount cleanup. Same-session rotation is allowed. Denial clears member/activity/task state without claiming to clear the shared authentication vault. Viewer editing is denied by the reused Operations role gate.

## Independent execution

- 25 focused tests passed using actual SessionClient token refresh and request behavior: actor/workspace/unmount retirement, held response rejection, valid rotation, internal-vs-Auth identity, ambiguous role/workspace/record rejection and wrong-scope zero dispatch. Log `/tmp/native-member-units-independent.log`.
- Actual Expo at localhost8197 passed 390/1440: select workspace → own assigned no-deadline task → completion → lost response → leave/reopen → recover receipt → return and refresh completed status. Exactly one mutation was asserted. Other-person assignment was absent; viewer had no Save; owner retained three-source activity; held read then workspace switch rendered no stale assignment; denied membership cleared work. Log `/tmp/native-member-browser-independent.log`.
- TypeScript check passed: `node mobile/node_modules/typescript/bin/tsc --noEmit -p mobile/tsconfig.json`, log `/tmp/native-member-ts-independent.log`.
- Phone list screenshot `/tmp/native-member-start-390.png` visually inspected: readable task/access copy and clear task action. Both widths and open-task/viewer screenshots captured by the retained producer harness.

## Frozen source

- `mobile/App.tsx`: `5e2d473133185fcce04e67d48859465a61e87d1bb9fe94577e54d7979f891cb0`
- `mobile/src/Priorities.tsx`: `4701a31883806d9d8c16422173ba7cbec99d343e02007fad0d2ab0755d20e098`
- `mobile/src/memberStart.ts`: `8696efcb1b2d4e9e2945958e610738a16f82bee1378d8adc8e3e9c8faa2f378f`

App changes only the existing Grow tool title/description. Operations/Auth/Session writers remain unchanged. Root owns exact-index full checks/export/release. Invitation acceptance still occurs on the website, followed by native sign-in/workspace selection; no automatic invitation deep link, credential transfer, signed binary delivery, provider capability or physical-device execution is claimed.

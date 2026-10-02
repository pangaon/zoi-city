# Native member start — local candidate, 2026-10-02

Existing Grow priorities now opens current personally assigned work, including tasks without deadlines. Membership comes from `workspace_team_get`; assignment uses its internal `actor_profile_id`, never the Auth user UUID. Team and task role must agree, every task must match the workspace and valid record shape. Owner/admin workspace activity remains available. Viewers can inspect tasks but the existing Operations role gate exposes no save action.

Opening a task passes its exact ID to the existing OperationsPanel. Existing CAS/receipt writer and SecureStore/sessionStorage recovery are unchanged. Returning refreshes assigned work; an explicit return confirmation explains unsaved form disposal and retained recovery references. No additional task store, invitation flow or SQL was created. The accepted invitation is still completed on the website; the user signs into the native app and selects their authorized workspace. This packet does not add an automatic invitation deep link or transfer web credentials.

All Overview/member/activity reads use actual SessionClient.token then captured actor/workspace/lifecycle checks before request dispatch and after response. Same-actor token rotation remains valid. Parent scope ref fences key replacement before child cleanup. Current denial clears private member/activity/task state; direct request deliberately does not globally clear the shared auth vault. Unmount destroys the React surface; no request result can restore it.

## Exercised evidence

- `node --test mobile/tests/memberStart.test.mjs`:25 tests. Actual SessionClient held refresh for all four readers across actor/workspace/unmount/valid rotation, held responses after retirement, malformed projection and wrong-workspace zero dispatch. Internal profile ID differs from Auth UUID.
- `node tests/browser/native-member-start/verify.cjs`: actual Expo React Native Web app on localhost8197 at390/1440 with controlled API persistence. Workspace selection→personally assigned no-deadline task→existing completion writer→lost response→leave/reopen→recover exact receipt→return/refresh shows completed. Exactly one mutation. Viewer exposes no save. Owners retain all three activity readers. Held read then workspace change cannot render old assignment; denied membership clears work.
- `node mobile/node_modules/typescript/bin/tsc --noEmit -p mobile/tsconfig.json`: passed on this candidate.
- Phone member list and opened task form screenshots visually inspected: `/tmp/native-member-start-390.png`, `/tmp/native-member-start-task-390.png`;1440 counterparts captured. Existing rounded44px actions and readable fields remain; no new decorative placeholders.

No production writes, migration, provider messages, signed binary distribution, physical-device run or native export is claimed. Actual auth/account-switch transport tests are isolated SessionClient tests, distinct from rendered workspace-switch/denial tests. Existing Operations full record editor and broad navigation remain reused. Volunteer packet untouched. Root owns integration/release; independent review pending.

## Frozen files

- `mobile/App.tsx` `5e2d473133185fcce04e67d48859465a61e87d1bb9fe94577e54d7979f891cb0`
- `mobile/src/Priorities.tsx` `4701a31883806d9d8c16422173ba7cbec99d343e02007fad0d2ab0755d20e098`
- `mobile/src/memberStart.ts` `8696efcb1b2d4e9e2945958e610738a16f82bee1378d8adc8e3e9c8faa2f378f`
- `mobile/tests/memberStart.test.mjs` `223eb37f16ce003f6c370a5d6e621afab2f0a41e485cb0b24c6db5963dcd138b`
- `tests/browser/native-member-start/verify.cjs` `d34c5cc4400771a563612d8f44c3dcf939864d54985783fdae9680332bdced6d`

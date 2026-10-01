# Native organization team candidate — 1 October 2026

Status: implementation and Expo-web fixture verified; independent review pending. No physical iOS/Android device test, native store build, distribution or production owner mutation performed.

## Integration

The actual AccountPanel offers “Manage organization team” only after its selected workspace belongs to the loaded authenticated workspace list. The native team panel uses the same `workspace_team_get/save/request` RPC contracts as web. Existing explicit browser handoffs to workspace Settings and business home editing remain.

Roster, role controls, protected owner/self, administrator peer restrictions, inline removal confirmation, loading/retry, current role, and unknown-save checking/cancellation are implemented in React Native. Account/workspace identity keys remount the panel; asynchronous operations check the current session/workspace before and after calls. Authority denial removes the private roster.

Only a request UUID is retained per account/workspace using the existing PrivateRequestStore with Expo SecureStore on native and sessionStorage on Expo web. No member names, invitation addresses or payload are persisted. Unknown outcomes block subsequent mutation, survive panel closure/remount, and recover through a receipt without replaying writes. Cancellation obtains a server tombstone. Storage failure before submit prevents mutation. Existing Sign out does not erase these nonce-only team references; they remain scoped to the same account for safe recovery after reauthentication.

The shared SessionClient change is narrowly scoped to exact team RPC paths: recognized HTTP200 conflict/cancellation outcomes reach the controller for workspace/request identity validation. Exact known team SQL rejection codes are preserved only for HTTP400 team-save/request; generic400, malformed outcome and network failure remain uncertain. Other publishing/API error envelopes continue throwing. This prevents quota rejection from leaving an avoidable uncertainty marker.

## Evidence

- Versioned Expo57 Crypto documentation checked for secure `randomUUID`, supported iOS/Android/Web.
- `node --test mobile/tests/workspaceTeam.test.mjs mobile/tests/workspaceTeamTransport.test.mjs mobile/tests/session.test.mjs`: 21 tests across controller, real SessionClient transport and existing authentication regressions. Includes quota clearing versus ambiguous400 retention and403 roster clearing through the actual transport.
- `./mobile/node_modules/.bin/tsc --noEmit -p mobile/tsconfig.json`: passed.
- Actual app `cd mobile && ./node_modules/.bin/expo start --web --port 8197`, then `node tests/browser/native-workspace-team/verify.cjs`: passed390/1440. The fixture uses actual AccountPanel, React Native team UI, SessionClient and private request storage adapter with controlled auth/RPC responses. Role save, lost-response remount/receipt recovery without resend, removal confirmation and signout passed. No horizontal overflow. These are controlled fixture writes, not production writes.
- `/tmp/native-team-390.png` visually inspected: readable role choices, stacked action buttons, inline removal confirmation, retained app navigation. Desktop screenshot `/tmp/native-team-1440.png` retained.
- Expo emitted existing `props.pointerEvents` deprecation warning; this task does not claim project-wide warning cleanup.

No invitation generation, email/SMS sending, ownership transfer, billing, or enterprise organization completeness is claimed.

## Frozen runtime hashes

- Account.tsx `b70007e5a6214c9fe33a2205c6b55cff060e8efcc4dcb764efc226b24ad74acf`
- WorkspaceTeam.tsx `492fceab63a979c450649da777000fbdb63adb9f9be74cf20143fc26c2106bd8`
- workspaceTeam.ts `a012df15ac8b1f71f3b87a7f2875b39461f8e5d64d8d46cef04ce6746c7639a4`
- session.ts `58238c9598e9980a049e93dcb400a48570dc4939464224ef5c223506aa4a06d6`

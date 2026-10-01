# Native organization team — independent review

1 October 2026. Accepted bounded source implementation and Expo-web integration; no App Store/Play Store build, physical iOS/Android execution, device keychain/keystore inspection or production membership mutation was performed.

Reviewed Account integration, React Native team panel, controller, actual SessionClient transport and reused PrivateRequestStore. Workspace selection is the shared Auth workspace ID. Panel/controller lifetime is keyed by account and workspace, checks current scope before/after asynchronous requests, drops roster on unmount and denies subsequent calls after scope loss. Owner/self/admin-peer controls remain constrained client-side and depend on the already-reviewed server authority. Successful role/remove responses are not acknowledged until a fresh roster is loaded.

Team request storage contains only the request UUID. Its namespace is account- and workspace-specific. Native adapter uses Expo SecureStore with WHEN_UNLOCKED_THIS_DEVICE_ONLY; web uses sessionStorage. Unknown results block new mutations, retain the nonce across panel remount, and recover by receipt rather than resending. Storage failure prevents submission. Authorization failure clears private roster. Actual encrypted storage behavior on physical devices is untested; code-level selection of SecureStore is not device acceptance.

SessionClient changes are narrowly scoped: only the team-save confirmed conflict/member-missing/cancellation envelopes bypass generic application-error handling, then controller checks exact workspace/request identity. Only exact known team SQL400 rejections are preserved for deterministic rejection handling. Generic400/network outcomes remain uncertain, and403 retains its denial status for roster clearing. Other RPC application errors still reject. No automatic mutation replay was added.

Independent checks:

- `node --test mobile/tests/workspaceTeam*.test.mjs mobile/tests/session.test.mjs`:21 passed, including real SessionClient-to-controller quota versus generic400 and403 behavior.
- `node --test mobile/tests/privateRequests.test.mjs`:10 passed, including account separation, chunked recovery, interrupted/corrupt storage, serialized cleanup and workflow namespaces.
- `./mobile/node_modules/.bin/tsc --noEmit -p mobile/tsconfig.json`: passed.
- Actual Expo app at localhost8197 through `tests/browser/native-workspace-team/verify.cjs`:390/1440 passed Account navigation, role write, lost response, remount and receipt without resend, removal confirmation and signout private clearing. Controlled RPC transport; no live customer updates. Log `/tmp/native-team-independent.log`.
- Directly inspected `/tmp/native-team-390.png`: readable radio choices, inline removal confirmation, no horizontal clipping. This is React Native rendered via Expo web, not an emulator or device screenshot.

Frozen SHA256:

- Account.tsx: `b70007e5a6214c9fe33a2205c6b55cff060e8efcc4dcb764efc226b24ad74acf`
- WorkspaceTeam.tsx: `492fceab63a979c450649da777000fbdb63adb9f9be74cf20143fc26c2106bd8`
- workspaceTeam.ts: `a012df15ac8b1f71f3b87a7f2875b39461f8e5d64d8d46cef04ce6746c7639a4`
- session.ts: `58238c9598e9980a049e93dcb400a48570dc4939464224ef5c223506aa4a06d6`

Existing broader gap observed: native header still uses the text zoi. wordmark rather than the user's approved Greek-Z/olive mark. Reported to lead as native branding parity work, not hidden by team acceptance. Invitations/delivery, ownership transfer, billing, full organization parity and physical-device acceptance remain open.

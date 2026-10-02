# Native Youth rendered acceptance

These tests compile the actual React Native `Youth`, `AuthProvider`, `SessionClient` and `PrivateRequestStore` through Expo web. `mobile/tests/fixtures/youth-entry.tsx` supplies only explicit account/workspace/unmount QA controls. It is not the shipped application entry and contains no credentials. RPC responses come from the isolated PostgreSQL fixture described by the web README, not fabricated success envelopes.

After initializing that fixture, start from `mobile/`:

```sh
CI=1 npx expo start --web --port 8198
```

Then, from repository root:

```sh
NODE_PATH="$PWD/node_modules" node tests/browser/native-youth-enrollment/verify.cjs
NODE_PATH="$PWD/node_modules" node tests/browser/native-youth-enrollment/public.cjs
NODE_PATH="$PWD/node_modules" node tests/browser/native-youth-enrollment/capability.cjs
NODE_PATH="$PWD/node_modules" node tests/browser/native-youth-enrollment/scope.cjs
```

Native unit/type checks, from `mobile/`:

```sh
node --test tests/youth.test.mjs tests/youthReadiness.test.mjs tests/youthRecovery.test.mjs
npx tsc --noEmit
```

Run lifecycle verifiers serially on each DB. At 390/1440, `verify` covers staff lost-reply publication/recovery, guardian lost-reply child creation/recovery, enrollment, approval, assigned instructor attendance, changed policy disabling attendance, guardian renewal restoring attendance, history and withdrawal. `public` verifies signed-out catalogue and terms with zero private calls; `capability` and `scope` cover malformed installation/account envelopes, retained nonce, zero writes and delayed response/account/workspace/unmount/denied access. All reject uncaught page errors. Override the literal fixture port only in an independent reviewer copy when using another Expo instance.

This is rendered native-component evidence. It does not claim a signed iOS/Android binary was installed, device contacts were read or physical-device secure storage/keyboard behavior was exercised.

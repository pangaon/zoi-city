# Native sponsor handoff

From this directory create a local `node_modules` symlink to `../../../mobile/node_modules` if absent, then run `../../../mobile/node_modules/.bin/expo export --platform web --output-dir /tmp/native-sponsor-dist`. From repository root run `node tests/browser/native-sponsor-handoff/verify.cjs`. Optional `EXPO_DIST`, `CHROMIUM_EXECUTABLE_PATH`, `QA_OUTPUT_DIR`.

The actual React Native handoff component is compiled with Expo57 and exercised at390/1440 with controlled Auth and read-only RPC contracts. The captured external browser URL is then exercised through the actual suite Festival wrapper, new receiver and frozen fulfillment module using the existing sponsorship fixture. Tests cover approved context, native role/status denial, held-refresh and held-read account/workspace/unmount, browser independent role/status/source checks, expired refresh and held-refresh/read account/workspace/replacement. No API or provider network is allowed. No iOS/Android installed binary was run.

Native SessionClient refresh behavior is independently exercised by `node --test mobile/tests/sponsorFulfillment.test.mjs`. The link contains only opaque IDs and a page offset; browser authentication is separate. The server binding migration from the fulfillment packet must pass its separate production gate before the combined feature is represented as active.

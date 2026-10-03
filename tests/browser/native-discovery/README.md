# Native Discovery candidate

These fixtures execute the real Expo application at 390 px (touch) and 1440 px. Supabase transports are intercepted with isolated, synthetic accounts and places; no customer data or production writes are used. MapLibre is the actual shared vendor SDK and the live attributed basemap loads from its existing provider. The cluster fixture observes the actual MapLibre instance through a test-only constructor wrapper, then taps rendered clusters and pins. This is browser execution of native application code, not physical iOS/Android SDK acceptance.

From the frozen snapshot root:

```sh
cd mobile
npm ci --ignore-scripts
./node_modules/.bin/tsc --noEmit
node --test tests/discovery.test.mjs tests/discoveryScope.test.mjs
node --test tests/*.test.mjs
CI=1 ./node_modules/.bin/expo start --web --port 8202 --clear --max-workers 2
```

In another terminal from the snapshot root (requires `playwright-core`, Chromium and network access for the existing basemap):

```sh
EXPO_ORIGIN=http://localhost:8202 node tests/browser/native-discovery/verify.cjs
EXPO_ORIGIN=http://localhost:8202 node tests/browser/native-discovery/privacy.cjs
EXPO_ORIGIN=http://localhost:8202 node tests/browser/native-discovery/clusters.cjs
PGPORT=15564 node tests/database/discovery-preferences.integration.mjs
```

The SQL fixture creates its own temporary PostgreSQL 16 cluster, installs the retained existing Community migration, tests the real writer and ACLs, and stops/deletes the cluster. It is independent of browser transport mocks. Override `PG_BIN` if necessary. Screenshots currently go to `/tmp/native-discovery-*.png`; reviewers should redirect their copied fixtures to distinct paths before independent runs.

Export all entry points from `mobile`:

```sh
CI=1 ./node_modules/.bin/expo export --platform ios --platform android --platform web --output-dir /tmp/zoi-discovery-review-export --max-workers 2
```

`verify.cjs` covers persisted private home, temporary city/country autocomplete without writing home, global search and result suggestions, fresh canonical place preview/profile return, actual street-pin touch selection, separate reviewed coordinate/address/name-only Maps handoffs, preference response loss followed by authoritative refresh without duplicate write, reload persistence, explicit null clears, failed search retry and obsolete search suppression. It asserts private bearer credentials are absent from public search.

`privacy.cjs` covers a held private home response across sign-out, a second account's home, failed and malformed home receipts, stale/denied selected-place reads, and incomplete paged map feeds that cannot expose precise markers until a complete retry succeeds. It uses no preference writes.

`clusters.cjs` covers map SDK failure/retry, actual two-place numeric cluster expansion using touch/mouse, individual exact pin selection after expansion, and zero signed-out private calls. Coarse and unmapped places are exercised in the other fixtures and remain available in lists.

The native OS branch compiles real `react-native-maps` 1.27.2 (Expo SDK 57's recommended version), groups real viewport positions without jitter, and bounds rendered clusters. iOS uses the default Apple provider; Android uses Google. Physical device gestures, accessible OS marker UI, binary configuration/signing, Android Maps key restrictions, actual destination provider acceptance and native sharing remain release gates. No provider navigation, device-location permission, offline tiles or missing street coordinates are invented. Existing native Home feed personalization is outside this Discovery candidate; interests continue to shape Community rather than secretly filtering search. City autocomplete suggestions are bounded to the published city RPC's first 100 rows, with manual any-city/country entry always available.

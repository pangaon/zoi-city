# Held source identity: retained source, canonical and native journeys

Run from the frozen snapshot root. Inputs are retained anonymous reads, not invented profiles: `home_entity` in the independent fresh14 directory and `seo_entity` in the producer `native-source` directory. Replay does not make live writes. Browser transport serves those exact retained bodies; Native Discovery rows are explicitly composed fixtures. This is candidate rendering, not deployed acceptance.

```sh
node --test tests/unit/source-identity-content.test.mjs tests/unit/source-health.test.mjs tests/unit/owner-entity.test.mjs tests/unit/owner-home-content.test.mjs tests/unit/public-owner-media.test.mjs tests/unit/official-source-policy.test.mjs
IDENTITY_EVIDENCE=/tmp/identity-canonical NODE_PATH=/path/to/repository/node_modules node tests/browser/source-identity-content/verify.cjs
QA_OUTPUT_DIR=/tmp/identity-owner NODE_PATH=/path/to/repository/node_modules node tests/browser/source-health-owner/verify.cjs
```

Run mobile checks from `mobile` with its existing installed dependencies:

```sh
node --test tests/*.test.mjs
npx tsc --noEmit
CI=1 npx expo export --platform all --output-dir /tmp/identity-platforms --max-workers 2 --source-maps
CI=1 npx expo start --web --port 8230 --max-workers 2
```

Then from snapshot root:

```sh
EXPO_ORIGIN=http://localhost:8230 IDENTITY_NATIVE_EVIDENCE=/tmp/identity-native NODE_PATH=/path/to/repository/node_modules node tests/browser/source-identity-content/native.cjs
```

Do not rerun `capture-native-input.mjs` for fixture reproduction: that script is a separate fresh anonymous source capture. Browser artifacts separate all 14 actual records at 390/1440 from owner/family synthetic negative units. The browser harness waits for actual native Reveal ancestors to finish before capturing visible screenshots; it does not override CSS or motion.

The broader current-workspace `tests/unit/*.test.mjs` run failed 14 tests; its log is retained separately. Lead owns independent clean baseline comparison and subsequent fixture/integration repair. No assertion is removed here. Physical native, OS provider behavior and deployed acceptance remain separate gates.

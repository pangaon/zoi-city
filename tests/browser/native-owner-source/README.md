# Native owner website/source review

Run from the isolated frozen snapshot root. The browser test exercises the actual compiled Expo App. Its private owner transport is explicitly synthetic, using actual retained anonymous Café Boulis fields for identity/source context. It is not a production authenticated customer edit. Existing installed function definitions are captured read-only separately.

```sh
cd mobile
node --test tests/businessOwner.test.mjs
node --test tests/*.test.mjs
npx tsc --noEmit
CI=1 npx expo export --platform all --output-dir /tmp/native-owner-exports --max-workers 2 --source-maps
CI=1 npx expo start --web --port 8232 --max-workers 2
```

From snapshot root in another terminal:

```sh
EXPO_ORIGIN=http://localhost:8232 OWNER_SOURCE_EVIDENCE=/tmp/native-owner-browser NODE_PATH=/path/to/repository/node_modules node tests/browser/native-owner-source/verify.cjs
PGPORT=15672 node tests/database/native-owner-source.integration.mjs
```

The PG script creates a separate temporary local database and replays exact retained installed SQL definitions/ACLs. It performs no network calls or production mutations. It exercises save/receipt/reopen/public owner choice, explicit clears, source/menu preservation, role/ownership/CAS negatives and concurrent writers. The expired old-receipt replay gap is retained explicitly, not counted as an authority pass. Native always performs fresh authorized reads before and after publication.

No contacts, draft body or token are persisted by new recovery storage. Only account/workspace/listing/request/version references are stored. Same mounted uncertain save retries its original immutable memory payload. After remount the owner must review fresh saved records before clearing the reference: there is no existing receipt lookup/cancel API, so a fresh read is never called an exact save confirmation.

Physical devices, store distribution, live authorized customer edit/public readback and inherited backend strict-session correction remain separate gates.

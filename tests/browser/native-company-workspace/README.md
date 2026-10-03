# Company suite verification

Run from the isolated candidate repository root. These fixtures mount the actual
Social Operations/Documents modules and the actual native App and panels. All
Supabase requests are intercepted; the browser fixtures cannot write live data.
Database fixtures use PostgreSQL 16 on local Unix sockets and apply actual
retained migrations independently of the synthetic browser responses.

```sh
node --test tests/unit/company-workspace.test.mjs tests/unit/company-journey.test.mjs
node tests/database/operations-recovery.integration.mjs
node tests/database/documents.integration.mjs
node tests/browser/company-workspace/verify.cjs
node tests/browser/company-workspace/ownership.cjs
```

The database fixture ports are 15529 and 15482. They clean up their own temporary
clusters; run the two commands sequentially if those ports are already in use.
Existing installed `node_modules` dependencies can be symlinked into a frozen
snapshot. From its `mobile` directory:

```sh
./node_modules/.bin/tsc --noEmit
node --test tests/*.test.mjs
CI=1 ./node_modules/.bin/expo start --web --port 8197 --clear --max-workers 2
```

With Metro running, from that snapshot's repository root:

```sh
EXPO_ORIGIN=http://localhost:8197 node tests/browser/native-company-workspace/verify.cjs
EXPO_ORIGIN=http://localhost:8197 node tests/browser/native-company-workspace/scope.cjs
EXPO_ORIGIN=http://localhost:8197 node tests/browser/native-company-workspace/documents.cjs
```

Set `EXPO_ORIGIN` to a separate port for independent review. Chromium defaults to
the existing local Playwright Chromium binary; `CHROMIUM_EXECUTABLE_PATH` overrides
it. The suite retains phone/desktop screenshots under `/tmp/company-*`,
`/tmp/organization-*` and `/tmp/native-company-*`; reviewers should redirect their
copies to a separate evidence directory. Inspect screenshots as well as results.

The exercised story is sparse Company → linked project → assigned first task →
lost mutation response/receipt recovery → private project documents → task and
project completion review. Tests also exercise explicit assignment clears,
owner/editor/viewer differences, account/workspace/unmount changes during waits,
removed projects, foreign document payloads, revoked downloads and confirmed
upload version retries. File bytes, MIME, attachment and `no-store` checks remain
active; fixture downloads supply the same exposed headers as the real edge writer.

This is local rendered and exercised evidence. It is not production backend
acceptance or physical iOS/Android device acceptance. Native private file picking,
temporary device storage, OS sharing and lifecycle cleanup still need device QA.
Native interrupted uploads retain the exact request ID while the panel is mounted;
the existing upload API does not provide a durable remount receipt lookup, and this
candidate does not claim that capability. Operations mutation recovery retains its
existing durable nonce-only marker. Company records do not submit legal filings.

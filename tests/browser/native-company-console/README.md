# Native Company console candidate

Use an isolated copy of the frozen snapshot. Link existing root and mobile
node_modules, then run:

```sh
node --test mobile/tests/companyConsole.test.mjs mobile/tests/companyHandover.test.mjs mobile/tests/companyWorkspace.test.mjs
cd mobile
./node_modules/.bin/tsc --noEmit
node --test tests/*.test.mjs
CI=1 ./node_modules/.bin/expo start --web --port 8213 --clear --max-workers 2
```

From the snapshot root, with a separate retained evidence directory:

```sh
EXPO_ORIGIN=http://localhost:8213 COMPANY_CONSOLE_EVIDENCE=/tmp/independent-company-console node tests/browser/native-company-console/verify.cjs
EXPO_ORIGIN=http://localhost:8213 node tests/browser/native-company-workspace/verify.cjs
EXPO_ORIGIN=http://localhost:8213 node tests/browser/native-company-workspace/scope.cjs
EXPO_ORIGIN=http://localhost:8213 node tests/browser/native-company-workspace/documents.cjs
```

These tests exercise the actual compiled Expo App and existing panels with
controlled Supabase responses. They do not write live customer records. The new
fixture covers both 390 and 1440 pixels, all shared work filters, assignees,
linked-company isolation, fresh reviewed handover, optional authorized document
metadata (the existing API returns at most 300 recent workspace rows), explicit nulls and exact versions, sparse companies, viewers, rejected
reads, malformed scope and held responses after account/workspace/unmount changes.
The existing fixtures additionally cover actual writer/CAS/nonce recovery and
project upload version retry, download refusal and permission clearing.

The native share adapter's installed IO boundary is injected in focused tests:
availability, OS share failure, current-scope checks around waits, fresh source
comparison, exact JSON scope, and temporary file cleanup. This is neither an
actual physical device share nor proof of receiving-app delivery. Platform
bundles compile the real Expo file/sharing implementation; physical iOS/Android
and distribution acceptance remain separate.

```sh
cd mobile
CI=1 ./node_modules/.bin/expo export --platform all --source-maps --output-dir /tmp/independent-company-console-export --max-workers 2
```

The browser's CDN cache suffix remains byte-identical. Metro recognizes only the
exact company-console-model → company-journey versioned relative edge. Unknown
versions, parameters, packages, parent traversal and node_modules origins are
passed through unchanged. Focused tests exercise that boundary.

No contact data is placed in AsyncStorage, credentials, telemetry or the durable
Operations recovery marker. A handover is explicitly user-requested; it does not
contain document contents, submit a filing, or perform any money or provider
write. Downloaded/shared copies are under the recipient's control. The separate
Company SQL current-session proposal is not applied by this frontend candidate.

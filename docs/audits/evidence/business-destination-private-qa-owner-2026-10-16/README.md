# Dedicated private owner destination QA (disabled)

This packet adds a request-fenced, copy-only QA harness and root-only operator SQL. It does not install schema, change a product file, provision Auth, prepare the hosted fixture or execute a hosted journey. The accepted private-product and destination packets are read-only prerequisites.

## Local verification

From the packet tree:

```sh
node --test tests/unit/business-destination-private-qa.test.mjs
PRIVATE_QA_TREE="$PWD" OUTPUT_DIR=/absolute/distinct/output ZOI_STUDIO_RASTER_EVIDENCE=/absolute/distinct/output PGPORT=15958 node docs/audits/evidence/business-destination-private-qa-owner-2026-10-16/controlled-pg.mjs
```

Use an unused local PG port and distinct persistent output. PostgreSQL16, Node24, Chromium1243, and openssl already exist in the workspace. No package installation is needed. The runner starts and finally stops/removes its own Unix-socket-only disposable PostgreSQL cluster and local Chrome. It reuses the accepted private-product fixture without editing it.

The controlled browser uses the real social shell and new CDP orchestration against real isolated canonical source/draft/destination/recovery functions. Local TLS/proxy replaces production transport. Auth issuance/signatures, the shell identity/configuration and scoped post-list auxiliary read are controlled; the canonical private source, drafts, nonces, receipt recovery, stale refusal, deletion and archive execute in PostgreSQL. This is not hosted Auth or production proof. The fixture omits the actual listing triggers: the two operator scripts adapt only listing/full-row/content/field hashes and the production-trigger expectation to that local fixture. Their 37 function metadata guards, authority/locking/mutation/cleanup bodies remain unchanged. Actual trigger effects require root's hosted rollback rehearsal.

## Intended actual admission and root coordination

1. Obtain a distinct independent source review and protected source commit. Keep the request exactly `{"enabled":false}` until the root operator accepts the exact installed product dependencies, full function/trigger metadata, actual fixture state and currently served critical web module hashes.
2. Root supplies one request UUID and finite issued/expiry (maximum30minutes). Rehearse `prepare.sql` in a rollback transaction with exactly those operator settings. Any changed material source/profile/owner field, changed catalog pin, unknown trigger effect, public availability, existing post or unexpected receipt refuses. Do not weaken these guards or publish the fixture.
3. After the rollback gate, root may commit that exact prepare SQL, leaving the fixture draft/clean/hidden. Use its returned content version/baseline in the enabled request. Root alone creates the one request-only, single-parent public-main commit with all45 `CODE_FILES` and28 critical `WEB_FILES` hashes. No workflow dispatch or rerun is admitted.
4. The existing dedicated `withQaSession` identity opens the actual private getter and UI. The fenced browser allows only original create, destination prepare and same-post edit. The coordinator separately attempts one stale-version refusal. Both response-loss cases discard a real successful browser response and recover via the original canonical receipt; no result is fabricated. Browser-local Auth removal tests editor disposal only, not actual server revocation.
5. At the cleanup notice, root finds the current dedicated QA SID for that exact run interval. No token is printed or needed. While that session is live, root executes reviewed `restore.sql` in one transaction with the same request/times and that SID. The SQL locks the original nonces, receipt/post and exact snapshot, calls existing canonical `social_delete_post`, then archives the hidden fixture. Unknown or changed posts/source/authority refuse for root reconciliation.
6. The coordinator waits at most240seconds and24 read polls, using only the original recovery identities, then confirms all original histories are removed/cancelled and the anonymous public reader stays null. It does not delete anything. The existing session helper finally logs out. A synthetic-only, mode0600 local checkpoint binds request UUID/run ID/post UUID; live original destination receipts revalidate it. It is neither an authority source nor uploaded. An unknown checkpoint or missing canonical outcome stays cleanup-required.
7. Root independently verifies final fixture/catalog/history/post absence. Preserve append-only receipts. A successful browser exit alone is not cleanup proof. Hosted actual QA remains open until this admitted run and final root verification occur.

No uploads, assets, normal public posts, publication, sends, schedules, customer data, Management SQL in CI, new Auth issuer, content store or provider capability are added. Result/failure workflow artifacts contain fixed booleans/stages and synthetic identifiers only. External font requests and every non-allowlisted writer are fenced off.

## Retained local failures

Pre-freeze local runs caught operator lexical/NULL formatting, fixture proxy error handling, actual Calendar truncated-body selection and destination-context reload assumptions. The first completed UI run then exposed that the original creative recovery reader intentionally refuses a current post after it gains Community channels. The coordinator now retains the already verified initial timestamp, reconciles original destination receipts first, and reads original create history after removal. These were local authoring/rehearsal failures; no actual hosted attempts occurred. Selected failure logs are pinned as historical evidence, not green results.

The final mounted rehearsal preceded only the isolated run-bound checkpoint validation helper/main wiring and its added focused regression. The complete mounted source path `exercise` and browser/SQL journey are unchanged by that final checkpoint-only addition; all21 focused tests ran on the final source. Independent review can rerun the exact final tree.

# Repository and evidence workflow

The production website, source repository, local checkouts and private QA files
have different retention needs. A smaller checkout improves disk use and release
work; it does not establish capacity for thousands of concurrent visitors.

## Source and deployment

Keep the integration checkout plus at most three active specialist checkouts.
Agree on exact files before writing in the integration checkout. Use sparse
checkouts for an independent branch when isolation is necessary; do not copy the
whole repository or nest recovery checkouts inside it. Frozen source and review
receipts must survive retirement, but an entire merged checkout need not.

Use the committed lockfiles: `npm ci` at the root for browser tooling, and
`npm ci` in `mobile` for native tooling. Native postinstall patches run only in
that installation; never patch another checkout's shared dependency directory.
Shared read-only dependencies require an explicit owner and dependency record.
Browser probes should resolve the root's pinned `playwright-core` normally and
accept an explicit executable override. Existing probes with hardcoded old
checkout paths must be migrated and tested before those dependency targets retire.

`.gitignore` prevents new local caches/downloads from entering source control;
it does not remove already tracked files. `.vercelignore` excludes review, test,
operator and local build files while retaining web pages, assets, API functions
and their shared `supabase/functions` helpers. The build gate follows those
helpers transitively; an unrelated Edge entrypoint remains a backend-only change.
The [Vercel exclusion documentation](https://vercel.com/docs/deployments/vercel-ignore)
describes the separate deployment filter.

## Lean evidence, without deleting observations

Historical evidence has not been deleted by this hygiene change. Before removing
any old proof from the default branch:

1. Freeze an immutable historical commit containing the exact bytes and verify a
   manifest of original path, Git blob ID, SHA256, size, source commit and reviewer.
   Do not rewrite history. Do not make another complete checkout/archive copy.
2. Generate an explicit keep-set from current CI, scripts and native fixtures,
   including dynamic directory readers and JSON-manifest dependencies. Preserve
   the complete dependency closure. A literal-path search alone is insufficient.
3. Keep current product requirements, release requests, current audit summaries,
   manifests and required fixtures in the default branch. Replace retired audit
   links with pinned historical-commit links or a small archive index before
   removing their files. Verify link resolution and the full required checks.
4. Restore historical evidence by its exact commit/path and verify SHA256 when
   needed. A small manifest plus Git history is the first archive; separate object
   storage is optional and needs its own verified retention/access plan.

New screenshots or source captures should have one stored byte representation
per digest and separate owner/reviewer observation records. Preserve meaningful
failures and accepted journeys; avoid copying the same proof into every checkout.
Never move private session traces or credentials into public Git evidence.

`/docs/audits/*` deliberately routes to an uncached, no-index 404 through
`api/audit-evidence.js`. Historical review retrieval must not turn that denial
route into a public source-capture reader.

## Temporary outputs and checkout retirement

Write disposable test files to a unique temporary directory and remove only that
directory in `finally`. Write source work and evidence that must survive a restart
to an explicitly named persistent location outside the repository, then retain
only the reviewed source, necessary proofs and manifest. Avoid fixed shared output
names, root-level wheel/APK downloads, nested `.recovery` copies and whole-tree
backup duplication.

Before retiring a checkout, verify no live process, active reviewer or dependency
symlink still uses it. Reconcile all tracked changes and untracked/ignored owned
files against the accepted source/evidence manifest, preserving unique needed
bytes once. Keep branch/commit references and a retirement receipt; then remove
only the classified checkout. Do not remove the original shared workspace or a
shared dependency target based only on branch age.

After each protected merge, close the completed ownership slot and retire its
unneeded checkout once its review/source requirements are satisfied. Recurring
workflows are retained, disabled or retired from their actual schedule, admission
and owner contract; a workflow filename is not evidence that it is stale.

Traffic readiness remains a separate check: measure the deployed artifact's
request mix, error/latency percentiles, caching and database/worker limits before
making a concurrency claim. A few HTTP 200 responses establish availability only.

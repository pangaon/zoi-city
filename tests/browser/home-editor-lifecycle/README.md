# Isolated owner design lifecycle

Run from repository root after installing locked dependencies and Chromium:

```sh
npx --no-install playwright-core install chromium
node tests/browser/home-editor-lifecycle/verify-lifecycle.mjs
```

Requires PostgreSQL 16 binaries (default `/usr/lib/postgresql/16/bin`; override
`PG_BIN`) and a non-root OS user for `initdb`. Set `CHROMIUM_EXECUTABLE_PATH` to
use an existing Chromium executable.

The harness starts a temporary PostgreSQL cluster with a unique Unix socket and
TCP disabled, plus an ephemeral loopback HTTP bridge. Browser and database are
closed and temporary data removed in `finally`. No production session, listing,
write, email, provider action or remote fetch is allowed. No screenshots are saved.

It mounts the real home design editor for synthetic restaurant (1440px) and
creator (390px) records. Writes/reads execute the production design migration's
functions under the `authenticated` role and exact fixture actor. The real
`api/home-preview.js` handler receives those SQL results through an isolated
fetch adapter, retaining its receipt and inert-render checks. Public design
reads execute as `anon`; both production family renderers generate public HTML.
The resulting public HTML is also opened in a JavaScript-disabled browser page
for visible revision and width assertions.

Checks: private save cannot leak its headline before publication, private preview
contains the saved revision without publishing, explicit publish exposes exactly
version 2, a subsequent version-3 private save does not replace public version 2,
and another actor cannot read, preview or publish the home. Unexpected editor
browser errors fail the run.

Limits: the base listing schema and `seo_entity` projection are explicitly local
fixtures. The actual `home_entity` composition and home design functions come
verbatim from `20260930043408_owner_home_design_drafts_and_publication.sql`.
This does not test production canonical duplicate resolution, live JWT issuance,
PostgREST transport, CDN invalidation, customer ownership or provider integrations.
The HTTP bridge supplies identity only to this isolated cluster and is not an
authentication seam shipped with the application.

This specialized browser/database check runs explicitly; the ordinary dependency-light
`verify:local` job does not provision PostgreSQL or Chromium. It is named separately
from automatically discovered standalone `run.mjs` suites for that reason.

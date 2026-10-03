# Company operating journey candidate

The current Company summary did not show what work remained, and native project
files handed users to the website despite a working native document panel. This
candidate makes the same saved Company → project → task → completion model available
on web and native, and opens the existing private document tools inside the app.

The immutable candidate is `/tmp/zoi-company-frozen-jdolexjn`. Its manifest is
`docs/audits/evidence/company-journey-producer-2026-10-02/frozen-manifest.json`, SHA256
`a73e66a452cb52286a34f9d373bc7f7140f7af48c6a8b324b5fe7312c8c83c25`.
It contains 9 owned runtime files, 7 owned test/README files and baseline dependencies
for reproducing the actual Social modules and compiled native App. This report is
additional documentation, outside the frozen candidate. Root owns independent
review, entry/cache integration, deployment and real production acceptance.

## Implemented behavior

- Shared persisted progress shows completed tasks, blocked work, overdue deadlines
  and missing assignments. Empty companies lead toward a linked first project;
  empty projects lead toward a first task. Completed tasks lead toward reviewing
  project completion. A completed project with unfinished tasks remains visible.
  No status is automatically changed and documents are not treated as compulsory.
- Existing Operations writers and nonce-only mutation recovery remain in place.
  Member assignment uses internal workspace profile IDs, never inferred Auth IDs.
  Explicit assignment clears still send null and custom persisted form data survives.
- Web return navigation now handles the real case where a linked project was
  created while the address remained on the Company route. Returning restores
  the exact active Company instead of doing an ineffective same-route navigation.
- Native Company and project controls open `DocumentsPanel` in the app after a
  fresh authorized project read. Its project choice is locked to the exact active
  requested record. Upload/version/history/private download/archive/cleanup use
  the existing APIs, with no parallel document writer or external handoff.
- Private document RPCs recheck account and project/workspace around token refresh
  and response waits. Removed/foreign refreshed contexts clear old document views;
  denied access clears private records and presents a reload/sign-in explanation.
  Interrupted mounted uploads retain the same ID and immutable submitted payload.
- Phone controls stack without splitting project names into narrow columns. Web
  and native share the same completion logic and Zoi blue/rounded visual treatment.

## Separate evidence boundaries

**Source:** The implementation uses `ops_mutation_execute`, `ops_request_status`,
`documents_list`, `document_history`, `document_archive` and the existing private
document edge API. Actual SQL fixtures passed 11 Operations receipt checks and 15
document checks, including duplicate/concurrent writes, cancellation fencing,
editor/viewer restrictions, private storage RLS, version conflicts, archive and
cross-workspace rejection. Source baseline definitions are retained in the snapshot.

**Rendered:** Actual Social modules and the actual Metro-compiled native App were
inspected at 390 and 1440 widths. Phone project controls were corrected after
screenshot inspection. Representative completed Company and private version-history
screenshots are retained under the producer evidence directory. No horizontal page
overflow was found in the exercised Company views.

**Exercised:** Web and native complete sparse-company journeys passed at both widths:
company edit → linked first project → assigned first task → lost save response →
receipt recovery/remount → task completion → review project completion → explicit
assignment null-clear. Web also exercised project upload and second version, dirty
navigation, browser back/forward and viewer denial. Native additionally exercised
lost committed upload response/same-ID retry, second version, version history and
verified private attachment download. Company private-read wait tests passed 16
web cases and 6 native Company cases. Native document tests passed 18 adverse
cases covering account/workspace/unmount during waits, revoked role, removed or
foreign project context on initial read and refresh, and denied download.

Root unit checks passed 23; the full native suite passed 318 (including 46 focused
Company/Operations/document checks); native TypeScript passed. Retained logs and
`results.json` are under `docs/audits/evidence/company-journey-producer-2026-10-02`.
Reproduction commands and independent fixture ports are in
`tests/browser/native-company-workspace/README.md`.

## Actual limits and release gates

All browser API responses were intercepted, and SQL used isolated local PostgreSQL.
No live data was changed or deployed by this lane. Those results do not establish
production schema availability or production guest/owner acceptance.

This candidate preserves mounted native upload retry. The existing document API
does not expose durable upload receipt recovery after unmount/remount; that
capability was not invented or claimed. Physical iOS/Android file picking, temporary
storage, OS sharing and lifecycle cleanup require device acceptance. Company records
maintain team information; they do not file a legal registration. Recent Company
document counts describe returned records, rather than implying complete file totals.

Release must version the Social `assets/suite/operations.js` entry and retain its
dynamic Company module chain through `company-workspace.mjs` →
`company-journey.mjs?v=20261002-company-journey`. Native imports the pure shared model
without a browser URL query. Root should verify exact served assets, signed-in roles,
real authorized writer/readback and relevant sparse organization after promotion.

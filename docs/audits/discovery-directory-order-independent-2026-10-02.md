# Directory ordering independent review — 2026-10-02

Reviewer: Codex independent reviewer `/root/youth_review`. Release/application owner: root.

**PASS for the exact index candidate**, subject to the lead assessing the live index-construction lock and verifying the installed index and public reader after application. This reviewer made no production writes and did not apply the migration. The scoped result is a database ordering/performance correction; it is not acceptance of every discovery, enrichment, map, or authenticated user journey.

## Frozen source and actual authority

Reviewed candidate manifest SHA256 `d05077cce41ed07cf03e386b45e05dece8540cd231f3b409e30189d24d2123b0`. All six manifest entries were byte/hash checked before execution in a separate immutable copy and checked against the worktree again before this report. Retained manifest and exact source are in `evidence/discovery-directory-order-independent-2026-10-02/`.

Migration `20261002230128_discovery_directory_public_order_index.sql` SHA256 `7495339407ff369317f17a95e6874e8a3f2591b153d7b7787ca3e57a671d4c73` creates one partial expression index. Its five ordering keys and published/clean-or-cleared/not-hidden predicate match the captured current `public.dir_browse(text,text,integer,integer)` definition. It neither replaces the reader nor updates listing data or grants. Source preflight captured the actual production reader at 2026-10-02T23:01:22.932Z; its production EXPLAIN was read-only, without ANALYZE. That captured evidence is distinct from this reviewer's fresh local measurements.

The migration refuses changed function body MD5, changed function owner, changed exact ACL, and an already-existing index name before index construction. This review independently changed the actual function owner and proved refusal with no index or listing mutation, in addition to retained function-body/ACL drift and replay checks. Actual metadata after the successful index-only change retained the exact signature/defaults, postgres owner, SQL STABLE SECURITY DEFINER status, empty search_path, body and execute ACL (`postgres`, `anon`, `authenticated`, `service_role`). Public roles exercised the real definer reader while private-table access remained denied.

This is ordinary transactional CREATE INDEX. It may block listing writes during construction. The 5-second lock timeout and 30-second statement timeout bound waiting/execution; they do not establish that production load makes the operation harmless. A failed transaction leaves no accepted index. Lead retains application authority.

## Fresh database execution

Exact frozen producer integration: **11 groups passed**. Independently extended integration: **14 groups passed**, in a second fresh PostgreSQL 16 database. Both databases contained 20,003 rows, including 3,520-byte non-TOAST padding and a 2,048-byte profile payload. Both servers were stopped and temporary database files removed by the harness. There were no production database calls by this review lane.

All 78 before/after actual-function oracle calls retained every result projection and existing order: populated and sparse records across six families, Unicode, wildcard city terms, type filters, unmatched terms, defaults, nulls, negative/oversized bounds, limit/offset, hidden and moderation exclusions, and the empty-corpus array shape. A digest of every complete listing row stayed equal across migration. The extension separately exercised real adjacent function pages and proved first page plus second page equals the same first 60 results, without duplicated IDs on the fixture's determinate unique-name order.

Owner updates were exercised against the real retained reader: current display name, website, phone, brand logo, colors and tagline changes immediately changed projected output/order. Explicit NULL website and phone clears remained NULL, alongside the retained brand/display-name clear checks. Clearing the formerly top-ranked logo removed that listing from the first 60; a sparse cleared parish stayed visible until explicitly hidden. No cached publisher or brand value was introduced by this change.

## Actual query measurements and limits

No planner-forcing setting was used to require index selection. The expanded inner SELECT naturally used the exact index and removed the whole eligible result sort. The independent extension also measured actual `SELECT * FROM public.dir_browse(...)` Function Scan calls, including category projection, rather than attributing inner-select timings to the full RPC.

| Actual local function call | Execution ms | Shared reads | Returned rows |
| --- | ---: | ---: | ---: |
| Before, first 30, cold buffers | 82.042 | 20,077 | 30 |
| Before, first 30, warm buffers | 81.177 | 19,968 | 30 |
| After, first 30, cold buffers | 2.701 | 111 | 30 |
| After, first 30, warm buffers | 1.761 | 0 | 30 |
| After, second page, offset 30 | 1.966 | 30 | 30 |
| After, deep page, offset 12,000 | 74.151 | 12,042 | 30 |

The index was ready/valid and 868,352 bytes locally. “Cold” means PostgreSQL restarted with 32 MB shared buffers; the OS page cache was not evicted. These are controlled local observations, not production latency promises. The index does not make every city/type filter optimal, and deep OFFSET still scans substantial earlier rows. The existing reader has no ID tie-breaker: identical full sort-key ties remain unspecified, so this review does not claim deterministic pagination across tied names or concurrent listing edits.

This candidate changes no browser/API renderer. No rendered discovery or authenticated personalization acceptance is claimed here. After applying, verify exact installed index readiness/definition and unchanged reader metadata, exercise real public page 1/page 2 and a sparse scoped result, and inspect actual response errors/latency before claiming production capability.

## Narrow static-assets test correction

Reviewed corrected test SHA256 `95bccb23dd1dfcfbf6c2e1cbc66024c345fba850a4762ef17a97f7cad7b52141`. The change skips only the exact resolved `docs/audits/evidence` directory during HTML recursion. Captured publisher HTML refers to external publisher-local paths; it is not a Zoi application page. Existing application-page script/stylesheet validation remains intact.

Independent executions: exact corrected worktree test passed; a separate temporary fixture with retained publisher HTML and missing publisher vendor paths passed; actual product missing script failed; actual product missing stylesheet failed; a similarly named `docs/audits/evidence-like` folder was not excluded and its missing script failed. All five outcomes are retained in `static-assets/receipt.json` and individual logs. The actual rejected product cases establish that the scope did not become a general missing-asset bypass. Root retains the original full-suite failure and rerun evidence; this reviewer did not alter the test or suppress any product checks.

## Reproduction and evidence

`database.log` and `extended.log` retain the fresh results; `plans.json` and `extended-plans.json` retain raw EXPLAIN ANALYZE/BUFFERS output; `actual-function-metrics.json` is a compact extraction. `independent-extension.mjs` retains the exact independently exercised extension. For reproduction, copy the retained `frozen-source` tree into a new directory, place `independent-extension.mjs` at `tests/database/discovery-directory-order.independent.mjs` there, and run:

```sh
QA_DIRECTORY_ORDER_PGPORT=15749 QA_DIRECTORY_ORDER_EVIDENCE=/tmp/directory-original-plans.json node tests/database/discovery-directory-order.integration.mjs
QA_DIRECTORY_ORDER_PGPORT=15749 QA_DIRECTORY_ORDER_EVIDENCE=/tmp/directory-independent-plans.json node tests/database/discovery-directory-order.independent.mjs
```

Requires local PostgreSQL 16 binaries at `/usr/lib/postgresql/16/bin`. Independent evidence manifest hashes every retained artifact. No commits, live index application, runtime edits, customer writes or messages were made by this reviewer.

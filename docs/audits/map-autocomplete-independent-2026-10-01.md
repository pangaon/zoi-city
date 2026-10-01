# Map autocomplete and search scope independent review

Initial candidate map SHA256 `7063b66b4ce87f5ade8c1c6f5a676dd927d3a1846ed8b260042742e824b26136`, shared autocomplete `a100b8d4241468c116d7eb9d73ba212559a4f6b2be0c29c5b8fa081a3682aeff`. Review in progress; not accepted for a working production search claim.

Independent 51 unit cases passed across map search scope, discovery autocomplete, locality personalization, precision and preview. These establish query scope and privacy policies at code level, not live search operation.

Source findings sent to specialist:

- A chosen suggestion queued before directory readiness survived account, locality and category changes. Boot could later open the obsolete selection. Specialist is correcting explicit scope-change invalidation without clearing valid pending choices on generic refresh.
- Multiple enabled categories were filtered only after an unfiltered eight-row response, potentially hiding valid enabled-category results below the truncated disabled results. Specialist is reviewing bounded category-aware lookup.

Actual browser attempts using candidate HTML/shared module and real public APIs failed in both main selection and account-scope fixtures waiting for an Amara Hotel option. Network diagnostics establish the cause: explore_search returned HTTP 500, PostgreSQL 57014, canceling statement due to statement timeout. This affected scoped Amar/Limassol/Cyprus autocomplete and area-list requests. It is a demonstrated backend failure, not presumed transient network noise or a missing-listing claim. Evidence: /tmp/map-autocomplete-independent.log, /tmp/map-account-independent.log, /tmp/map-autocomplete-diagnostic.log. The diagnostic log records public request arguments and error responses only.

No private preference or customer mutations were made. Root and specialist were informed. Further source hashes and exercised browser results must be appended after corrections; existing unit success does not supersede the observed live failure.

## Controlled queued-selection correction acceptance

Map SHA256 `207ab2924a4da270dbe9c070d93b16a4c99caa78a47766ee55d763fc0d80437b`; shared autocomplete remains `a100b8d4241468c116d7eb9d73ba212559a4f6b2be0c29c5b8fa081a3682aeff`. Source now clears the queued slug on auth/storage, locality navigation, category toggles and All, while generic refresh preserves an intentional pending selection. The city shortcut explicitly discards previous city/country/region before its city query.

Independent controlled browser fixture `/tmp/map-queued-independent.cjs` ran four cases at390px using actual candidate HTML/shared module and map rendering, with controlled search and delayed-directory RPC responses. Unchanged queued selection opened Amara's selected-place card; account, area and category changes each cancelled it before directory release. Log `/tmp/map-queued-independent.log`. The log's unchanged-case label is inherited boilerplate; the assertion explicitly requires the selection to open. Screenshot `/tmp/map-queued-unchanged-independent.png` visually inspected: search/locality, map pin and selected-place controls are legible with no horizontal overflow visible.

This accepts the queued-selection correction. It is not real search/API acceptance: production statement timeout and multi-category truncation remain outstanding. No new live search probes were used for this controlled acceptance.

## Live query gate closure after reviewed locality migration

Parent applied the independently reviewed locality SQL and reported actual HTTP SIGNAT309ms200 / Amar167ms200. Reviewer inspected retained /tmp/map-autocomplete-after-locality.json:390touch,1440keyboard and390delayed-directory each recorded scoped Amar/Limassol/Cyprus calls, no page errors and an Amara selected-place card; Explore default navigation reached its canonical business URL. Parent ran actual public RPCs with only local candidate HTML/module routing, not RPC fixtures. The reviewer did not duplicate those live probes.

The observed57014 release gate is closed for these demonstrated journeys after migration; no zero-timeout or global-load guarantee is made. Combined with independent source/unit/cancellation checks, the scoped map candidate is accepted. Multiple-enabled-category truncation remains an explicit separate limitation, not solved by this locality plan.

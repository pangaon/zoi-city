# Legacy directory global ordering candidate — 2026-10-02

This separate unapplied candidate adds one narrow partial expression index. It preserves the installed directory function byte-for-byte and addresses the measured global-page timeout observed after the earlier visibility corrections.

## Actual production defect and diagnosis

`explore-production-post-geography-2026-10-02.md` retains the actual public API results: global dir_browse page 1 returned 500/SQL57014 after 3122 ms and again after 3161 ms; page 2 first returned 500 after 3116 ms and then succeeded in 1565 ms. Scoped business/event/parish reads succeeded. Neither those failures nor the earlier PRE home_stats timeout have been overwritten or reclassified as passes.

Production diagnosis was read-only: installed definition/ACL/index metadata plus EXPLAIN without ANALYZE. The global page plan places Limit30 above a Sort of 31851 estimated eligible rows, fed by a public-predicate bitmap heap scan and category hash join. The sort keys include profile.brand.logo presence, rating, completeness and name. No retained installed index supplies those complete keys in that order. This supports targeting the global sort; it does not claim a production execution-time measurement from EXPLAIN or attribute every latency source to that sort.

Installed dir_browse(text,text,integer,integer) MD5 is `e279764dcf6230973418c810c14732dd`. Owner postgres, existing postgres/anon/authenticated/service_role EXECUTE ACL and empty search path are retained. The exact projection is the existing live function, including current owner name/contact and profile brand values. The source snapshot includes all existing listing indexes and the expanded global SELECT plan.

## Candidate implementation

CLI-created migration `20261002230128_discovery_directory_public_order_index.sql` creates `zoi.listings_public_directory_order_idx` with precisely these existing keys:

1. rating IS NOT NULL descending
2. rating descending NULLS LAST
3. nullif(profile #>> '{brand,logo}', '') IS NOT NULL descending
4. completeness_score descending NULLS LAST
5. name ascending

The predicate is exactly published, moderation clean/cleared, marketplace not hidden (NULL remains visible). No function replacement, cached brand column, new tie breaker, or ACL change occurs. Owner logo writes/explicit clears immediately maintain the normal expression index; reads continue to project current profile data. All existing filters and function limit/offset/default semantics remain unchanged. Equal complete sort-key ties were already unspecified and remain so; adding an index cannot promise an identical accidental tie ordering to the former heap sort.

The migration refuses before creation if the exact installed function hash, owner, EXECUTE ACL, or new index-name prerequisite differs. It also refuses replay rather than silently replacing an object. Function hash includes argument/return definitions, language, volatility, security and search-path declarations. Index creation is an ordinary transactional CREATE INDEX with lock_timeout5s and statement_timeout30s. This bounds waiting/build time but can block writes during construction; the release lead must review current load/lock timing. This candidate has not run against production. No concurrent-build strategy or destructive index replacement is hidden in it.

## Isolated verification

Postgres16 suite passed 11 groups on 20003 records. Each populated record has 3520 bytes of plain heap padding and 2048 bytes of plain JSON profile payload. It reconstructs the exact installed reader and public roles, uses its full output as the baseline oracle for 78 cases, applies the candidate, and compares every resulting projection field/order. Cases cover populated/sparse/empty records, all six consumer types, raw country labels, Unicode and wildcard locality behavior, bounds/defaults and offset pagination. Fixture names are unique to make the existing final name sort determinate for those comparisons.

Negative source/body/grant/index-name changes refuse creation. Successful application preserves function bytes/metadata and the digest of all listing data. Public anon/authenticated/service_role reads remain possible without private table access. A cleared sparse parish remains visible while hidden/pending records remain excluded; missing brands/booleans retain the existing null/empty/false projections.

Owner name, contact and branding edits are exercised, including explicit empty logo/tagline/colors and display-name removal. With a logo, the owner record ranks first; after logo clear it moves outside the first60. Its post-edit indexed output matches the unchanged reader under a local forced sequential comparison. That one functional-oracle check forces an alternative scan; performance plans do not force a planner choice. Hiding immediately removes the record, and an empty corpus returns the original empty-array shape.

| Global page1 measured plan | Before | After |
| --- | --- | --- |
| PostgreSQL buffer-cold execution | 79.051 ms | 0.431 ms |
| Warm execution | 74.456 ms | 0.177 ms |
| Buffer-cold shared reads | 20001 | 34 |
| Warm shared reads | 19968 | 0 |
| Warm shared hits | 44 | 34 |

“Buffer-cold” means restarting the isolated server to empty PostgreSQL shared buffers, using shared_buffers32MB. OS page cache was not evicted. The large baseline corpus does not fit that buffer, so a warm second query still performs buffer reads. These are controlled local measurements rather than production SLAs. After plans naturally use the new ordering index and contain no Sort. Scoped business/event/parish plans are also retained; the sparse parish still takes 15.579 ms locally and this candidate does not promise every locality query is optimal. The local index was valid/ready and 868352 bytes (about848KiB), with no included large JSON/contact fields.

## Release evidence and ownership

Root owns independent review, re-run, deployment/application, and actual post-application global-page verification. This agent made no production writes, changed no frozen geography/legacy packet, and did not mark any client, map, or whole directory capability complete. Source evidence, local execution evidence and prior actual production failure evidence remain separate.

`evidence/discovery-directory-order-candidate/manifest-2026-10-02.json` freezes migration, suite, source snapshot, isolated plans, database log and this audit. The earlier two schema packets and both production verification packets remain unchanged.
